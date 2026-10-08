// Checks an account key with the service it belongs to before DaisyClaw saves
// it, so a mistyped or wrongly pasted key is caught on the Connect card rather
// than turning up later as a failed request in the middle of a chat.
//
// Only services with a cheap "who am I" call are checked. Anything else, and
// any check that cannot reach the service, is reported as such and left to the
// caller: being offline is not a reason to refuse a key.
import { fetchWithTimeout } from "../utils/fetch-timeout.js";

export type ConnectionKeyCheck =
  | { status: "valid" }
  | { status: "invalid"; message: string }
  | { status: "unreachable"; message: string }
  | { status: "unchecked" };

const CHECK_TIMEOUT_MS = 10_000;

type KeyChecker = {
  label: string;
  check: (
    env: Readonly<Record<string, string>>,
    fetchFn: typeof fetch,
  ) => Promise<ConnectionKeyCheck>;
};

function readValue(env: Readonly<Record<string, string>>, name: string): string {
  return (env[name] ?? "").trim();
}

const KEY_CHECKERS: Record<string, KeyChecker> = {
  notion: {
    label: "Notion",
    async check(env, fetchFn) {
      const token = readValue(env, "NOTION_API_TOKEN");
      if (!token) {
        return { status: "invalid", message: "Paste your Notion token first." };
      }
      const res = await fetchWithTimeout(
        "https://api.notion.com/v1/users/me",
        { headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28" } },
        CHECK_TIMEOUT_MS,
        fetchFn,
      );
      if (res.ok) {
        return { status: "valid" };
      }
      if (res.status === 401 || res.status === 403) {
        return {
          status: "invalid",
          message:
            "Notion didn't accept this token. Copy the Internal Integration Secret again from your integration's page.",
        };
      }
      return {
        status: "unreachable",
        message: `Notion couldn't check it right now (${res.status}).`,
      };
    },
  },
  trello: {
    label: "Trello",
    async check(env, fetchFn) {
      const key = readValue(env, "TRELLO_API_KEY");
      const token = readValue(env, "TRELLO_TOKEN");
      if (!key || !token) {
        return { status: "invalid", message: "Paste both the API key and the token first." };
      }
      const query = new URLSearchParams({ fields: "username", key, token });
      const res = await fetchWithTimeout(
        `https://api.trello.com/1/members/me?${query.toString()}`,
        {},
        CHECK_TIMEOUT_MS,
        fetchFn,
      );
      if (res.ok) {
        return { status: "valid" };
      }
      if (res.status === 400 || res.status === 401) {
        const body = (await res.text().catch(() => "")).toLowerCase();
        return {
          status: "invalid",
          message: body.includes("key")
            ? "Trello didn't accept the API key. Copy it again from your Power-Up's API key page."
            : "Trello didn't accept the token. Press the Token link next to your API key, allow access, and copy the new token.",
        };
      }
      return {
        status: "unreachable",
        message: `Trello couldn't check it right now (${res.status}).`,
      };
    },
  },
};

/** Asks the service whether these values work; never throws. */
export async function checkConnectionKeys(params: {
  skillKey: string;
  env: Readonly<Record<string, string>>;
  fetchFn?: typeof fetch;
}): Promise<ConnectionKeyCheck> {
  const checker = KEY_CHECKERS[params.skillKey];
  if (!checker) {
    return { status: "unchecked" };
  }
  try {
    return await checker.check(params.env, params.fetchFn ?? fetch);
  } catch {
    return {
      status: "unreachable",
      message: `Couldn't reach ${checker.label} to check this right now.`,
    };
  }
}
