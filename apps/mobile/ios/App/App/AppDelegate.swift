import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Background tasks must be registered before launch finishes (Fase 1: the probe's, no network).
        // A fresh install: an earlier install's Keychain items are removed before anything reads them.
        InstallMarker.cleanIfFresh()
        // Nothing of Sulo's goes into an iCloud or computer backup (Android: allowBackup="false").
        BackupGuard.apply()
        Keeper.register()
        ScreenGuard.shared.start()
        Probe.noteLaunch()
        #if DEBUG
        // Debug builds only: `simctl launch <sim> dev.ikrar.sulo -suloProbe write|status` runs the Fase 1
        // checks without the dev screen and prints them, so they can be checked from the terminal.
        if let i = CommandLine.arguments.firstIndex(of: "-suloProbe"), i + 1 < CommandLine.arguments.count {
            if CommandLine.arguments[i + 1] == "write" { Probe.write() }
            if CommandLine.arguments[i + 1] == "keeper" {
                // The keeper's gates on made-up plans (no request; Keeper.blocked is pure but for its counts file).
                let t = Int(Date().timeIntervalSince1970)
                let base: [String: Any] = [
                    "enabled": true, "writtenAt": t - 3600,
                    "remote": ["okAt": t - 3600, "config": ["globalEnabled": true, "keepAlive": ["enabled": true]]],
                    "budget": ["watchStopPosts": 40],
                    "schedule": ["dayStartMin": 360, "nightStartMin": 1320, "dayIntervalMin": 20, "nightIntervalMin": 110],
                ]
                func with(_ k: String, _ v: Any) -> [String: Any] { var p = base; p[k] = v; return p }
                let open = Keeper.blocked(base, at: t)
                let off = Keeper.blocked(with("enabled", false), at: t)
                let idle = Keeper.blocked(with("writtenAt", t - 8 * 86_400), at: t)
                let stale = Keeper.blocked(with("remote", ["okAt": t - 73 * 3600, "config": ["globalEnabled": true, "keepAlive": ["enabled": true]]]), at: t)
                let remote = Keeper.blocked(with("remote", ["okAt": t - 3600, "config": ["globalEnabled": true, "keepAlive": ["enabled": false]]]), at: t)
                let pace = Keeper.intervalMin(base, at: t)
                print("SULO_KEEPER open=\(open ?? "nil") off=\(off ?? "nil") idle=\(idle ?? "nil") stale=\(stale ?? "nil") remote=\(remote ?? "nil") pace=\(pace)")
            }
            if CommandLine.arguments[i + 1] == "stores" {
                // The vault's rules on a test service (never the real session) and one sealed round trip.
                let v = SessionVault(service: "dev.ikrar.sulo.selftest")
                v.save(SikolaSession(moodleSession: "c1", sesskey: "AbC123xyZ0"))
                let saved = v.session == SikolaSession(moodleSession: "c1", sesskey: "AbC123xyZ0") && v.status() == "connected"
                v.saveCandidate("c2")
                let promoted = v.promoteCandidate() == "c2" && v.session?.moodleSession == "c2"
                v.markSuspect("test")
                let suspect = v.suspectCount() == 1
                v.clearSuspect()
                v.markExpired("test")
                let expired = v.status() == "expired" && v.session == nil
                v.clear()
                let cleared = v.status() == "none"
                let store = EncryptedStore(name: "SuloSelfTest", keyService: "dev.ikrar.sulo.selftest.key")
                try? store.set(user: 7, key: "neosia:x", value: "{\"a\":1}")
                let sealed = store.get(user: 7, key: "neosia:x") == "{\"a\":1}" && store.keys(user: 7, prefix: "neosia:") == ["neosia:x"]
                store.wipeAll()
                let wiped = store.get(user: 7, key: "neosia:x") == nil
                let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
                let backup = BackupGuard.excluded(support)
                print("SULO_STORES saved=\(saved) promoted=\(promoted) suspect=\(suspect) expired=\(expired) cleared=\(cleared) sealed=\(sealed) wiped=\(wiped) backupExcluded=\(backup)")
            }
            if CommandLine.arguments[i + 1] == "signout" {
                // "Keluar" on made-up values (the simulator holds synthetic data only): every store it must empty.
                let v = SessionVault(service: "dev.ikrar.sulo.selftest")
                v.save(SikolaSession(moodleSession: "c1", sesskey: "AbC123xyZ0"))
                try? EncryptedStore.neosia.set(user: 7, key: "neosia:x", value: "1")
                try? EncryptedStore.sipakamase.set(user: 7, key: "sipakamase:x", value: "1")
                SuloSipakamasePlugin.vault.save(SikolaSession(moodleSession: "c1", sesskey: nil))
                Diag.shared.note("selftest")
                SuloSessionPlugin.signOut(vault: v) {
                    let sikola = v.status() == "none"
                    let neosia = EncryptedStore.neosia.get(user: 7, key: "neosia:x") == nil
                    let sipakamase = EncryptedStore.sipakamase.get(user: 7, key: "sipakamase:x") == nil && SuloSipakamasePlugin.vault.session == nil
                    let diag = Diag.shared.entries().isEmpty
                    print("SULO_SIGNOUT sikola=\(sikola) neosia=\(neosia) sipakamase=\(sipakamase) diag=\(diag)")
                }
            }
            Probe.status { status in
                let data = try? JSONSerialization.data(withJSONObject: status, options: [.sortedKeys])
                print("SULO_PROBE " + (data.flatMap { String(data: $0, encoding: .utf8) } ?? "{}"))
            }
        }
        #endif
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // WebKit creates its folder once a page has loaded (NEOSIA's first): marked before the next backup.
        BackupGuard.apply()
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}
