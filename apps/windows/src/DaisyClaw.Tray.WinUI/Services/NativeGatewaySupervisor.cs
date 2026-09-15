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
    public static async Task<EnsureResult> EnsureAsync(
        string dataDir,
        IDaisyClawLogger? logger = null,
        bool allowEngineRepair = true)
    {
        try
        {
            var (port, token, found) = ReadNativeGatewayConfig();
            var gatewayUrl = $"ws://127.0.0.1:{port}";
            var healthy = found && await ProbeHealthAsync(port);

            if (!healthy && found)
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
                // No config yet (fresh install where the installer's service
                // step failed), or the scheduled task is missing/broken: let
                // the bundled engine register itself. Same script the
                // installer runs, so this is a repair, not a second path.
                // When the task exists the gateway is merely slow (first start
                // on a fresh PC can take minutes); repairing would only stack a
                // second start, so leave it to the caller's retry loop.
                var taskRegistered = found && WindowsStartupTaskRegistration.Exists(GatewayTaskName);
                if (allowEngineRepair
                    && !taskRegistered
                    && TryLocateBundledEngineScript() is { } engineScript)
                {
                    logger?.Info($"[NativeGateway] repairing gateway service with bundled engine ({engineScript})");
                    var repaired = await RunEngineActionAsync(engineScript, "install", TimeSpan.FromSeconds(150), logger);
                    (port, token, found) = ReadNativeGatewayConfig();
                    gatewayUrl = $"ws://127.0.0.1:{port}";
                    healthy = found && await ProbeHealthAsync(port);
                    for (var attempt = 0; attempt < 10 && !healthy; attempt++)
                    {
                        await Task.Delay(TimeSpan.FromSeconds(2));
                        (port, token, found) = ReadNativeGatewayConfig();
                        gatewayUrl = $"ws://127.0.0.1:{port}";
                        healthy = found && await ProbeHealthAsync(port);
                    }
                    logger?.Info($"[NativeGateway] repair exit={repaired} healthy={healthy}");
                }
            }

            if (!found)
            {
                return new EnsureResult(
                    false,
                    gatewayUrl,
                    null,
                    "DaisyClaw is not set up on this PC (no %USERPROFILE%\\.daisyclaw\\daisyclaw.json).");
            }

            if (!healthy)
            {
                // The engine is installed but still starting. Register the
                // record anyway: the app used to leave the registry empty here,
                // and an empty registry made opening the dashboard a silent
                // no-op, so a user who clicked the tray icon during a cold
                // start got no window and no message at all. The record carries
                // the URL and token, which are already known; the dashboard
                // window shows its own starting screen and reloads itself once
                // the engine answers.
                TryRegisterGatewayRecord(dataDir, gatewayUrl, token, logger);
                return new EnsureResult(
                    false,
                    gatewayUrl,
                    token,
                    $"The Daisy gateway did not respond on port {port}.");
            }

            var record = TryRegisterGatewayRecord(dataDir, gatewayUrl, token, logger);
            if (record is null)
            {
                return new EnsureResult(
                    false,
                    gatewayUrl,
                    token,
                    "The Daisy gateway is running but could not be recorded for this PC.");
            }

            return new EnsureResult(true, gatewayUrl, record.SharedGatewayToken, null);
        }
        catch (Exception ex)
        {
            return new EnsureResult(false, "ws://127.0.0.1:18789", null, ex.Message);
        }
    }

    /// <summary>
    /// Records this PC's gateway as the active one. Called as soon as the URL
    /// and token are known, whether or not the engine is answering yet, because
    /// every path that opens the dashboard needs a record to build its URL.
    /// </summary>
    private static GatewayRecord? TryRegisterGatewayRecord(
        string dataDir,
        string gatewayUrl,
        string? token,
        IDaisyClawLogger? logger)
    {
        try
        {
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
            return record;
        }
        catch (Exception ex)
        {
            logger?.Warn($"[NativeGateway] could not record gateway {gatewayUrl}: {ex.Message}");
            return null;
        }
    }

    /// <summary>
    /// The gateway URL this PC's engine is configured to serve, whether or not
    /// it is answering yet. Callers that must open a window use this so a cold
    /// start never leaves the user with nothing.
    /// </summary>
    internal static (string Url, string? Token)? TryResolveConfiguredGateway()
    {
        var (port, token, found) = ReadNativeGatewayConfig();
        return found ? ($"ws://127.0.0.1:{port}", token) : null;
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
            var restartsWithoutRecovery = 0;
            var lastEngineRepair = DateTime.MinValue;
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
                        restartsWithoutRecovery = 0;
                        continue;
                    }

                    consecutiveFailures++;
                    // Two consecutive misses (~1 min down) before intervening,
                    // so a config-apply restart never triggers a second start.
                    if (consecutiveFailures < 2)
                        continue;

                    logger?.Warn($"[NativeGateway] watchdog: gateway down on {port}; restarting '{GatewayTaskName}'");
                    TryRunScheduledTask(GatewayTaskName);
                    restartsWithoutRecovery++;
                    consecutiveFailures = 0;

                    // Three restarts in a row without recovery means the task
                    // itself is gone or broken (e.g. deleted by the user):
                    // re-register it from the bundled engine, at most once
                    // per 10 minutes so a truly broken engine cannot spin.
                    if (restartsWithoutRecovery >= 3
                        && DateTime.UtcNow - lastEngineRepair > TimeSpan.FromMinutes(10)
                        && TryLocateBundledEngineScript() is { } engineScript)
                    {
                        lastEngineRepair = DateTime.UtcNow;
                        restartsWithoutRecovery = 0;
                        logger?.Warn("[NativeGateway] watchdog: repairing gateway service with bundled engine");
                        await RunEngineActionAsync(engineScript, "install", TimeSpan.FromSeconds(150), logger);
                    }
                }
                catch
                {
                    // The watchdog itself must never die.
                }
            }
        });
    }

    /// <summary>
    /// True when the gateway is ready to be used, not merely listening.
    ///
    /// The engine binds its HTTP port several seconds before it finishes
    /// loading plugins, and it refuses connections during that window. Treating
    /// any HTTP answer as healthy therefore opened the dashboard too early, and
    /// the user met a login form until the engine caught up. The readiness
    /// endpoint reports that window honestly, so it is what we ask.
    /// </summary>
    internal static async Task<bool> ProbeHealthAsync(int port)
    {
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
            using var response = await client.GetAsync(
                new Uri($"http://127.0.0.1:{port}{GatewayReadinessPolicy.ReadinessPath}"));
            return GatewayReadinessPolicy.IsUsable((int)response.StatusCode);
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Path of the bundled engine's service script (<c>engine\\Manage-DaisyGateway.ps1</c>
    /// next to the tray executable), or null on installs without a bundled engine
    /// (developer machines running the gateway from source or npm).
    /// </summary>
    internal static string? TryLocateBundledEngineScript()
    {
        try
        {
            var candidate = Path.Combine(AppContext.BaseDirectory, "engine", "Manage-DaisyGateway.ps1");
            return File.Exists(candidate) && File.Exists(Path.Combine(AppContext.BaseDirectory, "engine", "node.exe"))
                ? candidate
                : null;
        }
        catch
        {
            return null;
        }
    }

    /// <summary>
    /// Runs the bundled engine's service script hidden (install/start/stop/uninstall)
    /// and returns its exit code, or -1 when it could not run or timed out. Never throws.
    /// </summary>
    internal static async Task<int> RunEngineActionAsync(
        string engineScript,
        string action,
        TimeSpan timeout,
        IDaisyClawLogger? logger = null)
    {
        try
        {
            var engineRoot = Path.GetDirectoryName(engineScript) ?? AppContext.BaseDirectory;
            var logPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                AppIdentity.DataDirectoryName,
                "logs",
                "gateway-setup.log");
            var powershell = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.Windows),
                "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
            var startInfo = new ProcessStartInfo
            {
                FileName = File.Exists(powershell) ? powershell : "powershell.exe",
                WorkingDirectory = engineRoot,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            foreach (var arg in new[]
            {
                "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
                "-File", engineScript,
                "-Action", action,
                "-EngineRoot", engineRoot,
                "-LogPath", logPath,
            })
            {
                startInfo.ArgumentList.Add(arg);
            }

            using var process = Process.Start(startInfo);
            if (process is null)
                return -1;
            using var cts = new CancellationTokenSource(timeout);
            try
            {
                await process.WaitForExitAsync(cts.Token);
            }
            catch (OperationCanceledException)
            {
                logger?.Warn($"[NativeGateway] engine {action} timed out after {timeout.TotalSeconds:N0}s");
                try { process.Kill(entireProcessTree: true); } catch { }
                return -1;
            }
            return process.ExitCode;
        }
        catch (Exception ex)
        {
            logger?.Warn($"[NativeGateway] engine {action} failed to run: {ex.Message}");
            return -1;
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
