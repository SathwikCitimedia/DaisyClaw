// Telegram type declarations define plugin contracts.
import type { DaisyClawConfig, ReplyToMode } from "daisyclaw/plugin-sdk/config-contracts";
import type { RuntimeEnv } from "daisyclaw/plugin-sdk/runtime-env";
import type { TelegramBotDeps } from "./bot-deps.js";
import type { TelegramBotInfo } from "./bot-info.js";
import type { TelegramTransport } from "./fetch.js";

export type TelegramBotOptions = {
  token: string;
  accountId?: string;
  runtime?: RuntimeEnv;
  requireMention?: boolean;
  allowFrom?: Array<string | number>;
  groupAllowFrom?: Array<string | number>;
  mediaMaxMb?: number;
  replyToMode?: ReplyToMode;
  proxyFetch?: typeof fetch;
  config?: DaisyClawConfig;
  /** Bot identity returned by the startup getMe probe. Avoids a duplicate grammY init getMe before polling. */
  botInfo?: TelegramBotInfo;
  /** Signal to abort in-flight Telegram API fetch requests (e.g. getUpdates) on shutdown. */
  fetchAbortSignal?: AbortSignal;
  /** Minimum grammY client timeout when timeoutSeconds is configured on long-polling bots. */
  minimumClientTimeoutSeconds?: number;
  updateOffset?: {
    lastUpdateId?: number | null;
    persistenceFloorUpdateId?: number | null;
    onUpdateId?: (updateId: number) => void | Promise<void>;
  };
  testTimings?: {
    mediaGroupFlushMs?: number;
    textFragmentGapMs?: number;
  };
  /** Pre-resolved Telegram transport to reuse across bot instances. If not provided, creates a new one. */
  telegramTransport?: TelegramTransport;
  telegramDeps?: TelegramBotDeps;
};
