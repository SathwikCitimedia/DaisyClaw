import ActivityKit
import Foundation

/// Shared schema used by iOS app + Live Activity widget extension.
struct DaisyClawActivityAttributes: ActivityAttributes {
    var agentName: String
    var sessionKey: String

    struct ContentState: Codable, Hashable {
        var statusText: String
        var isIdle: Bool
        var isDisconnected: Bool
        var isConnecting: Bool
        var startedAt: Date
    }
}

#if DEBUG
extension DaisyClawActivityAttributes {
    static let preview = DaisyClawActivityAttributes(agentName: "main", sessionKey: "main")
}

extension DaisyClawActivityAttributes.ContentState {
    static let connecting = DaisyClawActivityAttributes.ContentState(
        statusText: "Connecting...",
        isIdle: false,
        isDisconnected: false,
        isConnecting: true,
        startedAt: .now)

    static let idle = DaisyClawActivityAttributes.ContentState(
        statusText: "Idle",
        isIdle: true,
        isDisconnected: false,
        isConnecting: false,
        startedAt: .now)

    static let disconnected = DaisyClawActivityAttributes.ContentState(
        statusText: "Disconnected",
        isIdle: false,
        isDisconnected: true,
        isConnecting: false,
        startedAt: .now)

    static let attention = DaisyClawActivityAttributes.ContentState(
        statusText: "Approval needed",
        isIdle: false,
        isDisconnected: false,
        isConnecting: false,
        startedAt: .now)
}
#endif
