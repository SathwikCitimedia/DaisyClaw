namespace DaisyClawTray.Services;

/// <summary>
/// Decides whether the local gateway is ready to be used, from the status its
/// readiness endpoint returns.
///
/// The engine binds its HTTP port several seconds before it accepts gateway
/// connections. Treating any HTTP answer as healthy therefore opened the
/// dashboard into a window where connections were still refused, and the user
/// met a login form on a cold start. Kept in its own file, free of process and
/// registry dependencies, so the rule is covered by tests.
/// </summary>
internal static class GatewayReadinessPolicy
{
    /// <summary>The engine's readiness path.</summary>
    public const string ReadinessPath = "/ready";

    /// <summary>
    /// True when the gateway should be treated as usable. 200 is ready and 503
    /// is the still-starting window. A 404 or 405 means an engine without the
    /// endpoint, where the fact that something answered is the best signal
    /// available and refusing it would strand the user on an older install.
    /// </summary>
    public static bool IsUsable(int statusCode) =>
        statusCode switch
        {
            200 => true,
            404 => true,
            405 => true,
            _ => false,
        };
}
