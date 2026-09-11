using DaisyClaw.Connection;
using DaisyClaw.Shared;

namespace DaisyClawTray.Services;

internal interface ITrayController : IDisposable
{
    void Initialize();
    void BeginShutdown();
    void ShowMenu();
    void RefreshIcon();
    void ApplyConnectionState(ConnectionStatus status, OverallConnectionState? overallState);
    void HideMenu();
    void ApplyTheme();
    void CloseMenuForShutdown();
}
