import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserVoiceSession, isBrowserVoiceSupported } from "./browser-voice.ts";

type ResultEntry = { transcript: string; isFinal: boolean };

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 0;
  started = false;
  aborted = false;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;

  constructor() {
    FakeRecognition.instances.push(this);
  }

  start(): void {
    this.started = true;
  }

  stop(): void {}

  abort(): void {
    this.aborted = true;
  }

  // Test helper: deliver recognition results as the browser would.
  emit(results: ResultEntry[]): void {
    this.onresult?.({
      resultIndex: 0,
      results: Object.assign(
        results.map((r) => ({ 0: { transcript: r.transcript }, isFinal: r.isFinal, length: 1 })),
        { length: results.length },
      ),
    });
  }
}

class FakeUtterance {
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
}

function installSpeech(withSynthesis = true): { spoken: string[] } {
  const spoken: string[] = [];
  vi.stubGlobal("SpeechRecognition", FakeRecognition);
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  if (withSynthesis) {
    vi.stubGlobal("speechSynthesis", {
      cancel: () => undefined,
      // Speak synchronously resolves the utterance so the session resumes.
      speak: (u: FakeUtterance) => {
        spoken.push(u.text);
        u.onend?.();
      },
    });
  }
  return { spoken };
}

afterEach(() => {
  FakeRecognition.instances = [];
  vi.unstubAllGlobals();
});

describe("browser voice support detection", () => {
  it("reports unsupported when no recognition constructor exists", () => {
    vi.stubGlobal("SpeechRecognition", undefined);
    vi.stubGlobal("webkitSpeechRecognition", undefined);
    expect(isBrowserVoiceSupported()).toBe(false);
  });

  it("reports supported when a recognition constructor exists", () => {
    vi.stubGlobal("SpeechRecognition", FakeRecognition);
    expect(isBrowserVoiceSupported()).toBe(true);
  });
});

describe("BrowserVoiceSession", () => {
  it("throws a friendly error when speech recognition is unavailable", async () => {
    vi.stubGlobal("SpeechRecognition", undefined);
    vi.stubGlobal("webkitSpeechRecognition", undefined);
    const session = new BrowserVoiceSession({ onUserUtterance: () => undefined });
    await expect(session.start()).rejects.toThrow(/not supported/i);
  });

  it("sends a finalized utterance and speaks the reply, then resumes listening", async () => {
    const { spoken } = installSpeech();
    const statuses: string[] = [];
    const utterances: string[] = [];
    const session = new BrowserVoiceSession({
      onStatus: (status) => statuses.push(status),
      onUserUtterance: (text) => utterances.push(text),
    });
    await session.start();
    expect(statuses.at(-1)).toBe("listening");

    const first = FakeRecognition.instances.at(-1)!;
    expect(first.started).toBe(true);
    first.emit([{ transcript: "hello there", isFinal: true }]);
    first.onend?.();

    expect(utterances).toEqual(["hello there"]);
    expect(statuses).toContain("thinking");

    const listeningCountBefore = FakeRecognition.instances.length;
    session.speakReply("hi, how can I help?");
    expect(spoken).toEqual(["hi, how can I help?"]);
    // Resumed listening -> a fresh recognition instance and a listening status.
    expect(FakeRecognition.instances.length).toBe(listeningCountBefore + 1);
    expect(statuses.at(-1)).toBe("listening");
  });

  it("ignores speakReply when no utterance is awaiting a reply", async () => {
    const { spoken } = installSpeech();
    const session = new BrowserVoiceSession({ onUserUtterance: () => undefined });
    await session.start();
    session.speakReply("unsolicited");
    expect(spoken).toEqual([]);
  });

  it("resumes listening when the reply fails", async () => {
    installSpeech();
    const statuses: string[] = [];
    const session = new BrowserVoiceSession({
      onStatus: (status) => statuses.push(status),
      onUserUtterance: () => undefined,
    });
    await session.start();
    const rec = FakeRecognition.instances.at(-1)!;
    rec.emit([{ transcript: "do a thing", isFinal: true }]);
    rec.onend?.();
    expect(statuses).toContain("thinking");

    const before = FakeRecognition.instances.length;
    session.replyFailed();
    expect(FakeRecognition.instances.length).toBe(before + 1);
    expect(statuses.at(-1)).toBe("listening");
  });

  it("surfaces a terminal error when microphone access is blocked", async () => {
    installSpeech();
    const statuses: Array<{ status: string; detail?: string }> = [];
    const session = new BrowserVoiceSession({
      onStatus: (status, detail) => statuses.push({ status, detail }),
      onUserUtterance: () => undefined,
    });
    await session.start();
    const rec = FakeRecognition.instances.at(-1)!;
    rec.onerror?.({ error: "not-allowed" });
    expect(statuses.at(-1)?.status).toBe("error");
    expect(statuses.at(-1)?.detail).toMatch(/mic/i);
  });
});
