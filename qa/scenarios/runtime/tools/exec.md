# Exec runtime tool fixture

```yaml qa-scenario
id: runtime-tool-exec
title: Runtime tool fixture — exec
surface: runtime-tools
runtimeParityTier: standard
coverage:
  primary:
    - tools.exec
objective: Verify command execution behavior is tracked across DaisyClaw and Codex while Codex owns exec/process natively.
successCriteria:
  - DaisyClaw may expose DaisyClaw exec while Codex app-server mode may omit duplicate DaisyClaw dynamic exec/process.
  - Mock provider exec plans are reported as fixture intent, not as actual runtime tool calls.
  - The row stays report-only until the fixture validates native Codex command behavior directly.
docsRefs:
  - qa/scenarios/index.md
codeRefs:
  - src/agents/bash-tools.schemas.ts
  - extensions/qa-lab/src/runtime-tool-fixture.ts
execution:
  kind: flow
  summary: Exercise the exec runtime tool family.
  config:
    toolName: exec
    toolCoverage:
      family: exec
      actualTool: exec
      bucket: codex-native-workspace
      expectedLayer: codex-native-workspace
      required: true
      tracking: "#80319"
      codexDefaultImpact: P4
      qaImpact: P1
      action: split native command behavior from DaisyClaw dynamic tool parity
      reason: Codex app-server intentionally owns command execution natively; the fixture must not require DaisyClaw dynamic exec exposure.
    knownHarnessGap:
      issue: "#80319"
      reason: QA tool-defaults currently needs native command behavior coverage instead of DaisyClaw dynamic exec exposure.
    promptSnippet: "target=exec"
    failurePromptSnippet: "failure target=exec"
```

```yaml qa-flow
steps:
  - name: exercises exec happy and failure paths
    actions:
      - call: runRuntimeToolFixture
        saveAs: result
        args:
          - ref: env
          - ref: config
    detailsExpr: result
```
