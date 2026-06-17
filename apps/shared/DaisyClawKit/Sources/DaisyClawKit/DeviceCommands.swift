import Foundation

public enum DaisyClawDeviceCommand: String, Codable, Sendable {
    case status = "device.status"
    case info = "device.info"
}

public enum DaisyClawBatteryState: String, Codable, Sendable {
    case unknown
    case unplugged
    case charging
    case full
}

public enum DaisyClawThermalState: String, Codable, Sendable {
    case nominal
    case fair
    case serious
    case critical
}

public enum DaisyClawNetworkPathStatus: String, Codable, Sendable {
    case satisfied
    case unsatisfied
    case requiresConnection
}

public enum DaisyClawNetworkInterfaceType: String, Codable, Sendable {
    case wifi
    case cellular
    case wired
    case other
}

public struct DaisyClawBatteryStatusPayload: Codable, Sendable, Equatable {
    public var level: Double?
    public var state: DaisyClawBatteryState
    public var lowPowerModeEnabled: Bool

    public init(level: Double?, state: DaisyClawBatteryState, lowPowerModeEnabled: Bool) {
        self.level = level
        self.state = state
        self.lowPowerModeEnabled = lowPowerModeEnabled
    }
}

public struct DaisyClawThermalStatusPayload: Codable, Sendable, Equatable {
    public var state: DaisyClawThermalState

    public init(state: DaisyClawThermalState) {
        self.state = state
    }
}

public struct DaisyClawStorageStatusPayload: Codable, Sendable, Equatable {
    public var totalBytes: Int64
    public var freeBytes: Int64
    public var usedBytes: Int64

    public init(totalBytes: Int64, freeBytes: Int64, usedBytes: Int64) {
        self.totalBytes = totalBytes
        self.freeBytes = freeBytes
        self.usedBytes = usedBytes
    }
}

public struct DaisyClawNetworkStatusPayload: Codable, Sendable, Equatable {
    public var status: DaisyClawNetworkPathStatus
    public var isExpensive: Bool
    public var isConstrained: Bool
    public var interfaces: [DaisyClawNetworkInterfaceType]

    public init(
        status: DaisyClawNetworkPathStatus,
        isExpensive: Bool,
        isConstrained: Bool,
        interfaces: [DaisyClawNetworkInterfaceType])
    {
        self.status = status
        self.isExpensive = isExpensive
        self.isConstrained = isConstrained
        self.interfaces = interfaces
    }
}

public struct DaisyClawDeviceStatusPayload: Codable, Sendable, Equatable {
    public var battery: DaisyClawBatteryStatusPayload
    public var thermal: DaisyClawThermalStatusPayload
    public var storage: DaisyClawStorageStatusPayload
    public var network: DaisyClawNetworkStatusPayload
    public var uptimeSeconds: Double

    public init(
        battery: DaisyClawBatteryStatusPayload,
        thermal: DaisyClawThermalStatusPayload,
        storage: DaisyClawStorageStatusPayload,
        network: DaisyClawNetworkStatusPayload,
        uptimeSeconds: Double)
    {
        self.battery = battery
        self.thermal = thermal
        self.storage = storage
        self.network = network
        self.uptimeSeconds = uptimeSeconds
    }
}

public struct DaisyClawDeviceInfoPayload: Codable, Sendable, Equatable {
    public var deviceName: String
    public var modelIdentifier: String
    public var systemName: String
    public var systemVersion: String
    public var appVersion: String
    public var appBuild: String
    public var locale: String

    public init(
        deviceName: String,
        modelIdentifier: String,
        systemName: String,
        systemVersion: String,
        appVersion: String,
        appBuild: String,
        locale: String)
    {
        self.deviceName = deviceName
        self.modelIdentifier = modelIdentifier
        self.systemName = systemName
        self.systemVersion = systemVersion
        self.appVersion = appVersion
        self.appBuild = appBuild
        self.locale = locale
    }
}
