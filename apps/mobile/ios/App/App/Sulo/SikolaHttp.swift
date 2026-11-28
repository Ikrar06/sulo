import Foundation

/// Requests to one campus site from native code (Android SikolaHttp, SipakamaseHttp): the session cookie
/// added here, never a redirect followed, no cookie jar, no cache, Sulo's own User-Agent. The cookie and
/// the sesskey never leave this process. Synchronous: callers are already on a background queue.
final class SiteHttp: NSObject, URLSessionTaskDelegate {
    struct Reply {
        let status: Int
        let location: String?
        let body: String
        /** What the answer said about the session cookie. */
        let cookie: SikolaText.SessionCookie
        /** The session cookie's lifetime attributes, never its value (Sipakamase's session log). */
        let cookieExpires: Bool?
        let cookieMaxAge: Int?
    }

    enum Failure: Error {
        case network(String)
    }

    static let userAgent: String = {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0"
        return "Sulo/\(version) (iOS)"
    }()

    private let cookieName: String
    private let maxBody: Int

    init(cookieName: String, maxBody: Int = 4 * 1024 * 1024) {
        self.cookieName = cookieName
        self.maxBody = maxBody
    }

    private static func configuration() -> URLSessionConfiguration {
        let c = URLSessionConfiguration.ephemeral
        c.httpCookieStorage = nil
        c.httpShouldSetCookies = false
        c.httpCookieAcceptPolicy = .never
        c.urlCache = nil
        c.requestCachePolicy = .reloadIgnoringLocalCacheData
        c.timeoutIntervalForRequest = 30
        c.timeoutIntervalForResource = 60
        c.waitsForConnectivity = false
        return c
    }

    /** One shared session (kept connections), or a fresh one closed after (core's second ask). */
    private lazy var shared = URLSession(configuration: Self.configuration(), delegate: self, delegateQueue: nil)

    // Never follow a redirect: a 30x comes back as it is (a login redirect means the session ended).
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }

    func get(_ url: String, cookie: String) throws -> Reply {
        try send(method: "GET", url: url, cookie: cookie, body: nil, fresh: false)
    }

    func postJSON(_ url: String, cookie: String, body: String, fresh: Bool) throws -> Reply {
        try send(method: "POST", url: url, cookie: cookie, body: body, fresh: fresh)
    }

    private func send(method: String, url: String, cookie: String, body: String?, fresh: Bool) throws -> Reply {
        guard let u = URL(string: url) else { throw Failure.network("BadURL") }
        var request = URLRequest(url: u)
        request.httpMethod = method
        request.setValue(Self.userAgent, forHTTPHeaderField: "User-Agent")
        request.setValue("\(cookieName)=\(cookie)", forHTTPHeaderField: "Cookie")
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = Data(body.utf8)
        }
        let session = fresh ? URLSession(configuration: Self.configuration(), delegate: self, delegateQueue: nil) : shared
        defer { if fresh { session.finishTasksAndInvalidate() } }
        let done = DispatchSemaphore(value: 0)
        var out: (Data?, URLResponse?, Error?) = (nil, nil, nil)
        session.dataTask(with: request) { data, response, error in
            out = (data, response, error)
            done.signal()
        }.resume()
        done.wait()
        if let error = out.2 as NSError? {
            // The kind of failure only, never a message that could carry the URL.
            throw Failure.network("\(error.domain):\(error.code)")
        }
        guard let http = out.1 as? HTTPURLResponse else { throw Failure.network("NoResponse") }
        let headers = http.allHeaderFields.reduce(into: [String: String]()) { acc, pair in
            if let k = pair.key as? String, let v = pair.value as? String { acc[k] = v }
        }
        let parsed = HTTPCookie.cookies(withResponseHeaderFields: headers, for: u)
        let cookies = parsed.map { SikolaText.SetCookie(name: $0.name, value: $0.value, expires: $0.expiresDate) }
        let seen = SikolaText.sessionCookie(cookies, sent: cookie, name: cookieName)
        // The session cookie's own lifetime, from the parsed cookie (several Set-Cookie headers arrive merged into one).
        let mine = parsed.last { $0.name == cookieName }
        let lifetime = mine?.expiresDate.map { Int($0.timeIntervalSinceNow.rounded()) }
        let data = (out.0 ?? Data()).prefix(maxBody)
        return Reply(
            status: http.statusCode,
            location: http.value(forHTTPHeaderField: "Location"),
            body: String(decoding: data, as: UTF8.self),
            cookie: seen,
            cookieExpires: mine.map { $0.expiresDate != nil },
            cookieMaxAge: lifetime
        )
    }
}

/// One process-wide queue for SIKOLA (Android SikolaLock): never two requests at once, from the app or
/// the background keeper (Sulo's hard rule 3).
enum SikolaLock {
    static let queue = DispatchQueue(label: "dev.ikrar.sulo.sikola")
}
