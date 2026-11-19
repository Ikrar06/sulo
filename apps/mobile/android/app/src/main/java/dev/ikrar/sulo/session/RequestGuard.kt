package dev.ikrar.sulo.session

/**
 * Around every request to SIKOLA (owner's decision, 20 Nov 2026): SIKOLA
 * ends the session when a request is cut off mid-flight, which happens when
 * the app is swiped away during a sync. So, while a request runs:
 *
 * - a short foreground service (SuloRequestService) keeps the process alive
 *   when the app is swiped from Recents; it starts just before the first
 *   request and stops when the last one has its answer stored;
 * - a marker on disk says a request is in flight. Found again by a new
 *   process, it means the previous one ended mid-request ("interrupted"),
 *   which the app can then name honestly if the session turns out ended.
 *
 * The logic takes the service, the marker and the clock as parameters, so
 * it is tested on the JVM. One instance per process ([shared]).
 */
class RequestGuard(
    private val service: Service,
    private val marker: Slots,
    private val now: () -> Long = { System.currentTimeMillis() },
    private val diag: Diag? = null,
    /** Told about a request a previous process left unfinished (its time, seconds). */
    private val onLeftover: (Long) -> Unit = {},
) {
    /** The foreground service, behind an interface for tests. */
    interface Service {
        /** Starts it; throws when the system refuses (from the background, for example). */
        fun start()
        /** Asks it to stop once idle (it stops itself after showing, never before: no crash). */
        fun stopWhenIdle()
    }

    private var running = 0
    private var startedAt = 0L
    private var adopted = false
    private var leftover: Long? = null

    /** Requests in flight right now. */
    @get:Synchronized
    val inFlight: Int get() = running

    /**
     * Before a request: the marker, then the service (a refusal is noted and
     * the request goes out anyway, unguarded, as before).
     */
    @Synchronized
    fun begin(where: String) {
        adoptLeftover()
        running++
        if (running > 1) return
        startedAt = now()
        marker.putAll(mapOf(KEY_AT to (startedAt / 1000).toString(), KEY_WHERE to where))
        try {
            service.start()
        } catch (e: Exception) {
            diag?.note("fgs_refused:${e.javaClass.simpleName}")
        }
    }

    /** After the answer is stored: the last request out clears the marker and lets the service stop. Answers how long the guard held, in ms (0 while others still run). */
    @Synchronized
    fun end(): Long {
        if (running == 0) return 0
        running--
        if (running > 0) return 0
        marker.clear()
        runCatching { service.stopWhenIdle() }
        return now() - startedAt
    }

    /**
     * Once per process, before its first request: a marker still on disk was
     * left by a process that ended mid-request. Answers its time (seconds), or null.
     */
    @Synchronized
    fun adoptLeftover(): Long? {
        if (adopted) return leftover
        adopted = true
        val record = marker.all().orEmpty()
        val at = record[KEY_AT]?.toLongOrNull() ?: return null
        leftover = at
        marker.clear()
        diag?.note("request_interrupted:${record[KEY_WHERE] ?: "?"}")
        runCatching { onLeftover(at) }
        return at
    }

    companion object {
        private const val KEY_AT = "at"
        private const val KEY_WHERE = "where"
        /** The hard limit of one guarded stretch: then the service stops and open requests are ended. */
        const val LIMIT_MS = 30_000L

        @Volatile private var instance: RequestGuard? = null

        /** The process's guard. */
        fun shared(context: android.content.Context): RequestGuard = instance ?: synchronized(this) {
            instance ?: run {
                val app = context.applicationContext
                RequestGuard(
                    SuloRequestService.Starter(app),
                    FileSlots(java.io.File(app.filesDir, "sulo_inflight.json")),
                    diag = Diag.of(app),
                    onLeftover = { at -> SessionVault.of(app).noteInterrupted(at) },
                ).also { instance = it }
            }
        }
    }
}
