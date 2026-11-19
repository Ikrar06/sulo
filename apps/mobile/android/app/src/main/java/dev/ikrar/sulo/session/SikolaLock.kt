package dev.ikrar.sulo.session

import android.content.Context
import java.io.File
import java.io.RandomAccessFile
import java.nio.channels.FileChannel
import java.nio.channels.FileLock
import java.util.concurrent.TimeUnit
import java.util.concurrent.locks.ReentrantLock

/**
 * One holder at a time for the vault and requests to SIKOLA: the app's
 * syncs (SuloSession) and the background check (WatchWorker) never run
 * together. A fair lock inside the process plus a file lock across
 * processes (the app runs in one process today; the file lock keeps it true
 * if that ever changes). Reentrant for the same thread.
 */
object SikolaLock {
    private val inProcess = ReentrantLock(true)
    private var channel: FileChannel? = null
    private var held: FileLock? = null

    /** Runs [block] holding the lock, or answers null when it could not be had within [waitMs]. */
    fun <T> hold(context: Context, waitMs: Long, block: () -> T): T? {
        if (!inProcess.tryLock(waitMs, TimeUnit.MILLISECONDS)) return null
        try {
            if (inProcess.holdCount == 1) {
                val ch = RandomAccessFile(File(context.applicationContext.filesDir, "sikola.lock"), "rw").channel
                channel = ch
                held = ch.lock()
            }
            return block()
        } finally {
            if (inProcess.holdCount == 1) {
                runCatching { held?.release() }
                runCatching { channel?.close() }
                held = null
                channel = null
            }
            inProcess.unlock()
        }
    }
}
