import Foundation

public enum DaisyClawRemindersCommand: String, Codable, Sendable {
    case list = "reminders.list"
    case add = "reminders.add"
}

public enum DaisyClawReminderStatusFilter: String, Codable, Sendable {
    case incomplete
    case completed
    case all
}

public struct DaisyClawRemindersListParams: Codable, Sendable, Equatable {
    public var status: DaisyClawReminderStatusFilter?
    public var limit: Int?

    public init(status: DaisyClawReminderStatusFilter? = nil, limit: Int? = nil) {
        self.status = status
        self.limit = limit
    }
}

public struct DaisyClawRemindersAddParams: Codable, Sendable, Equatable {
    public var title: String
    public var dueISO: String?
    public var notes: String?
    public var listId: String?
    public var listName: String?

    public init(
        title: String,
        dueISO: String? = nil,
        notes: String? = nil,
        listId: String? = nil,
        listName: String? = nil)
    {
        self.title = title
        self.dueISO = dueISO
        self.notes = notes
        self.listId = listId
        self.listName = listName
    }
}

public struct DaisyClawReminderPayload: Codable, Sendable, Equatable {
    public var identifier: String
    public var title: String
    public var dueISO: String?
    public var completed: Bool
    public var listName: String?

    public init(
        identifier: String,
        title: String,
        dueISO: String? = nil,
        completed: Bool,
        listName: String? = nil)
    {
        self.identifier = identifier
        self.title = title
        self.dueISO = dueISO
        self.completed = completed
        self.listName = listName
    }
}

public struct DaisyClawRemindersListPayload: Codable, Sendable, Equatable {
    public var reminders: [DaisyClawReminderPayload]

    public init(reminders: [DaisyClawReminderPayload]) {
        self.reminders = reminders
    }
}

public struct DaisyClawRemindersAddPayload: Codable, Sendable, Equatable {
    public var reminder: DaisyClawReminderPayload

    public init(reminder: DaisyClawReminderPayload) {
        self.reminder = reminder
    }
}
