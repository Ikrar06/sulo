import Foundation
import Security

/// One signed-in session: the cookie and, once read from a signed-in page, the sesskey.
struct SikolaSession: Codable, Equatable {
    var moodleSession: String
    var sesskey: String?
}

/// The SIKOLA session on iOS, the Android SessionVault's rules over the Keychain (mobile hard rule 2):
/// one Keychain item (after first unlock, this device only, never synced) holds the cookie, the sesskey,
/// the state, the suspicion count and a candidate cookie. Nothing of it is ever handed to JavaScript.
///
/// - Only `markExpired` ends a session: after core asked SIKOLA twice, or the user's Keluar or Batal.
/// - A read that fails (the phone not unlocked yet since it started) never deletes the session.
/// - A cookie SIKOLA sets is a candidate until the same answer shows a valid session.
final class SessionVault {
    enum Read {
        case empty
        case ok(SikolaSession)
        /** The item is there but cannot be read right now: kept, try again later. */
        case unavailable(OSStatus)
    }

    private struct Record: Codable {
        var state: String
        var session: SikolaSession?
        var suspect: Int
        var candidate: String?
    }

    static let shared = SessionVault(service: "dev.ikrar.sulo.sikola")

    let service: String
    private let account = "vault"
    private let queue = DispatchQueue(label: "dev.ikrar.sulo.vault")

    init(service: String) {
        self.service = service
    }

    private func load() -> (Record?, OSStatus) {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: kCFBooleanTrue as Any,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        query[kSecAttrSynchronizable as String] = kCFBooleanFalse
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return (nil, status) }
        return (try? JSONDecoder().decode(Record.self, from: data), status)
    }

    /** The state alone (no secret) mirrored outside the Keychain, for `status()` while the Keychain cannot be read. */
    private var stateMirrorKey: String { "\(service).state" }

    private func store(_ record: Record) {
        guard let data = try? JSONEncoder().encode(record) else { return }
        Keychain.set(data, service: service, account: account)
        UserDefaults.standard.set(record.state == "connected" && record.session == nil ? "none" : record.state, forKey: stateMirrorKey)
    }

    func save(_ session: SikolaSession) {
        queue.sync { store(Record(state: "connected", session: session, suspect: 0, candidate: nil)) }
        Diag.shared.note("vault_saved")
    }

    func read() -> Read {
        queue.sync {
            let (record, status) = load()
            if status == errSecItemNotFound { return .empty }
            guard status == errSecSuccess, let record else { return status == errSecSuccess ? .empty : .unavailable(status) }
            guard record.state == "connected", let session = record.session else { return .empty }
            return .ok(session)
        }
    }

    var session: SikolaSession? {
        if case let .ok(s) = read() { return s }
        return nil
    }

    func status() -> String {
        queue.sync {
            let (record, status) = load()
            // Not readable right now (not unlocked since the phone started): the last known state; the session is kept.
            if status == errSecInteractionNotAllowed { return UserDefaults.standard.string(forKey: stateMirrorKey) ?? "none" }
            guard let record else { return "none" }
            if record.state == "expired" { return "expired" }
            return record.state == "connected" && record.session != nil ? "connected" : "none"
        }
    }

    func markExpired(_ reason: String) {
        queue.sync { store(Record(state: "expired", session: nil, suspect: 0, candidate: nil)) }
        Diag.shared.note("vault_expired:\(reason)")
    }

    func markSuspect(_ reason: String) {
        queue.sync {
            guard var r = load().0 else { return }
            r.suspect += 1
            store(r)
        }
        Diag.shared.note("vault_suspect:\(reason)")
    }

    func suspectCount() -> Int { queue.sync { load().0?.suspect ?? 0 } }

    func clearSuspect() {
        queue.sync {
            guard var r = load().0, r.suspect > 0 else { return }
            r.suspect = 0
            store(r)
        }
    }

    func saveCandidate(_ cookie: String) {
        queue.sync {
            guard var r = load().0 else { return }
            r.candidate = cookie
            store(r)
        }
    }

    /** The answer was a valid session: the candidate becomes the session's cookie. */
    func promoteCandidate() -> String? {
        queue.sync {
            guard var r = load().0, let c = r.candidate, var s = r.session else { return nil }
            s.moodleSession = c
            r.session = s
            r.candidate = nil
            store(r)
            return c
        }
    }

    func dropCandidate() {
        queue.sync {
            guard var r = load().0, r.candidate != nil else { return }
            r.candidate = nil
            store(r)
        }
    }

    /** Keluar: nothing left. */
    func clear() {
        queue.sync {
            _ = Keychain.deleteAll(service: service)
            UserDefaults.standard.removeObject(forKey: stateMirrorKey)
        }
        Diag.shared.note("vault_cleared")
    }
}

/// Watches the cookie SIKOLA sets in one answer (Android CookieKeeper): a replaced cookie is kept as a
/// candidate; `settle` makes it the session's only when that answer showed a valid session.
final class CookieKeeper {
    private(set) var session: SikolaSession
    private let vault: SessionVault
    private(set) var pending: String?

    init(_ session: SikolaSession, vault: SessionVault) {
        self.session = session
        self.vault = vault
    }

    func seen(_ cookie: SikolaText.SessionCookie) {
        switch cookie {
        case let .replaced(value):
            pending = value
            vault.saveCandidate(value)
            Diag.shared.note("sikola_cookie_replaced")
        case .cleared:
            Diag.shared.note("sikola_cookie_cleared")
        default:
            break
        }
    }

    func settle(_ sessionValid: Bool) {
        guard pending != nil else { return }
        pending = nil
        if sessionValid, let c = vault.promoteCandidate() { session.moodleSession = c } else { vault.dropCandidate() }
    }
}
