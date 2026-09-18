import { describe, expect, it } from "vitest";
import { CHANNEL_LOGOS } from "./channel-logos.ts";
import { renderChannelBrandIcon } from "./channels.icons.ts";

/** Every channel the Settings list can show a row for. */
const SHIPPED_CHANNELS = [
  "whatsapp",
  "telegram",
  "discord",
  "googlechat",
  "slack",
  "signal",
  "imessage",
  "nostr",
] as const;

function renderedMarkup(key: string): string {
  // The tile holds the logo template; read its static strings, which is enough
  // to tell a real mark from the fallback glyph.
  const result = renderChannelBrandIcon(key) as unknown as {
    values: unknown[];
    strings: readonly string[];
  };
  const nested = result.values.find(
    (value): value is { strings: readonly string[] } =>
      typeof value === "object" && value !== null && "strings" in value,
  );
  return [...result.strings, ...(nested?.strings ?? [])].join(" ");
}

describe("channel brand icons", () => {
  // Sept 18: setup showed the real WhatsApp and Telegram marks while the
  // Settings list showed flat one-colour glyphs, and Signal, Google Chat,
  // iMessage and Nostr were generic chat bubbles that belonged to no brand.
  it("has a real mark for every channel the Settings list can show", () => {
    for (const key of SHIPPED_CHANNELS) {
      expect(CHANNEL_LOGOS[key], key).toBeDefined();
    }
  });

  it("renders that mark rather than the fallback glyph", () => {
    for (const key of SHIPPED_CHANNELS) {
      const markup = renderedMarkup(key);
      expect(markup, key).toContain("ch-brand--logo");
      expect(markup, key).not.toContain("ch-brand__glyph");
    }
  });

  it("still has a tile for a channel nobody has drawn a mark for", () => {
    const markup = renderedMarkup("something-new");
    expect(markup).toContain("ch-brand__glyph");
  });

  it("uses the same marks the setup wizard uses", async () => {
    const { WIZARD_CHANNEL_LOGOS } = await import("./first-run-logos.ts");
    for (const key of SHIPPED_CHANNELS) {
      expect(WIZARD_CHANNEL_LOGOS[key], key).toBe(CHANNEL_LOGOS[key]);
    }
  });
});
