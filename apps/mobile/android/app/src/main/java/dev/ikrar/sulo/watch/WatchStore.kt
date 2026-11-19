package dev.ikrar.sulo.watch

import android.content.Context
import android.content.SharedPreferences
import dev.ikrar.sulo.session.Crypto
import dev.ikrar.sulo.session.KeystoreCrypto
import org.json.JSONArray
import org.json.JSONObject

/**
 * What the watch worker keeps between checks, in app-private storage that
 * is excluded from every backup (like the session vault):
 * - the plan core wrote, the overlay of what it learned since, held notices;
 * - the Radar cursor and the daytime check count;
 * - the answer queue, at most [QUEUE_MAX] items, each encrypted with the
 *   session's Keystore key (an unreadable item is dropped, like the vault);
 * - timings for the dev screen (times, durations and sizes only).
 * Budget and backoff are core's own JSON in Capacitor's Preferences, read
 * and written in the same shape. Nothing here is ever logged.
 */
class WatchStore(private val prefs: SharedPreferences, private val shared: SharedPreferences, private val crypto: Crypto) {
    constructor(context: Context) : this(
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE),
        context.applicationContext.getSharedPreferences(CAPACITOR_PREFS, Context.MODE_PRIVATE),
        KeystoreCrypto(),
    )

    private fun json(key: String): JSONObject? = prefs.getString(key, null)?.let { runCatching { JSONObject(it) }.getOrNull() }
    private fun array(key: String): JSONArray = prefs.getString(key, null)?.let { runCatching { JSONArray(it) }.getOrNull() } ?: JSONArray()
    private fun put(key: String, value: String?) { prefs.edit().apply { if (value == null) remove(key) else putString(key, value) }.commit() }

    @Synchronized fun plan(): JSONObject? = json(KEY_PLAN)

    /** A new plan replaces what the worker learned on the old one (core has read those answers). */
    @Synchronized fun setPlan(plan: JSONObject) {
        put(KEY_PLAN, plan.toString())
        put(KEY_OVERLAY, null)
        put(KEY_HELD, null)
        // A plan in force means a connected session (core writes enabled only then): signed in again.
        if (plan.optBoolean("enabled", false)) prefs.edit().remove(KEY_EXPIRED_SENT).commit()
        // A new plan means the app was opened: a 7-day pause ends, and its notice may come again next time.
        prefs.edit().remove(KEY_PAUSED_SENT).commit()
    }

    // ---- The worker's own config reads (WatchRemote, PublicConfig) ----

    /** The last good config the worker read itself, when it read it, the attempt time, and the ETag of that file (per URL). */
    @Synchronized fun remoteConfig(): JSONObject? = json(KEY_REMOTE_CONFIG)
    @Synchronized fun remoteOkAt(): Long = prefs.getLong(KEY_REMOTE_OK, 0)
    @Synchronized fun remoteReadAt(): Long = prefs.getLong(KEY_REMOTE_READ, 0)
    @Synchronized fun remoteEtag(url: String): String? = if (prefs.getString(KEY_REMOTE_URL, null) == url) prefs.getString(KEY_REMOTE_ETAG, null) else null

    @Synchronized fun setRemoteAttempt(now: Long) { prefs.edit().putLong(KEY_REMOTE_READ, now).commit() }

    /** A good read: a valid file (with its ETag) or a 304 confirming the stored one. */
    @Synchronized fun setRemoteGood(now: Long, url: String, config: JSONObject?, etag: String?) {
        prefs.edit().apply {
            putLong(KEY_REMOTE_OK, now)
            if (config != null) {
                putString(KEY_REMOTE_CONFIG, config.toString())
                putString(KEY_REMOTE_URL, url)
                if (etag != null) putString(KEY_REMOTE_ETAG, etag) else remove(KEY_REMOTE_ETAG)
            }
        }.commit()
    }

    /** The "Pemantauan dijeda" notice was sent for this pause. */
    @Synchronized fun pausedSent(): Boolean = prefs.getBoolean(KEY_PAUSED_SENT, false)
    @Synchronized fun setPausedSent() { prefs.edit().putBoolean(KEY_PAUSED_SENT, true).commit() }

    /** The "Masuk lagi" notice was sent for the current ended session. */
    @Synchronized fun expiredSent(): Boolean = prefs.getBoolean(KEY_EXPIRED_SENT, false)
    @Synchronized fun setExpiredSent() { prefs.edit().putBoolean(KEY_EXPIRED_SENT, true).commit() }

    @Synchronized fun overlay(): JSONObject = json(KEY_OVERLAY) ?: WatchCheck.emptyOverlay()
    @Synchronized fun setOverlay(o: JSONObject, gen: Long? = null) { if (gen == null || gen == generation()) put(KEY_OVERLAY, o.toString()) }

    @Synchronized fun held(): List<JSONObject> = array(KEY_HELD).let { a -> (0 until a.length()).map { a.getJSONObject(it) } }
    @Synchronized fun setHeld(list: List<JSONObject>, gen: Long? = null) { if (gen == null || gen == generation()) put(KEY_HELD, if (list.isEmpty()) null else JSONArray(list).toString()) }

    @Synchronized fun radarCursor(): Int = prefs.getInt(KEY_CURSOR, 0)
    @Synchronized fun setRadarCursor(v: Int) { prefs.edit().putInt(KEY_CURSOR, v).commit() }
    @Synchronized fun dayCheckIndex(): Int = prefs.getInt(KEY_DAY_INDEX, 0)
    @Synchronized fun setDayCheckIndex(v: Int) { prefs.edit().putInt(KEY_DAY_INDEX, v).commit() }

    @Synchronized fun plannedAt(): Long = prefs.getLong(KEY_PLANNED, 0)
    @Synchronized fun setPlannedAt(v: Long) { prefs.edit().putLong(KEY_PLANNED, v).commit() }

    @Synchronized fun lastExpiredNoticeAt(): Long = prefs.getLong(KEY_EXPIRED_NOTICE, 0)
    @Synchronized fun setLastExpiredNoticeAt(v: Long) { prefs.edit().putLong(KEY_EXPIRED_NOTICE, v).commit() }

    // ---- Core's budget and backoff (Capacitor Preferences, JSON strings) ----

    @Synchronized fun budget(): JSONObject? = shared.getString(BUDGET_KEY, null)?.let { runCatching { JSONObject(it) }.getOrNull() }
    @Synchronized fun setBudget(v: JSONObject) { shared.edit().putString(BUDGET_KEY, v.toString()).commit() }
    @Synchronized fun backoff(): JSONObject? = shared.getString(BACKOFF_KEY, null)?.let { runCatching { JSONObject(it) }.getOrNull() }
    @Synchronized fun setBackoff(v: JSONObject) { shared.edit().putString(BACKOFF_KEY, v.toString()).commit() }

    // ---- The answer queue ----

    /** The newest answer, encrypted like the queue, kept for the debug screen's simulations (no request). */
    @Synchronized fun lastAnswer(): JSONObject? = prefs.getString(KEY_LAST, null)?.let { runCatching { JSONObject(String(crypto.decrypt(it), Charsets.UTF_8)) }.getOrNull() }

    /** Debug simulations: notices held as if in quiet hours, sent as one summary later. */
    @Synchronized fun simHeld(): List<JSONObject> = array(KEY_SIM_HELD).let { a -> (0 until a.length()).map { a.getJSONObject(it) } }
    @Synchronized fun setSimHeld(list: List<JSONObject>) = put(KEY_SIM_HELD, if (list.isEmpty()) null else JSONArray(list).toString())

    /** `gen`: the generation the check started with; an answer from before a reset is dropped. */
    @Synchronized fun enqueue(answer: JSONObject, gen: Long? = null) {
        if (gen != null && gen != generation()) return
        put(KEY_LAST, crypto.encrypt(answer.toString().toByteArray(Charsets.UTF_8)))
        val q = array(KEY_QUEUE)
        val items = (0 until q.length()).map { q.getString(it) }.toMutableList()
        items.add(crypto.encrypt(answer.toString().toByteArray(Charsets.UTF_8)))
        if (items.size > QUEUE_MAX) {
            // Full: keep only the newest and ask core for a full sync when the app opens.
            while (items.size > QUEUE_MAX) items.removeAt(0)
            prefs.edit().putBoolean(KEY_FULL_SYNC, true).commit()
        }
        put(KEY_QUEUE, JSONArray(items).toString())
    }

    /** The queued answers, decrypted, and whether a full sync is asked; the queue is emptied. */
    @Synchronized fun takeQueue(): Pair<List<JSONObject>, Boolean> {
        val q = array(KEY_QUEUE)
        val answers = (0 until q.length()).mapNotNull { i -> runCatching { JSONObject(String(crypto.decrypt(q.getString(i)), Charsets.UTF_8)) }.getOrNull() }
        val full = prefs.getBoolean(KEY_FULL_SYNC, false) || answers.size < q.length()
        put(KEY_QUEUE, null)
        prefs.edit().remove(KEY_FULL_SYNC).commit()
        return answers to full
    }

    @Synchronized fun queueSize(): Int = array(KEY_QUEUE).length()

    // ---- Dev screen: timings and session ends (times, durations, sizes and outcome codes only) ----

    @Synchronized fun recordTiming(entry: JSONObject) {
        val a = array(KEY_TIMINGS)
        val list = (0 until a.length()).map { a.getJSONObject(it) }.toMutableList().apply { add(entry) }
        put(KEY_TIMINGS, JSONArray(list.takeLast(TIMINGS_MAX)).toString())
    }

    @Synchronized fun timings(): JSONArray = array(KEY_TIMINGS)

    @Synchronized fun recordSessionEnd(entry: JSONObject) {
        val a = array(KEY_ENDS)
        val list = (0 until a.length()).map { a.getJSONObject(it) }.toMutableList().apply { add(entry) }
        put(KEY_ENDS, JSONArray(list.takeLast(TIMINGS_MAX)).toString())
    }

    @Synchronized fun sessionEnds(): JSONArray = array(KEY_ENDS)

    // ---- A tapped notification, for the app to open ----

    @Synchronized fun setPendingOpen(id: String) = put(KEY_OPEN, id)

    @Synchronized fun takePendingOpen(): String? = prefs.getString(KEY_OPEN, null).also { put(KEY_OPEN, null) }

    /** "Keluar": everything the worker kept. */
    @Synchronized fun clear() = reset()

    /**
     * Everything the worker kept goes, and the generation moves on: a check
     * that started before (it read [generation] then) can no longer write its
     * answer, overlay or held notices after this ("Pakai akun ini" while the
     * worker runs).
     */
    @Synchronized fun reset() {
        val next = prefs.getLong(KEY_GENERATION, 0) + 1
        prefs.edit().clear().putLong(KEY_GENERATION, next).commit()
    }

    /** Read at the start of a check; writes made with an older one are dropped. */
    @Synchronized fun generation(): Long = prefs.getLong(KEY_GENERATION, 0)

    companion object {
        const val PREFS = "sulo_watch"
        /** Capacitor Preferences' file; core's keys carry the app's "sulo:" prefix (src/platform/store.ts). */
        const val CAPACITOR_PREFS = "CapacitorStorage"
        const val BUDGET_KEY = "sulo:global:budget"
        const val BACKOFF_KEY = "sulo:global:backoff"
        const val QUEUE_MAX = 20
        const val TIMINGS_MAX = 100
        private const val KEY_PLAN = "plan"
        private const val KEY_OVERLAY = "overlay"
        private const val KEY_HELD = "held"
        private const val KEY_CURSOR = "radarCursor"
        private const val KEY_DAY_INDEX = "dayCheckIndex"
        private const val KEY_PLANNED = "plannedAt"
        private const val KEY_EXPIRED_NOTICE = "expiredNoticeAt"
        private const val KEY_QUEUE = "queue"
        private const val KEY_GENERATION = "generation"
        private const val KEY_FULL_SYNC = "fullSync"
        private const val KEY_TIMINGS = "timings"
        private const val KEY_ENDS = "sessionEnds"
        private const val KEY_OPEN = "pendingOpen"
        private const val KEY_LAST = "lastAnswer"
        private const val KEY_EXPIRED_SENT = "expiredSent"
        private const val KEY_SIM_HELD = "simHeld"
        private const val KEY_REMOTE_CONFIG = "remoteConfig"
        private const val KEY_REMOTE_OK = "remoteOkAt"
        private const val KEY_REMOTE_READ = "remoteReadAt"
        private const val KEY_REMOTE_ETAG = "remoteEtag"
        private const val KEY_REMOTE_URL = "remoteUrl"
        private const val KEY_PAUSED_SENT = "pausedSent"
    }
}
