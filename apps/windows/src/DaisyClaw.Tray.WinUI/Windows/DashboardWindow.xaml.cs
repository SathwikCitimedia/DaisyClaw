using DaisyClawTray.Helpers;
using WinUIEx;

namespace DaisyClawTray.Windows;

/// <summary>
/// Hosts the DaisyClaw web dashboard — the product's main surface, including
/// the first-run onboarding wizard that lives in the web UI. Authentication
/// travels in the dashboard URL's fragment token, so no header injection or
/// pairing ceremony is involved here.
/// </summary>
public sealed partial class DashboardWindow : WindowEx
{
    public bool IsClosed { get; private set; }

    private bool _webViewReady;
    private string? _pendingUrl;
    private string? _lastUrl;

    public DashboardWindow()
    {
        InitializeComponent();
        Title = AppIdentity.DecorateWindowTitle("Daisy");
        this.SetIcon("Assets\\daisyclaw.ico");
        this.CenterOnScreen();
        Closed += (_, _) => IsClosed = true;
        _ = InitializeWebViewAsync();
    }

    private async Task InitializeWebViewAsync()
    {
        try
        {
            await GatewayChatHelper.InitializeWebView2Async(WebView);
            _webViewReady = true;
            if (_pendingUrl is { } url)
            {
                _pendingUrl = null;
                WebView.CoreWebView2.Navigate(url);
            }
        }
        catch
        {
            // WebView2 runtime unavailable: the window stays blank; callers can
            // still fall back to the system browser.
        }
    }

    /// <summary>Navigates to the dashboard URL (re-navigating only when it
    /// changed) and brings the window to the foreground.</summary>
    public void NavigateAndShow(string url)
    {
        if (_webViewReady && WebView.CoreWebView2 is not null)
        {
            if (!string.Equals(_lastUrl, url, StringComparison.Ordinal))
            {
                WebView.CoreWebView2.Navigate(url);
                _lastUrl = url;
            }
        }
        else
        {
            _pendingUrl = url;
            _lastUrl = url;
        }

        this.Show();
        Activate();
    }

    public void ForceClose()
    {
        IsClosed = true;
        Close();
    }
}
