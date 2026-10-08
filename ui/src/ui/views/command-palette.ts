// Control UI view renders command palette screen content.
import { html, nothing } from "lit";
import { ref } from "lit/directives/ref.js";
import { t } from "../../i18n/index.ts";
import { SLASH_COMMANDS } from "../chat/slash-commands.ts";
import { icons, type IconName } from "../icons.ts";
import { normalizeLowercaseStringOrEmpty } from "../string-coerce.ts";

type PaletteItem = {
  id: string;
  label: string;
  icon: IconName;
  category: "search" | "navigation" | "skills" | "actions" | "chats";
  action: string;
  description?: string;
};

function buildSlashPaletteItems(): PaletteItem[] {
  return SLASH_COMMANDS.map((command) => ({
    id: `slash:${command.name}`,
    label: `/${command.name}`,
    icon: command.icon ?? "terminal",
    category: "search",
    action: `/${command.name}`,
    description: command.description,
  }));
}

function getPaletteActionItems(): PaletteItem[] {
  return [
    {
      id: "action-shortcuts",
      label: t("overview.palette.items.keyboardShortcuts"),
      icon: "keyboard",
      category: "actions",
      action: "action:shortcuts",
    },
    {
      id: "action-export-chat",
      label: t("overview.palette.items.exportChat"),
      icon: "download",
      category: "actions",
      action: "action:export-chat",
      description: t("overview.palette.descriptions.exportChat"),
    },
  ];
}

function getPaletteBaseItems(): PaletteItem[] {
  return [
    {
      id: "nav-overview",
      label: t("overview.palette.items.overview"),
      icon: "barChart",
      category: "navigation",
      action: "nav:overview",
    },
    {
      id: "nav-sessions",
      label: t("overview.palette.items.sessions"),
      icon: "fileText",
      category: "navigation",
      action: "nav:sessions",
    },
    {
      id: "nav-cron",
      label: t("overview.palette.items.scheduled"),
      icon: "scrollText",
      category: "navigation",
      action: "nav:cron",
    },
    {
      id: "nav-skills",
      label: t("overview.palette.items.skills"),
      icon: "zap",
      category: "navigation",
      action: "nav:skills",
    },
    {
      id: "nav-config",
      label: t("overview.palette.items.settings"),
      icon: "settings",
      category: "navigation",
      action: "nav:config",
    },
    {
      id: "nav-agents",
      label: t("overview.palette.items.agents"),
      icon: "folder",
      category: "navigation",
      action: "nav:agents",
    },
    {
      id: "skill-shell",
      label: t("overview.palette.items.shellCommand"),
      icon: "monitor",
      category: "skills",
      action: "/skill shell",
      description: t("overview.palette.descriptions.shellCommand"),
    },
    {
      id: "skill-debug",
      label: t("overview.palette.items.debugMode"),
      icon: "bug",
      category: "skills",
      action: "/verbose full",
      description: t("overview.palette.descriptions.debugMode"),
    },
  ];
}

function getPaletteItemsInternal(): PaletteItem[] {
  return [...getPaletteActionItems(), ...buildSlashPaletteItems(), ...getPaletteBaseItems()];
}

export function getPaletteItems(): readonly PaletteItem[] {
  return getPaletteItemsInternal();
}

/** A message found by searching the user's chats, already labelled for display. */
export type PaletteChatResult = {
  label: string;
  description: string;
};

export type PaletteChatSearchView = {
  status: "idle" | "loading" | "done" | "error" | "unsupported";
  results: readonly PaletteChatResult[];
  truncated: boolean;
};

export type CommandPaletteProps = {
  open: boolean;
  query: string;
  activeIndex: number;
  onOpen?: () => void | Promise<void>;
  onToggle: () => void;
  onQueryChange: (query: string) => void;
  onActiveIndexChange: (index: number) => void;
  onNavigate: (tab: string) => void;
  onSlashCommand: (command: string) => void;
  /** Runs an app action such as opening the shortcuts sheet or exporting the open chat. */
  onAction?: (action: string) => void;
  /** Messages matching the query, searched across the user's chats. */
  chatSearch?: PaletteChatSearchView;
  onOpenChatResult?: (index: number) => void;
};

function chatResultItems(props?: Pick<CommandPaletteProps, "chatSearch">): PaletteItem[] {
  return (props?.chatSearch?.results ?? []).map((result, index) => ({
    id: `chat-result-${index}`,
    label: result.label,
    icon: "messageSquare",
    category: "chats",
    action: `chat:${index}`,
    description: result.description,
  }));
}

function filteredItems(
  query: string,
  props?: Pick<CommandPaletteProps, "chatSearch">,
): PaletteItem[] {
  const items = getPaletteItemsInternal();
  if (!query) {
    return items;
  }
  const q = normalizeLowercaseStringOrEmpty(query);
  const commands = items.filter(
    (item) =>
      normalizeLowercaseStringOrEmpty(item.label).includes(q) ||
      normalizeLowercaseStringOrEmpty(item.description).includes(q),
  );
  // Chat matches were found by the gateway for this query; they are not
  // filtered again by label here.
  return [...commands, ...chatResultItems(props)];
}

export function getFilteredPaletteItems(
  query: string,
  props?: Pick<CommandPaletteProps, "chatSearch">,
): readonly PaletteItem[] {
  return filteredItems(query, props);
}

function groupItems(items: PaletteItem[]): Array<[string, PaletteItem[]]> {
  const map = new Map<string, PaletteItem[]>();
  for (const item of items) {
    const group = map.get(item.category) ?? [];
    group.push(item);
    map.set(item.category, group);
  }
  return [...map.entries()];
}

let previouslyFocused: Element | null = null;
let activeDialog: HTMLDialogElement | null = null;
let activeProps: CommandPaletteProps | null = null;

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const paletteDialogLabelId = "cmd-palette-label";
const paletteInputId = "cmd-palette-input";
const paletteListboxId = "cmd-palette-listbox";

function saveFocus() {
  if (previouslyFocused) {
    return;
  }
  previouslyFocused = document.activeElement;
}

function restoreFocus() {
  const target = previouslyFocused;
  previouslyFocused = null;
  activeDialog = null;
  if (target instanceof HTMLElement && target.isConnected) {
    requestAnimationFrame(() => {
      if (target.isConnected) {
        target.focus();
      }
    });
  }
}

function selectItem(item: PaletteItem, props: CommandPaletteProps) {
  if (item.action.startsWith("nav:")) {
    props.onNavigate(item.action.slice(4));
  } else if (item.action.startsWith("chat:")) {
    props.onOpenChatResult?.(Number(item.action.slice("chat:".length)));
  } else if (item.action.startsWith("action:")) {
    props.onAction?.(item.action.slice("action:".length));
  } else {
    props.onSlashCommand(item.action);
  }
  props.onToggle();
  restoreFocus();
}

function closePalette(props: CommandPaletteProps) {
  if (!activeDialog) {
    return;
  }
  props.onToggle();
  restoreFocus();
}

function scrollActiveIntoView() {
  requestAnimationFrame(() => {
    const el = document.querySelector(".cmd-palette__item--active");
    el?.scrollIntoView({ block: "nearest" });
  });
}

function trapFocus(event: KeyboardEvent, root: HTMLElement) {
  const focusable = [...root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
    (element) => element.isConnected && element.tabIndex >= 0 && !element.closest("[hidden]"),
  );
  if (focusable.length === 0) {
    event.preventDefault();
    root.focus();
    return;
  }

  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const focusInside = active ? focusable.includes(active) : false;

  if (event.shiftKey && (!focusInside || active === first)) {
    event.preventDefault();
    last.focus();
    return;
  }
  if (!event.shiftKey && (!focusInside || active === last)) {
    event.preventDefault();
    first.focus();
  }
}

function handleKeydown(e: KeyboardEvent, props: CommandPaletteProps) {
  if (e.key === "Tab") {
    const dialog = (e.currentTarget as HTMLElement | null)?.closest("dialog");
    if (dialog instanceof HTMLElement) {
      trapFocus(e, dialog);
    }
    return;
  }

  const items = filteredItems(props.query, props);
  if (items.length === 0 && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter")) {
    return;
  }
  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      props.onActiveIndexChange((props.activeIndex + 1) % items.length);
      scrollActiveIntoView();
      break;
    case "ArrowUp":
      e.preventDefault();
      props.onActiveIndexChange((props.activeIndex - 1 + items.length) % items.length);
      scrollActiveIntoView();
      break;
    case "Enter":
      e.preventDefault();
      if (items[props.activeIndex]) {
        selectItem(items[props.activeIndex], props);
      }
      break;
    case "Escape":
      e.preventDefault();
      e.stopPropagation();
      closePalette(props);
      break;
  }
}

function getCategoryLabel(category: string): string {
  switch (category) {
    case "search":
      return t("overview.palette.categories.search");
    case "navigation":
      return t("overview.palette.categories.navigation");
    case "skills":
      return t("overview.palette.categories.skills");
    case "actions":
      return t("overview.palette.categories.actions");
    case "chats":
      return t("overview.palette.categories.chats");
    default:
      return category;
  }
}

function getOptionId(item: PaletteItem): string {
  return `cmd-palette-option-${item.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function syncDialog(el: Element | undefined) {
  if (!(el instanceof HTMLDialogElement)) {
    if (activeDialog) {
      restoreFocus();
    }
    return;
  }
  if (activeDialog !== el) {
    saveFocus();
    activeDialog = el;
    void activeProps?.onOpen?.();
  }
  if (el.open) {
    return;
  }
  if (typeof el.showModal === "function") {
    try {
      el.removeAttribute("aria-modal");
      el.showModal();
      return;
    } catch {
      // Fall through to the open attribute fallback below.
    }
  }
  el.setAttribute("aria-modal", "true");
  el.setAttribute("open", "");
}

function focusInput(el: Element | undefined) {
  if (el instanceof HTMLInputElement) {
    requestAnimationFrame(() => {
      if (el.isConnected) {
        el.focus();
      }
    });
  }
}

/**
 * What the "In your chats" search is doing, when there are no result rows to
 * say it: searching, nothing found, or failed. Found results are ordinary rows.
 */
function renderChatSearchStatus(props: CommandPaletteProps) {
  const search = props.chatSearch;
  if (!search || search.status === "idle" || search.status === "unsupported") {
    return nothing;
  }
  const hasRows = search.results.length > 0;
  let text: string | null = null;
  if (search.status === "loading" && !hasRows) {
    text = t("overview.palette.chatSearch.searching");
  } else if (search.status === "done" && !hasRows) {
    text = t("overview.palette.chatSearch.noMatches");
  } else if (search.status === "error") {
    text = t("overview.palette.chatSearch.failed");
  } else if (search.status === "done" && search.truncated) {
    text = t("overview.palette.chatSearch.truncated");
  }
  if (!text) {
    return nothing;
  }
  return html`
    ${hasRows
      ? nothing
      : html`<div class="cmd-palette__group-label">${getCategoryLabel("chats")}</div>`}
    <div class="cmd-palette__status muted" role="status">${text}</div>
  `;
}

export function renderCommandPalette(props: CommandPaletteProps) {
  if (!props.open) {
    return nothing;
  }
  activeProps = props;

  const items = filteredItems(props.query, props);
  const grouped = groupItems(items);
  const chatStatus = renderChatSearchStatus(props);
  const activeItem = items[props.activeIndex];
  const activeOptionId = activeItem ? getOptionId(activeItem) : nothing;
  const paletteLabel = t("overview.palette.placeholder");

  return html`
    <dialog
      ${ref(syncDialog)}
      class="cmd-palette-overlay"
      aria-labelledby=${paletteDialogLabelId}
      @cancel=${(e: Event) => {
        e.preventDefault();
        closePalette(props);
      }}
      @click=${(e: Event) => {
        if (e.target === e.currentTarget) {
          closePalette(props);
        }
      }}
    >
      <div
        class="cmd-palette"
        @click=${(e: Event) => e.stopPropagation()}
        @keydown=${(e: KeyboardEvent) => handleKeydown(e, props)}
      >
        <label id=${paletteDialogLabelId} class="cmd-palette__label" for=${paletteInputId}
          >${paletteLabel}</label
        >
        <input
          ${ref(focusInput)}
          id=${paletteInputId}
          class="cmd-palette__input"
          role="combobox"
          aria-autocomplete="list"
          aria-controls=${paletteListboxId}
          aria-activedescendant=${activeOptionId}
          aria-expanded="true"
          placeholder=${paletteLabel}
          .value=${props.query}
          @input=${(e: Event) => {
            props.onQueryChange((e.target as HTMLInputElement).value);
            props.onActiveIndexChange(0);
          }}
        />
        <div id=${paletteListboxId} class="cmd-palette__results" role="listbox">
          ${grouped.length === 0 && chatStatus === nothing
            ? html`<div class="cmd-palette__empty">
                <span class="nav-item__icon" style="opacity:0.3;width:20px;height:20px"
                  >${icons.search}</span
                >
                <span>${t("overview.palette.noResults")}</span>
              </div>`
            : grouped.map(
                ([category, groupedItems]) => html`
                  <div class="cmd-palette__group-label">${getCategoryLabel(category)}</div>
                  ${groupedItems.map((item) => {
                    const globalIndex = items.indexOf(item);
                    const isActive = globalIndex === props.activeIndex;
                    return html`
                      <div
                        id=${getOptionId(item)}
                        class="cmd-palette__item ${isActive
                          ? "cmd-palette__item--active"
                          : ""} ${item.category === "chats" ? "cmd-palette__item--chat" : ""}"
                        role="option"
                        aria-selected=${isActive ? "true" : "false"}
                        @click=${(e: Event) => {
                          e.stopPropagation();
                          selectItem(item, props);
                        }}
                        @mouseenter=${() => props.onActiveIndexChange(globalIndex)}
                      >
                        <span class="nav-item__icon">${icons[item.icon]}</span>
                        ${item.category === "chats"
                          ? html`<span class="cmd-palette__chat-text">
                              <span class="cmd-palette__chat-label">${item.label}</span>
                              <span class="cmd-palette__chat-snippet muted"
                                >${item.description}</span
                              >
                            </span>`
                          : html`<span>${item.label}</span> ${item.description
                                ? html`<span class="cmd-palette__item-desc muted"
                                    >${item.description}</span
                                  >`
                                : nothing}`}
                      </div>
                    `;
                  })}
                `,
              )}
          ${chatStatus}
        </div>
        <div class="cmd-palette__footer">
          <span><kbd>↑↓</kbd> ${t("overview.palette.footer.navigate")}</span>
          <span><kbd>↵</kbd> ${t("overview.palette.footer.select")}</span>
          <span><kbd>esc</kbd> ${t("overview.palette.footer.close")}</span>
        </div>
      </div>
    </dialog>
  `;
}
