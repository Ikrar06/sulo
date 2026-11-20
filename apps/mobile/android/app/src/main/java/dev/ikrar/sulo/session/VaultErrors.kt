package dev.ikrar.sulo.session

/**
 * Which vault read failures are for good. Damaged data or a key that is gone
 * cannot get better: the session ends. A Keystore error (the Keystore not
 * ready yet, just after the phone started) may pass: the blob is kept.
 */
object VaultErrors {
    private val PERMANENT = setOf(
        "AEADBadTagException", "BadPaddingException", "IllegalBlockSizeException",
        "KeyPermanentlyInvalidatedException", "UnrecoverableKeyException",
        "IllegalArgumentException", "JSONException", "NumberFormatException",
    )

    /**
     * The Keystore says the key is gone for good: missing (UnrecoverableKey,
     * our "no key") or invalidated by the system. Only this may end a session
     * from a failed read (owner's rule, 20 Nov 2026).
     */
    fun keyGone(e: Throwable): Boolean = chain(e).any { it in KEY_GONE }

    private val KEY_GONE = setOf("KeyPermanentlyInvalidatedException", "UnrecoverableKeyException")

    private fun chain(e: Throwable): List<String> {
        val out = mutableListOf<String>()
        var t: Throwable? = e
        while (t != null && out.size < 10) {
            out.add(t.javaClass.simpleName)
            t = t.cause.takeIf { it !== t }
        }
        return out
    }

    fun permanent(e: Throwable): Boolean {
        var t: Throwable? = e
        while (t != null) {
            if (t.javaClass.simpleName in PERMANENT) return true
            t = t.cause.takeIf { it !== t }
        }
        return false
    }
}
