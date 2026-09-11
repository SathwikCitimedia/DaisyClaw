using System.Diagnostics;
using System.Text.Json;
using DaisyClaw.Connection;
using DaisyClaw.Shared;

namespace DaisyClawTray.Services;

/// <summary>
/// Headless consumer-flow replacement for the SetupWindow ceremony: ensures the
/// native DaisyClaw gateway on this PC is running and registered as the active
/// gateway record. Mirrors NativeGatewayPage's guided flow without any UI.
/// The record deliberately keeps <see cref="GatewayRecord.SetupManagedDistroName"/>
/// null so none of the WSL provenance/keepalive/repair machinery engages.
/// </summary>
internal static class NativeGatewaySupervisor
{
    /// <summary>Scheduled task the native DaisyClaw gateway installs under.</summary>
    public const string GatewayTaskName = "DaisyClaw Gateway";

    internal sealed record EnsureResult(
        bool Ok,
        string GatewayUrl,
        string? SharedToken,
        string? Error);

    /// <summary>
    /// Reads the native gateway's own config, starts the gateway if needed, and
    /// registers it as the active gateway record under <paramref name="dataDir"/>.
    /// Never throws; failures come back as <see cref="EnsureResult.Error"/>.
    /// </summary>
    public static async Task<EnsureResult> EnsureAsync(string dataDir, IDaisyClawLogger? logger = null)
    {
        try
        {
            var (port, token, found) = ReadNativeGatewayConfig();
            var gatewayUrl = $"ws://127.0.0.1:{port}";
            if (!found)
            {
                return new EnsureResult(
                    false,
                    gatewayUrl,
                    null,
                    "DaisyClaw is not set up on this PC (no %USERPROFILE%\\.daisyclaw\\daisyclaw.json).");
            }

            var healthy = await ProbeHealthAsync(port);
            if (!healthy)
            {
                logger?.Info($"[NativeGateway] gateway not responding on {port}; starting task '{GatewayTaskName}'");
                TryRunScheduledTask(GatewayTaskName);
                for (var attempt = 0; attempt < 15 && !healthy; attempt++)
                {
                    await Task.Delay(TimeSpan.FromSeconds(2));
                    healthy = await ProbeHealthAsync(port);
                }
            }

            if (!healthy)
            {
                return new EnsureResult(
                    false,
                    gatewayUrl,
                    token,
                    $"The Daisy gateway did not respond on port {port}.");
            }

            var registry = new GatewayRegistry(dataDir);
            registry.Load();
            var existing = registry.FindByUrl(gatewayUrl);
            var record = (existing ?? new GatewayRecord
            {
                Id = Guid.NewGuid().ToString("N")[..16],
                Url = gatewayUrl,
            }) with
            {
                FriendlyName = "Daisy (this PC)",
                SharedGatewayToken = string.IsNullOrWhiteSpace(token)
                    ? existing?.SharedGatewayToken
                    : token,
                IsLocal = true,
                SetupManagedDistroName = null,
                SshTunnel = null,
                LastConnected = DateTime.UtcNow,
            };
            record = registry.AddOrUpdate(record);
            registry.SetActive(record.Id);
            registry.Save();
            new DeviceIdentity(registry.GetIdentityDirectory(record.Id)).Initialize();
            logger?.Info($"[NativeGateway] active record {record.Id} -> {gatewayUrl}");

            return new EnsureResult(true, gatewayUrl, record.SharedGatewayToken, null);
        }
        catch (Exception ex)
        {
            return new EnsureResult(false, "ws://127.0.0.1:18789", null, ex.Message);
        }
    }

    /// <summary>
    /// Reads %USERPROFILE%\.daisyclaw\daisyclaw.json for the gateway port and
    /// shared auth token. Tolerates comments/trailing commas; any parse failure
    /// counts as "not found".
    /// </summary>
    internal static (int Port, string? Token, bool Found) ReadNativeGatewayConfig()
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

    /// <summary>
    /// Always-on watchdog: probes the native gateway every 30 seconds and
    /// restarts its scheduled task when it stops responding. Fire-and-forget;
    /// lives for the process lifetime.
    /// </summary>
    public static void StartWatchdog(IDaisyClawLogger? logger = null)
    {
        _ = Task.Run(async () =>
        {
            var consecutiveFailures = 0;
            while (true)
            {
                try
                {
                    await Task.Delay(TimeSpan.FromSeconds(30));
                    var (port, _, found) = ReadNativeGatewayConfig();
                    if (!found)
                        continue;
                    if (await ProbeHealthAsync(port))
                    {
                        consecutiveFailures = 0;
                        continue;
                    }

                    consecutiveFailures++;
                    // Two consecutive misses (~1 min down) before intervening,
                    // so a config-apply restart never triggers a second start.
                    if (consecutiveFailures < 2)
                        continue;

                    logger?.Warn($"[NativeGateway] watchdog: gateway down on {port}; restarting '{GatewayTaskName}'");
                    TryRunScheduledTask(GatewayTaskName);
                    consecutiveFailures = 0;
                }
                catch
                {
                    // The watchdog itself must never die.
                }
            }
        });
    }

    /// <summary>HTTP GET against the gateway's HTTP endpoint; any response counts.</summary>
    internal static async Task<bool> ProbeHealthAsync(int port)
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
    internal static void TryRunScheduledTask(string taskName)
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
