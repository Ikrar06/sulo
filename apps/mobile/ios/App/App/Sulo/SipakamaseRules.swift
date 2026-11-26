import Foundation

/// Sipakamase's address and the pure rules Sulo applies to it on iOS (Android sipakamase/Sipakamase.kt,
/// core sipakamase/allowlist.ts): the five read paths are constants, nothing builds an address from a page
/// (the site changes data with plain GETs, Sulo's hard rule 17).
enum Sipakamase {
    static let origin = "https://sipakamase.unhas.ac.id"
    static let host = "sipakamase.unhas.ac.id"
    static let sessionCookie = "session"
    /** Where the sign-in screen starts; Sipakamase sends it to its login when there is no session. */
    static let entryURL = "\(origin)/home"

    static let readPaths = [
        "/caktifitasmahasiswa/content",
        "/caktifitas/content",
        "/ckonversimhs/matakuliah",
        "/cklaim/content",
        "/ckonversimhs/rekappoin",
    ]

    /** One of the five exact paths: no query, no fragment, nothing appended. */
    static func isReadPath(_ path: String) -> Bool { readPaths.contains(path) }

    private static let signedIn = ["/home", "/caktifitasmahasiswa", "/caktifitas", "/ckonversimhs", "/cklaim"]

    /** The student's pages after signing in; the login page is none of them. */
    static func isSignedInPage(_ url: URL?) -> Bool {
        guard let url, url.scheme == "https", url.host == host else { return false }
        return signedIn.contains { url.path == $0 || url.path.hasPrefix("\($0)/") }
    }

    private static let password = try! NSRegularExpression(pattern: #"<input[^>]*type\s*=\s*["']?password"#, options: [.caseInsensitive])

    /** A page that asks for a password is the login page: the session is gone. */
    static func isLoginPage(_ html: String) -> Bool {
        password.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)) != nil
    }
}

/// The keeper's Sipakamase rules (Android SipakamaseKeepRules): one GET to the next of the five paths when
/// due, every 3 hours or slower (the app's plan, which follows the measured session length), at most 10 a
/// day counted together with the app's own reads.
enum SipakamaseKeep {
    static let dailyMax = 10
    static let slack = 5 * 60

    struct Part: Equatable {
        let intervalMin: Int
        let next: Int
        let usedToday: Int
        let date: String
        let lastAutoAt: Int
    }

    struct State: Codable, Equatable {
        var lastAt = 0
        var date = ""
        var count = 0
        var next = 0
        var planNext = -1
        var loginAt = 0
        var okAt = 0
    }

    static func parse(_ plan: [String: Any]?) -> Part? {
        guard let o = plan?["sipakamase"] as? [String: Any], o["keep"] as? Bool == true else { return nil }
        let interval = o["intervalMin"] as? Int ?? 0
        if interval < 180 { return nil }
        return Part(intervalMin: interval, next: o["next"] as? Int ?? 0, usedToday: o["usedToday"] as? Int ?? 0, date: o["date"] as? String ?? "", lastAutoAt: o["lastAutoAt"] as? Int ?? 0)
    }

    /** The index into readPaths of the read due now, or nil. */
    static func due(_ part: Part?, configKeep: Bool, state: State, now: Int, today: String) -> Int? {
        guard let part, configKeep else { return nil }
        let used = (state.date == today ? state.count : 0) + (part.date == today ? part.usedToday : 0)
        if used >= dailyMax { return nil }
        let last = max(state.lastAt, part.lastAutoAt)
        if last > 0 && now - last < part.intervalMin * 60 - slack { return nil }
        let next = part.next != state.planNext ? part.next : state.next
        return ((next % Sipakamase.readPaths.count) + Sipakamase.readPaths.count) % Sipakamase.readPaths.count
    }

    /** After a read was sent, whatever its answer. */
    static func after(_ part: Part, state: State, index: Int, now: Int, today: String, login: Bool, ok: Bool) -> State {
        var s = state
        s.lastAt = now
        s.count = (state.date == today ? state.count : 0) + 1
        s.date = today
        s.next = index + 1
        s.planNext = part.next
        if login { s.loginAt = now }
        if ok { s.okAt = now }
        return s
    }
}
