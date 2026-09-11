using DaisyClaw.Shared;
using DaisyClawTray.Services;
using Xunit;

namespace DaisyClaw.Tray.Tests.Services;

public sealed class ChatNotificationSpeechTextTests
{
    [Fact]
    public void Resolve_UsesFullMessageWhenPreviewWasTruncated()
    {
        var fullMessage = new string('x', 240);

        var resolved = ChatNotificationSpeechText.Resolve(new DaisyClawNotification
        {
            Message = fullMessage[..200] + "…",
            FullMessage = fullMessage
        });

        Assert.Equal(fullMessage, resolved);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void Resolve_FallsBackToPreviewWhenFullMessageIsUnavailable(string? fullMessage)
    {
        var resolved = ChatNotificationSpeechText.Resolve(new DaisyClawNotification
        {
            Message = "Preview",
            FullMessage = fullMessage
        });

        Assert.Equal("Preview", resolved);
    }
}
