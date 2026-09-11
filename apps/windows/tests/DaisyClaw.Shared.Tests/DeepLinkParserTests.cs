using System.Collections.Generic;
using DaisyClaw.Shared;
using Xunit;

namespace DaisyClaw.Shared.Tests;

public class DeepLinkParserTests
{
    // ─── ParseDeepLink ────────────────────────────────────────────────────────

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void ParseDeepLink_ReturnsNull_ForNullOrWhitespace(string? uri)
    {
        Assert.Null(DeepLinkParser.ParseDeepLink(uri));
    }

    [Theory]
    [InlineData("https://example.com/send")]
    [InlineData("opencla://send")]
    [InlineData("DAISYCLAW//send")]
    public void ParseDeepLink_ReturnsNull_ForNonDaisyClawScheme(string uri)
    {
        Assert.Null(DeepLinkParser.ParseDeepLink(uri));
    }

    [Theory]
    [InlineData("daisyclaw://send", "send")]
    [InlineData("DAISYCLAW://send", "send")]
    [InlineData("daisyclaw://send/", "send")]
    [InlineData("daisyclaw://send/?text=hello", "send")]
    [InlineData("daisyclaw://send?text=hello", "send")]
    [InlineData("daisyclaw://pair/setup", "pair/setup")]
    [InlineData("daisyclaw://", "")]
    public void ParseDeepLink_ExtractsPath(string uri, string expectedPath)
    {
        var result = DeepLinkParser.ParseDeepLink(uri);

        Assert.NotNull(result);
        Assert.Equal(expectedPath, result.Path);
    }

    [Fact]
    public void ParseDeepLink_ExtractsQueryString()
    {
        var result = DeepLinkParser.ParseDeepLink("daisyclaw://send?text=hello&target=channel");

        Assert.NotNull(result);
        Assert.Equal("text=hello&target=channel", result.Query);
    }

    [Fact]
    public void ParseDeepLink_ParsesSingleParameter()
    {
        var result = DeepLinkParser.ParseDeepLink("daisyclaw://send?text=hello");

        Assert.NotNull(result);
        Assert.Equal("hello", result.Parameters["text"]);
    }

    [Fact]
    public void ParseDeepLink_ParsesMultipleParameters()
    {
        var result = DeepLinkParser.ParseDeepLink("daisyclaw://send?text=hello&target=channel&urgent=true");

        Assert.NotNull(result);
        Assert.Equal("hello", result.Parameters["text"]);
        Assert.Equal("channel", result.Parameters["target"]);
        Assert.Equal("true", result.Parameters["urgent"]);
    }

    [Fact]
    public void ParseDeepLink_ParameterLookupIsCaseInsensitive()
    {
        var result = DeepLinkParser.ParseDeepLink("daisyclaw://send?Text=hello");

        Assert.NotNull(result);
        Assert.Equal("hello", result.Parameters["text"]);
        Assert.Equal("hello", result.Parameters["TEXT"]);
    }

    [Fact]
    public void ParseDeepLink_DecodesUrlEncodedParameters()
    {
        var result = DeepLinkParser.ParseDeepLink("daisyclaw://send?text=hello%20world&key=a%2Bb");

        Assert.NotNull(result);
        Assert.Equal("hello world", result.Parameters["text"]);
        Assert.Equal("a+b", result.Parameters["key"]);
    }

    [Fact]
    public void ParseDeepLink_ReturnsEmptyParameters_WhenNoQuery()
    {
        var result = DeepLinkParser.ParseDeepLink("daisyclaw://send");

        Assert.NotNull(result);
        Assert.Empty(result.Parameters);
        Assert.Equal(string.Empty, result.Query);
    }

    [Fact]
    public void ParseDeepLink_HandlesWindowsCanonicalizedForm_SlashBeforeQuery()
    {
        // Windows may canonicalize daisyclaw://send/?args=... — path should be "send", not "send/"
        var result = DeepLinkParser.ParseDeepLink("daisyclaw://send/?text=hello");

        Assert.NotNull(result);
        Assert.Equal("send", result.Path);
        Assert.Equal("hello", result.Parameters["text"]);
    }

    [Fact]
    public void ParseDeepLink_CustomScheme_IsStrictlyIsolated()
    {
        var result = DeepLinkParser.ParseDeepLink("daisyclaw-dev://settings", "daisyclaw-dev");

        Assert.NotNull(result);
        Assert.Equal("settings", result.Path);
        Assert.Null(DeepLinkParser.ParseDeepLink("daisyclaw://settings", "daisyclaw-dev"));
        Assert.Null(DeepLinkParser.ParseDeepLink("daisyclaw-dev://settings"));
    }

    // ─── GetQueryParam ────────────────────────────────────────────────────────

    [Theory]
    [InlineData(null, "key")]
    [InlineData("", "key")]
    public void GetQueryParam_ReturnsNull_ForNullOrEmptyQuery(string? query, string key)
    {
        Assert.Null(DeepLinkParser.GetQueryParam(query, key));
    }

    [Theory]
    [InlineData("text=hello", "")]
    public void GetQueryParam_ReturnsNull_ForEmptyKey(string query, string key)
    {
        Assert.Null(DeepLinkParser.GetQueryParam(query, key));
    }

    [Fact]
    public void GetQueryParam_ReturnsValue_ForMatchingKey()
    {
        Assert.Equal("hello", DeepLinkParser.GetQueryParam("text=hello&target=chan", "text"));
    }

    [Fact]
    public void GetQueryParam_LookupIsCaseInsensitive()
    {
        Assert.Equal("hello", DeepLinkParser.GetQueryParam("Text=hello", "text"));
        Assert.Equal("hello", DeepLinkParser.GetQueryParam("text=hello", "TEXT"));
    }

    [Fact]
    public void GetQueryParam_DecodesUrlEncodedValue()
    {
        Assert.Equal("hello world", DeepLinkParser.GetQueryParam("text=hello%20world", "text"));
    }

    [Fact]
    public void GetQueryParam_ReturnsNull_ForMissingKey()
    {
        Assert.Null(DeepLinkParser.GetQueryParam("text=hello", "missing"));
    }
}
