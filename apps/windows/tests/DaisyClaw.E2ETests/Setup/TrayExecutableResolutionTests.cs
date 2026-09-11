namespace DaisyClaw.E2ETests.Setup;

public sealed class TrayExecutableResolutionTests
{
    [Fact]
    public void ResolveTrayExecutable_UsesExistingOverrideBeforeSourceTreeLookup()
    {
        var directory = Path.Combine(Path.GetTempPath(), $"daisyclaw-e2e-tray-{Guid.NewGuid():N}");
        Directory.CreateDirectory(directory);
        var releasedTray = Path.Combine(directory, "DaisyClaw.Tray.WinUI.exe");
        File.WriteAllText(releasedTray, string.Empty);

        try
        {
            var resolved = E2ESetupFixture.ResolveTrayExecutable(
                releasedTray,
                Path.Combine(directory, "checkout-does-not-exist"));

            Assert.Equal(Path.GetFullPath(releasedTray), resolved);
        }
        finally
        {
            Directory.Delete(directory, recursive: true);
        }
    }

    [Theory]
    [InlineData("missing.exe")]
    [InlineData("not-an-executable.txt")]
    public void ResolveTrayExecutable_RejectsInvalidOverride(string fileName)
    {
        var directory = Path.Combine(Path.GetTempPath(), $"daisyclaw-e2e-tray-{Guid.NewGuid():N}");
        Directory.CreateDirectory(directory);
        var overridePath = Path.Combine(directory, fileName);
        if (fileName.EndsWith(".txt", StringComparison.Ordinal))
            File.WriteAllText(overridePath, string.Empty);

        try
        {
            var exception = Assert.Throws<FileNotFoundException>(() =>
                E2ESetupFixture.ResolveTrayExecutable(overridePath, directory));

            Assert.Contains("DAISYCLAW_E2E_TRAY_EXE", exception.Message, StringComparison.Ordinal);
        }
        finally
        {
            Directory.Delete(directory, recursive: true);
        }
    }
}
