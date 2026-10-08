import { describe, expect, it, vi } from "vitest";
import { checkConnectionKeys } from "./connection-keys.js";

function fakeFetch(status: number, body = "") {
  return vi.fn(async () => new Response(body, { status })) as unknown as typeof fetch;
}

describe("checkConnectionKeys", () => {
  it("accepts a Notion token Notion recognises, sending it the way Notion expects", async () => {
    const fetchFn = fakeFetch(200, "{}");

    await expect(
      checkConnectionKeys({ skillKey: "notion", env: { NOTION_API_TOKEN: " ntn_abc " }, fetchFn }),
    ).resolves.toStrictEqual({ status: "valid" });

    const [url, init] = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.notion.com/v1/users/me");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer ntn_abc");
  });

  it("explains a refused Notion token", async () => {
    const result = await checkConnectionKeys({
      skillKey: "notion",
      env: { NOTION_API_TOKEN: "wrong" },
      fetchFn: fakeFetch(401),
    });

    expect(result.status).toBe("invalid");
    expect(result).toMatchObject({ message: expect.stringContaining("Notion didn't accept") });
  });

  it("tells a refused Trello key apart from a refused token", async () => {
    const env = { TRELLO_API_KEY: "k", TRELLO_TOKEN: "t" };

    await expect(
      checkConnectionKeys({ skillKey: "trello", env, fetchFn: fakeFetch(401, "invalid key") }),
    ).resolves.toMatchObject({ status: "invalid", message: expect.stringContaining("API key") });
    await expect(
      checkConnectionKeys({ skillKey: "trello", env, fetchFn: fakeFetch(401, "invalid token") }),
    ).resolves.toMatchObject({ status: "invalid", message: expect.stringContaining("token") });
  });

  it("asks for both Trello values before calling Trello", async () => {
    const fetchFn = fakeFetch(200);

    await expect(
      checkConnectionKeys({ skillKey: "trello", env: { TRELLO_API_KEY: "k" }, fetchFn }),
    ).resolves.toMatchObject({ status: "invalid" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("reports a service it cannot reach instead of refusing the key", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;

    await expect(
      checkConnectionKeys({ skillKey: "notion", env: { NOTION_API_TOKEN: "ntn_abc" }, fetchFn }),
    ).resolves.toStrictEqual({
      status: "unreachable",
      message: "Couldn't reach Notion to check this right now.",
    });
  });

  it("leaves services without a check unchecked", async () => {
    const fetchFn = fakeFetch(200);

    await expect(
      checkConnectionKeys({ skillKey: "gh-issues", env: { GH_TOKEN: "x" }, fetchFn }),
    ).resolves.toStrictEqual({ status: "unchecked" });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
