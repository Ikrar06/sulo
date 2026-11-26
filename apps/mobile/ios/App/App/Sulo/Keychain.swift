import Foundation
import Security

/// The Keychain, the only place Sulo keeps a secret on iOS (the SIKOLA and Sipakamase
/// sessions, from Fase 2). Readable after the phone's first unlock, so a background task
/// can use it, and never copied to another device: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly.
/// No access group and no sharing between apps (Sulo uses no entitlement).
enum Keychain {
    private static func base(service: String, account: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrSynchronizable as String: kCFBooleanFalse as Any,
        ]
    }

    @discardableResult
    static func set(_ data: Data, service: String, account: String) -> OSStatus {
        let query = base(service: service, account: account)
        let update: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        let status = SecItemUpdate(query as CFDictionary, update as CFDictionary)
        if status != errSecItemNotFound { return status }
        var add = query
        add.merge(update) { _, new in new }
        return SecItemAdd(add as CFDictionary, nil)
    }

    static func get(service: String, account: String) -> Data? {
        var query = base(service: service, account: account)
        query[kSecReturnData as String] = kCFBooleanTrue
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess else { return nil }
        return result as? Data
    }

    @discardableResult
    static func delete(service: String, account: String) -> OSStatus {
        SecItemDelete(base(service: service, account: account) as CFDictionary)
    }

    /// Every item of one service.
    @discardableResult
    static func deleteAll(service: String) -> OSStatus {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrSynchronizable as String: kSecAttrSynchronizableAny,
        ]
        return SecItemDelete(query as CFDictionary)
    }
}
