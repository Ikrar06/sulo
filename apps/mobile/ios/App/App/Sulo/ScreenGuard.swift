import UIKit

/// The iPhone's counterpart of Android's FLAG_SECURE on the grades screens. iOS lets no app block a
/// screenshot, so while grades show (`secure` on): the app's window is covered when it leaves the
/// foreground (the app switcher's preview shows no grade), and masked while the screen is recorded or
/// mirrored. Grades stay hidden by default anyway (hard rule 16).
final class ScreenGuard {
    static let shared = ScreenGuard()

    private var cover: UIView?
    private var mask: UIView?
    private var observers: [NSObjectProtocol] = []

    var secure = false {
        didSet { DispatchQueue.main.async { self.refreshMask() } }
    }

    private init() {
        let center = NotificationCenter.default
        observers.append(center.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { [weak self] _ in self?.showCover() })
        observers.append(center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in self?.hideCover() })
        observers.append(center.addObserver(forName: UIScreen.capturedDidChangeNotification, object: nil, queue: .main) { [weak self] _ in self?.refreshMask() })
    }

    /** Starts listening (called once at launch). */
    func start() {}

    private var window: UIWindow? {
        UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.windows.first { $0.isKeyWindow } }.first
    }

    private func plate() -> UIView {
        let v = UIView()
        v.backgroundColor = .systemBackground
        let icon = UIImageView(image: UIImage(systemName: "lock.fill"))
        icon.tintColor = .tertiaryLabel
        icon.translatesAutoresizingMaskIntoConstraints = false
        v.addSubview(icon)
        NSLayoutConstraint.activate([icon.centerXAnchor.constraint(equalTo: v.centerXAnchor), icon.centerYAnchor.constraint(equalTo: v.centerYAnchor)])
        return v
    }

    private func showCover() {
        guard secure, cover == nil, let window else { return }
        let v = plate()
        v.frame = window.bounds
        v.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        window.addSubview(v)
        cover = v
    }

    private func hideCover() {
        cover?.removeFromSuperview()
        cover = nil
    }

    /** Recording or mirroring while grades show: masked until either stops. */
    private func refreshMask() {
        let captured = window?.windowScene?.screen.isCaptured ?? false
        if secure && captured {
            guard mask == nil, let window else { return }
            let v = plate()
            v.frame = window.bounds
            v.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            window.addSubview(v)
            mask = v
        } else {
            mask?.removeFromSuperview()
            mask = nil
        }
    }
}
