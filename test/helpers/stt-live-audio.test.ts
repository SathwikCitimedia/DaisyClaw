// STT live audio tests validate live speech-to-text audio fixtures.
import {
  expectDaisyClawLiveTranscriptMarker,
  normalizeTranscriptForMatch,
  DAISYCLAW_LIVE_TRANSCRIPT_MARKER_RE,
} from "daisyclaw/plugin-sdk/provider-test-contracts";
import { describe, expect, it } from "vitest";

describe("normalizeTranscriptForMatch", () => {
  it("normalizes punctuation and common DaisyClaw live transcription variants", () => {
    expect(normalizeTranscriptForMatch("Open-Claw integration OK")).toBe("daisyclawintegrationok");
    expect(normalizeTranscriptForMatch("Testing OpenFlaw realtime transcription")).toMatch(
      /open(?:claw|flaw)/,
    );
    expect(normalizeTranscriptForMatch("OpenCore xAI realtime transcription")).toMatch(
      DAISYCLAW_LIVE_TRANSCRIPT_MARKER_RE,
    );
    expect(normalizeTranscriptForMatch("OpenCL xAI realtime transcription")).toMatch(
      DAISYCLAW_LIVE_TRANSCRIPT_MARKER_RE,
    );
    expectDaisyClawLiveTranscriptMarker("OpenClar integration OK");
  });
});
