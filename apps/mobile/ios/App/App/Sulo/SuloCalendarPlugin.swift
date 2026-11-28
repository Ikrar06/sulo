import Capacitor
import EventKit
import EventKitUI
import Foundation
import UIKit

/// "Tambah ke Kalender iPhone" (1.1.0, owner 27 Nov 2026): iOS's own add-event sheet, filled with one task (its
/// title, 30 minutes up to the due time, notes with the SIKOLA link; core format/task-event.ts). The student saves
/// or cancels it there; Sulo never reads the calendar and keeps nothing from it.
/// iOS 17 and later run the sheet outside the app and ask for no calendar access at all. iOS 16 needs access for
/// the sheet: asked once (NSCalendarsUsageDescription), and a "no" leaves the sheet closed ("denied").
@objc(SuloCalendarPlugin)
public class SuloCalendarPlugin: CAPPlugin, CAPBridgedPlugin, EKEventEditViewDelegate {
    public let identifier = "SuloCalendarPlugin"
    public let jsName = "SuloCalendar"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "addEvent", returnType: CAPPluginReturnPromise),
    ]

    private let store = EKEventStore()
    /// The call waiting for the sheet to close; one sheet at a time.
    private var pending: CAPPluginCall?

    @objc func addEvent(_ call: CAPPluginCall) {
        guard let input = CalendarEventInput(title: call.getString("title"), startAt: call.getDouble("startAt"), endAt: call.getDouble("endAt"), notes: call.getString("notes"), url: call.getString("url")) else {
            call.reject("bad event")
            return
        }
        if #available(iOS 17.0, *) {
            present(input, call)
            return
        }
        switch EKEventStore.authorizationStatus(for: .event) {
        case .authorized:
            present(input, call)
        case .notDetermined:
            store.requestAccess(to: .event) { granted, _ in
                DispatchQueue.main.async {
                    if granted { self.present(input, call) } else { call.resolve(["result": "denied"]) }
                }
            }
        default:
            call.resolve(["result": "denied"])
        }
    }

    private func present(_ input: CalendarEventInput, _ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.pending == nil, let host = self.bridge?.viewController else {
                call.resolve(["result": "unavailable"])
                return
            }
            let event = EKEvent(eventStore: self.store)
            event.title = input.title
            event.startDate = input.start
            event.endDate = input.end
            event.notes = input.notes
            event.url = input.url
            let sheet = EKEventEditViewController()
            sheet.eventStore = self.store
            sheet.event = event
            sheet.editViewDelegate = self
            self.pending = call
            host.present(sheet, animated: true)
        }
    }

    public func eventEditViewController(_ controller: EKEventEditViewController, didCompleteWith action: EKEventEditViewAction) {
        controller.dismiss(animated: true)
        pending?.resolve(["result": action == .saved ? "saved" : "canceled"])
        pending = nil
    }
}
