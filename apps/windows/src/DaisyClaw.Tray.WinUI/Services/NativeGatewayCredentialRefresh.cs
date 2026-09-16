using DaisyClaw.Connection;
using DaisyClaw.Shared;

namespace DaisyClawTray.Services;

/// <summary>
/// Keeps the active native gateway record's shared token in step with the
/// engine's own configuration file.
/// <para>
/// The bundled engine owns the shared token: every reinstall or reset can
/// rotate it, while the tray's gateway record keeps the copy from the last
/// launch. That stale copy produced the two failures seen on upgraded PCs: the
/// dashboard opened with a rejected token (login form), and the tray's
/// credential recovery retried with the same rejected token. Both paths now
/// ask this class for the token the engine is actually using.
/// </para>
/// </summary>
internal static class NativeGatewayCredentialRefresh
{
    /// <summary>
    /// True when <paramref name="record"/> addresses the configured native
    /// engine: both loopback, same port. Scheme and host spelling
    /// (localhost vs 127.0.0.1) are not significant.
    /// </summary>
    internal static bool Matches(GatewayRecord record, string configuredUrl)
    {
        if (record is null ||
            string.IsNullOrWhiteSpace(record.Url) ||
            string.IsNullOrWhiteSpace(configuredUrl) ||
            !LocalGatewayUrlClassifier.IsLocalGatewayUrl(record.Url) ||
            !LocalGatewayUrlClassifier.IsLocalGatewayUrl(configuredUrl) ||
            !Uri.TryCreate(record.Url, UriKind.Absolute, out var recordUri) ||
            !Uri.TryCreate(configuredUrl, UriKind.Absolute, out var configuredUri))
        {
            return false;
        }

        return recordUri.Port == configuredUri.Port;
    }

    /// <summary>
    /// The shared token the engine's configuration currently holds for
    /// <paramref name="record"/>, or null when the record is not the native
    /// engine or no configuration is present. Used by the connection manager
    /// when a credential is rejected.
    /// </summary>
    internal static string? ResolveSharedToken(
        GatewayRecord record,
        (string Url, string? Token)? configured)
    {
        if (configured is not { } engine ||
            string.IsNullOrWhiteSpace(engine.Token) ||
            !Matches(record, engine.Url))
        {
            return null;
        }

        return engine.Token;
    }

    /// <summary>
    /// Writes the engine's current shared token onto the active record when it
    /// differs. Returns true when the record changed.
    /// </summary>
    internal static bool RefreshActiveRecord(
        GatewayRegistry? registry,
        (string Url, string? Token)? configured,
        IDaisyClawLogger? logger = null)
    {
        if (registry is null)
            return false;

        var active = registry.GetActive();
        if (active is null)
            return false;

        var fresh = ResolveSharedToken(active, configured);
        if (string.IsNullOrWhiteSpace(fresh) ||
            string.Equals(fresh, active.SharedGatewayToken, StringComparison.Ordinal))
        {
            return false;
        }

        try
        {
            var updated = registry.UpdateAndSave(
                active.Id,
                record => record with { SharedGatewayToken = fresh });
            if (updated is null)
                return false;
            logger?.Info("[NativeGateway] shared token refreshed from the engine configuration.");
            return true;
        }
        catch (Exception ex)
        {
            logger?.Warn($"[NativeGateway] could not persist the refreshed shared token: {ex.Message}");
            return false;
        }
    }
}
