import Foundation

// Stable identifier used for both the macOS LaunchAgent label and Nix-managed defaults suite.
// nix-daisyclaw writes app defaults into this suite to survive app bundle identifier churn.
let launchdLabel = "ai.daisyclaw.mac"
let gatewayLaunchdLabel = "ai.daisyclaw.gateway"
let onboardingVersionKey = "daisyclaw.onboardingVersion"
let onboardingSeenKey = "daisyclaw.onboardingSeen"
let currentOnboardingVersion = 7
let pauseDefaultsKey = "daisyclaw.pauseEnabled"
let iconAnimationsEnabledKey = "daisyclaw.iconAnimationsEnabled"
let swabbleEnabledKey = "daisyclaw.swabbleEnabled"
let swabbleTriggersKey = "daisyclaw.swabbleTriggers"
let voiceWakeTriggerChimeKey = "daisyclaw.voiceWakeTriggerChime"
let voiceWakeSendChimeKey = "daisyclaw.voiceWakeSendChime"
let showDockIconKey = "daisyclaw.showDockIcon"
let defaultVoiceWakeTriggers = ["daisyclaw"]
let voiceWakeMaxWords = 32
let voiceWakeMaxWordLength = 64
let voiceWakeMicKey = "daisyclaw.voiceWakeMicID"
let voiceWakeMicNameKey = "daisyclaw.voiceWakeMicName"
let voiceWakeLocaleKey = "daisyclaw.voiceWakeLocaleID"
let voiceWakeAdditionalLocalesKey = "daisyclaw.voiceWakeAdditionalLocaleIDs"
let voicePushToTalkEnabledKey = "daisyclaw.voicePushToTalkEnabled"
let voiceWakeTriggersTalkModeKey = "daisyclaw.voiceWakeTriggersTalkMode"
let talkEnabledKey = "daisyclaw.talkEnabled"
let talkPhaseSoundsEnabledKey = "daisyclaw.talkPhaseSoundsEnabled"
let talkShiftToStopEnabledKey = "daisyclaw.talkShiftToStopEnabled"
let iconOverrideKey = "daisyclaw.iconOverride"
let connectionModeKey = "daisyclaw.connectionMode"
let remoteTargetKey = "daisyclaw.remoteTarget"
let remoteIdentityKey = "daisyclaw.remoteIdentity"
let remoteProjectRootKey = "daisyclaw.remoteProjectRoot"
let remoteCliPathKey = "daisyclaw.remoteCliPath"
let canvasEnabledKey = "daisyclaw.canvasEnabled"
let cameraEnabledKey = "daisyclaw.cameraEnabled"
let systemRunPolicyKey = "daisyclaw.systemRunPolicy"
let systemRunAllowlistKey = "daisyclaw.systemRunAllowlist"
let systemRunEnabledKey = "daisyclaw.systemRunEnabled"
let locationModeKey = "daisyclaw.locationMode"
let locationPreciseKey = "daisyclaw.locationPreciseEnabled"
let peekabooBridgeEnabledKey = "daisyclaw.peekabooBridgeEnabled"
let deepLinkKeyKey = "daisyclaw.deepLinkKey"
let cliInstallPromptedVersionKey = "daisyclaw.cliInstallPromptedVersion"
let heartbeatsEnabledKey = "daisyclaw.heartbeatsEnabled"
let debugPaneEnabledKey = "daisyclaw.debugPaneEnabled"
let debugFileLogEnabledKey = "daisyclaw.debug.fileLogEnabled"
let appLogLevelKey = "daisyclaw.debug.appLogLevel"
let voiceWakeSupported: Bool = ProcessInfo.processInfo.operatingSystemVersion.majorVersion >= 26
