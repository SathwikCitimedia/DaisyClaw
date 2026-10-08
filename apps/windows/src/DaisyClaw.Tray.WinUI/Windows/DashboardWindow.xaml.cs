using System.Diagnostics;
using DaisyClawTray.Helpers;
using Microsoft.UI.Xaml;
using Microsoft.Web.WebView2.Core;
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
    private bool _lastNavigationFailed;

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
            WebView.CoreWebView2.NavigationCompleted += OnNavigationCompleted;
            WebView.CoreWebView2.NewWindowRequested += OnNewWindowRequested;
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

    /// <summary>
    /// Links that leave Daisy (Google's console, a sign-in page, help pages)
    /// open in the user's own browser. Google refuses to sign anyone in inside
    /// an embedded window, and a stray popup window is easy to lose. Daisy's
    /// own pages and in-app previews (blob/data) keep the built-in behaviour.
    /// </summary>
    private void OnNewWindowRequested(
        CoreWebView2 sender,
        CoreWebView2NewWindowRequestedEventArgs args)
    {
        if (!Uri.TryCreate(args.Uri, UriKind.Absolute, out var target) ||
            (target.Scheme != Uri.UriSchemeHttp && target.Scheme != Uri.UriSchemeHttps))
        {
            return;
        }
        if (Uri.TryCreate(sender.Source, UriKind.Absolute, out var current) &&
            string.Equals(current.Host, target.Host, StringComparison.OrdinalIgnoreCase) &&
            current.Port == target.Port)
        {
            return;
        }
        args.Handled = true;
        try
        {
            Process.Start(new ProcessStartInfo(target.AbsoluteUri) { UseShellExecute = true });
        }
        catch
        {
            // No default browser registered: nothing better to offer than not opening.
        }
    }

    private void OnNavigationCompleted(
        CoreWebView2 sender,
        CoreWebView2NavigationCompletedEventArgs args)
    {
        _lastNavigationFailed = !args.IsSuccess;
        if (args.IsSuccess)
        {
            ShowDashboardContent();
            return;
        }

        // A failed load here almost always means the engine has not finished
        // starting. Say that in plain words and offer a retry, instead of the
        // browser's own "can't be reached" page which offers nothing.
        var connectionProblem = args.WebErrorStatus is
            CoreWebView2WebErrorStatus.CannotConnect or
            CoreWebView2WebErrorStatus.ConnectionAborted or
            CoreWebView2WebErrorStatus.ConnectionReset or
            CoreWebView2WebErrorStatus.Disconnected or
            CoreWebView2WebErrorStatus.HostNameNotResolved or
            CoreWebView2WebErrorStatus.ServerUnreachable or
            CoreWebView2WebErrorStatus.Timeout;
        ShowStatus(
            connectionProblem ? "Starting Daisy…" : "Daisy could not open",
            connectionProblem
                ? "Daisy's engine is still starting. This can take a minute the first time, and longer if security software is scanning it."
                : $"The dashboard did not load ({args.WebErrorStatus}).",
            busy: connectionProblem);
    }

    private void ShowDashboardContent()
    {
        StatusPanel.Visibility = Visibility.Collapsed;
        StatusRing.IsActive = false;
        WebView.Visibility = Visibility.Visible;
    }

    private void ShowStatus(string title, string message, bool busy)
    {
        StatusTitle.Text = title;
        StatusText.Text = message;
        StatusRing.IsActive = busy;
        StatusRing.Visibility = busy ? Visibility.Visible : Visibility.Collapsed;
        StatusPanel.Visibility = Visibility.Visible;
        WebView.Visibility = Visibility.Collapsed;
    }

    private void OnStatusRetryClick(object sender, RoutedEventArgs e)
    {
        Reload();
    }

    /// <summary>
    /// Re-navigates to the last dashboard URL. Used by the retry button and by
    /// the app once the engine reports ready, so a window that opened too early
    /// recovers by itself.
    /// </summary>
    public void Reload()
    {
        if (_lastUrl is not { } url)
        {
            return;
        }
        ShowStatus("Starting Daisy…", "Connecting to Daisy's engine…", busy: true);
        if (_webViewReady && WebView.CoreWebView2 is not null)
        {
            WebView.CoreWebView2.Navigate(url);
        }
        else
        {
            _pendingUrl = url;
        }
    }

    /// <summary>Navigates to the dashboard URL (re-navigating only when it
    /// changed, or when the last load failed) and brings the window to the
    /// foreground.</summary>
    public void NavigateAndShow(string url)
    {
        if (_webViewReady && WebView.CoreWebView2 is not null)
        {
            // Re-opening after a failed load must retry: otherwise clicking the
            // tray icon again just re-showed the same dead page.
            if (_lastNavigationFailed || !string.Equals(_lastUrl, url, StringComparison.Ordinal))
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
