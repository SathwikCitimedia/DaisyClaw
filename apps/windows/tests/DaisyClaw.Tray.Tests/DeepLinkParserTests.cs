using DaisyClaw.Shared;
using DaisyClawTray.Services;

namespace DaisyClaw.Tray.Tests;

public class DeepLinkParserTests
{
    #region ParseDeepLink

    [Fact]
    public void ParseDeepLink_Settings()
    {
        var result = DeepLinkParser.ParseDeepLink("daisyclaw://settings");
        Assert.NotNull(result);
        Assert.Equal("settings", result.Path);
        Assert.Empty(result.Query);
        Assert.Empty(result.Parameters);
    }

    [Fact]
    public void ParseDeepLink_Dashboard()
    {
        var result = DeepLinkParser.ParseDeepLink("daisyclaw://dashboard");
        Assert.NotNull(result);
        Assert.Equal("dashboard", result.Path);
    }

    [Fact]
    public void ParseDeepLink_DashboardSubpath()
    {
        var result = DeepLinkParser.ParseDeepLink("daisyclaw://dashboard/sessions");
        Assert.NotNull(result);
        Assert.Equal("dashboard/sessions", result.Path);
    }

    [Theory]
    [InlineData("daisyclaw://dashboard/channels", "dashboard/channels")]
    [InlineData("daisyclaw://dashboard/skills", "dashboard/skills")]
    [InlineData("daisyclaw://dashboard/cron", "dashboard/cron")]
    public void ParseDeepLink_DashboardKnownSubpaths(string uri, string expectedPath)
    {
        var result = DeepLinkParser.ParseDeepLink(uri);
        Assert.NotNull(result);
        Assert.Equal(expectedPath, result.Path);
    }

    [Fact]
    public void ParseDeepLink_SendWithMessage()
    {
        var result = DeepLinkParser.ParseDeepLink("daisyclaw://send?message=hello");
        Assert.NotNull(result);
        Assert.Equal("send", result.Path);
        Assert.Equal("hello", result.Parameters["message"]);
    }

    [Fact]
    public void ParseDeepLink_SendWithEncodedMessage()
    {
        var result = DeepLinkParser.ParseDeepLink("daisyclaw://send?message=hello%20world");
        Assert.NotNull(result);
        Assert.Equal("hello world", result.Parameters["message"]);
    }

    [Fact]
    public void ParseDeepLink_MultipleQueryParams()
    {
        var result = DeepLinkParser.ParseDeepLink("daisyclaw://agent?message=hi&key=abc");
        Assert.NotNull(result);
        Assert.Equal("agent", result.Path);
        Assert.Equal("hi", result.Parameters["message"]);
        Assert.Equal("abc", result.Parameters["key"]);
    }

    [Fact]
    public void ParseDeepLink_ActivityWithFilter()
    {
        var result = DeepLinkParser.ParseDeepLink("daisyclaw://activity?filter=nodes");
        Assert.NotNull(result);
        Assert.Equal("activity", result.Path);
        Assert.Equal("nodes", result.Parameters["filter"]);
    }

    [Fact]
    public void ParseDeepLink_History()
    {
        var result = DeepLinkParser.ParseDeepLink("daisyclaw://history");
        Assert.NotNull(result);
        Assert.Equal("history", result.Path);
    }

    [Theory]
    [InlineData("daisyclaw://setup", "setup")]
    [InlineData("daisyclaw://healthcheck", "healthcheck")]
    [InlineData("daisyclaw://check-updates", "check-updates")]
    [InlineData("daisyclaw://logs", "logs")]
    [InlineData("daisyclaw://log-folder", "log-folder")]
    [InlineData("daisyclaw://config", "config")]
    [InlineData("daisyclaw://diagnostics", "diagnostics")]
    [InlineData("daisyclaw://support-context", "support-context")]
    [InlineData("daisyclaw://debug-bundle", "debug-bundle")]
    [InlineData("daisyclaw://browser-setup", "browser-setup")]
    [InlineData("daisyclaw://port-diagnostics", "port-diagnostics")]
    [InlineData("daisyclaw://capability-diagnostics", "capability-diagnostics")]
    [InlineData("daisyclaw://node-inventory", "node-inventory")]
    [InlineData("daisyclaw://channel-summary", "channel-summary")]
    [InlineData("daisyclaw://activity-summary", "activity-summary")]
    [InlineData("daisyclaw://extensibility-summary", "extensibility-summary")]
    [InlineData("daisyclaw://restart-ssh-tunnel", "restart-ssh-tunnel")]
    public void ParseDeepLink_TrayUtilityEntrypoints(string uri, string expectedPath)
    {
        var result = DeepLinkParser.ParseDeepLink(uri);
        Assert.NotNull(result);
        Assert.Equal(expectedPath, result.Path);
    }

    [Fact]
    public void ParseDeepLink_TrailingSlash_IsStripped()
    {
        var result = DeepLinkParser.ParseDeepLink("daisyclaw://settings/");
        Assert.NotNull(result);
        Assert.Equal("settings", result.Path);
    }

    [Theory]
    [InlineData("daisyclaw://send/?message=hello", "send")]
    [InlineData("daisyclaw://agent/?message=hi&key=abc", "agent")]
    [InlineData("daisyclaw://activity/?filter=nodes", "activity")]
    public void ParseDeepLink_TrailingSlashBeforeQuery_IsStripped(string uri, string expectedPath)
    {
        // Windows canonicalizes daisyclaw://send?... to daisyclaw://send/?...
        // before handing it to us. The slash sits before the `?`, so a naïve
        // TrimEnd before query split fails to strip it. Regression test for
        // the off-by-one fix in DeepLinkParser.ParseDeepLink.
        var result = DeepLinkParser.ParseDeepLink(uri);
        Assert.NotNull(result);
        Assert.Equal(expectedPath, result!.Path);
    }

    [Fact]
    public void ParseDeepLink_CaseInsensitiveScheme()
    {
        var result = DeepLinkParser.ParseDeepLink("DAISYCLAW://dashboard");
        Assert.NotNull(result);
        Assert.Equal("dashboard", result.Path);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void ParseDeepLink_NullOrEmpty_ReturnsNull(string? uri)
    {
        Assert.Null(DeepLinkParser.ParseDeepLink(uri));
    }

    [Fact]
    public void ParseDeepLink_NoProtocol_ReturnsNull()
    {
        Assert.Null(DeepLinkParser.ParseDeepLink("settings"));
    }

    [Fact]
    public void ParseDeepLink_WrongProtocol_ReturnsNull()
    {
        Assert.Null(DeepLinkParser.ParseDeepLink("https://settings"));
    }

    [Fact]
    public void ParseDeepLink_EmptyPath()
    {
        var result = DeepLinkParser.ParseDeepLink("daisyclaw://");
        Assert.NotNull(result);
        Assert.Equal("", result.Path);
    }

    [Fact]
    public void ParseDeepLink_MalformedQuery_IgnoresKeyOnly()
    {
        var result = DeepLinkParser.ParseDeepLink("daisyclaw://send?message");
        Assert.NotNull(result);
        Assert.Empty(result.Parameters);
    }

    #endregion

    #region GetQueryParam

    [Fact]
    public void GetQueryParam_ExtractsValue()
    {
        Assert.Equal("hello", DeepLinkParser.GetQueryParam("message=hello", "message"));
    }

    [Fact]
    public void GetQueryParam_CaseInsensitiveKey()
    {
        Assert.Equal("hello", DeepLinkParser.GetQueryParam("MESSAGE=hello", "message"));
    }

    [Fact]
    public void GetQueryParam_UrlDecodes()
    {
        Assert.Equal("hello world", DeepLinkParser.GetQueryParam("msg=hello%20world", "msg"));
    }

    [Fact]
    public void GetQueryParam_MissingKey_ReturnsNull()
    {
        Assert.Null(DeepLinkParser.GetQueryParam("message=hello", "missing"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void GetQueryParam_NullOrEmptyQuery_ReturnsNull(string? query)
    {
        Assert.Null(DeepLinkParser.GetQueryParam(query, "key"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void GetQueryParam_NullOrEmptyKey_ReturnsNull(string? key)
    {
        Assert.Null(DeepLinkParser.GetQueryParam("message=hello", key!));
    }

    [Fact]
    public void GetQueryParam_MultipleParams_FindsCorrect()
    {
        Assert.Equal("bar", DeepLinkParser.GetQueryParam("foo=baz&key=bar&x=1", "key"));
    }

    [Fact]
    public void GetQueryParam_ValueWithEquals()
    {
        Assert.Equal("a=b", DeepLinkParser.GetQueryParam("token=a=b", "token"));
    }

    #endregion

    #region DeepLinkHandler

    [Theory]
    [InlineData("daisyclaw://settings", "hub:settings")]
    [InlineData("daisyclaw://setup", "setup")]
    [InlineData("daisyclaw://chat", "hub:chat")]
    [InlineData("daisyclaw://commandcenter", "hub:connection")]
    [InlineData("daisyclaw://history", "hub:channels")]
    [InlineData("daisyclaw://logs", "log-file")]
    [InlineData("daisyclaw://log-folder", "log-folder")]
    [InlineData("daisyclaw://config", "config-folder")]
    [InlineData("daisyclaw://diagnostics", "diagnostics-folder")]
    [InlineData("daisyclaw://support-context", "copy:SupportContext")]
    [InlineData("daisyclaw://debug-bundle", "copy:DebugBundle")]
    [InlineData("daisyclaw://browser-setup", "copy:BrowserSetupGuidance")]
    [InlineData("daisyclaw://port-diagnostics", "copy:PortDiagnostics")]
    [InlineData("daisyclaw://capability-diagnostics", "copy:CapabilityDiagnostics")]
    [InlineData("daisyclaw://node-inventory", "copy:NodeInventory")]
    [InlineData("daisyclaw://channel-summary", "copy:ChannelSummary")]
    [InlineData("daisyclaw://activity-summary", "copy:ActivitySummary")]
    [InlineData("daisyclaw://extensibility-summary", "copy:ExtensibilitySummary")]
    [InlineData("daisyclaw://check-updates", "check-updates")]
    [InlineData("daisyclaw://restart-ssh-tunnel", "restart-ssh")]
    public void PlanRoute_ReturnsExpectedRoute(string uri, string expected)
    {
        var route = DeepLinkHandler.PlanRoute(uri, "daisyclaw");
        var actual = route switch
        {
            ActivationRoute.OpenHub r => $"hub:{r.Page}",
            ActivationRoute.OpenSetup => "setup",
            ActivationRoute.OpenLogFile => "log-file",
            ActivationRoute.OpenLogFolder => "log-folder",
            ActivationRoute.OpenConfigFolder => "config-folder",
            ActivationRoute.OpenDiagnosticsFolder => "diagnostics-folder",
            ActivationRoute.CopyDiagnostics r => $"copy:{r.Kind}",
            ActivationRoute.CheckForUpdates => "check-updates",
            ActivationRoute.RestartSshTunnel => "restart-ssh",
            _ => route?.GetType().Name,
        };

        Assert.Equal(expected, actual);
    }

    [Theory]
    [InlineData("daisyclaw://activity", "channels")]
    [InlineData("daisyclaw://activity?filter=usage", "usage")]
    [InlineData("daisyclaw://activity?filter=session", "sessions")]
    [InlineData("daisyclaw://activity?filter=node", "instances")]
    [InlineData("daisyclaw://history", "channels")]
    [InlineData("daisyclaw://notification-history", "channels")]
    [InlineData("daisyclaw://commandcenter", "connection")]
    [InlineData("daisyclaw://command-center", "connection")]
    public void PlanRoute_HubAliases_ReturnExpectedPage(string uri, string expectedHubTag)
    {
        var route = Assert.IsType<ActivationRoute.OpenHub>(
            DeepLinkHandler.PlanRoute(uri, "daisyclaw"));
        Assert.Equal(expectedHubTag, route.Page);
    }

    [Fact]
    public void PlanRoute_DashboardSubpath_PreservesPath()
    {
        var route = Assert.IsType<ActivationRoute.OpenDashboard>(
            DeepLinkHandler.PlanRoute("daisyclaw://dashboard/skills", "daisyclaw"));
        Assert.Equal("skills", route.Path);
    }

    [Fact]
    public void PlanRoute_Activity_RedirectsByFilter()
    {
        Assert.Equal("instances", PlanHubPage("daisyclaw://activity?filter=node"));
        Assert.Equal("sessions", PlanHubPage("daisyclaw://activity?filter=session"));
        Assert.Equal("channels", PlanHubPage("daisyclaw://activity"));
    }

    [Fact]
    public void PlanRoute_Agent_PreservesMessage()
    {
        var route = Assert.IsType<ActivationRoute.SendMessage>(
            DeepLinkHandler.PlanRoute("daisyclaw://agent?message=ping", "daisyclaw"));
        Assert.Equal("ping", route.Message);
    }

    [Fact]
    public void PlanRoute_HealthCheck_ReturnsHealthRoute()
    {
        Assert.IsType<ActivationRoute.RunHealthCheck>(
            DeepLinkHandler.PlanRoute("daisyclaw://healthcheck", "daisyclaw"));
    }

    private static string? PlanHubPage(string uri) =>
        Assert.IsType<ActivationRoute.OpenHub>(
            DeepLinkHandler.PlanRoute(uri, "daisyclaw")).Page;

    #endregion
}
