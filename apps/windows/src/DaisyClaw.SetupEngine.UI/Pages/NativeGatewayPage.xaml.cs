using System.Diagnostics;
using System.Text.Json;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Navigation;
using DaisyClaw.Connection;
using DaisyClaw.SetupEngine;
using DaisyClaw.Shared;

namespace DaisyClaw.SetupEngine.UI.Pages;

/// <summary>
/// Native Windows gateway flow: finds (or starts) the DaisyClaw gateway that
/// runs directly on this PC, registers it as the active gateway record, and
/// hands off to the onboarding wizard. No WSL, no distro provisioning — this
/// deliberately leaves <see cref="GatewayRecord.SetupManagedDistroName"/> null
/// so none of the WSL provenance/keepalive/repair machinery engages.
/// </summary>
public sealed partial class NativeGatewayPage : Page
{
    /// <summary>Scheduled task the native DaisyClaw gateway installs under.</summary>
    private const string GatewayTaskName = "DaisyClaw Gateway";

    private SetupConfig? _config;
    private bool _ready;

    public NativeGatewayPage()
    {
        InitializeComponent();
        Loaded += OnLoaded;
    }

    protected override void OnNavigatedTo(NavigationEventArgs e)
    {
        _config = e.Parameter as SetupConfig ?? new SetupConfig();
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        AsyncEventHandlerGuard.Run(DetectAndRegisterAsync, NullLogger.Instance, nameof(DetectAndRegisterAsync));
    }

    private void Back_Click(object sender, RoutedEventArgs e)
    {
        SetupWindow.Active?.NavigateToWelcome(back: true);
    }

    private void Primary_Click(object sender, RoutedEventArgs e)
    {
        if (_ready)
        {
            SetupWindow.Active?.TryNavigateToWizard();
            return;
        }

        // Not ready: the primary button acts as Retry.
        ErrorBar.IsOpen = false;
        PrimaryButton.IsEnabled = false;
        PrimaryButton.Content = "Continue";
        AsyncEventHandlerGuard.Run(DetectAndRegisterAsync, NullLogger.Instance, nameof(DetectAndRegisterAsync));
    }

    private void SetStatus(string status, string detail = "")
    {
        StatusText.Text = status;
        DetailText.Text = detail;
    }

    private void SetFailed(string message)
    {
        DetectProgress.IsActive = false;
        DetectProgress.Visibility = Visibility.Collapsed;
        ResultIcon.Visibility = Visibility.Collapsed;
        SetStatus("Daisy gateway not reachable");
        ErrorBar.Message = message;
        ErrorBar.IsOpen = true;
        PrimaryButton.Content = "Try again";
        PrimaryButton.IsEnabled = true;
    }

    private async Task DetectAndRegisterAsync()
    {
        var setupWindow = SetupWindow.Active;
        var config = _config;
        if (setupWindow is null || config is null)
            return;

        _ready = false;
        DetectProgress.Visibility = Visibility.Visible;
        DetectProgress.IsActive = true;
        ResultIcon.Visibility = Visibility.Collapsed;

        // 1. Read the native gateway's own config for its port and token.
        SetStatus("Reading your Daisy configuration…");
        var (gatewayPort, sharedToken, configFound) = await Task.Run(ReadNativeGatewayConfig);
        if (!configFound)
        {
            SetFailed(
                "DaisyClaw isn't set up on this PC yet (no configuration found in "
                + "%USERPROFILE%\\.daisyclaw). Install DaisyClaw first, or go Back and "
                + "choose \"Connect to an existing gateway\".");
            return;
        }

        var gatewayUrl = $"ws://127.0.0.1:{gatewayPort}";

        // 2. Health-check; if it isn't up, start the scheduled task and poll.
        SetStatus("Checking the Daisy gateway…", gatewayUrl);
        var healthy = await ProbeHealthAsync(gatewayPort);
        if (!healthy)
        {
            SetStatus("Starting the Daisy gateway…", "This can take a few seconds.");
            await Task.Run(() => TryRunScheduledTask(GatewayTaskName));
            for (var attempt = 0; attempt < 15 && !healthy; attempt++)
            {
                await Task.Delay(TimeSpan.FromSeconds(2));
                healthy = await ProbeHealthAsync(gatewayPort);
            }
        }

        if (!healthy)
        {
            SetFailed(
                $"The Daisy gateway did not respond on port {gatewayPort}. "
                + "Make sure DaisyClaw is installed and running, then try again.");
            return;
        }

        // 3. Register the gateway record and device identity, mirroring
        //    PairOperatorStep but with no managed-distro ownership.
        SetStatus("Registering Daisy Assistant with your gateway…");
        try
        {
            await Task.Run(() =>
            {
                var registry = new GatewayRegistry(setupWindow.DataDir);
                registry.Load();
                var existing = registry.FindByUrl(gatewayUrl);
                var record = (existing ?? new GatewayRecord
                {
                    Id = Guid.NewGuid().ToString("N")[..16],
                    Url = gatewayUrl,
                }) with
                {
                    FriendlyName = "Daisy (this PC)",
                    SharedGatewayToken = string.IsNullOrWhiteSpace(sharedToken)
                        ? existing?.SharedGatewayToken
                        : sharedToken,
                    IsLocal = true,
                    SetupManagedDistroName = null,
                    SshTunnel = null,
                    LastConnected = DateTime.UtcNow,
                };
                record = registry.AddOrUpdate(record);
                registry.SetActive(record.Id);
                registry.Save();
                new DeviceIdentity(registry.GetIdentityDirectory(record.Id)).Initialize();

                // Keep the wizard/summary and the tray's defaults aligned with
                // the native endpoint, and persist the capability defaults the
                // WSL pipeline would have written in VerifyEndToEndStep.
                config.GatewayUrl = gatewayUrl;
                config.Settings.ApplyCapabilities(config.Capabilities);
                config.Settings.MergeIntoSettingsFile(Path.Combine(setupWindow.DataDir, "settings.json"));
            });
        }
        catch (Exception ex)
        {
            SetFailed($"Could not save the gateway connection: {ex.Message}");
            return;
        }

        _ready = true;
        DetectProgress.IsActive = false;
        DetectProgress.Visibility = Visibility.Collapsed;
        ResultIcon.Visibility = Visibility.Visible;
        SetStatus("Daisy gateway is ready", gatewayUrl);
        PrimaryButton.Content = "Continue";
        PrimaryButton.IsEnabled = true;
    }

    /// <summary>
    /// Reads %USERPROFILE%\.daisyclaw\daisyclaw.json for the gateway port and
    /// shared auth token. Tolerates comments/trailing commas; any parse failure
    /// counts as "not found" so the UI can give one clear message.
    /// </summary>
    private static (int Port, string? Token, bool Found) ReadNativeGatewayConfig()
    {
        try
        {
            var path = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                ".daisyclaw",
                "daisyclaw.json");
            if (!File.Exists(path))
                return (18789, null, false);

            using var doc = JsonDocument.Parse(
                File.ReadAllText(path),
                new JsonDocumentOptions
                {
                    CommentHandling = JsonCommentHandling.Skip,
                    AllowTrailingCommas = true,
                });

            var port = 18789;
            string? token = null;
            if (doc.RootElement.TryGetProperty("gateway", out var gateway))
            {
                if (gateway.TryGetProperty("port", out var portElement)
                    && portElement.ValueKind == JsonValueKind.Number
                    && portElement.TryGetInt32(out var parsedPort)
                    && parsedPort is > 0 and < 65536)
                {
                    port = parsedPort;
                }

                if (gateway.TryGetProperty("auth", out var auth)
                    && auth.TryGetProperty("token", out var tokenElement)
                    && tokenElement.ValueKind == JsonValueKind.String)
                {
                    token = tokenElement.GetString();
                }
            }

            return (port, token, true);
        }
        catch
        {
            return (18789, null, false);
        }
    }

    /// <summary>HTTP GET against the gateway's HTTP endpoint; any response counts.</summary>
    private static async Task<bool> ProbeHealthAsync(int port)
    {
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
            using var response = await client.GetAsync(new Uri($"http://127.0.0.1:{port}/"));
            return true;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>Starts the native gateway's scheduled task; failures are non-fatal
    /// (the follow-up health poll decides the outcome).</summary>
    private static void TryRunScheduledTask(string taskName)
    {
        try
        {
            using var process = Process.Start(new ProcessStartInfo
            {
                FileName = WindowsStartupTaskRegistration.ResolveSchtasksPath(),
                Arguments = $"/Run /TN \"{taskName}\"",
                UseShellExecute = false,
                CreateNoWindow = true,
            });
            process?.WaitForExit(10_000);
        }
        catch
        {
            // Non-fatal: the health poll after this reports the real outcome.
        }
    }
}
