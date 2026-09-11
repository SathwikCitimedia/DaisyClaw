using Microsoft.Win32;
using DaisyClaw.Shared;
using System;
using System.Threading.Tasks;

namespace DaisyClawTray.Services;

/// <summary>
/// Manages Windows auto-start registration.
/// </summary>
public static class AutoStartManager
{
    private const string RegistryKey = @"SOFTWARE\Microsoft\Windows\CurrentVersion\Run";
    private static readonly string AppName = AppIdentity.AutoStartRegistryName;

    public static bool IsAutoStartEnabled()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(RegistryKey, false);
            if (key?.GetValue(AppName) != null)
                return true;
        }
        catch
        {
        }

        return WindowsStartupTaskRegistration.Exists(AppIdentity.StartupTaskName);
    }

    public static void SetAutoStart(bool enable)
    {
        try
        {
            if (enable)
            {
                var exePath = Environment.ProcessPath ?? System.Reflection.Assembly.GetExecutingAssembly().Location;
                if (WindowsStartupTaskRegistration.Register(exePath, AppIdentity.StartupTaskName))
                {
                    DeleteRunKey();
                    Logger.Info("Auto-start enabled via scheduled task");
                    return;
                }

                using var key = Registry.CurrentUser.CreateSubKey(RegistryKey, true);
                if (key == null)
                {
                    Logger.Warn($"Auto-start registry key unavailable: HKCU\\{RegistryKey}");
                    return;
                }

                key.SetValue(AppName, $"\"{exePath}\"");
                Logger.Info("Auto-start enabled");
            }
            else
            {
                DeleteRunKey();
                WindowsStartupTaskRegistration.Unregister(AppIdentity.StartupTaskName);
                Logger.Info("Auto-start disabled");
            }
        }
        catch (Exception ex)
        {
            Logger.Error($"Failed to set auto-start: {ex.Message}");
        }
    }

    public static Task SetAutoStartAsync(bool enable) =>
        Task.Run(() => SetAutoStart(enable));

    /// <summary>
    /// Removes stale auto-start Run entries left by earlier, differently-named
    /// builds (e.g. a pre-rename exe) so they cannot relaunch a ghost process.
    /// </summary>
    public static void CleanUpStaleRunEntries()
    {
        // Legacy Run value names this app (or its predecessor) may have written.
        string[] staleNames = ["DaisyAssistant", "DaisyAssistant-Dev", "OpenClawTray", "OpenClawTray-Dev"];
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(RegistryKey, writable: true);
            if (key is null)
                return;
            foreach (var name in staleNames)
            {
                if (name == AppName)
                    continue;
                var value = key.GetValue(name) as string;
                // Only remove entries that don't point at the current exe.
                if (value is not null &&
                    (value.Contains("OpenClaw", StringComparison.OrdinalIgnoreCase) ||
                     !value.Contains(Environment.ProcessPath ?? "\0", StringComparison.OrdinalIgnoreCase)))
                {
                    key.DeleteValue(name, throwOnMissingValue: false);
                    Logger.Info($"Removed stale auto-start entry: {name}");
                }
            }
        }
        catch (Exception ex)
        {
            Logger.Warn($"Stale auto-start cleanup failed: {ex.Message}");
        }
    }

    private static void DeleteRunKey()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(RegistryKey, writable: true);
            key?.DeleteValue(AppName, false);
        }
        catch (Exception ex)
        {
            Logger.Warn($"Failed to remove auto-start registry key: {ex.Message}");
        }
    }
}
