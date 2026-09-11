using DaisyClaw.Shared;
using DaisyClawTray.Services;

namespace DaisyClawTray;

internal sealed class AppLogger : IDaisyClawLogger
{
    public void Info(string message) => Logger.Info(message);
    public void Debug(string message) => Logger.Debug(message);
    public void Warn(string message) => Logger.Warn(message);
    public void Error(string message, Exception? ex = null) =>
        Logger.Error(ex != null ? $"{message}: {ex}" : message);
    public void Trace(string message) => Logger.Trace(message);
}
