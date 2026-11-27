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
check(SikolaPage.allowedURL("/mod/assign/view.php?id=70") == "\(base)/mod/assign/view.php?id=70", "assignment by id")
for path in ["/mod/assign/view.php?id=70&action=editsubmission", "/mod/assign/view.php?id=70&action=removesubmission&sesskey=abc", "/mod/assign/view.php?action=grading",
             "/mod/assign/view.php?id=70&mode=1", "/mod/assign/view.php?id=70&id=71", "/mod/assign/view.php?id=abc", "/mod/assign/view.php", "/mod/assign/index.php?id=70"] {
    check(SikolaPage.allowedURL(path) == nil, "refused: \(path)")
}
for path in ["/my/", "/mod/attendance/take.php?id=1", "/mod/attendance/sessions.php?id=1", "/mod/quiz/view.php?id=1", "/login/logout.php?sesskey=abc",
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

// NeosiaRules (Android NeosiaRulesTest)
check(!NeosiaRules.Page.login.script, "the login page gets no script")
for page in NeosiaRules.Page.allCases where page != .login { check(page.script, "script on \(page)") }
for page in NeosiaRules.Page.allCases { check(NeosiaRules.isLogin(NeosiaRules.url(page)) == !page.script, "login rule for \(page)") }
check(NeosiaRules.isLogin(URL(string: "https://neosia.unhas.ac.id/login")), "login")
check(NeosiaRules.isLogin(URL(string: "https://neosia.unhas.ac.id/login?next=%2F")), "login with a query")
check(NeosiaRules.isLogin(URL(string: "https://neosia.unhas.ac.id/login/sso")), "login under /login/")
check(!NeosiaRules.isLogin(URL(string: "https://neosia.unhas.ac.id/loginx")), "loginx is not login")
check(!NeosiaRules.isLogin(URL(string: "https://neosia.unhas.ac.id/kartu-hasil-studi")), "khs is not login")
check(!NeosiaRules.isLogin(URL(string: "https://evil.example/login")), "another host is not NEOSIA's login")
check(!NeosiaRules.isLogin(nil), "no URL is not login")
let home = URL(string: "https://neosia.unhas.ac.id/")
let capture = #"{"type":"sulo:capture:v1","endpoint":"khs","status":"ok","data":{}}"#
check(NeosiaRules.judge(origin: "https://evil.example", mainFrame: true, pageURL: home, data: capture) == .otherOrigin, "other origin")
check(NeosiaRules.judge(origin: "http://neosia.unhas.ac.id", mainFrame: true, pageURL: home, data: capture) == .otherOrigin, "http origin")
check(NeosiaRules.judge(origin: "https://api.neosia.unhas.ac.id", mainFrame: true, pageURL: home, data: capture) == .otherOrigin, "api origin")
check(NeosiaRules.judge(origin: nil, mainFrame: true, pageURL: home, data: capture) == .otherOrigin, "no origin")
let big = "{\"type\":\"sulo:capture:v1\",\"x\":\"" + String(repeating: "a", count: NeosiaRules.maxMessageBytes) + "\"}"
check(NeosiaRules.judge(origin: NeosiaRules.origin, mainFrame: true, pageURL: home, data: big) == .tooBig, "too big")
let head = #"{"type":"sulo:capture:v1","x":""#
let atLimit = head + String(repeating: "a", count: NeosiaRules.maxMessageBytes - head.utf8.count - 2) + #""}"#
check(atLimit.utf8.count == NeosiaRules.maxMessageBytes && NeosiaRules.judge(origin: NeosiaRules.origin, mainFrame: true, pageURL: home, data: atLimit) == .accept, "at the limit")
check(NeosiaRules.judge(origin: NeosiaRules.origin, mainFrame: true, pageURL: home, data: capture) == .accept, "a capture is taken")
check(NeosiaRules.judge(origin: NeosiaRules.origin, mainFrame: false, pageURL: home, data: capture) == .notMainFrame, "not the main frame")
check(NeosiaRules.judge(origin: NeosiaRules.origin, mainFrame: true, pageURL: URL(string: "https://neosia.unhas.ac.id/login"), data: capture) == .onLogin, "never on the login page")
check(NeosiaRules.judge(origin: NeosiaRules.origin, mainFrame: true, pageURL: home, data: #"{"type":"other"}"#) == .notCapture, "not a capture")
check(NeosiaRules.judge(origin: NeosiaRules.origin, mainFrame: true, pageURL: home, data: nil) == .notCapture, "no data")
check(NeosiaRules.stays(URL(string: "https://neosia.unhas.ac.id/kartu-hasil-studi")), "stays on NEOSIA")
check(!NeosiaRules.stays(URL(string: "http://neosia.unhas.ac.id/")), "not over http")
check(!NeosiaRules.stays(URL(string: "https://example.com/")), "not elsewhere")
check(!NeosiaRules.stays(URL(string: "intent://scan")), "not an intent")
check(NeosiaRules.label(capture) == "khs (ok)", "the trial label")
check(NeosiaRules.originString(scheme: "https", host: "neosia.unhas.ac.id", port: 0) == NeosiaRules.origin, "origin string")

// Sipakamase (Android SipakamaseTest, SipakamaseKeepTest)
check(Sipakamase.readPaths.count == 5 && Sipakamase.readPaths.allSatisfy(Sipakamase.isReadPath), "the five read paths")
for path in ["/home", "/ckonversimhs/detail", "/caktifitas/content?x=1", "/cklaim/content#a", "/cklaim/content/", "/cklaim/simpan"] { check(!Sipakamase.isReadPath(path), "refused: \(path)") }
check(Sipakamase.isSignedInPage(URL(string: "https://sipakamase.unhas.ac.id/home")), "home is signed in")
check(Sipakamase.isSignedInPage(URL(string: "https://sipakamase.unhas.ac.id/cklaim/content")), "a fragment page is signed in")
check(!Sipakamase.isSignedInPage(URL(string: "https://sipakamase.unhas.ac.id/login")), "login is not signed in")
check(!Sipakamase.isSignedInPage(URL(string: "https://evil.example/home")), "another host is not signed in")
check(Sipakamase.isLoginPage(#"<form><input name="p" type="password"></form>"#), "a password field is the login page")
check(!Sipakamase.isLoginPage(#"<table><tr><td>MKPK</td></tr></table>"#), "a fragment is not the login page")
func plan(_ interval: Int = 180, next: Int = 0, used: Int = 0, date: String = "d", last: Int = 0) -> [String: Any] {
    ["sipakamase": ["keep": true, "intervalMin": interval, "next": next, "usedToday": used, "date": date, "lastAutoAt": last]]
}
typealias KS = SipakamaseKeep.State
check(SipakamaseKeep.due(SipakamaseKeep.parse([:]), configKeep: true, state: KS(), now: 1000, today: "d") == nil, "no plan part: nothing")
check(SipakamaseKeep.due(SipakamaseKeep.parse(plan()), configKeep: false, state: KS(), now: 1000, today: "d") == nil, "the owner stopped it: nothing")
check(SipakamaseKeep.parse(plan(60)) == nil, "faster than 3 hours is refused")
let p3 = SipakamaseKeep.parse(plan(last: 10_000))
check(SipakamaseKeep.due(p3, configKeep: true, state: KS(), now: 10_000 + 2 * 3600, today: "d") == nil, "not before 3 hours")
check(SipakamaseKeep.due(p3, configKeep: true, state: KS(), now: 10_000 + 3 * 3600 - 60, today: "d") == 0, "due at 3 hours, slack included")
var s20 = KS(); s20.lastAt = 20_000
check(SipakamaseKeep.due(p3, configKeep: true, state: s20, now: 10_000 + 3 * 3600, today: "d") == nil, "the worker's own last read counts too")
let pr = SipakamaseKeep.parse(plan(next: 3, used: 6))!
check(SipakamaseKeep.due(pr, configKeep: true, state: KS(), now: 1, today: "d") == 3, "takes the plan's next")
var after = SipakamaseKeep.after(pr, state: KS(), index: 3, now: 1, today: "d", login: false, ok: false)
after.lastAt = 0
check(SipakamaseKeep.due(pr, configKeep: true, state: after, now: 1, today: "d") == 4, "rotates")
var four = KS(); four.date = "d"; four.count = 4
check(SipakamaseKeep.due(pr, configKeep: true, state: four, now: 1, today: "d") == nil, "ten a day with the app's six")
check(SipakamaseKeep.due(pr, configKeep: true, state: four, now: 1, today: "e") == 3, "a new day counts again")
check(SipakamaseKeep.due(SipakamaseKeep.parse(plan(next: 5)), configKeep: true, state: KS(), now: 1, today: "d") == 0, "wraps around")
check(SipakamaseKeep.after(pr, state: KS(), index: 0, now: 77, today: "d", login: true, ok: false).loginAt == 77, "remembers the login page")
check(SipakamaseKeep.after(pr, state: KS(), index: 0, now: 77, today: "d", login: false, ok: true).okAt == 77, "remembers a signed-in read")
var ok9 = KS(); ok9.okAt = 9
check(SipakamaseKeep.after(pr, state: ok9, index: 0, now: 77, today: "d", login: true, ok: false).okAt == 9, "a login page leaves the good read")

print("ios-test: \(count - failures) dari \(count) lolos")
exit(failures == 0 ? 0 : 1)
