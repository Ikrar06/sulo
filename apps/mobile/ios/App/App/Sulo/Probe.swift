import BackgroundTasks
import Foundation
import UIKit
import UserNotifications

/// Fase 1 checks on the owner's iPhone, with synthetic values only and no network at all:
/// - does the Keychain and the app's own storage survive installing the same .ipa again
///   (Sideloadly signs it again each time) and the weekly refresh;
/// - do scheduled notifications still show while the app's 7-day profile has expired;
/// - when does the app's profile expire (read from the app's own bundle);
/// - does iOS ever run Sulo's background tasks on a free Apple ID (they only write a time here).
/// Shown on the hidden dev screen. Removed or reduced to the diagnostics screen before release.
enum Probe {
    static let keychainService = "dev.ikrar.sulo.probe"
    static let keychainAccount = "fase1"
    static let storeKey = "probe:fase1"
    static let refreshTask = "dev.ikrar.sulo.probe.refresh"
    static let chargeTask = "dev.ikrar.sulo.probe.charge"
    static let notificationPrefix = "sulo.probe."

    private static var support: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    }

    private static var probeDir: URL {
        let dir = support.appendingPathComponent("SuloProbe", isDirectory: true)
        if !FileManager.default.fileExists(atPath: dir.path) {
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true, attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            var target = dir
            try? target.setResourceValues(values)
        }
        return dir
    }

    private static func readJSON(_ name: String) -> [String: Any]? {
        guard let data = try? Data(contentsOf: probeDir.appendingPathComponent(name)) else { return nil }
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }

    private static func writeJSON(_ name: String, _ value: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: value) else { return }
        try? data.write(to: probeDir.appendingPathComponent(name), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }

    private static func now() -> Int { Int(Date().timeIntervalSince1970) }

    // MARK: Launches

    /// Called once per launch: counts launches, and notes when a first launch (no marker in the
    /// app's own storage) still found the Keychain item, which means it outlived an uninstall.
    static func noteLaunch() {
        var marker = readJSON("install.json") ?? [:]
        if marker["firstLaunchAt"] == nil {
            marker["firstLaunchAt"] = now()
            marker["keychainLeftAtFirstLaunch"] = Keychain.get(service: keychainService, account: keychainAccount) != nil
        }
        marker["launches"] = ((marker["launches"] as? Int) ?? 0) + 1
        marker["lastLaunchAt"] = now()
        writeJSON("install.json", marker)
    }

    // MARK: The written check values

    /// Writes one synthetic value to the Keychain and one to the store, with the time.
    static func write() {
        let stamp = now()
        let value = "{\"writtenAt\":\(stamp)}"
        Keychain.set(Data(value.utf8), service: keychainService, account: keychainAccount)
        try? FileStore.shared.set(storeKey, value)
    }

    static func clear() {
        Keychain.delete(service: keychainService, account: keychainAccount)
        try? FileStore.shared.remove(storeKey)
        UNUserNotificationCenter.current().getPendingNotificationRequests { requests in
            let ids = requests.map(\.identifier).filter { $0.hasPrefix(notificationPrefix) }
            UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ids)
        }
    }

    private static func writtenAt(_ data: Data?) -> Any {
        guard let data, let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any], let at = json["writtenAt"] as? Int else { return NSNull() }
        return at
    }

    // MARK: Profile expiry

    static func profileExpiry() -> Int? { AppProfile.expiry() }

    // MARK: Background runs (the keeper's tasks, Keeper.swift)

    /** The keeper's background tasks (Keeper.swift) note each run here, for the Fase 1 card. */
    static func noteBackgroundRun(_ kind: String) {
        var log = readJSON("background.json") ?? [:]
        var runs = (log["runs"] as? [[String: Any]]) ?? []
        runs.insert(["kind": kind, "at": now()], at: 0)
        log["runs"] = Array(runs.prefix(50))
        log["total"] = ((log["total"] as? Int) ?? 0) + 1
        writeJSON("background.json", log)
    }

    // MARK: Notifications

    /// One notification in two minutes, and one at 09.00 on the 8th and the 9th day from now:
    /// those two fall after the 7-day profile ends, unless Sideloadly refreshed it.
    static func scheduleNotifications(completion: @escaping (Bool) -> Void) {
        let center = UNUserNotificationCenter.current()
        center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
            guard granted else { return completion(false) }
            let soon = UNMutableNotificationContent()
            soon.title = "Uji Sulo"
            soon.body = "Notifikasi uji dua menit. Kalau ini muncul, notifikasi terjadwal jalan."
            center.add(UNNotificationRequest(identifier: notificationPrefix + "soon", content: soon, trigger: UNTimeIntervalNotificationTrigger(timeInterval: 120, repeats: false)))
            for day in [8, 9] {
                let content = UNMutableNotificationContent()
                content.title = "Uji Sulo hari ke-\(day)"
                content.body = "Pengingat uji. Catat apakah ini muncul dan apakah Sulo saat itu masih bisa dibuka."
                content.sound = .default
                guard let date = Calendar.current.date(byAdding: .day, value: day, to: Date()) else { continue }
                var parts = Calendar.current.dateComponents([.year, .month, .day], from: date)
                parts.hour = 9
                parts.minute = 0
                center.add(UNNotificationRequest(identifier: notificationPrefix + "day\(day)", content: content, trigger: UNCalendarNotificationTrigger(dateMatching: parts, repeats: false)))
            }
            completion(true)
        }
    }

    // MARK: Status

    static func status(completion: @escaping ([String: Any]) -> Void) {
        UNUserNotificationCenter.current().getPendingNotificationRequests { requests in
            let pending: [[String: Any]] = requests.filter { $0.identifier.hasPrefix(notificationPrefix) }.map { request in
                var at: Any = NSNull()
                if let trigger = request.trigger as? UNCalendarNotificationTrigger, let next = trigger.nextTriggerDate() { at = Int(next.timeIntervalSince1970) }
                if let trigger = request.trigger as? UNTimeIntervalNotificationTrigger, let next = trigger.nextTriggerDate() { at = Int(next.timeIntervalSince1970) }
                return ["id": String(request.identifier.dropFirst(notificationPrefix.count)), "at": at]
            }
            DispatchQueue.main.async {
                let marker = readJSON("install.json") ?? [:]
                let background = readJSON("background.json") ?? [:]
                let refreshStatus: String
                switch UIApplication.shared.backgroundRefreshStatus {
                case .available: refreshStatus = "available"
                case .denied: refreshStatus = "denied"
                case .restricted: refreshStatus = "restricted"
                @unknown default: refreshStatus = "unknown"
                }
                completion([
                    "keychainWrittenAt": writtenAt(Keychain.get(service: keychainService, account: keychainAccount)),
                    "storeWrittenAt": writtenAt(FileStore.shared.get(storeKey).map { Data($0.utf8) }),
                    "firstLaunchAt": marker["firstLaunchAt"] ?? NSNull(),
                    "launches": marker["launches"] ?? 0,
                    "keychainLeftAtFirstLaunch": marker["keychainLeftAtFirstLaunch"] ?? false,
                    "profileExpiresAt": profileExpiry() ?? NSNull(),
                    "backgroundRefresh": refreshStatus,
                    "backgroundRuns": background["runs"] ?? [],
                    "backgroundTotal": background["total"] ?? 0,
                    "backgroundSubmitError": background["lastSubmitError"] ?? NSNull(),
                    "pending": pending,
                ])
            }
        }
    }
}
