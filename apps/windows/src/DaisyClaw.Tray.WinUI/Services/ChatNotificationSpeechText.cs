using DaisyClaw.Shared;

namespace DaisyClawTray.Services;

internal static class ChatNotificationSpeechText
{
    public static string Resolve(DaisyClawNotification notification)
    {
        ArgumentNullException.ThrowIfNull(notification);
        return string.IsNullOrEmpty(notification.FullMessage)
            ? notification.Message
            : notification.FullMessage;
    }
}
