// Control UI module draws an error that can be closed and fades away on its
// own after ten seconds, so a problem that has passed does not sit on screen.
// Hovering or focusing it holds it while it is being read.
import { html, nothing } from "lit";
import { keyed } from "lit/directives/keyed.js";
import { t } from "../i18n/index.ts";
import { icons } from "./icons.ts";

function dismissWhenFaded(onDismiss: () => void) {
  return (event: AnimationEvent) => {
    // Only the error's own fade counts, not an animation inside it.
    if (event.target === event.currentTarget && event.animationName.startsWith("error-auto-hide")) {
      onDismiss();
    }
  };
}

function renderDismissButton(onDismiss: () => void, className: string) {
  return html`
    <button
      class=${className}
      type="button"
      @click=${onDismiss}
      aria-label=${t("common.dismissError")}
      title=${t("common.dismiss")}
    >
      ${icons.x}
    </button>
  `;
}

/** A full-width error bar, as shown above the conversation. */
export function renderDismissibleErrorBanner(message: string, onDismiss?: () => void) {
  // Keyed on the message so a new error starts its own ten seconds.
  return keyed(
    message,
    html`
      <div
        class="callout danger callout--dismissible ${onDismiss ? "error-auto-hide" : ""}"
        role="alert"
        @animationend=${onDismiss ? dismissWhenFaded(onDismiss) : nothing}
      >
        <span class="callout__content">${message}</span>
        ${onDismiss ? renderDismissButton(onDismiss, "callout__dismiss") : nothing}
      </div>
    `,
  );
}

/** A compact error label, as shown in the page header. */
export function renderDismissibleErrorPill(message: string, onDismiss: () => void) {
  return keyed(
    message,
    html`
      <div
        class="pill danger pill--dismissible error-auto-hide"
        role="alert"
        @animationend=${dismissWhenFaded(onDismiss)}
      >
        <span class="pill__text" title=${message}>${message}</span>
        ${renderDismissButton(onDismiss, "pill__dismiss")}
      </div>
    `,
  );
}
