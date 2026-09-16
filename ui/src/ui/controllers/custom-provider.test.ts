import { describe, expect, it } from "vitest";
import {
  describeCustomProviderSave,
  resolveCustomProviderBaseUrl,
  type ConnectCustomProviderResult,
} from "./custom-provider.ts";

const unreachable = { models: [] as string[], baseUrl: "" };

describe("resolveCustomProviderBaseUrl", () => {
  // The Sept 16 laptop report: the same LiteLLM address worked when saved from
  // the wizard and returned "404 status code (no body)" when saved from
  // Settings after a reset. The address stored depended on whether a
  // three-second probe reached the server; when it missed, /v1 was left off.
  it("adds /v1 to a bare address even when the probe reached nothing", () => {
    expect(
      resolveCustomProviderBaseUrl({
        typed: "http://10.21.66.8:4000",
        probe: { ...unreachable, baseUrl: "http://10.21.66.8:4000" },
      }),
    ).toBe("http://10.21.66.8:4000/v1");
  });

  it("adds /v1 with no probe at all, and supplies a missing scheme", () => {
    expect(resolveCustomProviderBaseUrl({ typed: "10.21.66.8:4000" })).toBe(
      "http://10.21.66.8:4000/v1",
    );
    expect(resolveCustomProviderBaseUrl({ typed: "http://10.21.66.8:4000/" })).toBe(
      "http://10.21.66.8:4000/v1",
    );
  });

  it("keeps an address the user gave a path to, exactly", () => {
    expect(resolveCustomProviderBaseUrl({ typed: "http://host:4000/v1" })).toBe(
      "http://host:4000/v1",
    );
    expect(resolveCustomProviderBaseUrl({ typed: "https://gw.example.com/openai/v1" })).toBe(
      "https://gw.example.com/openai/v1",
    );
    // Trailing slashes are noise, not a path.
    expect(resolveCustomProviderBaseUrl({ typed: "http://host:4000/v1//" })).toBe(
      "http://host:4000/v1",
    );
  });

  it("honours positive evidence that the API really lives at the root", () => {
    expect(
      resolveCustomProviderBaseUrl({
        typed: "http://host:11434",
        probe: { baseUrl: "http://host:11434", models: ["llama3"] },
      }),
    ).toBe("http://host:11434");
  });

  it("ignores a probe that listed nothing, even when it answered", () => {
    expect(
      resolveCustomProviderBaseUrl({
        typed: "http://host:4000",
        probe: { baseUrl: "http://host:4000", models: [] },
      }),
    ).toBe("http://host:4000/v1");
  });
});

describe("describeCustomProviderSave", () => {
  function result(over: Partial<ConnectCustomProviderResult>): ConnectCustomProviderResult {
    return {
      providerId: "litellm",
      label: "LiteLLM",
      baseUrl: "http://10.21.66.8:4000/v1",
      modelRef: "litellm/claude-sonnet-4-5",
      probe: {
        reachable: true,
        kind: "litellm",
        providerId: "litellm",
        label: "LiteLLM",
        baseUrl: "http://10.21.66.8:4000/v1",
        models: ["claude-sonnet-4-5"],
        authRejected: false,
      },
      ...over,
    } as ConnectCustomProviderResult;
  }

  it("names the address that was saved when the server did not answer", () => {
    const note = describeCustomProviderSave(
      result({ probe: { ...result({}).probe, reachable: false, models: [] } }),
    );
    expect(note.tone).toBe("info");
    expect(note.message).toContain("http://10.21.66.8:4000/v1");
  });

  it("confirms plainly when everything checked out", () => {
    expect(describeCustomProviderSave(result({}))).toEqual({
      tone: "success",
      message: "Connected to LiteLLM.",
    });
  });

  it("warns when the server does not list the typed model", () => {
    const note = describeCustomProviderSave(
      result({ probe: { ...result({}).probe, models: ["gpt-4o"] } }),
    );
    expect(note.message).toContain('does not list "claude-sonnet-4-5"');
  });
});
