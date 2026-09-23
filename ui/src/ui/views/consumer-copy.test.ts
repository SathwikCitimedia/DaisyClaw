import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Copy rules for the screens a paying customer reads.
 *
 * Two mistakes keep coming back. The product told people their conversations
 * never leave the computer, which stopped being true the moment they pasted a
 * provider key. And the engine's own name leaked into sentences spoken to the
 * user, who has never heard it. The wordmark is a separate thing and is allowed
 * to stay where a brand belongs.
 */
const CONSUMER_COPY_FILES = [
  "ui/src/ui/views/first-run-wizard.ts",
  "ui/src/ui/views/chat.ts",
  "ui/src/ui/chat/chat-welcome.ts",
  "ui/src/ui/views/config-quick.ts",
];

/** Sentences that claim messages stay on the machine. They do not. */
const FALSE_LOCALITY = [
  /never leaves? this device/i,
  /conversations? never leaves?/i,
  /everything stays local/i,
  /all requests are processed on this pc/i,
];

function readFile(relative: string): string {
  return fs.readFileSync(path.join(process.cwd(), relative), "utf8");
}

describe("copy a customer reads", () => {
  it("never claims their messages stay on this computer", () => {
    for (const file of CONSUMER_COPY_FILES) {
      const source = readFile(file);
      for (const pattern of FALSE_LOCALITY) {
        expect(pattern.test(source), `${file} matches ${pattern}`).toBe(false);
      }
    }
  });

  it("speaks to the user as Daisy, not as the engine", () => {
    // The sidebar wordmark is deliberately excluded: a brand belongs there.
    // These files are sentences addressed to a person.
    for (const file of ["ui/src/ui/views/chat.ts", "ui/src/ui/chat/chat-welcome.ts"]) {
      expect(readFile(file).includes("DaisyClaw"), file).toBe(false);
    }
  });

  it("does not offer the engine's name as something the user already set up", () => {
    const wizard = readFile("ui/src/ui/views/first-run-wizard.ts");
    expect(/already set up DaisyClaw/i.test(wizard)).toBe(false);
  });

  it("keeps operator controls out of a customer's Settings", () => {
    const settings = readFile("ui/src/ui/views/config-quick.ts");
    // Both cards must be rendered behind the consumer-build check, not directly.
    expect(settings).toContain("const operatorCards = !isConsumerBuild()");
    expect(settings).toContain("${operatorCards ? renderSecurityCard(props) : nothing}");
    expect(settings).toContain("${operatorCards ? renderPresetsCard(props) : nothing}");
  });
});
