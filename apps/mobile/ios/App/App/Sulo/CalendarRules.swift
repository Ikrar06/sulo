import Foundation

/// One task for iOS's add-event sheet (SuloCalendarPlugin), checked before anything is shown: a title, a start
/// before an end, short notes, and a link only to a task page on SIKOLA (core builds it the same way, format/
/// task-event.ts; anything else is dropped, never shown). No UIKit, tested on the Mac (SuloTests).
struct CalendarEventInput: Equatable {
    let title: String
    let start: Date
    let end: Date
    let notes: String
    let url: URL?

    static let maxTitle = 400
    static let maxNotes = 2000

    init?(title: String?, startAt: Double?, endAt: Double?, notes: String?, url: String?) {
        guard let title, !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, title.count <= Self.maxTitle,
              let startAt, let endAt, startAt > 0, endAt >= startAt, endAt - startAt <= 86_400,
              let notes, notes.count <= Self.maxNotes
        else { return nil }
        self.title = title
        self.start = Date(timeIntervalSince1970: startAt)
        self.end = Date(timeIntervalSince1970: endAt)
        self.notes = notes
        self.url = Self.taskLink(url)
    }

    /// https://sikola-v2.unhas.ac.id/mod/<module>/view.php?id=<digits>, and nothing else.
    static func taskLink(_ text: String?) -> URL? {
        guard let text, let parts = URLComponents(string: text), parts.scheme == "https", parts.host == "sikola-v2.unhas.ac.id", parts.port == nil,
              parts.path.range(of: #"^/mod/[a-z0-9]+/view\.php$"#, options: .regularExpression) != nil,
              let items = parts.queryItems, items.count == 1, items[0].name == "id",
              let id = items[0].value, id.range(of: #"^\d{1,10}$"#, options: .regularExpression) != nil
        else { return nil }
        return URL(string: text)
    }
}
