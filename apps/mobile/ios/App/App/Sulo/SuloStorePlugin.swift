import Capacitor
import Foundation

/// SuloStore on iOS: the whole key-value store (get, set, remove, keys) on FileStore.
/// On Android the same plugin only writes (reads go through @capacitor/preferences);
/// src/platform/store.ts reads through this one on iOS.
@objc(SuloStorePlugin)
public class SuloStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SuloStorePlugin"
    public let jsName = "SuloStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remove", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "keys", returnType: CAPPluginReturnPromise),
    ]

    private let store = FileStore.shared

    @objc func get(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else { return call.reject("key") }
        call.resolve(["value": store.get(key) ?? NSNull()])
    }

    @objc func set(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), let value = call.getString("value") else { return call.reject("key") }
        do {
            try store.set(key, value)
            call.resolve()
        } catch {
            call.reject("write")
        }
    }

    @objc func remove(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else { return call.reject("key") }
        do {
            try store.remove(key)
            call.resolve()
        } catch {
            call.reject("remove")
        }
    }

    @objc func keys(_ call: CAPPluginCall) {
        call.resolve(["keys": store.keys()])
    }
}
