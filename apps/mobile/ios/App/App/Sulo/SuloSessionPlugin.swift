import Capacitor
import Foundation
import LocalAuthentication
import UIKit

/// SuloSession on iOS (Android SuloSessionPlugin): the SIKOLA session held natively. JavaScript only ever
/// gets statuses and Moodle's JSON: the cookie and the sesskey never cross into it (mobile hard rule 2).
/// Background watching is Android's (WorkManager): its methods answer "nothing here" on iOS, and the iOS
/// keeper (PENJAGA-SESI.md A3) comes with Fase 3.
@objc(SuloSessionPlugin)
public class SuloSessionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SuloSessionPlugin"
    public let jsName = "SuloSession"
    public let pluginMethods: [CAPPluginMethod] = [
        "deviceInfo", "haptic", "login", "status", "endSession", "suspect", "note", "ready", "diagLog", "request", "page", "logout",
        "discardSession", "watchReset", "lockAvailable", "unlock", "openAppSettings", "secure",
        "watchApply", "watchTake", "watchStatus", "watchTakeOpen", "watchRunNow", "watchSimulate", "devTestBudget", "profileExpiry", "textScale", "share",
    ].map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }

    private let vault = SessionVault.shared
    private let http = SiteHttp(cookieName: Sikola.sessionCookie)
    private static let deferredKey = "dev.ikrar.sulo.deferredSync"

    // MARK: Device

    /// What the phone says about itself, for the performance tier (core perf/tier.ts). Memory only.
    /// iOS has no low-RAM flag; Low Power Mode asks for the same light tier, so it stands in for it.
    @objc func deviceInfo(_ call: CAPPluginCall) {
        let info = ProcessInfo.processInfo
        call.resolve([
            "lowRamDevice": info.isLowPowerModeEnabled,
            "totalRamMb": Int(info.physicalMemory / 1_048_576),
            "cpuCores": info.activeProcessorCount,
            "webView": "iOS " + UIDevice.current.systemVersion,
        ])
    }

    @objc func haptic(_ call: CAPPluginCall) {
        let firm = call.getString("kind") == "firm"
        DispatchQueue.main.async {
            UIImpactFeedbackGenerator(style: firm ? .medium : .light).impactOccurred()
            call.resolve()
        }
    }

    @objc func ready(_ call: CAPPluginCall) { call.resolve() }

    @objc func note(_ call: CAPPluginCall) {
        if let e = call.getString("e") { Diag.shared.note("app:\(e)") }
        call.resolve()
    }

    @objc func diagLog(_ call: CAPPluginCall) {
        #if DEBUG
        call.resolve(["events": Diag.shared.entries()])
        #else
        call.reject("not available")
        #endif
    }

    // MARK: Session

    @objc func status(_ call: CAPPluginCall) {
        SikolaLock.queue.async { call.resolve(["status": self.vault.status()]) }
    }

    /// SIKOLA's own login page; once signed in, one GET /my/ for the sesskey (the user's own activity).
    @objc func login(_ call: CAPPluginCall) {
        let labels = LoginViewController.Labels(close: call.getString("close") ?? "Tutup", offline: call.getString("offline") ?? "", retry: call.getString("retry") ?? "Coba lagi")
        let site = LoginViewController.Site(host: Sikola.host, entry: URL(string: Sikola.loginURL)!, cookie: Sikola.sessionCookie, signedIn: Sikola.isSignedInPage)
        DispatchQueue.main.async {
            let login = LoginViewController(site: site, labels: labels) { outcome in
                switch outcome {
                case .cancelled: call.resolve(["status": "cancelled"])
                case .offline: call.resolve(["status": "offline"])
                case let .captured(cookie):
                    // Answered once the vault holds the session, so the first sync finds it.
                    self.protected("sulo-signin") {
                        self.finishSignIn(cookie)
                        call.resolve(["status": "connected"])
                    }
                }
            }
            self.bridge?.viewController?.present(login, animated: true)
        }
    }

    private func finishSignIn(_ cookie: String) {
        let page = try? http.get("\(Sikola.origin)/my/", cookie: cookie)
        let sesskey = page.flatMap { $0.status == 200 ? SikolaText.sesskey($0.body) : nil }
        // A cookie /my/ set counts only with a signed-in page (nothing is in the vault yet).
        var chosen = cookie
        if let page, case let .replaced(fresh) = page.cookie, sesskey != nil { chosen = fresh }
        vault.save(SikolaSession(moodleSession: chosen, sesskey: sesskey))
        Diag.shared.note("signed_in")
    }

    /// The session is over for sure: core asked twice and SIKOLA said "log in" both times.
    @objc func endSession(_ call: CAPPluginCall) {
        let reason = String((call.getString("reason") ?? "").prefix(60))
        SikolaLock.queue.async {
            self.vault.markExpired("confirmed:\(reason)")
            call.resolve(["status": self.vault.status()])
        }
    }

    @objc func suspect(_ call: CAPPluginCall) {
        let deferred = UserDefaults.standard.bool(forKey: Self.deferredKey)
        if deferred { UserDefaults.standard.removeObject(forKey: Self.deferredKey) }
        SikolaLock.queue.async { call.resolve(["suspect": self.vault.status() == "connected" && self.vault.suspectCount() > 0, "deferred": deferred]) }
    }

    /// "Batal" on the different-account screen: the new session is thrown away; the state reads expired.
    @objc func discardSession(_ call: CAPPluginCall) {
        SikolaLock.queue.async {
            self.vault.markExpired("discarded")
            call.resolve(["status": self.vault.status()])
        }
    }

    /// "Keluar": the vault and the deferred flag. SIKOLA's sign-in page keeps nothing in WebKit (non-persistent);
    /// NEOSIA's and Sipakamase's own data go through their plugins' wipe and forget.
    @objc func logout(_ call: CAPPluginCall) {
        SikolaLock.queue.async {
            self.vault.clear()
            Keeper.clear()
            UserDefaults.standard.removeObject(forKey: Self.deferredKey)
            call.resolve(["status": "none"])
        }
    }

    // MARK: Requests

    /// Runs `work` on the SIKOLA queue while iOS lets the app finish it in the background: a request cut
    /// off mid-way makes SIKOLA end the session (seen on Android, 20 Nov 2026).
    private func protected(_ name: String, _ work: @escaping () -> Void) {
        var task: UIBackgroundTaskIdentifier = .invalid
        task = UIApplication.shared.beginBackgroundTask(withName: name) {
            UIApplication.shared.endBackgroundTask(task)
            task = .invalid
        }
        SikolaLock.queue.async {
            work()
            DispatchQueue.main.async {
                if task != .invalid { UIApplication.shared.endBackgroundTask(task) }
            }
        }
    }

    /// The app is going away: no request starts now, the sync waits for the next open (owner's rule, 20 Nov 2026).
    private func deferIfClosing(_ call: CAPPluginCall) -> Bool {
        let background = onMain { UIApplication.shared.applicationState == .background }
        guard background else { return false }
        UserDefaults.standard.set(true, forKey: Self.deferredKey)
        Diag.shared.note("request_deferred")
        call.resolve(["deferred": true, "sessionStatus": vault.status()])
        return true
    }

    private func onMain<T>(_ f: () -> T) -> T { Thread.isMainThread ? f() : DispatchQueue.main.sync(execute: f) }

    @objc func request(_ call: CAPPluginCall) {
        guard let body = call.getString("body") else { return call.reject("body missing") }
        guard let functions = SikolaRequest.allowedFunctions(body) else { return call.reject("not allowlisted") }
        let userInitiated = call.getBool("userInitiated") ?? false
        let fresh = call.getBool("fresh") ?? false
        if deferIfClosing(call) { return }
        protected("sulo-request") { self.batch(call, body: body, functions: functions, userInitiated: userInitiated, fresh: fresh) }
    }

    private func batch(_ call: CAPPluginCall, body: String, functions: [String], userInitiated: Bool, fresh: Bool) {
        var current: SikolaSession
        switch vault.read() {
        case .empty: return call.resolve(["sessionStatus": vault.status()])
        case .unavailable: return call.resolve(["networkError": "VaultUnavailable", "sessionStatus": vault.status()])
        case let .ok(s): current = s
        }
        do {
            // A sesskey only comes from the user's own activity (sign-in, or a sync they started).
            if current.sesskey == nil {
                if !userInitiated { return call.resolve(["sessionStatus": "connected", "needsUser": true]) }
                switch try refreshSesskey(current) {
                case let .ok(s): current = s
                case .toLogin: return toLogin(call, "my")
                case .none: return call.resolve(["networkError": "NoSesskey", "sessionStatus": vault.status()])
                }
            }
            var keeper = CookieKeeper(current, vault: vault)
            var reply = try http.postJSON(SikolaRequest.batchURL(sesskey: current.sesskey!, functions: functions, userInitiated: userInitiated), cookie: current.moodleSession, body: body, fresh: fresh)
            keeper.seen(reply.cookie)
            keeper.settle(SikolaRequest.sessionAnswered(reply.body, functions: functions))
            current = keeper.session
            if SikolaRequest.invalidSesskey(reply.body, functions: functions) && userInitiated {
                current.sesskey = nil
                switch try refreshSesskey(current) {
                case let .ok(s): current = s
                case .toLogin: return toLogin(call, "my")
                case .none: return call.resolve(["networkError": "NoSesskey", "sessionStatus": vault.status()])
                }
                keeper = CookieKeeper(current, vault: vault)
                reply = try http.postJSON(SikolaRequest.batchURL(sesskey: current.sesskey!, functions: functions, userInitiated: true), cookie: current.moodleSession, body: body, fresh: fresh)
                keeper.seen(reply.cookie)
                keeper.settle(SikolaRequest.sessionAnswered(reply.body, functions: functions))
            }
            if (300 ... 399).contains(reply.status), reply.location?.contains("/login/") == true { return toLogin(call, "batch") }
            if SikolaRequest.loginRequired(reply.body, functions: functions) {
                // SIKOLA said "log in" once; core asks again before anything ends.
                Diag.shared.note("sikola_login_signal:batch:\(SikolaRequest.sessionCodes(reply.body, functions: functions).first ?? "?")")
            } else if SikolaRequest.sessionAnswered(reply.body, functions: functions) {
                vault.clearSuspect()
                // The session works: a later end may be offered again (Keeper.offerRelogin).
                Keeper.clearOffer()
            }
            call.resolve(["httpStatus": reply.status, "body": reply.body, "sessionStatus": vault.status()])
        } catch SiteHttp.Failure.network(let kind) {
            call.resolve(["networkError": kind, "sessionStatus": vault.status()])
        } catch {
            call.resolve(["networkError": "Unknown", "sessionStatus": vault.status()])
        }
    }

    private enum Refresh {
        case ok(SikolaSession)
        case toLogin
        case none
    }

    /// GET /my/ for a fresh sesskey. A redirect to SIKOLA's login is reported, never acted on here.
    private func refreshSesskey(_ session: SikolaSession) throws -> Refresh {
        let keeper = CookieKeeper(session, vault: vault)
        let page = try http.get("\(Sikola.origin)/my/", cookie: session.moodleSession)
        keeper.seen(page.cookie)
        keeper.settle(page.status == 200 && SikolaText.sesskey(page.body) != nil)
        if (300 ... 399).contains(page.status), page.location?.contains("/login/") == true { return .toLogin }
        guard let sesskey = SikolaText.sesskey(page.body) else { return .none }
        var next = keeper.session
        next.sesskey = sesskey
        vault.save(next)
        return .ok(next)
    }

    private func toLogin(_ call: CAPPluginCall, _ where: String) {
        Diag.shared.note("sikola_login_signal:redirect:\(`where`)")
        call.resolve(["httpStatus": 303, "body": "", "toLogin": true, "sessionStatus": vault.status()])
    }

    /// One allowlisted SIKOLA page (attendance only), for something the user started; stripped for JavaScript.
    @objc func page(_ call: CAPPluginCall) {
        guard let path = call.getString("path"), let url = SikolaPage.allowedURL(path) else { return call.reject("not allowlisted") }
        guard call.getBool("userInitiated") == true else { return call.reject("user only") }
        if deferIfClosing(call) { return }
        protected("sulo-page") {
            guard case let .ok(session) = self.vault.read() else { return call.resolve(["sessionStatus": self.vault.status()]) }
            do {
                let keeper = CookieKeeper(session, vault: self.vault)
                let reply = try self.http.get(url, cookie: session.moodleSession)
                keeper.seen(reply.cookie)
                // A page cannot show the session is valid by itself: a new cookie from it is never used.
                keeper.settle(false)
                if (300 ... 399).contains(reply.status) {
                    let login = reply.location?.contains("/login/") == true
                    Diag.shared.note(login ? "sikola_login_signal:redirect:page" : "sikola_page_redirect")
                    return call.resolve(["httpStatus": reply.status, "html": "", "toLogin": login, "sessionStatus": self.vault.status()])
                }
                call.resolve(["httpStatus": reply.status, "html": SikolaPage.forJS(reply.body, secrets: [session.sesskey].compactMap { $0 }), "sessionStatus": self.vault.status()])
            } catch SiteHttp.Failure.network(let kind) {
                call.resolve(["networkError": kind, "sessionStatus": self.vault.status()])
            } catch {
                call.resolve(["networkError": "Unknown", "sessionStatus": self.vault.status()])
            }
        }
    }

    // MARK: App lock

    @objc func lockAvailable(_ call: CAPPluginCall) {
        var error: NSError?
        call.resolve(["available": LAContext().canEvaluatePolicy(.deviceOwnerAuthentication, error: &error)])
    }

    /// Face ID or Touch ID, else the phone's passcode. Never unlocked by default.
    @objc func unlock(_ call: CAPPluginCall) {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            return call.resolve(["unlocked": false, "reason": "no_device_lock"])
        }
        context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: "Sulo") { ok, _ in
            call.resolve(["unlocked": ok])
        }
    }

    @objc func openAppSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
            call.resolve()
        }
    }

    /// iOS cannot block screenshots: while grades show, a cover in the app switcher and a mask while recording.
    @objc func secure(_ call: CAPPluginCall) {
        ScreenGuard.shared.secure = call.getBool("on") ?? false
        call.resolve()
    }

    // MARK: The keeper (Keeper.swift); Android's watching answers the rest with nothing

    /// The phone's text size (Settings, Display, Text Size) as a factor of the default, clamped like Android's
    /// textZoom (85 to 130 percent): WKWebView does not follow Dynamic Type on its own.
    @objc func textScale(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let factor = UIFontMetrics(forTextStyle: .body).scaledValue(for: 17, compatibleWith: UITraitCollection(preferredContentSizeCategory: UIApplication.shared.preferredContentSizeCategory)) / 17
            call.resolve(["scale": min(1.3, max(0.85, (factor * 100).rounded() / 100))])
        }
    }

    /// The share sheet for Sulo's own guide ("Kirim tautan ke laptop"): sulo.ikrar.dev links only.
    @objc func share(_ call: CAPPluginCall) {
        guard let s = call.getString("url"), let url = URL(string: s), url.scheme == "https", url.host == "sulo.ikrar.dev" else { return call.reject("url") }
        let text = call.getString("text") ?? ""
        DispatchQueue.main.async {
            let sheet = UIActivityViewController(activityItems: [text, url], applicationActivities: nil)
            sheet.completionWithItemsHandler = { _, done, _, _ in call.resolve(["shared": done]) }
            sheet.popoverPresentationController?.sourceView = self.bridge?.viewController?.view
            self.bridge?.viewController?.present(sheet, animated: true)
        }
    }

    @objc func profileExpiry(_ call: CAPPluginCall) { call.resolve(["at": AppProfile.expiry() ?? NSNull()]) }
    @objc func watchReset(_ call: CAPPluginCall) {
        SikolaLock.queue.async {
            Keeper.clear()
            call.resolve()
        }
    }
    @objc func watchApply(_ call: CAPPluginCall) {
        let plan = call.getString("plan") ?? "{}"
        SikolaLock.queue.async {
            Keeper.apply(plan)
            call.resolve()
        }
    }
    @objc func watchTake(_ call: CAPPluginCall) { call.resolve(["answers": [String](), "fullSync": false]) }
    @objc func watchStatus(_ call: CAPPluginCall) { SikolaLock.queue.async { call.resolve(Keeper.status()) } }
    @objc func watchTakeOpen(_ call: CAPPluginCall) { call.resolve(["id": NSNull()]) }
    @objc func watchRunNow(_ call: CAPPluginCall) { call.reject("not available") }
    @objc func watchSimulate(_ call: CAPPluginCall) { call.reject("not available") }
    @objc func devTestBudget(_ call: CAPPluginCall) { call.reject("not available") }
}
