package dev.ikrar.sulo.sipakamase

import android.content.Context
import dev.ikrar.sulo.neosia.NeosiaStore
import dev.ikrar.sulo.session.Diag
import dev.ikrar.sulo.session.FileSlots
import dev.ikrar.sulo.session.KeystoreCrypto
import dev.ikrar.sulo.session.SessionVault
import java.io.File

/**
 * Where Sipakamase lives on the phone (1.1.0), apart from SIKOLA's and
 * NEOSIA's: its session cookie in a vault of its own (AES-256-GCM, a
 * Keystore key of its own, excluded from backups like the SIKOLA vault),
 * and core's Sipakamase data (keys under "sipakamase:") in an encrypted
 * file per SIKOLA account. Putuskan, Keluar and a new account remove both.
 */
object SipakamaseVault {
    fun session(context: Context): SessionVault {
        val app = context.applicationContext
        return SessionVault(
            FileSlots(File(app.filesDir, "sulo_sipakamase.json")),
            KeystoreCrypto("sulo_sipakamase_session_v1"),
            Diag.of(app),
            FileSlots(File(app.filesDir, "sulo_sipakamase.good.json")),
        )
    }

    fun data(context: Context): NeosiaStore {
        val dir = File(context.applicationContext.filesDir, "sipakamase")
        return NeosiaStore(
            files = { user -> FileSlots(File(dir, "u$user.json")) },
            crypto = KeystoreCrypto("sulo_sipakamase_v1"),
            wipeFiles = { dir.deleteRecursively() },
        )
    }

    /** Everything: the session, its key, the data of every account and its key. */
    fun wipeAll(context: Context) {
        runCatching { session(context).wipe() }
        runCatching { data(context).wipeAll() }
        runCatching { SipakamaseKeeper(context).clear() }
    }
}
