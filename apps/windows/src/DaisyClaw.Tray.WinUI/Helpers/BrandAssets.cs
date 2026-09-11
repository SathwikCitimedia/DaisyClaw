using Microsoft.UI.Xaml.Media.Imaging;

namespace DaisyClawTray.Helpers;

public static class BrandAssets
{
    public const string RedBotMarkUri = "ms-appx:///Assets/Square44x44Logo.targetsize-256_altform-unplated.png";

    public static BitmapImage CreateRedBotMarkSource() => new(new Uri(RedBotMarkUri));
}
