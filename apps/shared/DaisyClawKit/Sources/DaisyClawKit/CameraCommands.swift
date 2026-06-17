import Foundation

public enum DaisyClawCameraCommand: String, Codable, Sendable {
    case list = "camera.list"
    case snap = "camera.snap"
    case clip = "camera.clip"
}

public enum DaisyClawCameraFacing: String, Codable, Sendable {
    case back
    case front
}

public enum DaisyClawCameraImageFormat: String, Codable, Sendable {
    case jpg
    case jpeg
}

public enum DaisyClawCameraVideoFormat: String, Codable, Sendable {
    case mp4
}

public struct DaisyClawCameraSnapParams: Codable, Sendable, Equatable {
    public var facing: DaisyClawCameraFacing?
    public var maxWidth: Int?
    public var quality: Double?
    public var format: DaisyClawCameraImageFormat?
    public var deviceId: String?
    public var delayMs: Int?

    public init(
        facing: DaisyClawCameraFacing? = nil,
        maxWidth: Int? = nil,
        quality: Double? = nil,
        format: DaisyClawCameraImageFormat? = nil,
        deviceId: String? = nil,
        delayMs: Int? = nil)
    {
        self.facing = facing
        self.maxWidth = maxWidth
        self.quality = quality
        self.format = format
        self.deviceId = deviceId
        self.delayMs = delayMs
    }
}

public struct DaisyClawCameraClipParams: Codable, Sendable, Equatable {
    public var facing: DaisyClawCameraFacing?
    public var durationMs: Int?
    public var includeAudio: Bool?
    public var format: DaisyClawCameraVideoFormat?
    public var deviceId: String?

    public init(
        facing: DaisyClawCameraFacing? = nil,
        durationMs: Int? = nil,
        includeAudio: Bool? = nil,
        format: DaisyClawCameraVideoFormat? = nil,
        deviceId: String? = nil)
    {
        self.facing = facing
        self.durationMs = durationMs
        self.includeAudio = includeAudio
        self.format = format
        self.deviceId = deviceId
    }
}
