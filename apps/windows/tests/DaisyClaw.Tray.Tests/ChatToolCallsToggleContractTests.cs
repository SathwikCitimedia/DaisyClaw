namespace DaisyClaw.Tray.Tests;

public sealed class ChatToolCallsToggleContractTests
{
    [Fact]
    public void ProductionTimeline_HonorsSettingsToolCallVisibilityToggle()
    {
        var root = Read("src", "DaisyClaw.Tray.WinUI", "Chat", "DaisyClawReactorChatRoot.cs");
        var timeline = Read("src", "DaisyClaw.Tray.WinUI", "Chat", "ReactorChatTimeline.cs");
        var renderer = Read("src", "DaisyClaw.Tray.WinUI", "Chat", "ToolCallCardRenderer.cs");
        var app = Read("src", "DaisyClaw.Tray.WinUI", "App.xaml.cs");
        var settingsVm = Read("src", "DaisyClaw.Tray.WinUI", "Presentation", "SettingsPageViewModel.cs");

        // Root still owns the shared tool-call visibility state and feeds it to
        // the timeline (independent of the composer).
        Assert.Contains("showToolCalls", root);
        Assert.Contains("toolCallsCollapseVersion", root);
        Assert.Contains("UseState(s_showToolCalls", root);
        Assert.Contains("UseState(s_toolCallsCollapseVersion", root);
        Assert.Contains("ToolCallsVisibilityChanged", root);

        // The single writer now lives on the root as a public static, invoked by
        // Settings and by startup seeding — no longer a composer callback.
        Assert.Contains("public static void SetToolCallsVisible(bool", root);
        Assert.Contains("s_showToolCalls = visible", root);
        Assert.DoesNotContain("OnShowToolCallsChanged", root);

        // Settings persists the preference and App applies every settings save to the
        // live timeline through the static writer.
        Assert.Contains("ShowChatToolCalls", settingsVm);
        Assert.Contains("DaisyClawTray.Chat.DaisyClawReactorChatRoot.SetToolCallsVisible", app);

        // Startup seeds visibility from the persisted setting.
        Assert.Contains("SetToolCallsVisible(_settings.ShowChatToolCalls)", app);

        // Timeline still consumes the props from the root.
        Assert.Contains("props.Timeline.ShowToolCalls", timeline);
        Assert.Contains("ToolCallsCollapseVersion", renderer);
        Assert.Contains("row.Props.Timeline.ShowToolCalls", timeline);
        Assert.Contains("row.IsAssistantRunEnd && row.Props.Timeline.ShowToolCalls", timeline);
        Assert.Contains("ChatToolActivityPresentation.Project(", timeline);
        Assert.Contains("props.Timeline.ShowToolCalls);", timeline);
        Assert.Contains("ChatToolActivityExpansionState", timeline);
    }

    [Fact]
    public void ProductionChatSurfaces_MountReactorRoot()
    {
        var page = Read("src", "DaisyClaw.Tray.WinUI", "Pages", "ChatPage.xaml.cs");
        var window = Read("src", "DaisyClaw.Tray.WinUI", "Windows", "ChatWindow.xaml.cs");
        var host = Read("src", "DaisyClaw.Tray.WinUI", "Chat", "ReactorChatHostExtensions.cs");

        Assert.Contains(".MountReactorChat(", page);
        Assert.Contains(".MountReactorChat(", window);
        Assert.Contains("var host = new ReactorHostControl();", host);
        Assert.Contains(
            "Component<DaisyClawReactorChatRoot, DaisyClawReactorChatRootProps>(props)",
            host);
        Assert.Contains("target.Child = host;", host);
    }

    private static string Read(params string[] parts)
        => File.ReadAllText(Path.Combine(new[] { TestRepositoryPaths.GetRepositoryRoot() }.Concat(parts).ToArray()));
}
