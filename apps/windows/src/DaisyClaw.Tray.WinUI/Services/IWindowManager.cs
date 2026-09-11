using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using DaisyClaw.Connection;
using DaisyClaw.Shared;
using DaisyClawTray.Windows;

namespace DaisyClawTray.Services;

internal interface IWindowManager
{
    Window? ActiveHubWindow { get; }
    bool IsHubOpen { get; }
    bool IsChatVisible { get; }
    /// <summary>True while the web dashboard window is open and visible.</summary>
    bool IsDashboardVisible { get; }

    /// <summary>Reloads an already-open dashboard window, if there is one.</summary>
    void ReloadDashboard();
    XamlRoot? DialogXamlRoot { get; }
    XamlRoot? RuntimeAnchorXamlRoot { get; }
    XamlRoot? SetupXamlRoot { get; }

    bool CanNavigateHubBack();
    void NavigateHubBack();
    void InitializeRuntimeAnchor();
    void BeginShutdown();
    void PrewarmChat(ChatWindowRequest request);
    void ShowChat(ChatWindowRequest request);
    void ResetChatForCredentialChange();
    void ShowDashboard(string url);
    void ShowCanvas(CanvasWindowRequest request);
    void ShowHub(string? navigateTo = null, bool activate = true);
    void ShowConnectionStatus();
    Task ShowOnboardingAsync();
    Task ShowGatewayWizardAsync();
    void CloseSetup();
    void ApplyThemeToOpenWindows();
    void UpdateHubTitleBarStatus(GatewayConnectionSnapshot snapshot, ConnectionStatus status);
    void RefreshHubDiagnosticsNavigationVisibility();
    void SetPendingChatSessionKey(string? sessionKey);
    void ShowHubChatAndStartVoice();
    IntPtr GetHubWindowHandle();
    IntPtr GetOnboardingWindowHandle();
    Task CloseForShutdownAsync();
}
