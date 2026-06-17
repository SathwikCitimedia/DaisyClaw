import CoreLocation
import Foundation
import DaisyClawKit
import UIKit

typealias DaisyClawCameraSnapResult = (format: String, base64: String, width: Int, height: Int)
typealias DaisyClawCameraClipResult = (format: String, base64: String, durationMs: Int, hasAudio: Bool)

protocol CameraServicing: Sendable {
    func listDevices() async -> [CameraController.CameraDeviceInfo]
    func snap(params: DaisyClawCameraSnapParams) async throws -> DaisyClawCameraSnapResult
    func clip(params: DaisyClawCameraClipParams) async throws -> DaisyClawCameraClipResult
}

protocol ScreenRecordingServicing: Sendable {
    func record(
        screenIndex: Int?,
        durationMs: Int?,
        fps: Double?,
        includeAudio: Bool?,
        outPath: String?) async throws -> String
}

@MainActor
protocol LocationServicing: Sendable {
    func authorizationStatus() -> CLAuthorizationStatus
    func accuracyAuthorization() -> CLAccuracyAuthorization
    func ensureAuthorization(mode: DaisyClawLocationMode) async -> CLAuthorizationStatus
    func currentLocation(
        params: DaisyClawLocationGetParams,
        desiredAccuracy: DaisyClawLocationAccuracy,
        maxAgeMs: Int?,
        timeoutMs: Int?) async throws -> CLLocation
    func startLocationUpdates(
        desiredAccuracy: DaisyClawLocationAccuracy,
        significantChangesOnly: Bool) -> AsyncStream<CLLocation>
    func stopLocationUpdates()
    func startMonitoringSignificantLocationChanges(onUpdate: @escaping @Sendable (CLLocation) -> Void)
    func stopMonitoringSignificantLocationChanges()
}

@MainActor
protocol DeviceStatusServicing: Sendable {
    func status() async throws -> DaisyClawDeviceStatusPayload
    func info() -> DaisyClawDeviceInfoPayload
}

protocol PhotosServicing: Sendable {
    func latest(params: DaisyClawPhotosLatestParams) async throws -> DaisyClawPhotosLatestPayload
}

protocol ContactsServicing: Sendable {
    func search(params: DaisyClawContactsSearchParams) async throws -> DaisyClawContactsSearchPayload
    func add(params: DaisyClawContactsAddParams) async throws -> DaisyClawContactsAddPayload
}

protocol CalendarServicing: Sendable {
    func events(params: DaisyClawCalendarEventsParams) async throws -> DaisyClawCalendarEventsPayload
    func add(params: DaisyClawCalendarAddParams) async throws -> DaisyClawCalendarAddPayload
}

protocol RemindersServicing: Sendable {
    func list(params: DaisyClawRemindersListParams) async throws -> DaisyClawRemindersListPayload
    func add(params: DaisyClawRemindersAddParams) async throws -> DaisyClawRemindersAddPayload
}

protocol MotionServicing: Sendable {
    func activities(params: DaisyClawMotionActivityParams) async throws -> DaisyClawMotionActivityPayload
    func pedometer(params: DaisyClawPedometerParams) async throws -> DaisyClawPedometerPayload
}

struct WatchMessagingStatus: Equatable {
    var supported: Bool
    var paired: Bool
    var appInstalled: Bool
    var reachable: Bool
    var activationState: String
}

struct WatchQuickReplyEvent: Equatable {
    var replyId: String
    var promptId: String
    var actionId: String
    var actionLabel: String?
    var sessionKey: String?
    var note: String?
    var sentAtMs: Int?
    var transport: String
}

struct WatchExecApprovalResolveEvent: Equatable {
    var replyId: String
    var approvalId: String
    var decision: DaisyClawWatchExecApprovalDecision
    var sentAtMs: Int?
    var transport: String
}

struct WatchExecApprovalSnapshotRequestEvent: Equatable {
    var requestId: String
    var sentAtMs: Int?
    var transport: String
}

struct WatchNotificationSendResult: Equatable {
    var deliveredImmediately: Bool
    var queuedForDelivery: Bool
    var transport: String
}

protocol WatchMessagingServicing: AnyObject, Sendable {
    func status() async -> WatchMessagingStatus
    func setStatusHandler(_ handler: (@Sendable (WatchMessagingStatus) -> Void)?)
    func setReplyHandler(_ handler: (@Sendable (WatchQuickReplyEvent) -> Void)?)
    func setExecApprovalResolveHandler(_ handler: (@Sendable (WatchExecApprovalResolveEvent) -> Void)?)
    func setExecApprovalSnapshotRequestHandler(
        _ handler: (@Sendable (WatchExecApprovalSnapshotRequestEvent) -> Void)?)
    func sendNotification(
        id: String,
        params: DaisyClawWatchNotifyParams) async throws -> WatchNotificationSendResult
    func sendExecApprovalPrompt(
        _ message: DaisyClawWatchExecApprovalPromptMessage) async throws -> WatchNotificationSendResult
    func sendExecApprovalResolved(
        _ message: DaisyClawWatchExecApprovalResolvedMessage) async throws -> WatchNotificationSendResult
    func sendExecApprovalExpired(
        _ message: DaisyClawWatchExecApprovalExpiredMessage) async throws -> WatchNotificationSendResult
    func syncExecApprovalSnapshot(
        _ message: DaisyClawWatchExecApprovalSnapshotMessage) async throws -> WatchNotificationSendResult
}

extension CameraController: CameraServicing {}
extension ScreenRecordService: ScreenRecordingServicing {}
extension LocationService: LocationServicing {}
