// Control UI chat module implements chat welcome behavior.
import { html } from "lit";
import { t } from "../../i18n/index.ts";
import type { SkillStatusEntry } from "../types.ts";
import { normalizeLocalUserIdentity } from "../user-identity.ts";
import { resolveChatAvatarRenderUrl, resolveAssistantTextAvatar } from "../views/agents-utils.ts";
import { buildWelcomeSuggestions } from "./welcome-suggestions.ts";

export type ChatWelcomeProps = {
  assistantName: string;
  assistantAvatar: string | null;
  assistantAvatarUrl?: string | null;
  basePath?: string;
  onDraftChange: (next: string) => void;
  onSend: () => void;
  /** Skills this install has, so the chips only suggest what Daisy can do. */
  skills?: readonly SkillStatusEntry[];
  /** Rotates the suggestions so a returning user sees different ideas. */
  suggestionSeed?: number;
};

function resolveAssistantAvatarUrl(
  props: Pick<ChatWelcomeProps, "assistantAvatar" | "assistantAvatarUrl">,
): string | null {
  return resolveChatAvatarRenderUrl(props.assistantAvatarUrl, {
    identity: {
      avatar: props.assistantAvatar ?? undefined,
      avatarUrl: props.assistantAvatarUrl ?? undefined,
    },
  });
}

export function resolveAssistantDisplayAvatar(
  props: Pick<ChatWelcomeProps, "assistantAvatar" | "assistantAvatarUrl">,
): string | null {
  return resolveAssistantAvatarUrl(props) ?? resolveAssistantTextAvatar(props.assistantAvatar);
}

/**
 * The greeting an empty chat opens with: "How can I help, Bunty?" when the
 * user has told Daisy their name, a plain "How can I help?" when not. It sits
 * just above the message box, which waits in the middle of the screen until
 * the first message is sent.
 */
export function renderWelcomeGreeting(props: { userName?: string | null }) {
  const name = normalizeLocalUserIdentity({ name: props.userName ?? null }).name;
  return html`
    <div class="agent-chat__welcome agent-chat__welcome--greeting">
      <h2 class="agent-chat__greeting">
        ${name ? t("chat.welcome.greetingNamed", { name }) : t("chat.welcome.greeting")}
      </h2>
    </div>
  `;
}

/** Ideas to start from, under the message box of an empty chat. */
export function renderWelcomeSuggestions(props: ChatWelcomeProps) {
  return html`
    <div class="agent-chat__suggestions agent-chat__suggestions--welcome">
      ${buildWelcomeSuggestions({
        skills: props.skills,
        seed: props.suggestionSeed,
      }).map(
        (text) => html`
          <button
            type="button"
            class="agent-chat__suggestion"
            @click=${() => {
              props.onDraftChange(text);
              props.onSend();
            }}
          >
            ${text}
          </button>
        `,
      )}
    </div>
  `;
}
