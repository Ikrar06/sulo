import Foundation

/// Sulo's key-value store on iOS: one file per key in Application Support/SuloStore.
///
/// Why not @capacitor/preferences: on iOS it writes UserDefaults, a plain plist that goes
/// into iCloud and computer backups, while the Android app turns backups off
/// (android:allowBackup="false"). Here the folder is excluded from backups and every file
/// is readable only after the phone's first unlock. Each write replaces its file whole
/// (atomic), the iOS counterpart of SharedPreferences' commit(): whole or not at all.
/// No secret is stored here: secrets live in the Keychain (Keychain.swift).
final class FileStore {
    static let shared = FileStore()

    let directory: URL
    private let queue = DispatchQueue(label: "dev.ikrar.sulo.store")
    private let fileManager = FileManager.default

    init(directory: URL? = nil) {
        let base = directory ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("SuloStore", isDirectory: true)
        self.directory = base
        Self.prepare(base)
    }

    private static func prepare(_ url: URL) {
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true, attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var target = url
        try? target.setResourceValues(values)
    }

    /// A key as a file name: base64url of its UTF-8 bytes, so any key maps to one safe name and back.
    static func fileName(for key: String) -> String {
        Data(key.utf8).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    static func key(fromFileName name: String) -> String? {
        var s = name.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        while s.count % 4 != 0 { s += "=" }
        guard let data = Data(base64Encoded: s) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func url(for key: String) -> URL {
        directory.appendingPathComponent(Self.fileName(for: key), isDirectory: false)
    }

    func get(_ key: String) -> String? {
        queue.sync {
            guard let data = try? Data(contentsOf: url(for: key)) else { return nil }
            return String(data: data, encoding: .utf8)
        }
    }

    func set(_ key: String, _ value: String) throws {
        try queue.sync {
            Self.prepare(directory)
            try Data(value.utf8).write(to: url(for: key), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        }
    }

    func remove(_ key: String) throws {
        try queue.sync {
            let target = url(for: key)
            if fileManager.fileExists(atPath: target.path) { try fileManager.removeItem(at: target) }
        }
    }

    func keys() -> [String] {
        queue.sync {
            let names = (try? fileManager.contentsOfDirectory(atPath: directory.path)) ?? []
            return names.compactMap { Self.key(fromFileName: $0) }.sorted()
        }
    }

    /// Every key: "Keluar" and "Hapus semua data".
    func removeAll() throws {
        try queue.sync {
            for name in (try? fileManager.contentsOfDirectory(atPath: directory.path)) ?? [] {
                try fileManager.removeItem(at: directory.appendingPathComponent(name))
            }
        }
    }
}
