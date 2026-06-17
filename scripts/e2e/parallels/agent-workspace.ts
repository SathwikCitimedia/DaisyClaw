// Agent Workspace script supports DaisyClaw repository automation.
export function posixAgentWorkspaceScript(purpose: string): string {
  return `set -eu
workspace="\${DAISYCLAW_WORKSPACE_DIR:-$HOME/.daisyclaw/workspace}"
mkdir -p "$workspace/.daisyclaw"
cat > "$workspace/IDENTITY.md" <<'IDENTITY_EOF'
# Identity

- Name: DaisyClaw
- Purpose: ${purpose}
IDENTITY_EOF
cat > "$workspace/.daisyclaw/workspace-state.json" <<'STATE_EOF'
{
  "version": 1,
  "setupCompletedAt": "2026-01-01T00:00:00.000Z"
}
STATE_EOF
rm -f "$workspace/BOOTSTRAP.md"`;
}

export function windowsAgentWorkspaceScript(purpose: string): string {
  return `$workspace = $env:DAISYCLAW_WORKSPACE_DIR
if (-not $workspace) { $workspace = Join-Path $env:USERPROFILE '.daisyclaw\\workspace' }
$stateDir = Join-Path $workspace '.daisyclaw'
New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
@'
# Identity

- Name: DaisyClaw
- Purpose: ${purpose}
'@ | Set-Content -Path (Join-Path $workspace 'IDENTITY.md') -Encoding UTF8
@'
{
  "version": 1,
  "setupCompletedAt": "2026-01-01T00:00:00.000Z"
}
'@ | Set-Content -Path (Join-Path $stateDir 'workspace-state.json') -Encoding UTF8
Remove-Item (Join-Path $workspace 'BOOTSTRAP.md') -Force -ErrorAction SilentlyContinue`;
}
