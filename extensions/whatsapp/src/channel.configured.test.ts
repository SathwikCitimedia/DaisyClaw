/**
 * The full WhatsApp channel surface now loads at every gateway start in the
 * desktop build, so its "is this configured?" check runs on the startup path
 * even when WhatsApp was never set up. It must answer from the auth file alone:
 * pulling the connection runtime in made every start slower for nothing.
 */
import { describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  readWebAuthState: vi.fn(async () => "linked" as const),
  loadChannelRuntime: vi.fn(async () => {
    throw new Error("the channel runtime must not load while checking configured state");
  }),
}));

vi.mock("./auth-store.js", async () => {
  const actual = await vi.importActual<typeof import("./auth-store.js")>("./auth-store.js");
  return { ...actual, readWebAuthState: hoisted.readWebAuthState };
});

vi.mock("./shared.js", async () => {
  const actual = await vi.importActual<typeof import("./shared.js")>("./shared.js");
  return { ...actual, loadWhatsAppChannelRuntime: hoisted.loadChannelRuntime };
});

const { whatsappPlugin } = await import("./channel.js");

describe("whatsapp channel config.isConfigured", () => {
  it("reads the auth state without loading the connection runtime", async () => {
    hoisted.readWebAuthState.mockResolvedValueOnce("linked");
    await expect(
      whatsappPlugin.config.isConfigured?.({ authDir: "/tmp/wa" } as never, {} as never),
    ).resolves.toBe(true);
    expect(hoisted.readWebAuthState).toHaveBeenCalledWith("/tmp/wa");
    expect(hoisted.loadChannelRuntime).not.toHaveBeenCalled();
  });

  it("reports an unlinked account as not configured", async () => {
    hoisted.readWebAuthState.mockResolvedValueOnce("not-linked" as never);
    await expect(
      whatsappPlugin.config.isConfigured?.({ authDir: "/tmp/wa" } as never, {} as never),
    ).resolves.toBe(false);
    expect(hoisted.loadChannelRuntime).not.toHaveBeenCalled();
  });
});
