import Foundation

// SIKOLA's pure rules on iOS, the same as the Android app's (session/Sikola.kt, SikolaRequest.kt,
// SikolaPage.kt) and tested with the same cases (ios/SuloTests, `pnpm ios:test`). Foundation only:
// no UIKit, no network here.

enum Sikola {
    static let origin = "https://sikola-v2.unhas.ac.id"
    static let host = "sikola-v2.unhas.ac.id"
    static let loginURL = "\(origin)/login/index.php"
    static let sessionCookie = "MoodleSession"

    /** A SIKOLA page that is not part of the login flow (/login/...). */
    static func isSignedInPage(_ url: URL?) -> Bool {
        guard let url, url.scheme == "https", url.host == host else { return false }
        let path = url.path.isEmpty ? "/" : url.path
        return !(path == "/login" || path.hasPrefix("/login/"))
    }
}

enum SikolaText {
    private static let sesskeyShape = try! NSRegularExpression(pattern: "^[A-Za-z0-9]{8,32}$")
    private static let input = try! NSRegularExpression(pattern: #"<input[^>]*name=["']sesskey["'][^>]*value=["']([^"']+)["']|<input[^>]*value=["']([^"']+)["'][^>]*name=["']sesskey["']"#, options: [.caseInsensitive])
    private static let link = try! NSRegularExpression(pattern: #"[?&]sesskey=([A-Za-z0-9]{8,32})"#)

    private static func group(_ m: NSTextCheckingResult, _ i: Int, in s: String) -> String? {
        let r = m.range(at: i)
        guard r.location != NSNotFound, let range = Range(r, in: s) else { return nil }
        return String(s[range])
    }

    private static func matches(_ re: NSRegularExpression, _ s: String) -> Bool {
        re.firstMatch(in: s, range: NSRange(s.startIndex..., in: s)) != nil
    }

    /** The sesskey on a signed-in page, found the way the extension's content script finds it. */
    static func sesskey(_ html: String) -> String? {
        for m in input.matches(in: html, range: NSRange(html.startIndex..., in: html)) {
            let v = group(m, 1, in: html).flatMap { $0.isEmpty ? nil : $0 } ?? group(m, 2, in: html) ?? ""
            if matches(sesskeyShape, v) { return v }
        }
        if let m = link.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)) { return group(m, 1, in: html) }
        return nil
    }

    /** What a response said about the session cookie (never its value outside this process). */
    enum SessionCookie: Equatable {
        case absent, same, cleared
        case replaced(String)
    }

    /** One cookie from a response, already parsed (HTTPCookie on iOS). */
    struct SetCookie {
        let name: String
        let value: String
        let expires: Date?
    }

    /** The session cookie among a response's cookies, against the value the request sent. */
    static func sessionCookie(_ cookies: [SetCookie], sent: String, name: String = Sikola.sessionCookie, now: Date = Date()) -> SessionCookie {
        guard let c = cookies.last(where: { $0.name == name }) else { return .absent }
        if c.value.isEmpty || c.value == "deleted" || (c.expires.map { $0 <= now } ?? false) { return .cleared }
        return c.value == sent ? .same : .replaced(c.value)
    }
}

enum SikolaRequest {
    /** The only functions a batch may carry (core client.ts; Android SikolaRequest.ALLOWED). */
    static let allowed: Set<String> = [
        "core_session_time_remaining",
        "core_calendar_get_action_events_by_timesort",
        "core_courseformat_get_state",
        "message_popup_get_popup_notifications",
        "core_course_get_enrolled_courses_by_timeline_classification",
    ]
    private static let loginCodes: Set<String> = ["servicerequireslogin", "requireloginerror"]

    /** nosessionupdate: false only for a sync the user started, or the keeper's ping. */
    static func batchURL(sesskey: String, functions: [String], userInitiated: Bool) -> String {
        let info = functions.joined(separator: ",")
        let tail = userInitiated ? "" : "&nosessionupdate=true"
        return "\(Sikola.origin)/lib/ajax/service.php?sesskey=\(sesskey)&info=\(info)\(tail)"
    }

    /** The function names of a batch body, or nil when it is not a valid, allowlisted batch. */
    static func allowedFunctions(_ body: String) -> [String]? {
        guard let data = body.data(using: .utf8), let array = (try? JSONSerialization.jsonObject(with: data)) as? [[String: Any]], !array.isEmpty else { return nil }
        var out: [String] = []
        for item in array {
            guard let name = item["methodname"] as? String, allowed.contains(name) else { return nil }
            out.append(name)
        }
        return out
    }

    /** The error codes that speak for the whole session: top-level, or core_session_time_remaining's own. */
    static func sessionCodes(_ body: String, functions: [String]) -> [String] {
        let text = body.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let data = text.data(using: .utf8), let json = try? JSONSerialization.jsonObject(with: data) else { return [] }
        if text.hasPrefix("{"), let o = json as? [String: Any] {
            return (o["errorcode"] as? String).flatMap { $0.isEmpty ? nil : [$0] } ?? []
        }
        if text.hasPrefix("["), let a = json as? [Any], let at = functions.firstIndex(of: "core_session_time_remaining"), at < a.count, let item = a[at] as? [String: Any] {
            guard (item["error"] as? Bool) == true, let ex = item["exception"] as? [String: Any], let code = ex["errorcode"] as? String, !code.isEmpty else { return [] }
            return [code]
        }
        return []
    }

    static func loginRequired(_ body: String, functions: [String]) -> Bool {
        sessionCodes(body, functions: functions).contains { loginCodes.contains($0) }
    }

    static func invalidSesskey(_ body: String, functions: [String]) -> Bool {
        sessionCodes(body, functions: functions).contains("invalidsesskey")
    }

    /** core_session_time_remaining answered without an error: SIKOLA knows this session. */
    static func sessionAnswered(_ body: String, functions: [String]) -> Bool {
        let text = body.trimmingCharacters(in: .whitespacesAndNewlines)
        guard text.hasPrefix("["), let at = functions.firstIndex(of: "core_session_time_remaining"), let data = text.data(using: .utf8),
              let a = (try? JSONSerialization.jsonObject(with: data)) as? [Any], at < a.count, let item = a[at] as? [String: Any] else { return false }
        return item["data"] != nil && (item["error"] as? Bool) != true
    }
}

enum SikolaPage {
    static let attendancePath = "/mod/attendance/view.php"
    private static let attendanceKeys: Set<String> = ["id", "mode", "view"]
    private static let number = try! NSRegularExpression(pattern: "^[0-9]{1,10}$")

    /** The full URL for an allowlisted page path ("/mod/attendance/view.php?id=1&mode=1"), or nil. */
    static func allowedURL(_ path: String) -> String? {
        if path.count > 200 || path.contains("#") || path.contains("%") || path.contains("\\") { return nil }
        let parts = path.components(separatedBy: "?")
        guard parts.count == 2, parts[0] == attendancePath else { return nil }
        let pairs = parts[1].components(separatedBy: "&").map { $0.components(separatedBy: "=") }
        guard pairs.allSatisfy({ $0.count == 2 }) else { return nil }
        let keys = pairs.map { $0[0] }
        guard Set(keys).count == keys.count, Set(keys).isSubset(of: attendanceKeys), keys.contains("id") else { return nil }
        guard pairs.allSatisfy({ number.firstMatch(in: $0[1], range: NSRange($0[1].startIndex..., in: $0[1])) != nil }) else { return nil }
        return "\(Sikola.origin)\(path)"
    }

    private static let remove: [NSRegularExpression] = [
        #"<head\b[\s\S]*?</head>"#,
        #"<script\b[\s\S]*?</script>"#,
        #"<style\b[\s\S]*?</style>"#,
        #"<noscript\b[\s\S]*?</noscript>"#,
        #"<template\b[\s\S]*?</template>"#,
        #"<form\b[\s\S]*?</form>"#,
        #"<(input|textarea|select|button)\b[^>]*>"#,
    ].map { try! NSRegularExpression(pattern: $0, options: [.caseInsensitive]) } + [try! NSRegularExpression(pattern: #"<!--[\s\S]*?-->"#)]

    /** "sesskey" then = or : in any spelling Moodle uses: plain, quoted, or HTML-escaped. */
    private static let sesskey = try! NSRegularExpression(
        pattern: #"(sesskey(?:["']|&quot;|&#0*34;|&#x0*22;|&#0*39;|&#x0*27;|&apos;)?\s*(?:[=:]|&#0*61;|&#x0*3d;|&#0*58;|&#x0*3a;|&equals;|&colon;|%3d|%3a)\s*(?:["']|&quot;|&#0*34;|&#x0*22;|&#0*39;|&#x0*27;|&apos;)?)[A-Za-z0-9]+"#,
        options: [.caseInsensitive])

    private static func replace(_ re: NSRegularExpression, in s: String, with template: String) -> String {
        re.stringByReplacingMatches(in: s, range: NSRange(s.startIndex..., in: s), withTemplate: template)
    }

    /**
     * What JavaScript may see of a page: no head, scripts, styles, forms or inputs, and no sesskey.
     * Three layers, as on Android: the elements are removed; every known sesskey is removed wherever
     * it appears, plainly or as HTML character references; any "sesskey=..." left is blanked.
     */
    static func forJS(_ html: String, secrets: [String] = []) -> String {
        let keys = Set((secrets + [SikolaText.sesskey(html)].compactMap { $0 }).filter { $0.count >= 8 })
        var out = html
        for re in remove { out = replace(re, in: out, with: "") }
        for key in keys {
            out = out.replacingOccurrences(of: key, with: "removed")
            out = out.replacingOccurrences(of: key.unicodeScalars.map { "&#\($0.value);" }.joined(), with: "removed")
            let hex = key.unicodeScalars.map { "&#x0*\(String($0.value, radix: 16));" }.joined()
            if let re = try? NSRegularExpression(pattern: hex, options: [.caseInsensitive]) { out = replace(re, in: out, with: "removed") }
        }
        return replace(sesskey, in: out, with: "$1removed")
    }
}
