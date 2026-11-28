package dev.ikrar.sulo.calendar

import android.content.ActivityNotFoundException
import android.content.Intent
import android.provider.CalendarContract
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * "Tambah ke kalender HP" (1.1.0, owner 27 Nov 2026): the phone's own calendar app (Google Calendar, Samsung
 * Calendar, whichever handles it) opens its new-event screen filled with one task (core format/task-event.ts).
 * The student saves or leaves it there. No permission: Sulo neither reads nor writes the calendar itself, and is
 * not told what was chosen ("opened"). With no calendar app, "unavailable" and the app offers Google's link.
 */
@CapacitorPlugin(name = "SuloCalendar")
class SuloCalendarPlugin : Plugin() {
    @PluginMethod
    fun addEvent(call: PluginCall) {
        val event = CalendarEvent.from(call.getString("title"), call.getDouble("startAt"), call.getDouble("endAt"), call.getString("notes"), call.getString("url"))
            ?: return call.reject("bad event")
        val intent = Intent(Intent.ACTION_INSERT)
            .setData(CalendarContract.Events.CONTENT_URI)
            .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, event.startMs)
            .putExtra(CalendarContract.EXTRA_EVENT_END_TIME, event.endMs)
            .putExtra(CalendarContract.Events.TITLE, event.title)
            .putExtra(CalendarContract.Events.DESCRIPTION, event.notes)
        try {
            activity.startActivity(intent)
            call.resolve(JSObject().put("result", "opened"))
        } catch (e: ActivityNotFoundException) {
            call.resolve(JSObject().put("result", "unavailable"))
        }
    }
}
