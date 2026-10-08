// The wizard says why Create did not work. The reason used to land on the full
// form hidden behind it, so Create looked like it did nothing.
import { render } from "lit";
import { describe, expect, it, vi } from "vitest";
import {
  createDefaultDraft,
  renderCronQuickCreate,
  type CronQuickCreateProps,
} from "./cron-quick-create.ts";

function mount(overrides: Partial<CronQuickCreateProps> = {}) {
  const props: CronQuickCreateProps = {
    open: true,
    step: "how",
    draft: { ...createDefaultDraft(), prompt: "Summarize my unread emails" },
    onDraftChange: vi.fn(),
    onStepChange: vi.fn(),
    onCreate: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  const host = document.createElement("div");
  render(renderCronQuickCreate(props), host);
  return { host, props };
}

const createButton = (host: HTMLElement) =>
  [...host.querySelectorAll<HTMLButtonElement>(".cqc-actions button.primary")][0];

describe("quick create wizard", () => {
  it("shows why the task could not be created", () => {
    const { host } = mount({ createError: "Couldn't create the task: something went wrong" });
    expect(host.querySelector(".cqc-error")?.textContent).toContain("Couldn't create the task");
  });

  it("can't be pressed twice while it is saving", () => {
    const { host } = mount({ creating: true });
    expect(createButton(host)?.disabled).toBe(true);
    expect(createButton(host)?.textContent).toContain("Creating");
  });

  it("offers two clear choices for results", () => {
    const { host } = mount();
    const labels = [...host.querySelectorAll(".cqc-radio-card__label")].map((el) => el.textContent);
    expect(labels).toEqual(["Notify me", "Silent"]);
  });
});
