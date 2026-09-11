namespace DaisyClawTray;

/// <summary>
/// Compile-time app identity constants that vary between Dev and Release builds,
/// enabling side-by-side installation of both variants (similar to WinUI Gallery).
/// </summary>
internal static class AppIdentity
{
#if DEV_BUILD
    /// <summary>Human-visible app name shown in tray tooltips, window titles, and notifications.</summary>
    public const string DisplayName = "Daisy Assistant (Dev)";

    /// <summary>Short name used in tray tooltip prefix.</summary>
    public const string TrayName = "Daisy Assistant (Dev)";

    /// <summary>MSIX package identity name (must differ from release for side-by-side).</summary>
    public const string PackageIdentityName = "DaisyClaw.DaisyAssistant.Dev";

    /// <summary>Win32 AppUserModelID used for notifications and shell grouping.</summary>
    public const string AppUserModelId = PackageIdentityName;

    /// <summary>Windows Registry auto-start value name (must differ so both can auto-start).</summary>
    public const string AutoStartRegistryName = "DaisyAssistant-Dev";

    /// <summary>Windows scheduled task name (must differ so both can auto-start).</summary>
    public const string StartupTaskName = "Daisy Assistant (Dev)";

    /// <summary>Leaf directory for local and roaming app-owned data.</summary>
    public const string DataDirectoryName = "DaisyAssistant-Dev";

    /// <summary>Single-instance mutex base name.</summary>
    public const string MutexBaseName = "DaisyAssistant-Dev";

    /// <summary>Protocol scheme for deep links.</summary>
    public const string ProtocolScheme = "daisy-dev";

    /// <summary>App-owned WSL distro used by embedded setup.</summary>
    public const string SetupDistroName = "DaisyClawGateway-Dev";

    /// <summary>Loopback gateway port used by embedded setup.</summary>
    public const int SetupGatewayPort = 18790;

    /// <summary>Explicit IPv4 loopback gateway URL used by embedded setup and post-setup startup.</summary>
    public const string SetupGatewayUrl = "ws://127.0.0.1:18790";

    /// <summary>Whether this is a development build.</summary>
    public static bool IsDev => true;
#else
    /// <summary>Human-visible app name shown in tray tooltips, window titles, and notifications.</summary>
    public const string DisplayName = "Daisy Assistant";

    /// <summary>Short name used in tray tooltip prefix.</summary>
    public const string TrayName = "Daisy Assistant";

    /// <summary>MSIX package identity name.</summary>
    public const string PackageIdentityName = "DaisyClaw.DaisyAssistant";

    /// <summary>Win32 AppUserModelID used for notifications and shell grouping.</summary>
    public const string AppUserModelId = PackageIdentityName;

    /// <summary>Windows Registry auto-start value name.</summary>
    public const string AutoStartRegistryName = "DaisyAssistant";

    /// <summary>Windows scheduled task name.</summary>
    public const string StartupTaskName = "Daisy Assistant";

    /// <summary>Leaf directory for local and roaming app-owned data.</summary>
    public const string DataDirectoryName = "DaisyAssistant";

    /// <summary>Single-instance mutex base name.</summary>
    public const string MutexBaseName = "DaisyAssistant";

    /// <summary>Protocol scheme for deep links.</summary>
    public const string ProtocolScheme = "daisy";

    /// <summary>App-owned WSL distro used by embedded setup.</summary>
    public const string SetupDistroName = "DaisyClawGateway";

    /// <summary>Loopback gateway port used by embedded setup.</summary>
    public const int SetupGatewayPort = 18789;

    /// <summary>Explicit IPv4 loopback gateway URL used by embedded setup and post-setup startup.</summary>
    public const string SetupGatewayUrl = "ws://127.0.0.1:18789";

    /// <summary>Whether this is a development build.</summary>
    public static bool IsDev => false;
#endif

    public static string ResolveLocalDataDirectory()
        => Environment.GetEnvironmentVariable("DAISYCLAW_TRAY_DATA_DIR") is { Length: > 0 } overrideDir
            ? overrideDir
            : Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                DataDirectoryName);

    /// <summary>
    /// Resolves setup-owned local state while preserving SetupEngine's dedicated
    /// local-data override contract.
    /// </summary>
    public static string ResolveSetupLocalDataDirectory()
    {
        if (Environment.GetEnvironmentVariable("DAISYCLAW_TRAY_LOCALAPPDATA_DIR") is { Length: > 0 } localAppDataRoot)
            return Path.Combine(localAppDataRoot, DataDirectoryName);

        if (Environment.GetEnvironmentVariable("DAISYCLAW_TRAY_LOCAL_DATA_DIR") is { Length: > 0 } localDataDir)
            return localDataDir;

        return Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            DataDirectoryName);
    }

    public static string ResolveRoamingDataDirectory()
        => Environment.GetEnvironmentVariable("DAISYCLAW_TRAY_DATA_DIR") is { Length: > 0 } overrideDir
            ? overrideDir
            : Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                DataDirectoryName);

    public static string DecorateWindowTitle(string title)
        => IsDev ? $"{title} (Dev)" : title;
}
