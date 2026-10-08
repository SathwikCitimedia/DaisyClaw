// Control UI view renders the keyboard shortcuts sheet and platform-aware key labels.
import { html, nothing } from "lit";
import { t } from "../../i18n/index.ts";
import "../components/modal-dialog.ts";

type NavigatorLike = {
  platform?: string;
  userAgent?: string;
  userAgentData?: { platform?: string };
};

/** True on macOS and iOS, where the command key (⌘) takes the place of Ctrl. */
export function isApplePlatform(nav: NavigatorLike | undefined = globalThis.navigator): boolean {
  if (!nav) {
    return false;
  }
  const platform = nav.userAgentData?.platform || nav.platform || nav.userAgent || "";
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** "⌘" on Apple platforms, "Ctrl" everywhere else. */
export function modifierKeyLabel(nav?: NavigatorLike): string {
  return isApplePlatform(nav) ? "⌘" : "Ctrl";
}

/** The label for the search shortcut: "⌘K" on a Mac, "Ctrl K" on Windows and Linux. */
export function paletteShortcutLabel(nav?: NavigatorLike): string {
  return isApplePlatform(nav) ? "⌘K" : "Ctrl K";
}

/** "mod" stands for the platform modifier key. */
type ShortcutKey = "mod" | string;

type ShortcutEntry = {
  id: string;
  keys: readonly ShortcutKey[];
  labelKey: string;
};

type ShortcutGroup = {
  id: string;
  titleKey: string;
  entries: readonly ShortcutEntry[];
};

export const KEYBOARD_SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
  {
    id: "anywhere",
    titleKey: "chat.shortcuts.groups.anywhere",
    entries: [
      { id: "search", keys: ["mod", "K"], labelKey: "chat.shortcuts.items.search" },
      { id: "shortcuts", keys: ["mod", "/"], labelKey: "chat.shortcuts.items.shortcuts" },
    ],
  },
  {
    id: "composer",
    titleKey: "chat.shortcuts.groups.composer",
    entries: [
      { id: "send", keys: ["Enter"], labelKey: "chat.shortcuts.items.send" },
      { id: "newline", keys: ["Shift", "Enter"], labelKey: "chat.shortcuts.items.newline" },
      { id: "history", keys: ["↑"], labelKey: "chat.shortcuts.items.history" },
      { id: "commands", keys: ["/"], labelKey: "chat.shortcuts.items.commands" },
      { id: "find", keys: ["mod", "F"], labelKey: "chat.shortcuts.items.find" },
    ],
  },
];

export function resolveShortcutKeys(keys: readonly ShortcutKey[], nav?: NavigatorLike): string[] {
  const modifier = modifierKeyLabel(nav);
  return keys.map((key) => (key === "mod" ? modifier : key));
}

/** Ctrl+/ (⌘/ on a Mac) opens the sheet. */
export function isKeyboardShortcutsHotkey(event: KeyboardEvent): boolean {
  return (event.metaKey || event.ctrlKey) && !event.altKey && event.key === "/";
}

export type KeyboardShortcutsDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function renderKeyboardShortcutsDialog(props: KeyboardShortcutsDialogProps) {
  if (!props.open) {
    return nothing;
  }
  const title = t("chat.shortcuts.title");
  return html`
    <daisyclaw-modal-dialog label=${title} @modal-cancel=${() => props.onClose()}>
      <div class="exec-approval-card shortcuts-sheet">
        <div class="exec-approval-header">
          <div class="exec-approval-title">${title}</div>
          <button
            type="button"
            class="btn btn--ghost btn--sm"
            aria-label=${t("chat.shortcuts.close")}
            @click=${() => props.onClose()}
          >
            ${t("chat.shortcuts.close")}
          </button>
        </div>
        ${KEYBOARD_SHORTCUT_GROUPS.map(
          (group) => html`
            <section class="shortcuts-sheet__group" aria-label=${t(group.titleKey)}>
              <div class="shortcuts-sheet__group-title">${t(group.titleKey)}</div>
              <dl class="shortcuts-sheet__list">
                ${group.entries.map(
                  (entry) => html`
                    <div class="shortcuts-sheet__row" data-shortcut=${entry.id}>
                      <dt class="shortcuts-sheet__label">${t(entry.labelKey)}</dt>
                      <dd class="shortcuts-sheet__keys">
                        ${resolveShortcutKeys(entry.keys).map((key) => html`<kbd>${key}</kbd>`)}
                      </dd>
                    </div>
                  `,
                )}
              </dl>
            </section>
          `,
        )}
      </div>
    </daisyclaw-modal-dialog>
  `;
}
