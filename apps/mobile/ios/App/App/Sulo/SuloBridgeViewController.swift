import Capacitor
import UIKit

/// The app's web view, with Sulo's own plugins (Capacitor's are found on their own).
///
/// The keyboard: Android's WebView is resized to the space above it, and the app's screens are laid out for
/// that (the onboarding's frame, Bantuan's search). iOS keeps the web view full height and scrolls the whole
/// page up to show the field instead, which pushed the onboarding's top off the screen (owner's iPhone, 27 Nov
/// 2026). Here the web view takes the space above the keyboard, as on Android, and the page itself never
/// scrolls: every screen scrolls inside its own area.
class SuloBridgeViewController: CAPBridgeViewController {
    private var keyboardOverlap: CGFloat = 0

    override func viewDidLoad() {
        super.viewDidLoad()
        webView?.scrollView.isScrollEnabled = false
        webView?.scrollView.bounces = false
        let center = NotificationCenter.default
        center.addObserver(self, selector: #selector(keyboardWillChange(_:)), name: UIResponder.keyboardWillChangeFrameNotification, object: nil)
        center.addObserver(self, selector: #selector(keyboardWillHide(_:)), name: UIResponder.keyboardWillHideNotification, object: nil)
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        // A layout pass (rotation, a sheet) puts the view back to full height: keep it above the keyboard.
        if keyboardOverlap > 0 { fitAboveKeyboard() }
    }

    @objc private func keyboardWillChange(_ note: Notification) {
        guard let end = (note.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue)?.cgRectValue, let window = view.window else { return }
        // The keyboard's frame is in screen coordinates, which are the window's on iPhone (it fills the screen).
        keyboardOverlap = max(0, window.bounds.maxY - end.minY)
        fitAboveKeyboard()
    }

    @objc private func keyboardWillHide(_ note: Notification) {
        keyboardOverlap = 0
        fitAboveKeyboard()
    }

    /// The app's screen color (packages/ui palette --layer-screen), light or dark as the phone: what shows in the
    /// see-through rounded edges of iOS 26's keyboard once the web view stops at its top (it was black).
    private static let screen = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 11 / 255, green: 11 / 255, blue: 14 / 255, alpha: 1)
            : UIColor(red: 241 / 255, green: 241 / 255, blue: 244 / 255, alpha: 1)
    }

    private func fitAboveKeyboard() {
        guard let webView, let window = view.window else { return }
        window.backgroundColor = Self.screen
        let height = window.bounds.height - keyboardOverlap
        if webView.frame.height != height { webView.frame = CGRect(x: 0, y: 0, width: window.bounds.width, height: height) }
        webView.scrollView.contentOffset = .zero
    }


    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(SuloStorePlugin())
        bridge?.registerPluginInstance(SuloSessionPlugin())
        #if DEBUG || SULO_PROBE
        bridge?.registerPluginInstance(SuloProbePlugin())
        #endif
        bridge?.registerPluginInstance(SuloNeosiaPlugin())
        bridge?.registerPluginInstance(SuloSipakamasePlugin())
        bridge?.registerPluginInstance(SuloCalendarPlugin())
    }
}
