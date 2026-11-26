import BackgroundTasks
import Foundation
import UserNotifications

/// When the app's 7-day profile ends: read from the app's own bundle (embedded.mobileprovision, a signed
/// file whose middle is a plain XML plist). Only the date is read. Nil in the simulator.
enum AppProfile {
    static func expiry() -> Int? {
        guard let url = Bundle.main.url(forResource: "embedded", withExtension: "mobileprovision"),
              let data = try? Data(contentsOf: url),
              let start = data.range(of: Data("<?xml".utf8)),
              let end = data.range(of: Data("</plist>".utf8), in: start.lowerBound ..< data.endIndex) else { return nil }
        let plist = data.subdata(in: start.lowerBound ..< end.upperBound)
        guard let dict = (try? PropertyListSerialization.propertyList(from: plist, format: nil)) as? [String: Any],
              let date = dict["ExpirationDate"] as? Date else { return nil }
        return Int(date.timeIntervalSince1970)
    }
}

/// The iPhone's session keeper (owner's decision of 26 Nov 2026, docs/ios/PENJAGA-SESI.md A3): in the
/// time iOS gives a background task, one ping to SIKOLA (core_session_time_remaining alone, counted as
/// activity, the same as a sync the user started). No JavaScript, no content read: only whether the session
/// is still there. Never promised to the user: iOS decides when, if ever, it runs.
///
/// The same switches as the Android worker, from the plan the app writes (watchApply): the user's "Pantau
/// tugas baru", the remote config (and its last good read, at most 72 hours old), the daily stop, quiet
/// hours, and nothing after 7 days without the app. When SIKOLA says "log in" twice, the session is only
/// marked suspect (the app confirms), and "Masuk lagi" is offered once: in the next morning summary when
/// it is on, else in one notice.
enum Keeper {
    static let refreshTask = "dev.ikrar.sulo.keep.refresh"
    static let chargeTask = "dev.ikrar.sulo.keep.charge"
    private static let day = 86_400

    private static var dir: URL {
        let d = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("SuloKeeper", isDirectory: true)
        if !FileManager.default.fileExists(atPath: d.path) {
            try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true, attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            var target = d
            try? target.setResourceValues(values)
        }
        return d
    }

    private static func readJSON(_ name: String) -> [String: Any]? {
        guard let data = try? Data(contentsOf: dir.appendingPathComponent(name)) else { return nil }
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }

    private static func writeJSON(_ name: String, _ value: Any) {
        guard let data = try? JSONSerialization.data(withJSONObject: value) else { return }
        try? data.write(to: dir.appendingPathComponent(name), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }

    private static func now() -> Int { Int(Date().timeIntervalSince1970) }

    // MARK: The plan

    static func apply(_ planJSON: String) {
        guard let data = planJSON.data(using: .utf8), let plan = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return }
        writeJSON("plan.json", plan)
        schedule()
    }

    private static func plan() -> [String: Any]? { readJSON("plan.json") }

    /** Why the keeper does not ping now, or nil when it may. */
    static func blocked(_ plan: [String: Any], at t: Int) -> String? { commonBlocked(plan, at: t) ?? sikolaBlocked(plan, at: t) }

    /** The switches every keeper step obeys: the user's switch, 7 days without the app, the remote config. */
    static func commonBlocked(_ plan: [String: Any], at t: Int) -> String? {
        guard plan["enabled"] as? Bool == true else { return "off" }
        let written = plan["writtenAt"] as? Int ?? 0
        if t - written > 7 * day { return "idle_7d" }
        let remote = plan["remote"] as? [String: Any]
        let okAt = remote?["okAt"] as? Int ?? 0
        if okAt == 0 || t - okAt > 72 * 3600 { return "config_stale" }
        let config = remote?["config"] as? [String: Any]
        let keep = config?["keepAlive"] as? [String: Any]
        if config?["globalEnabled"] as? Bool == false || keep?["enabled"] as? Bool == false { return "remote_off" }
        // Below a required update the keeper holds, as Android's worker does (it compares with its own version).
        let installed = Int(Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "0") ?? 0
        if let min = config?["minVersionCode"] as? Int, min > installed { return "update_required" }
        return nil
    }

    /** SIKOLA's own: the daily stop and the pace. */
    static func sikolaBlocked(_ plan: [String: Any], at t: Int) -> String? {
        let budget = plan["budget"] as? [String: Any]
        let stop = budget?["watchStopPosts"] as? Int ?? 0
        let counts = readJSON("counts.json") ?? [:]
        if counts["date"] as? String == dateKey(t), (counts["posts"] as? Int ?? 0) >= stop { return "daily_stop" }
        let last = counts["lastAt"] as? Int ?? 0
        if last > 0 && t - last < intervalMin(plan, at: t) * 60 - 5 * 60 { return "not_yet" }
        return nil
    }

    private static func dateKey(_ t: Int) -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date(timeIntervalSince1970: TimeInterval(t)))
    }

    private static func minuteOfDay(_ t: Int) -> Int {
        let c = Calendar.current.dateComponents([.hour, .minute], from: Date(timeIntervalSince1970: TimeInterval(t)))
        return (c.hour ?? 0) * 60 + (c.minute ?? 0)
    }

    /** The plan's pace for this time of day (Android: 20 minutes in the day, 110 at night by default). */
    static func intervalMin(_ plan: [String: Any], at t: Int) -> Int {
        let s = plan["schedule"] as? [String: Any] ?? [:]
        let dayStart = s["dayStartMin"] as? Int ?? 360
        let nightStart = s["nightStartMin"] as? Int ?? 1320
        let m = minuteOfDay(t)
        let isDay = dayStart < nightStart ? (m >= dayStart && m < nightStart) : (m >= dayStart || m < nightStart)
        return (isDay ? s["dayIntervalMin"] as? Int : s["nightIntervalMin"] as? Int) ?? 110
    }

    // MARK: Background tasks

    static func register() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: refreshTask, using: nil) { task in handle(task, kind: "refresh") }
        BGTaskScheduler.shared.register(forTaskWithIdentifier: chargeTask, using: nil) { task in handle(task, kind: "charge") }
    }

    private static func handle(_ task: BGTask, kind: String) {
        Probe.noteBackgroundRun(kind)
        let work = DispatchWorkItem { run(reason: kind) }
        task.expirationHandler = { work.cancel() }
        SikolaLock.queue.async {
            if !work.isCancelled { work.perform() }
            schedule()
            task.setTaskCompleted(success: true)
        }
    }

    /** Asks iOS for the next chances (it decides; a refresh task is often hours late or never). */
    static func schedule() {
        let pace = plan().map { intervalMin($0, at: now()) } ?? 110
        let refresh = BGAppRefreshTaskRequest(identifier: refreshTask)
        refresh.earliestBeginDate = Date(timeIntervalSinceNow: TimeInterval(pace * 60))
        let charge = BGProcessingTaskRequest(identifier: chargeTask)
        charge.requiresExternalPower = true
        charge.requiresNetworkConnectivity = true
        charge.earliestBeginDate = Date(timeIntervalSinceNow: TimeInterval(pace * 60))
        try? BGTaskScheduler.shared.submit(refresh)
        try? BGTaskScheduler.shared.submit(charge)
    }

    // MARK: One run

    private static func record(_ outcome: String, at t: Int) {
        var counts = readJSON("counts.json") ?? [:]
        if counts["date"] as? String != dateKey(t) { counts = ["date": dateKey(t), "posts": 0] }
        if outcome != "blocked" {
            counts["posts"] = (counts["posts"] as? Int ?? 0) + 1
            counts["lastAt"] = t
        }
        writeJSON("counts.json", counts)
        var timings = (readJSON("timings.json")?["list"] as? [[String: Any]]) ?? []
        timings.append(["ranAt": t, "plannedAt": 0, "ms": 0, "bytes": 0, "outcome": outcome])
        writeJSON("timings.json", ["list": Array(timings.suffix(50))])
    }

    /** One keeper step (on the SIKOLA queue). Returns an outcome code for the timings, never content. */
    @discardableResult
    static func run(reason: String) -> String {
        let t = now()
        guard let plan = plan() else { return "no_plan" }
        if let why = commonBlocked(plan, at: t) { return why }
        // Sipakamase keeps its own pace (SipakamaseKeep), riding the same wake.
        sipakamaseStep(plan, at: t)
        if let why = sikolaBlocked(plan, at: t) { return why }
        let vault = SessionVault.shared
        guard case let .ok(session) = vault.read(), let sesskey = session.sesskey else { return "no_session" }
        let http = SiteHttp(cookieName: Sikola.sessionCookie)
        let body = #"[{"index":0,"methodname":"core_session_time_remaining","args":{}}]"#
        let functions = ["core_session_time_remaining"]
        func ask(fresh: Bool) -> String {
            guard let reply = try? http.postJSON(SikolaRequest.batchURL(sesskey: sesskey, functions: functions, userInitiated: true), cookie: session.moodleSession, body: body, fresh: fresh) else { return "network" }
            let keeper = CookieKeeper(session, vault: vault)
            keeper.seen(reply.cookie)
            keeper.settle(SikolaRequest.sessionAnswered(reply.body, functions: functions))
            if (300 ... 399).contains(reply.status), reply.location?.contains("/login/") == true { return "login" }
            if SikolaRequest.loginRequired(reply.body, functions: functions) { return "login" }
            return SikolaRequest.sessionAnswered(reply.body, functions: functions) ? "ok" : "status_\(reply.status)"
        }
        var outcome = ask(fresh: false)
        record(outcome, at: t)
        if outcome == "ok" { vault.clearSuspect() }
        if outcome == "login" {
            // Asked twice, a few seconds apart over a new connection, before anything is said.
            Thread.sleep(forTimeInterval: 4)
            outcome = ask(fresh: true)
            record(outcome == "login" ? "login_confirmed" : outcome, at: now())
            if outcome == "login" {
                vault.markSuspect("keeper")
                var ends = (readJSON("ends.json")?["list"] as? [[String: Any]]) ?? []
                ends.append(["at": now(), "sinceLastOkSec": NSNull(), "heldBack": false])
                writeJSON("ends.json", ["list": Array(ends.suffix(30))])
                offerRelogin(plan)
            }
        }
        Diag.shared.note("keeper:\(reason):\(outcome)")
        return outcome
    }

    // MARK: Sipakamase (hard rule 17: one rotating GET, every 3 hours or slower, 10 a day with the app's)

    static func sipakamaseState() -> SipakamaseKeep.State {
        guard let data = try? Data(contentsOf: dir.appendingPathComponent("sipakamase.json")), let s = try? JSONDecoder().decode(SipakamaseKeep.State.self, from: data) else { return SipakamaseKeep.State() }
        return s
    }

    private static func saveSipakamase(_ s: SipakamaseKeep.State) {
        guard let data = try? JSONEncoder().encode(s) else { return }
        try? data.write(to: dir.appendingPathComponent("sipakamase.json"), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }

    static func clearSipakamase() { try? FileManager.default.removeItem(at: dir.appendingPathComponent("sipakamase.json")) }

    private static func sipakamaseStep(_ plan: [String: Any], at t: Int) {
        let part = SipakamaseKeep.parse(plan)
        let state = sipakamaseState()
        let today = dateKey(t)
        guard let part, let index = SipakamaseKeep.due(part, configKeep: true, state: state, now: t, today: today) else { return }
        guard let session = SuloSipakamasePlugin.vault.session else { return }
        let path = Sipakamase.readPaths[index]
        guard let reply = try? SuloSipakamasePlugin.http.get(Sipakamase.origin + path, cookie: session.moodleSession) else {
            return saveSipakamase(SipakamaseKeep.after(part, state: state, index: index, now: t, today: today, login: false, ok: false))
        }
        if case let .replaced(fresh) = reply.cookie, (200 ... 299).contains(reply.status) { SuloSipakamasePlugin.vault.save(SikolaSession(moodleSession: fresh, sesskey: nil)) }
        // The page is read only to tell a login page apart, then dropped: nothing of it is kept.
        let login = (300 ... 399).contains(reply.status) || reply.status == 401 || reply.status == 403 || (reply.status == 200 && Sipakamase.isLoginPage(reply.body))
        saveSipakamase(SipakamaseKeep.after(part, state: state, index: index, now: t, today: today, login: login, ok: reply.status == 200 && !login))
        Diag.shared.note("keeper:sipakamase:\(login ? "login" : "\(reply.status)")")
    }

    // MARK: "Masuk lagi", once per ended session

    static func offerRelogin(_ plan: [String: Any]) {
        guard let ios = plan["ios"] as? [String: Any] else { return }
        let state = readJSON("offer.json") ?? [:]
        // Once until the session works again (the app clears it on its next sync through clearOffer).
        if state["offered"] as? Bool == true { return }
        writeJSON("offer.json", ["offered": true, "at": now()])
        let center = UNUserNotificationCenter.current()
        let line = ios["reloginLine"] as? String ?? ""
        center.getPendingNotificationRequests { pending in
            let morning = ios["morningOn"] as? Bool == true
                ? pending.filter { (($0.content.userInfo["cap_extra"] as? [String: Any])?["suloId"] as? String)?.hasPrefix("morning|") == true }
                    .sorted { (($0.trigger as? UNCalendarNotificationTrigger)?.nextTriggerDate() ?? .distantFuture) < (($1.trigger as? UNCalendarNotificationTrigger)?.nextTriggerDate() ?? .distantFuture) }
                    .first
                : nil
            if let morning, let content = morning.content.mutableCopy() as? UNMutableNotificationContent {
                // The next morning summary carries the offer; a tap opens the sign-in (its id now reads "session|").
                content.body = [content.body, line].filter { !$0.isEmpty }.joined(separator: " ")
                var info = content.userInfo
                var extra = info["cap_extra"] as? [String: Any] ?? [:]
                if let id = extra["suloId"] as? String { extra["suloId"] = "session|" + id.dropFirst("morning|".count) }
                info["cap_extra"] = extra
                content.userInfo = info
                center.add(UNNotificationRequest(identifier: morning.identifier, content: content, trigger: morning.trigger))
                return
            }
            // Morning summary off (or none planned): one quiet notice, after quiet hours.
            let content = UNMutableNotificationContent()
            content.title = ios["noticeTitle"] as? String ?? "Sulo"
            content.body = ios["noticeBody"] as? String ?? line
            content.userInfo = ["cap_extra": ["suloId": "session|keep:\(now())"]]
            let quiet = plan["quiet"] as? [String: Any] ?? [:]
            var at = now() + 5
            if quiet["enabled"] as? Bool == true, let s = quiet["startMin"] as? Int, let e = quiet["endMin"] as? Int, s != e {
                let m = minuteOfDay(at)
                let inside = s < e ? (m >= s && m < e) : (m >= s || m < e)
                if inside {
                    let wait = ((e - m) + 1440) % 1440
                    at += wait * 60
                }
            }
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: TimeInterval(max(5, at - now())), repeats: false)
            center.add(UNNotificationRequest(identifier: "sulo.keeper.relogin", content: content, trigger: trigger))
        }
    }

    /** The session works again (a sync the user started answered): the next end may be offered again. */
    static func clearOffer() { try? FileManager.default.removeItem(at: dir.appendingPathComponent("offer.json")) }

    // MARK: For the screens

    static func status() -> [String: Any] {
        let timings = (readJSON("timings.json")?["list"] as? [[String: Any]]) ?? []
        let ends = (readJSON("ends.json")?["list"] as? [[String: Any]]) ?? []
        func json(_ v: Any) -> String { (try? JSONSerialization.data(withJSONObject: v)).flatMap { String(data: $0, encoding: .utf8) } ?? "[]" }
        return ["timings": json(timings), "sessionEnds": json(ends), "plannedAt": 0, "queued": 0]
    }

    /** Keluar: nothing of the keeper stays. */
    static func clear() {
        try? FileManager.default.removeItem(at: dir)
        BGTaskScheduler.shared.cancelAllTaskRequests()
    }
}
