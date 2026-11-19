package dev.ikrar.sulo.neosia

/**
 * B0 trial counters (debug builds only), in memory for this process: what the
 * NEOSIA screen saw, as labels and numbers only. No data of any capture is
 * kept; an accepted message is counted by its endpoint id and dropped.
 * Read by the hidden dev screen through SuloNeosia.trialStats.
 */
internal object NeosiaTrial {
    private val captures = linkedMapOf<String, Int>()
    private val rejected = linkedMapOf<String, Int>()
    private val requests = linkedMapOf<String, Int>()
    private val pages = mutableListOf<String>()
    private var largest = 0
    /** Pages that started as the login page while the script was registered: must stay 0. */
    private var scriptOnLogin = 0
    /** The app moved to the login page without a new document (the script was taken away for what follows). */
    private var spaToLogin = 0
    /** The app left the login page without a new document: the next page needs a tap from Sulo to get the script. */
    private var spaFromLogin = 0
    var docStart: Boolean? = null
    var listener: Boolean? = null

    @Synchronized fun capture(label: String, bytes: Int) {
        captures[label] = (captures[label] ?: 0) + 1
        if (bytes > largest) largest = bytes
    }

    @Synchronized fun reject(reason: String) {
        rejected[reason] = (rejected[reason] ?: 0) + 1
    }

    @Synchronized fun request(key: String) {
        requests[key] = (requests[key] ?: 0) + 1
    }

    @Synchronized fun page(path: String) {
        pages.add(path)
        if (pages.size > 40) pages.removeAt(0)
    }

    @Synchronized fun scriptOnLogin() { scriptOnLogin++ }
    @Synchronized fun spaToLogin() { spaToLogin++ }
    @Synchronized fun spaFromLogin() { spaFromLogin++ }

    @Synchronized fun reset() {
        captures.clear(); rejected.clear(); requests.clear(); pages.clear()
        largest = 0; scriptOnLogin = 0; spaToLogin = 0; spaFromLogin = 0
    }

    @Synchronized fun snapshot(): Map<String, Any?> = mapOf(
        "captures" to LinkedHashMap(captures),
        "rejected" to LinkedHashMap(rejected),
        "requests" to LinkedHashMap(requests),
        "pages" to ArrayList(pages),
        "largestBytes" to largest,
        "scriptOnLogin" to scriptOnLogin,
        "spaToLogin" to spaToLogin,
        "spaFromLogin" to spaFromLogin,
        "docStart" to docStart,
        "listener" to listener,
    )
}
