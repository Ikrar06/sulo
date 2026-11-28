import UIKit
import WebKit

/// The projected captures waiting for the app (Android CaptureQueue): sealed like the rest of NEOSIA's
/// data, taken once. Only what the page script already projected (allowlist, no raw response, hard rule 15).
enum NeosiaQueue {
    private static let store = EncryptedStore(name: "SuloNeosiaQueue", keyService: "dev.ikrar.sulo.neosia.key")
    private static let key = "queue"

    static func append(_ message: String) {
        var list = take(keep: true)
        list.append(message)
        if let data = try? JSONSerialization.data(withJSONObject: Array(list.suffix(40))), let text = String(data: data, encoding: .utf8) {
            try? store.set(user: 0, key: key, value: text)
        }
    }

    @discardableResult
    static func take(keep: Bool = false) -> [String] {
        let text = store.get(user: 0, key: key) ?? "[]"
        let list = (try? JSONSerialization.jsonObject(with: Data(text.utf8))) as? [String] ?? []
        if !keep { store.remove(user: 0, keys: [key]) }
        return list
    }
}

/// Counters for the dev screen's NEOSIA trial: labels and numbers only, never captured data.
enum NeosiaTrial {
    private static let lock = NSLock()
    private(set) static var captures: [String: Int] = [:]
    private(set) static var rejected: [String: Int] = [:]
    private(set) static var scriptOnLogin = 0
    private(set) static var spaToLogin = 0
    private(set) static var spaFromLogin = 0

    static func capture(_ label: String) { lock.lock(); captures[label, default: 0] += 1; lock.unlock() }
    static func reject(_ why: String) { lock.lock(); rejected[why, default: 0] += 1; lock.unlock() }
    static func noteScriptOnLogin() { lock.lock(); scriptOnLogin += 1; lock.unlock() }
    static func noteSpaToLogin() { lock.lock(); spaToLogin += 1; lock.unlock() }
    static func noteSpaFromLogin() { lock.lock(); spaFromLogin += 1; lock.unlock() }
    static func reset() {
        lock.lock()
        captures = [:]; rejected = [:]; scriptOnLogin = 0; spaToLogin = 0; spaFromLogin = 0
        lock.unlock()
    }
}

/// WKUserContentController keeps its handlers strongly: this breaks the cycle.
private final class WeakHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) { target?.userContentController(c, didReceive: message) }
}

/// One NEOSIA page in a web view with the capture (Android NeosiaActivity's rules): NEOSIA's own scripts
/// run as they always do, Sulo adds only the capture script (never on the login page) and its message
/// handler, both scoped to NEOSIA's main frame. NEOSIA keeps its sign-in in its own storage (WebKit's
/// default store, separate from the app's own pages by origin). Used visibly (a tap) and hidden (the
/// visit on opening the app, when the user turned it on).
final class NeosiaSession: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
    enum Result: String { case signedIn = "signed_in", needsLogin = "needs_login", closed, data, timeout }

    static let dataSettle: TimeInterval = 2.5
    static let signedInSettle: TimeInterval = 1.5

    let webView: WKWebView
    private let page: NeosiaRules.Page
    private let closeOnData: Bool
    private var attached = false
    private var lastURL: URL?
    private var closing = false
    private var observation: NSKeyValueObservation?
    var onFinish: ((Result) -> Void)?

    init(page: NeosiaRules.Page, closeOnData: Bool) {
        self.page = page
        self.closeOnData = closeOnData
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        webView = WKWebView(frame: .zero, configuration: config)
        super.init()
        webView.navigationDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        if page.script { attach() }
        // NEOSIA moving between pages without a new document (history.pushState).
        observation = webView.observe(\.url, options: [.new]) { [weak self] view, _ in self?.urlChanged(view.url) }
    }

    func load() { webView.load(URLRequest(url: NeosiaRules.url(page))) }

    /** The capture script from the app's own bundle (built with the app: public/neosia-main.js). */
    private func attach() {
        guard let url = Bundle.main.url(forResource: "neosia-main", withExtension: "js", subdirectory: "public"),
              let source = try? String(contentsOf: url, encoding: .utf8) else { return }
        let controller = webView.configuration.userContentController
        controller.add(WeakHandler(self), contentWorld: .page, name: NeosiaRules.port)
        controller.addUserScript(WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true, in: .page))
        attached = true
    }

    /** The script and the handler go: they never reach a login page that loads after this. */
    private func detach() {
        guard attached else { return }
        let controller = webView.configuration.userContentController
        controller.removeAllUserScripts()
        controller.removeScriptMessageHandler(forName: NeosiaRules.port, contentWorld: .page)
        attached = false
    }

    func finish(_ result: Result, after delay: TimeInterval = 0) {
        guard !closing else { return }
        closing = true
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
            self.detach()
            self.observation = nil
            self.onFinish?(result)
            self.onFinish = nil
        }
    }

    private func urlChanged(_ url: URL?) {
        let wasLogin = NeosiaRules.isLogin(lastURL)
        let nowLogin = NeosiaRules.isLogin(url)
        if nowLogin && !wasLogin && page.script {
            // The app moved to its login page without a new document: the script must not stay on it.
            NeosiaTrial.noteSpaToLogin()
            detach()
            finish(.needsLogin)
        }
        if wasLogin && !nowLogin && lastURL != nil {
            NeosiaTrial.noteSpaFromLogin()
            if page == .login { finish(.signedIn, after: Self.signedInSettle) }
        }
        lastURL = url
    }

    // NEOSIA's own pages only; before a login page, the script goes.
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let mainFrame = navigationAction.targetFrame?.isMainFrame ?? true
        let url = navigationAction.request.url
        if mainFrame && !NeosiaRules.stays(url) { return decisionHandler(.cancel) }
        if mainFrame && NeosiaRules.isLogin(url) && page.script {
            // A page with the script never shows the login page: stop here, the app asks to sign in first.
            detach()
            finish(.needsLogin)
            return decisionHandler(.cancel)
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        if NeosiaRules.isLogin(webView.url) && attached {
            // A login page began while the script was still there (a redirect past the check above).
            NeosiaTrial.noteScriptOnLogin()
            detach()
        }
    }

    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        let o = message.frameInfo.securityOrigin
        let origin = NeosiaRules.originString(scheme: o.protocol, host: o.host, port: o.port)
        let data = message.body as? String
        let verdict = NeosiaRules.judge(origin: origin, mainFrame: message.frameInfo.isMainFrame, pageURL: webView.url, data: data)
        guard verdict == .accept, let data else { return NeosiaTrial.reject("\(verdict)") }
        // Already projected in the page; sealed in the queue until the app runs core's gate and stores it.
        NeosiaQueue.append(data)
        NeosiaTrial.capture(NeosiaRules.label(data))
        if closeOnData { finish(.data, after: Self.dataSettle) }
    }
}

/// The visible NEOSIA screen: a bar (lock, host, close) over the page, as on Android.
final class NeosiaViewController: UIViewController {
    private let session: NeosiaSession
    private let closeLabel: String
    private let hostLabel = UILabel()

    init(page: NeosiaRules.Page, closeLabel: String, closeOnData: Bool, completion: @escaping (NeosiaSession.Result) -> Void) {
        session = NeosiaSession(page: page, closeOnData: closeOnData)
        self.closeLabel = closeLabel
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .fullScreen
        session.onFinish = { [weak self] result in
            self?.dismiss(animated: true) { completion(result) }
        }
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        let lock = UIImageView(image: UIImage(systemName: "lock.fill"))
        lock.tintColor = .secondaryLabel
        lock.setContentHuggingPriority(.required, for: .horizontal)
        hostLabel.text = NeosiaRules.host
        hostLabel.font = .preferredFont(forTextStyle: .subheadline)
        hostLabel.adjustsFontForContentSizeCategory = true
        hostLabel.textColor = .secondaryLabel
        let close = UIButton(type: .system)
        close.setTitle(closeLabel, for: .normal)
        close.addTarget(self, action: #selector(closeTapped), for: .touchUpInside)
        close.setContentHuggingPriority(.required, for: .horizontal)
        let bar = UIStackView(arrangedSubviews: [lock, hostLabel, close])
        bar.spacing = 8
        bar.alignment = .center
        bar.isLayoutMarginsRelativeArrangement = true
        bar.directionalLayoutMargins = NSDirectionalEdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16)
        let line = UIView()
        line.backgroundColor = .separator
        let web = session.webView
        for v in [bar, line, web] as [UIView] {
            v.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview(v)
        }
        let g = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            bar.topAnchor.constraint(equalTo: g.topAnchor),
            bar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bar.heightAnchor.constraint(greaterThanOrEqualToConstant: 52),
            line.topAnchor.constraint(equalTo: bar.bottomAnchor),
            line.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            line.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            line.heightAnchor.constraint(equalToConstant: 1 / UIScreen.main.scale),
            web.topAnchor.constraint(equalTo: line.bottomAnchor),
            web.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            web.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
        session.load()
    }

    @objc private func closeTapped() { session.finish(.closed) }
}

/// "Perbarui NEOSIA otomatis" on iOS (owner's decision of 26 Nov 2026, A3): when the app is open and the
/// visit is due (core neosia/visit.ts decides), Beranda loads in a hidden web view with the capture, at
/// most 30 seconds; NEOSIA's own app loads its data, Sulo sends nothing. Only in the foreground.
enum NeosiaVisit {
    static let limit: TimeInterval = 30
    private static var current: NeosiaSession?

    static func run(in window: UIWindow?, completion: @escaping (NeosiaSession.Result) -> Void) {
        guard current == nil, let window else { return completion(.closed) }
        let session = NeosiaSession(page: .home, closeOnData: true)
        current = session
        let web = session.webView
        // In the window (WebKit throttles a web view outside one), behind everything and invisible.
        web.frame = CGRect(x: 0, y: 0, width: 1, height: 1)
        web.alpha = 0.01
        web.isUserInteractionEnabled = false
        window.insertSubview(web, at: 0)
        session.onFinish = { result in
            web.removeFromSuperview()
            current = nil
            completion(result)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + limit) { session.finish(.timeout) }
        session.load()
    }
}
