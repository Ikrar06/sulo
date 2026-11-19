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

    fun permanent(e: Throwable): Boolean {
        var t: Throwable? = e
        while (t != null) {
            if (t.javaClass.simpleName in PERMANENT) return true
            t = t.cause.takeIf { it !== t }
        }
        return false
    }
}
