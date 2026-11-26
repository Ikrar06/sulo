import Foundation

/// The NEOSIA screen's rules on iOS, the same as Android's (neosia/NeosiaRules.kt) and tested with the same
/// cases (`pnpm ios:test`): which pages Sulo opens, which get the capture script (never the login page),
/// where the web view may go, and which messages are taken. Sulo makes no request to NEOSIA (hard rule 12):
/// it opens NEOSIA's own pages from a tap and reads what those pages already asked for.
enum NeosiaRules {
    static let origin = "https://neosia.unhas.ac.id"
    static let host = "neosia.unhas.ac.id"
    static let apiHost = "api.neosia.unhas.ac.id"
    /** The message handler's name (Android: the WebMessageListener object). */
    static let port = "SuloNeosia"
    /** The extension's limit too (core neosia/allowlist.ts MAX_MESSAGE_CHARS): 256 KiB. */
    static let maxMessageBytes = 262_144
    static let captureType = "sulo:capture:v1"

    enum Page: String, CaseIterable {
        case login, home, khs, krs, transkrip, matakuliah

        var path: String {
            switch self {
            case .login: return "/login"
            case .home: return "/"
            case .khs: return "/kartu-hasil-studi"
            case .krs: return "/kartu-rencana-studi"
            case .transkrip: return "/transkrip-nilai"
            case .matakuliah: return "/matakuliah"
            }
        }

        /** The login page never gets the script. */
        var script: Bool { self != .login }
    }

    static func page(_ id: String?) -> Page? { Page.allCases.first { $0.rawValue.caseInsensitiveCompare(id ?? "") == .orderedSame } }

    static func url(_ page: Page) -> URL { URL(string: origin + page.path)! }

    /** NEOSIA's login page, or anything under it. */
    static func isLogin(_ url: URL?) -> Bool {
        guard let url, url.scheme == "https", url.host == host else { return false }
        return url.path == "/login" || url.path.hasPrefix("/login/")
    }

    /** The screen shows NEOSIA's own pages only (https, its host); any other link is not followed. */
    static func stays(_ url: URL?) -> Bool {
        guard let url else { return false }
        return url.scheme == "https" && url.host == host
    }

    enum Verdict: Equatable { case accept, otherOrigin, notMainFrame, tooBig, notCapture, onLogin }

    /** A message from the page: NEOSIA's origin, the main frame, not on the login page, at most 256 KiB, a capture. */
    static func judge(origin messageOrigin: String?, mainFrame: Bool, pageURL: URL?, data: String?) -> Verdict {
        if messageOrigin != origin { return .otherOrigin }
        if !mainFrame { return .notMainFrame }
        if isLogin(pageURL) { return .onLogin }
        guard let data else { return .notCapture }
        if data.utf8.count > maxMessageBytes { return .tooBig }
        if !data.hasPrefix("{") || !data.contains("\"\(captureType)\"") { return .notCapture }
        return .accept
    }

    /** The trial's label for an accepted message: its endpoint id and status, nothing of its data. */
    static func label(_ data: String) -> String {
        func first(_ pattern: String) -> String? {
            guard let re = try? NSRegularExpression(pattern: pattern), let m = re.firstMatch(in: data, range: NSRange(data.startIndex..., in: data)),
                  let r = Range(m.range(at: 1), in: data) else { return nil }
            return String(data[r])
        }
        return "\(first(#""endpoint"\s*:\s*"([A-Za-z0-9_./-]{1,80})""#) ?? "?") (\(first(#""status"\s*:\s*"(ok|unknown_shape)""#) ?? "?"))"
    }

    /** The message's origin as the page reports it (WKSecurityOrigin's parts). */
    static func originString(scheme: String, host: String, port: Int) -> String {
        port == 0 || (scheme == "https" && port == 443) ? "\(scheme)://\(host)" : "\(scheme)://\(host):\(port)"
    }
}
