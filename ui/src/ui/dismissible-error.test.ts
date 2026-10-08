import { render } from "lit";
import { describe, expect, it, vi } from "vitest";
import { renderDismissibleErrorBanner, renderDismissibleErrorPill } from "./dismissible-error.ts";

function fade(element: Element, animationName: string) {
  const event = new Event("animationend", { bubbles: true }) as AnimationEvent;
  Object.defineProperty(event, "animationName", { value: animationName });
  element.dispatchEvent(event);
}

describe("errors that fade away on their own", () => {
  it("closes the banner when its fade ends or its close button is pressed", () => {
    const container = document.createElement("div");
    const onDismiss = vi.fn();
    render(renderDismissibleErrorBanner("Couldn't reach DaisyClaw.", onDismiss), container);

    const banner = container.querySelector(".callout")!;
    expect(banner.classList.contains("error-auto-hide")).toBe(true);
    expect(banner.querySelector(".callout__content")?.textContent).toBe(
      "Couldn't reach DaisyClaw.",
    );

    fade(banner, "error-auto-hide");
    expect(onDismiss).toHaveBeenCalledTimes(1);

    container.querySelector<HTMLButtonElement>('[aria-label="Dismiss error"]')!.click();
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });

  it("ignores animations that belong to something inside the error", () => {
    const container = document.createElement("div");
    const onDismiss = vi.fn();
    render(renderDismissibleErrorBanner("Saving failed.", onDismiss), container);

    fade(container.querySelector(".callout__content")!, "error-auto-hide");
    fade(container.querySelector(".callout")!, "spin");

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("stays put when nothing can close it", () => {
    const container = document.createElement("div");
    render(renderDismissibleErrorBanner("Read-only error."), container);

    expect(container.querySelector(".error-auto-hide")).toBeNull();
    expect(container.querySelector(".callout__dismiss")).toBeNull();
  });

  it("gives the header label the same close button and fade", () => {
    const container = document.createElement("div");
    const onDismiss = vi.fn();
    render(renderDismissibleErrorPill("Settings could not be loaded.", onDismiss), container);

    const pill = container.querySelector(".pill.danger")!;
    expect(pill.classList.contains("error-auto-hide")).toBe(true);
    fade(pill, "error-auto-hide-still");
    container.querySelector<HTMLButtonElement>(".pill__dismiss")!.click();

    expect(onDismiss).toHaveBeenCalledTimes(2);
  });
});
