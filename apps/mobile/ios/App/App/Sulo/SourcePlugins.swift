import Capacitor
import Foundation
import UIKit
import WebKit

/// The encrypted store's four calls, shared by SuloNeosia and SuloSipakamase (JS NeosiaNative).
private func storeCall(_ store: EncryptedStore, _ method: String, _ call: CAPPluginCall) {
    guard let user = call.getInt("user") else { return call.reject("user") }
    switch method {
    case "storeGet":
        guard let key = call.getString("key") else { return call.reject("key") }
        call.resolve(["value": store.get(user: user, key: key) ?? NSNull()])
    case "storeSet":
        guard let key = call.getString("key"), let value = call.getString("value") else { return call.reject("key") }
        do {
            try store.set(user: user, key: key, value: value)
            call.resolve()
        } catch {
            call.reject("write")
        }
    case "storeRemove":
        store.remove(user: user, keys: call.getArray("keys", String.self) ?? [])
        call.resolve()
    case "storeKeys":
        call.resolve(["keys": store.keys(user: user, prefix: call.getString("prefix") ?? "")])
    default:
        call.reject("unknown")
    }
}

/// NEOSIA on iOS: its encrypted store (the app's NEOSIA data, grades included, sealed), its screen with the
/// passive capture (NeosiaScreen.swift: the same allowlist and projection as Android, zero requests by Sulo),
/// and the hidden visit on opening the app when the user turned it on.
@objc(SuloNeosiaPlugin)
public class SuloNeosiaPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SuloNeosiaPlugin"
    public let jsName = "SuloNeosia"
    public let pluginMethods: [CAPPluginMethod] = ["storeGet", "storeSet", "storeRemove", "storeKeys", "wipe", "support", "open", "visit", "takeCaptures", "trialStats", "resetTrial"]
        .map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }

    @objc func storeGet(_ call: CAPPluginCall) { storeCall(.neosia, "storeGet", call) }
    @objc func storeSet(_ call: CAPPluginCall) { storeCall(.neosia, "storeSet", call) }
    @objc func storeRemove(_ call: CAPPluginCall) { storeCall(.neosia, "storeRemove", call) }
    @objc func storeKeys(_ call: CAPPluginCall) { storeCall(.neosia, "storeKeys", call) }

    /// One account's NEOSIA data, or every account's; web: NEOSIA's own WebKit data too ("Putuskan NEOSIA").
    @objc func wipe(_ call: CAPPluginCall) {
        if let user = call.getInt("user") { EncryptedStore.neosia.wipe(user: user) } else { EncryptedStore.neosia.wipeAll() }
        NeosiaQueue.take()
        guard call.getBool("web") == true else { return call.resolve() }
        DispatchQueue.main.async {
            let store = WKWebsiteDataStore.default()
            store.fetchDataRecords(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes()) { records in
                // NEOSIA's site only (unhas.ac.id); the app's own pages live under capacitor://localhost.
                let neosia = records.filter { $0.displayName == "unhas.ac.id" || $0.displayName.hasSuffix(".unhas.ac.id") }
                store.removeData(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(), for: neosia) { call.resolve() }
            }
        }
    }

    /** WKWebView has both what the capture needs (a document-start script and a message handler, iOS 14+). */
    @objc func support(_ call: CAPPluginCall) { call.resolve(["docStart": true, "listener": true, "webViewPackage": "WebKit"]) }

    /** One NEOSIA page from a tap; resolves when the screen closes (NeosiaSession.Result). */
    @objc func open(_ call: CAPPluginCall) {
        guard let page = NeosiaRules.page(call.getString("page")) else { return call.reject("page") }
        let close = call.getString("close") ?? "Tutup"
        let closeOnData = call.getBool("closeOnData") ?? false
        DispatchQueue.main.async {
            let screen = NeosiaViewController(page: page, closeLabel: close, closeOnData: closeOnData) { result in
                call.resolve(["result": result == .timeout ? "closed" : result.rawValue])
            }
            self.bridge?.viewController?.present(screen, animated: true)
        }
    }

    /** "Perbarui NEOSIA otomatis": Beranda hidden, at most 30 s, only while the app is in front. */
    @objc func visit(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard UIApplication.shared.applicationState == .active else { return call.resolve(["result": "unsupported"]) }
            NeosiaVisit.run(in: self.bridge?.viewController?.view.window) { result in
                switch result {
                case .data: call.resolve(["result": "data"])
                case .needsLogin: call.resolve(["result": "needs_login"])
                default: call.resolve(["result": "timeout"])
                }
            }
        }
    }

    @objc func takeCaptures(_ call: CAPPluginCall) { call.resolve(["messages": NeosiaQueue.take()]) }

    @objc func trialStats(_ call: CAPPluginCall) {
        call.resolve(["captures": NeosiaTrial.captures, "rejected": NeosiaTrial.rejected, "requests": [String: Int](), "pages": [String](), "largestBytes": 0,
                      "scriptOnLogin": NeosiaTrial.scriptOnLogin, "spaToLogin": NeosiaTrial.spaToLogin, "spaFromLogin": NeosiaTrial.spaFromLogin,
                      "webView": "iOS \(UIDevice.current.systemVersion)", "docStartSupported": true, "listenerSupported": true])
    }

    @objc func resetTrial(_ call: CAPPluginCall) {
        NeosiaTrial.reset()
        call.resolve()
    }
}

/// Sipakamase on iOS (Android SuloSipakamasePlugin): its own sign-in page with no script of Sulo's, the cookie
/// in its own Keychain vault, GETs to the five read paths only (refused before connecting otherwise, never a
/// redirect followed, hard rule 17), and its encrypted store.
@objc(SuloSipakamasePlugin)
public class SuloSipakamasePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SuloSipakamasePlugin"
    public let jsName = "SuloSipakamase"
    public let pluginMethods: [CAPPluginMethod] = ["storeGet", "storeSet", "storeRemove", "storeKeys", "signIn", "get", "status", "workerState", "forget"]
        .map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }

    @objc func storeGet(_ call: CAPPluginCall) { storeCall(.sipakamase, "storeGet", call) }
    @objc func storeSet(_ call: CAPPluginCall) { storeCall(.sipakamase, "storeSet", call) }
    @objc func storeRemove(_ call: CAPPluginCall) { storeCall(.sipakamase, "storeRemove", call) }
    @objc func storeKeys(_ call: CAPPluginCall) { storeCall(.sipakamase, "storeKeys", call) }

    static let vault = SessionVault(service: "dev.ikrar.sulo.sipakamase")
    static let http = SiteHttp(cookieName: Sipakamase.sessionCookie, maxBody: 1024 * 1024)

    @objc func signIn(_ call: CAPPluginCall) {
        let labels = LoginViewController.Labels(close: call.getString("close") ?? "Tutup", offline: call.getString("offline") ?? "", retry: call.getString("retry") ?? "Coba lagi")
        let site = LoginViewController.Site(host: Sipakamase.host, entry: URL(string: Sipakamase.entryURL)!, cookie: Sipakamase.sessionCookie, signedIn: Sipakamase.isSignedInPage)
        DispatchQueue.main.async {
            let login = LoginViewController(site: site, labels: labels) { outcome in
                switch outcome {
                case .cancelled: call.resolve(["result": "closed"])
                case .offline: call.resolve(["result": "offline"])
                case let .captured(cookie):
                    Self.vault.save(SikolaSession(moodleSession: cookie, sesskey: nil))
                    call.resolve(["result": "signed_in"])
                }
            }
            self.bridge?.viewController?.present(login, animated: true)
        }
    }

    /** One fragment: its status, whether it went to a login, and its HTML (never a cookie). */
    @objc func get(_ call: CAPPluginCall) {
        guard let path = call.getString("path"), Sipakamase.isReadPath(path) else { return call.reject("not allowed") }
        // The same serial queue as SIKOLA and the keeper: never two campus requests at once (hard rule 3).
        SikolaLock.queue.async {
            guard let session = Self.vault.session else { return call.resolve(["noSession": true]) }
            guard let reply = try? Self.http.get(Sipakamase.origin + path, cookie: session.moodleSession) else { return call.resolve(["networkError": true]) }
            if case let .replaced(fresh) = reply.cookie, (200 ... 299).contains(reply.status) { Self.vault.save(SikolaSession(moodleSession: fresh, sesskey: nil)) }
            let toLogin = (300 ... 399).contains(reply.status) || reply.status == 401 || reply.status == 403
            var out: [String: Any] = ["status": reply.status, "toLogin": toLogin, "html": toLogin ? "" : reply.body]
            // The session cookie's lifetime attributes only, never its value (the session log, A2).
            if let expires = reply.cookieExpires {
                out["cookieExpires"] = expires
                out["cookieMaxAge"] = reply.cookieMaxAge ?? NSNull()
            }
            call.resolve(out)
        }
    }

    @objc func status(_ call: CAPPluginCall) { call.resolve(["hasSession": Self.vault.session != nil]) }

    /** What the iPhone keeper did: times and counts only (Keeper.swift). */
    @objc func workerState(_ call: CAPPluginCall) {
        let s = Keeper.sipakamaseState()
        call.resolve(["lastAt": s.lastAt, "date": s.date, "count": s.count, "loginAt": s.loginAt, "okAt": s.okAt])
    }

    /// Putuskan: the vault, the keeper's state, every account's Sipakamase data and its key.
    @objc func forget(_ call: CAPPluginCall) {
        Self.vault.clear()
        Keeper.clearSipakamase()
        EncryptedStore.sipakamase.wipeAll()
        call.resolve()
    }
}
