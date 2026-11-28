import UIKit
import WebKit

/// A campus site's own sign-in page (SIKOLA now, Sipakamase from Fase 4), the iOS counterpart of the
/// Android LoginActivity. Sulo never touches the password: the page is the site's own, in a WKWebView
/// with no script of Sulo's (mobile hard rule 8), and iOS's password autofill works as on any page.
/// Its storage is non-persistent: once the page lands signed in, the session cookie is read from it,
/// handed to the Keychain vault, and nothing stays in WebKit's storage.
final class LoginViewController: UIViewController, WKNavigationDelegate, UIAdaptivePresentationControllerDelegate {
    struct Site {
        let host: String
        let entry: URL
        let cookie: String
        let signedIn: (URL?) -> Bool
    }

    struct Labels {
        let close: String
        let offline: String
        let retry: String
    }

    enum Outcome {
        case captured(String)
        case cancelled
        case offline
    }

    private let site: Site
    private let labels: Labels
    private let completion: (Outcome) -> Void
    private var webView: WKWebView!
    private let hostLabel = UILabel()
    private let offlineView = UIStackView()
    private var offlineShown = false
    private var finished = false

    init(site: Site, labels: Labels, completion: @escaping (Outcome) -> Void) {
        self.site = site
        self.labels = labels
        self.completion = completion
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .fullScreen
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.customUserAgent = nil

        let lock = UIImageView(image: UIImage(systemName: "lock.fill"))
        lock.tintColor = .secondaryLabel
        lock.setContentHuggingPriority(.required, for: .horizontal)
        hostLabel.text = site.host
        hostLabel.font = .preferredFont(forTextStyle: .subheadline)
        hostLabel.adjustsFontForContentSizeCategory = true
        hostLabel.textColor = .secondaryLabel
        hostLabel.lineBreakMode = .byTruncatingMiddle
        let close = UIButton(type: .system)
        close.setTitle(labels.close, for: .normal)
        close.titleLabel?.font = .preferredFont(forTextStyle: .body)
        close.titleLabel?.adjustsFontForContentSizeCategory = true
        close.addTarget(self, action: #selector(closeTapped), for: .touchUpInside)
        close.setContentHuggingPriority(.required, for: .horizontal)

        let bar = UIStackView(arrangedSubviews: [lock, hostLabel, close])
        bar.axis = .horizontal
        bar.spacing = 8
        bar.alignment = .center
        bar.isLayoutMarginsRelativeArrangement = true
        bar.directionalLayoutMargins = NSDirectionalEdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16)
        let line = UIView()
        line.backgroundColor = .separator

        let message = UILabel()
        message.text = labels.offline
        message.numberOfLines = 0
        message.textAlignment = .center
        message.font = .preferredFont(forTextStyle: .body)
        message.adjustsFontForContentSizeCategory = true
        let retry = UIButton(type: .system)
        retry.setTitle(labels.retry, for: .normal)
        retry.addTarget(self, action: #selector(retryTapped), for: .touchUpInside)
        offlineView.axis = .vertical
        offlineView.spacing = 12
        offlineView.alignment = .center
        offlineView.addArrangedSubview(message)
        offlineView.addArrangedSubview(retry)
        offlineView.isHidden = true

        for v in [bar, line, webView!, offlineView] as [UIView] {
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
            webView.topAnchor.constraint(equalTo: line.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            offlineView.centerYAnchor.constraint(equalTo: webView.centerYAnchor),
            offlineView.leadingAnchor.constraint(equalTo: g.leadingAnchor, constant: 24),
            offlineView.trailingAnchor.constraint(equalTo: g.trailingAnchor, constant: -24),
        ])
        load()
    }

    private func load() {
        showOffline(false)
        webView.load(URLRequest(url: site.entry))
    }

    private func showOffline(_ on: Bool) {
        offlineShown = on
        offlineView.isHidden = !on
        webView.isHidden = on
    }

    @objc private func retryTapped() { load() }

    @objc private func closeTapped() { finish(offlineShown ? .offline : .cancelled) }

    private func finish(_ outcome: Outcome) {
        guard !finished else { return }
        finished = true
        dismiss(animated: true) { self.completion(outcome) }
    }

    // Only the site's own pages open in the main frame; anything else is not followed.
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let mainFrame = navigationAction.targetFrame?.isMainFrame ?? true
        if mainFrame, let host = navigationAction.request.url?.host, host != site.host {
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        hostLabel.text = webView.url?.host ?? site.host
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard !finished, site.signedIn(webView.url) else { return }
        webView.configuration.websiteDataStore.httpCookieStore.getAllCookies { cookies in
            let value = cookies.last { $0.name == self.site.cookie && self.site.host.hasSuffix($0.domain.trimmingCharacters(in: CharacterSet(charactersIn: "."))) }?.value
            guard let value, !value.isEmpty else { return }
            self.finish(.captured(value))
        }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let code = (error as NSError).code
        if code == NSURLErrorCancelled { return }
        showOffline(true)
    }
}
