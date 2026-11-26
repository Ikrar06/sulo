import Foundation

// Tests for Sulo's pure Swift (pnpm ios:test): compiled with the sources they test into one macOS
// program, no simulator needed. The cases are the Android app's own (android/.../test/.../session),
// so both apps hold the same rules.

var failures = 0
var count = 0
func check(_ ok: Bool, _ name: String, file: String = #file, line: Int = #line) {
    count += 1
    if !ok {
        failures += 1
        print("GAGAL \(name) (baris \(line))")
    }
}

let base = "https://sikola-v2.unhas.ac.id"

// SikolaText
check(SikolaText.sesskey(#"<form><input type="hidden" name="sesskey" value="AbC123xyZ0"></form>"#) == "AbC123xyZ0", "sesskey from a hidden input")
check(SikolaText.sesskey(#"<input value="AbC123xyZ0" name="sesskey" type="hidden">"#) == "AbC123xyZ0", "sesskey with value first")
check(SikolaText.sesskey(#"<a href="https://sikola-v2.unhas.ac.id/login/logout.php?sesskey=Q1w2E3r4T5">Keluar</a>"#) == "Q1w2E3r4T5", "sesskey from a link")
check(SikolaText.sesskey(#"<form action="/login/index.php"><input name="password" type="password"></form>"#) == nil, "no sesskey on the login page")
check(SikolaText.sesskey(#"<input name="sesskey" value="short">"#) == nil, "too short is not a sesskey")

check(Sikola.isSignedInPage(URL(string: "\(base)/my/")), "signed in: /my/")
check(Sikola.isSignedInPage(URL(string: "\(base)/")), "signed in: /")
check(!Sikola.isSignedInPage(URL(string: "\(base)/login/index.php")), "login page is not signed in")
check(!Sikola.isSignedInPage(URL(string: "\(base)/login")), "/login is not signed in")
check(!Sikola.isSignedInPage(URL(string: "http://sikola-v2.unhas.ac.id/my/")), "http is not signed in")
check(!Sikola.isSignedInPage(URL(string: "https://neosia.unhas.ac.id/")), "another host is not signed in")
check(!Sikola.isSignedInPage(nil), "no URL is not signed in")

let now = Date()
let c = { (v: String, e: Date?) in SikolaText.SetCookie(name: "MoodleSession", value: v, expires: e) }
check(SikolaText.sessionCookie([], sent: "a") == .absent, "no Set-Cookie: absent")
check(SikolaText.sessionCookie([c("a", nil)], sent: "a") == .same, "same value: same")
check(SikolaText.sessionCookie([c("b", nil)], sent: "a") == .replaced("b"), "new value: replaced")
check(SikolaText.sessionCookie([c("deleted", nil)], sent: "a") == .cleared, "deleted: cleared")
check(SikolaText.sessionCookie([c("b", now.addingTimeInterval(-10))], sent: "a", now: now) == .cleared, "expiry in the past: cleared")
check(SikolaText.sessionCookie([SikolaText.SetCookie(name: "other", value: "x", expires: nil)], sent: "a") == .absent, "other cookie: absent")

// SikolaRequest
let f = ["core_session_time_remaining", "core_calendar_get_action_events_by_timesort"]
check(SikolaRequest.allowedFunctions(#"[{"index":0,"methodname":"core_session_time_remaining","args":{}}]"#) == ["core_session_time_remaining"], "allowlisted batch")
check(SikolaRequest.allowedFunctions(#"[{"index":0,"methodname":"core_user_update_users","args":{}}]"#) == nil, "a write is refused")
check(SikolaRequest.allowedFunctions("[]") == nil, "an empty batch is refused")
check(SikolaRequest.allowedFunctions("{}") == nil, "not a batch is refused")
check(SikolaRequest.batchURL(sesskey: "K", functions: f, userInitiated: false).hasSuffix("&nosessionupdate=true"), "background batch leaves the session alone")
check(!SikolaRequest.batchURL(sesskey: "K", functions: f, userInitiated: true).contains("nosessionupdate"), "user batch counts as activity")
check(SikolaRequest.loginRequired(#"{"error":"x","errorcode":"servicerequireslogin"}"#, functions: f), "top-level login error")
check(SikolaRequest.loginRequired(#"[{"error":true,"exception":{"errorcode":"requireloginerror"}}]"#, functions: f), "session call's login error")
check(!SikolaRequest.loginRequired(#"[{"error":false,"data":{"userid":1,"timeremaining":100}},{"error":true,"exception":{"errorcode":"requireloginerror"}}]"#, functions: f), "another call's login error is that call's own")
check(SikolaRequest.invalidSesskey(#"[{"error":true,"exception":{"errorcode":"invalidsesskey"}}]"#, functions: f), "invalid sesskey")
check(SikolaRequest.sessionAnswered(#"[{"error":false,"data":{"userid":1,"timeremaining":100}}]"#, functions: f), "session answered")
check(!SikolaRequest.sessionAnswered(#"[{"error":true,"exception":{"errorcode":"x"}}]"#, functions: f), "session error is not answered")

// SikolaPage
check(SikolaPage.allowedURL("/mod/attendance/view.php?id=197570&mode=1") == "\(base)/mod/attendance/view.php?id=197570&mode=1", "attendance mode=1")
check(SikolaPage.allowedURL("/mod/attendance/view.php?id=197570&view=5") == "\(base)/mod/attendance/view.php?id=197570&view=5", "attendance view=5")
check(SikolaPage.allowedURL("/mod/attendance/view.php?id=1") == "\(base)/mod/attendance/view.php?id=1", "attendance id only")
for path in ["/my/", "/mod/attendance/take.php?id=1", "/mod/attendance/sessions.php?id=1", "/mod/assign/view.php?id=1", "/login/logout.php?sesskey=abc",
             "/mod/attendance/view.php", "/mod/attendance/view.php?", "https://example.com/mod/attendance/view.php?id=1", "//example.com/mod/attendance/view.php?id=1",
             "/mod/attendance/../../login/index.php?id=1", "/mod/attendance/view.php/../take.php?id=1",
             "/mod/attendance/view.php?id=1&sesskey=abc", "/mod/attendance/view.php?id=1&studentid=2", "/mod/attendance/view.php?id=1&mode=1&mode=2",
             "/mod/attendance/view.php?mode=1", "/mod/attendance/view.php?id=abc", "/mod/attendance/view.php?id=1&view=5#x", "/mod/attendance/view.php?id=1%26take=1",
             "/mod/attendance/view.php?id=1&view", "/mod/attendance/view.php?id=1&view=5=6", "/mod/attendance/view.php?id=1?mode=1", "/mod/attendance/view.php?id=12345678901"] {
    check(SikolaPage.allowedURL(path) == nil, "refused: \(path)")
}

let page = """
<html><head><title>x</title><script>M.cfg = {"sesskey":"AbC123xyZ0"};</script></head>
<body><div class="popover-region" data-userid="42"></div>
<a href="\(base)/login/logout.php?sesskey=AbC123xyZ0">Keluar</a>
<form action="/x"><input type="hidden" name="sesskey" value="AbC123xyZ0"></form>
<script src="/y.js"></script><style>.a{}</style><!-- note -->
<section id="region-main"><table class="generaltable"></table></section></body></html>
"""
let out = SikolaPage.forJS(page)
check(!out.contains("AbC123xyZ0"), "no sesskey in the page")
check(out.range(of: "<script", options: .caseInsensitive) == nil, "no script")
check(out.range(of: "<head", options: .caseInsensitive) == nil, "no head")
check(out.range(of: "<form", options: .caseInsensitive) == nil, "no form")
check(out.range(of: "<style", options: .caseInsensitive) == nil, "no style")
check(out.contains("data-userid=\"42\""), "the user id stays")
check(out.contains("region-main"), "the main region stays")

let key = "Zx9Yw8Vu7T"
let dec = key.unicodeScalars.map { "&#\($0.value);" }.joined()
let hex = key.unicodeScalars.map { "&#x\(String($0.value, radix: 16));" }.joined()
let escaped = """
<body><div class="popover-region" data-userid="42"></div>
<div data-config="{&quot;sesskey&quot;:&quot;\(key)&quot;,&quot;a&quot;:1}"></div>
<a href="/x.php?sesskey&#61;\(key)">x</a>
<a href="/y.php?SESSKEY%3D\(key)">y</a>
<span data-k="\(dec)"></span>
<span data-k="\(hex)"></span>
<input type="hidden" name="sesskey" value="\(key)">
<section id="region-main">ok</section></body>
"""
let out2 = SikolaPage.forJS(escaped, secrets: [key])
check(!out2.contains(key), "no sesskey in any escaped form")
check(!out2.contains("&#\(key.unicodeScalars.first!.value);&#\(Array(key.unicodeScalars)[1].value);"), "no decimal-escaped sesskey")
check(out2.range(of: "<input", options: .caseInsensitive) == nil, "no input")
check(out2.contains("data-userid=\"42\""), "the user id stays (escaped page)")
check(!SikolaPage.forJS(#"<div data-x="Qq1Ww2Ee3R"></div><p>Qq1Ww2Ee3R</p>"#, secrets: ["Qq1Ww2Ee3R"]).contains("Qq1Ww2Ee3R"), "the vault's key goes even without the word sesskey")

// FileStore
let dir = FileManager.default.temporaryDirectory.appendingPathComponent("sulo-store-test-\(UUID().uuidString)")
let store = FileStore(directory: dir)
check(FileStore.key(fromFileName: FileStore.fileName(for: "sulo:u:1/tasks?x")) == "sulo:u:1/tasks?x", "key round trip")
try? store.set("sulo:a", "1")
try? store.set("sulo:b", "{\"x\":2}")
check(store.get("sulo:a") == "1" && store.get("sulo:b") == "{\"x\":2}", "store get")
check(store.keys() == ["sulo:a", "sulo:b"], "store keys")
try? store.remove("sulo:a")
check(store.get("sulo:a") == nil && store.keys() == ["sulo:b"], "store remove")
check((try? dir.resourceValues(forKeys: [.isExcludedFromBackupKey]).isExcludedFromBackup) == true, "store excluded from backups")
try? store.removeAll()
check(store.keys().isEmpty, "store remove all")
try? FileManager.default.removeItem(at: dir)

print("ios-test: \(count - failures) dari \(count) lolos")
exit(failures == 0 ? 0 : 1)
