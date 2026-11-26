import CryptoKit
import Foundation

/// NEOSIA's and Sipakamase's data on iOS (Android NeosiaStore): per SIKOLA account, one file per key,
/// each value sealed with AES-GCM under a key that lives in the Keychain (after first unlock, this device
/// only). The folder is excluded from backups. Grades and the study card never leave it unsealed.
final class EncryptedStore {
    static let neosia = EncryptedStore(name: "SuloNeosia", keyService: "dev.ikrar.sulo.neosia.key")
    static let sipakamase = EncryptedStore(name: "SuloSipakamase", keyService: "dev.ikrar.sulo.sipakamase.key")

    private let root: URL
    private let keyService: String
    private let queue = DispatchQueue(label: "dev.ikrar.sulo.encrypted")

    init(name: String, keyService: String) {
        root = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent(name, isDirectory: true)
        self.keyService = keyService
    }

    private func key() -> SymmetricKey? {
        if let data = Keychain.get(service: keyService, account: "key") { return SymmetricKey(data: data) }
        let fresh = SymmetricKey(size: .bits256)
        let data = fresh.withUnsafeBytes { Data($0) }
        guard Keychain.set(data, service: keyService, account: "key") == errSecSuccess else { return nil }
        return fresh
    }

    private func files(_ user: Int) -> FileStore { FileStore(directory: root.appendingPathComponent("u\(user)", isDirectory: true)) }

    func get(user: Int, key name: String) -> String? {
        queue.sync {
            guard let sealed = files(user).get(name), let data = Data(base64Encoded: sealed), let key = key(),
                  let box = try? AES.GCM.SealedBox(combined: data), let plain = try? AES.GCM.open(box, using: key) else { return nil }
            return String(decoding: plain, as: UTF8.self)
        }
    }

    func set(user: Int, key name: String, value: String) throws {
        try queue.sync {
            guard let key = key(), let combined = try AES.GCM.seal(Data(value.utf8), using: key).combined else { throw CocoaError(.fileWriteUnknown) }
            try files(user).set(name, combined.base64EncodedString())
        }
    }

    func remove(user: Int, keys: [String]) {
        queue.sync { keys.forEach { try? files(user).remove($0) } }
    }

    func keys(user: Int, prefix: String) -> [String] {
        queue.sync { files(user).keys().filter { $0.hasPrefix(prefix) } }
    }

    func wipe(user: Int) {
        queue.sync { try? FileManager.default.removeItem(at: root.appendingPathComponent("u\(user)", isDirectory: true)) }
    }

    /** Every account's data and the key itself. */
    func wipeAll() {
        queue.sync {
            try? FileManager.default.removeItem(at: root)
            Keychain.deleteAll(service: keyService)
        }
    }
}

/// A fresh install: anything an earlier install of Sulo left in the Keychain is removed before first use
/// (Keychain items can outlive the app; Apple does not promise either way). Installing over the app
/// (an update, a weekly refresh) keeps the marker, so nothing is removed then.
enum InstallMarker {
    static let services = ["dev.ikrar.sulo.sikola", "dev.ikrar.sulo.sipakamase", "dev.ikrar.sulo.neosia.key", "dev.ikrar.sulo.sipakamase.key"]

    static func cleanIfFresh() {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let marker = dir.appendingPathComponent("sulo-installed")
        if FileManager.default.fileExists(atPath: marker.path) { return }
        for s in services { Keychain.deleteAll(service: s) }
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        try? Data("1".utf8).write(to: marker, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        Diag.shared.note("install_fresh")
    }
}
