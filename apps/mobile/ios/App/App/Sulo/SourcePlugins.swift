import Capacitor
import Foundation
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

/// NEOSIA on iOS. Fase 2: its encrypted store (the app's NEOSIA data, grades included, sealed). The NEOSIA
/// screen with the passive reader (WKWebView, the same allowlist and projection) comes with Fase 4; until
/// then `support` says no and nothing opens.
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

    @objc func support(_ call: CAPPluginCall) { call.resolve(["docStart": false, "listener": false, "webViewPackage": NSNull()]) }
    @objc func open(_ call: CAPPluginCall) { call.resolve(["result": "closed"]) }
    @objc func visit(_ call: CAPPluginCall) { call.resolve(["result": "unsupported"]) }
    @objc func takeCaptures(_ call: CAPPluginCall) { call.resolve(["messages": [String]()]) }
    @objc func trialStats(_ call: CAPPluginCall) {
        call.resolve(["captures": [String: Int](), "rejected": [String: Int](), "requests": [String: Int](), "pages": [String](), "largestBytes": 0, "scriptOnLogin": 0, "spaToLogin": 0, "spaFromLogin": 0, "webView": "iOS", "docStartSupported": false, "listenerSupported": false])
    }
    @objc func resetTrial(_ call: CAPPluginCall) { call.resolve() }
}

/// Sipakamase on iOS. Fase 2: its encrypted store. Signing in (LoginViewController with Sipakamase's own
/// page), the five read-only GETs and the keeper come with Fase 4.
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

    @objc func signIn(_ call: CAPPluginCall) { call.resolve(["result": "closed"]) }
    @objc func get(_ call: CAPPluginCall) { call.resolve(["noSession": true]) }
    @objc func status(_ call: CAPPluginCall) { call.resolve(["hasSession": false]) }
    @objc func workerState(_ call: CAPPluginCall) { call.resolve(["lastAt": 0, "date": "", "count": 0, "loginAt": 0, "okAt": 0]) }

    /// Putuskan: every account's Sipakamase data and its key.
    @objc func forget(_ call: CAPPluginCall) {
        EncryptedStore.sipakamase.wipeAll()
        Keychain.deleteAll(service: "dev.ikrar.sulo.sipakamase")
        call.resolve()
    }
}
