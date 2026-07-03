// Control UI chat module implements browser-native voice input/output.
//
// Unlike the realtime Talk transports (which require a cloud realtime voice
// provider such as OpenAI Realtime or Gemini Live), this mode uses the
// browser's built-in Web Speech APIs: SpeechRecognition for microphone
// transcription and speechSynthesis for spoken replies. It needs no API key
// and works on any local machine running a Chromium-based browser, so the mic
// button is usable even when no realtime voice provider is configured.
//
// Speech in is routed through the normal chat send pipeline (the host wires
// onUserUtterance to its send handler); the finalized assistant reply is fed
// back via speakReply() so voice and typed chat share one conversation.
import type { RealtimeTalkStatus } from "./realtime-talk-shared.ts";

export type BrowserVoiceCallbacks = {
  onStatus?: (status: RealtimeTalkStatus, detail?: string) => void;
  onTranscript?: (entry: { role: "user" | "assistant"; text: string; final: boolean }) => void;
  // Fired with a finalized user utterance; the host sends it through chat.
  onUserUtterance: (text: string) => void;
};

// Minimal shape of the Web Speech recognition API. The DOM lib does not ship
// these types, and only the members used here are declared.
type SpeechRecognitionAlternativeLike = { transcript: string };
type SpeechRecognitionResultLike = {
  0: SpeechRecognitionAlternativeLike;
  isFinal: boolean;
  length: number;
};
type SpeechRecognitionResultListLike = {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
};
type SpeechRecognitionErrorEventLike = { error: string };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

type SpeechCapableWindow = Window & {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
};

function resolveSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") {
    return null;
  }
  const speechWindow = window as SpeechCapableWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function isBrowserVoiceSupported(): boolean {
  return resolveSpeechRecognitionCtor() !== null;
}

// Resume listening if the reply never arrives (send failed silently, agent
// stalled). Keeps the session from getting stuck in "thinking" forever.
const REPLY_WATCHDOG_MS = 90_000;

export class BrowserVoiceSession {
  private recognition: SpeechRecognitionLike | null = null;
  private closed = false;
  // "thinking" once an utterance is sent, until the reply is spoken; blocks the
  // recognition auto-restart so we do not capture the assistant's own speech.
  private awaitingReply = false;
  private speaking = false;
  private finalTranscript = "";
  private replyWatchdog: ReturnType<typeof setTimeout> | number | null = null;

  constructor(private readonly callbacks: BrowserVoiceCallbacks) {}

  async start(): Promise<void> {
    const Ctor = resolveSpeechRecognitionCtor();
    if (!Ctor) {
      throw new Error("Voice input is not supported in this browser. Try Chrome or Edge.");
    }
    this.closed = false;
    this.beginListening(Ctor);
  }

  stop(): void {
    this.closed = true;
    this.clearWatchdog();
    this.awaitingReply = false;
    this.speaking = false;
    this.teardownRecognition();
    this.cancelSpeech();
    this.callbacks.onStatus?.("idle");
  }

  // Called by the host when the assistant reply for the spoken turn finalizes.
  speakReply(text: string): void {
    if (this.closed || !this.awaitingReply) {
      return;
    }
    this.clearWatchdog();
    this.awaitingReply = false;
    const trimmed = text.trim();
    if (trimmed) {
      this.callbacks.onTranscript?.({ role: "assistant", text: trimmed, final: true });
    }
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!trimmed || !synth) {
      this.resumeListening();
      return;
    }
    this.speaking = true;
    const utterance = new SpeechSynthesisUtterance(trimmed);
    const done = () => {
      this.speaking = false;
      this.resumeListening();
    };
    utterance.onend = done;
    utterance.onerror = done;
    synth.cancel();
    synth.speak(utterance);
  }

  // Called by the host when the spoken turn ends without a spoken reply
  // (aborted, errored, or a silent NO_REPLY). Returns to listening.
  replyFailed(detail?: string): void {
    if (this.closed || !this.awaitingReply) {
      return;
    }
    this.clearWatchdog();
    this.awaitingReply = false;
    if (detail) {
      this.callbacks.onStatus?.("listening", detail);
    }
    this.resumeListening();
  }

  private beginListening(Ctor: SpeechRecognitionCtor): void {
    if (this.closed) {
      return;
    }
    this.finalTranscript = "";
    const recognition = new Ctor();
    recognition.lang = (typeof navigator !== "undefined" && navigator.language) || "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => this.handleResult(event);
    recognition.onerror = (event) => this.handleError(event);
    recognition.onend = () => this.handleEnd(Ctor);
    this.recognition = recognition;
    try {
      recognition.start();
      this.callbacks.onStatus?.("listening");
    } catch {
      // start() throws if called while already started; ignore and stay live.
    }
  }

  private handleResult(event: SpeechRecognitionEventLike): void {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const text = result[0]?.transcript ?? "";
      if (result.isFinal) {
        this.finalTranscript = `${this.finalTranscript} ${text}`.trim();
      } else {
        interim = `${interim} ${text}`.trim();
      }
    }
    const preview = this.finalTranscript || interim;
    if (preview) {
      this.callbacks.onTranscript?.({ role: "user", text: preview, final: false });
    }
  }

  private handleError(event: SpeechRecognitionErrorEventLike): void {
    if (this.closed) {
      return;
    }
    // Permission/hardware failures are terminal; transient ones fall through to
    // onend, which restarts listening.
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      this.closed = true;
      this.teardownRecognition();
      this.callbacks.onStatus?.("error", "Microphone access was blocked. Allow the mic and retry.");
      return;
    }
    if (event.error === "audio-capture") {
      this.closed = true;
      this.teardownRecognition();
      this.callbacks.onStatus?.("error", "No microphone was found.");
    }
  }

  private handleEnd(Ctor: SpeechRecognitionCtor): void {
    if (this.closed || this.awaitingReply || this.speaking) {
      return;
    }
    const utterance = this.finalTranscript.trim();
    if (!utterance) {
      // Silence timeout: keep listening.
      this.beginListening(Ctor);
      return;
    }
    this.finalTranscript = "";
    this.callbacks.onTranscript?.({ role: "user", text: utterance, final: true });
    this.awaitingReply = true;
    this.callbacks.onStatus?.("thinking");
    this.armWatchdog();
    this.callbacks.onUserUtterance(utterance);
  }

  private resumeListening(): void {
    const Ctor = resolveSpeechRecognitionCtor();
    if (this.closed || !Ctor) {
      return;
    }
    this.beginListening(Ctor);
  }

  private armWatchdog(): void {
    this.clearWatchdog();
    this.replyWatchdog = setTimeout(() => {
      this.replyWatchdog = null;
      this.replyFailed();
    }, REPLY_WATCHDOG_MS);
  }

  private clearWatchdog(): void {
    if (this.replyWatchdog !== null) {
      clearTimeout(this.replyWatchdog as ReturnType<typeof setTimeout>);
      this.replyWatchdog = null;
    }
  }

  private teardownRecognition(): void {
    const recognition = this.recognition;
    if (!recognition) {
      return;
    }
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try {
      recognition.abort();
    } catch {
      // abort() can throw if never started; safe to ignore.
    }
    this.recognition = null;
  }

  private cancelSpeech(): void {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
}
