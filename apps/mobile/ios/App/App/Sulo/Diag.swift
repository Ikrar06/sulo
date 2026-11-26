import Foundation

/// The session's history on this phone (Android Diag): event codes and times only, never a value.
/// Codes keep to lowercase letters, digits and _:.>+-. Shown on the debug build's dev screen.
final class Diag {
    static let shared = Diag()
    private let queue = DispatchQueue(label: "dev.ikrar.sulo.diag")
    private let max = 200
    private let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyz0123456789_:.>+-")

    private var file: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("sulo-diag.json")
    }

    private func clean(_ code: String) -> String {
        String(code.lowercased().unicodeScalars.filter { allowed.contains($0) }.prefix(80))
    }

    func note(_ code: String) {
        let e = clean(code)
        guard !e.isEmpty else { return }
        queue.async {
            var list = self.entries()
            list.append(["at": Int(Date().timeIntervalSince1970), "e": e])
            if list.count > self.max { list.removeFirst(list.count - self.max) }
            if let data = try? JSONSerialization.data(withJSONObject: list) {
                try? data.write(to: self.file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            }
        }
    }

    func entries() -> [[String: Any]] {
        guard let data = try? Data(contentsOf: file), let list = (try? JSONSerialization.jsonObject(with: data)) as? [[String: Any]] else { return [] }
        return list
    }

    /** Waits for the notes already queued, so none lands after it (never called on the diag queue). */
    func clear() {
        queue.sync { try? FileManager.default.removeItem(at: self.file) }
    }
}
