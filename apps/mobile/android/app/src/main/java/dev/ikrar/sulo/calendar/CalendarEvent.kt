package dev.ikrar.sulo.calendar

/**
 * One task for the phone's calendar app (SuloCalendarPlugin), checked before anything opens: a title, a start
 * before an end, short notes, and a link only to a task page on SIKOLA (core builds it the same way,
 * format/task-event.ts). The same rules as the iPhone's CalendarRules.swift. Pure, tested on the JVM.
 */
data class CalendarEvent(val title: String, val startMs: Long, val endMs: Long, val notes: String, val url: String?) {
    companion object {
        const val MAX_TITLE = 400
        const val MAX_NOTES = 2000
        private val TASK_LINK = Regex("""^https://sikola-v2\.unhas\.ac\.id/mod/[a-z0-9]+/view\.php\?id=\d{1,10}$""")

        fun from(title: String?, startAt: Double?, endAt: Double?, notes: String?, url: String?): CalendarEvent? {
            if (title == null || title.isBlank() || title.length > MAX_TITLE) return null
            if (startAt == null || endAt == null || startAt <= 0 || endAt < startAt || endAt - startAt > 86_400) return null
            if (notes == null || notes.length > MAX_NOTES) return null
            return CalendarEvent(title, (startAt * 1000).toLong(), (endAt * 1000).toLong(), notes, taskLink(url))
        }

        /** https://sikola-v2.unhas.ac.id/mod/<module>/view.php?id=<digits>, and nothing else. */
        fun taskLink(text: String?): String? = text?.takeIf { TASK_LINK.matches(it) }
    }
}
