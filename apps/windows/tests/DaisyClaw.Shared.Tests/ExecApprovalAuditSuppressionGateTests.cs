using Xunit;
using DaisyClaw.Shared.ExecApprovals;

namespace DaisyClaw.Shared.Tests;

public class ExecApprovalAuditSuppressionGateTests
{
    [Fact]
    public void SetSuppressions_RequiresApproval()
        => Assert.True(ExecApprovalAuditSuppressionGate.RequiresExtraApproval(
            new[] { "daisyclaw", "config", "set", "security.audit.suppressions", "x" },
            "daisyclaw config set security.audit.suppressions x"));

    [Fact]
    public void GetSuppressions_IsReadOnly_NoApproval()
        => Assert.False(ExecApprovalAuditSuppressionGate.RequiresExtraApproval(
            new[] { "daisyclaw", "config", "get", "security.audit.suppressions" },
            "daisyclaw config get security.audit.suppressions"));

    [Theory]
    [InlineData("schema")]
    [InlineData("validate")]
    public void InspectSuppressions_IsReadOnly_NoApproval(string verb)
        => Assert.False(ExecApprovalAuditSuppressionGate.RequiresExtraApproval(
            new[] { "daisyclaw", "config", verb, "security.audit.suppressions" },
            $"daisyclaw config {verb} security.audit.suppressions"));

    [Fact]
    public void PnpmDaisyclawGet_IsReadOnly_NoApproval()
        => Assert.False(ExecApprovalAuditSuppressionGate.RequiresExtraApproval(
            new[] { "pnpm", "daisyclaw", "config", "get", "security.audit.suppressions" },
            "pnpm daisyclaw config get security.audit.suppressions"));

    [Fact]
    public void UnrelatedCommand_NoApproval()
        => Assert.False(ExecApprovalAuditSuppressionGate.RequiresExtraApproval(
            new[] { "git", "status" }, "git status"));

    [Fact]
    public void ObfuscatedReference_RequiresApproval()
        => Assert.True(ExecApprovalAuditSuppressionGate.RequiresExtraApproval(
            new[] { "node", "-e", "cfg[\"security\"][\"audit\"][\"suppressions\"]=[]" },
            "node -e cfg[\"security\"][\"audit\"][\"suppressions\"]=[]"));

    [Fact]
    public void ShellWrappedSet_RequiresApproval()
        // Shell-wrapped reads are not exempted (over-requires approval, which is safe).
        => Assert.True(ExecApprovalAuditSuppressionGate.RequiresExtraApproval(
            new[] { "cmd", "/c", "daisyclaw config set security.audit.suppressions x" },
            "cmd /c daisyclaw config set security.audit.suppressions x"));

    [Fact]
    public void GlobalFlagBeforeConfig_StillReadOnly()
        => Assert.False(ExecApprovalAuditSuppressionGate.RequiresExtraApproval(
            new[] { "daisyclaw", "--no-color", "config", "get", "security.audit.suppressions" },
            "daisyclaw --no-color config get security.audit.suppressions"));

    [Fact]
    public void ValueGlobalOptionBeforeConfig_StillReadOnly()
        => Assert.False(ExecApprovalAuditSuppressionGate.RequiresExtraApproval(
            new[] { "daisyclaw", "--profile", "prod", "config", "get", "security.audit.suppressions" },
            "daisyclaw --profile prod config get security.audit.suppressions"));

    [Fact]
    public void CmdSuffixDaisyclaw_IsRecognizedAsReadOnly()
        => Assert.False(ExecApprovalAuditSuppressionGate.RequiresExtraApproval(
            new[] { "daisyclaw.cmd", "config", "get", "security.audit.suppressions" },
            "daisyclaw.cmd config get security.audit.suppressions"));

    [Fact]
    public void GlobalFlagBeforeSet_StillRequiresApproval()
        => Assert.True(ExecApprovalAuditSuppressionGate.RequiresExtraApproval(
            new[] { "daisyclaw", "--dev", "config", "set", "security.audit.suppressions", "x" },
            "daisyclaw --dev config set security.audit.suppressions x"));
}
