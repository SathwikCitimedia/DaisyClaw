using System;
using DaisyClaw.Shared;

namespace DaisyClawTray.Services;

internal sealed record SettingsChangeEffects(
    Action<SettingsData> ApplyOllamaPermission,
    Action<SettingsData> ApplyChatToolCallVisibility,
    Action SyncActiveGatewayBrowserProxyForward,
    Action PublishSandboxRiskNotification,
    Action<SettingsData> PrepareFullReconnect,
    Action ReconnectWithSyncedBrowserProxyForward,
    Action<SettingsData> ApplyMcpRuntime,
    Action<SettingsData> ApplyGlobalHotkey,
    Action<SettingsData> ApplyAutoStartAndTelemetry,
    Action<SettingsData> ApplyOnUiThread);
