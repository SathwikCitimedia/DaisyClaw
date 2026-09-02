// Control UI tests cover the Model Studio dialog opening from Quick Settings.
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  canRunPlaywrightChromium,
  installMockGateway,
  resolvePlaywrightChromiumExecutablePath,
  startControlUiE2eServer,
  type ControlUiE2eServer,
} from "../../test-helpers/control-ui-e2e.ts";

const chromiumExecutablePath = resolvePlaywrightChromiumExecutablePath(chromium.executablePath());
const chromiumAvailable = canRunPlaywrightChromium(chromiumExecutablePath);
const allowMissingChromium = process.env.DAISYCLAW_UI_E2E_ALLOW_MISSING_CHROMIUM === "1";
const describeControlUiE2e = chromiumAvailable || !allowMissingChromium ? describe : describe.skip;

let browser: Browser;
let server: ControlUiE2eServer;

/** Realistic user config — the object model shape, not the plain string. */
const REAL_SHAPE_CONFIG = {
  agents: {
    defaults: {
      model: { primary: "litellm/claude-sonnet-4-5" },
    },
  },
  models: {
    providers: {
      litellm: {
        baseUrl: "http://127.0.0.1:4000/v1",
        apiKey: "sk-redacted",
        models: [{ id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5 (LiteLLM)" }],
      },
    },
  },
};

describeControlUiE2e("Control UI Model Studio mocked Gateway E2E", () => {
  beforeAll(async () => {
    if (!chromiumAvailable) {
      throw new Error(
        `Playwright Chromium is not installed or cannot start at ${chromiumExecutablePath}. Run \`pnpm --dir ui exec playwright install --with-deps chromium\`, or set DAISYCLAW_UI_E2E_ALLOW_MISSING_CHROMIUM=1 only when intentionally skipping this lane.`,
      );
    }
    server = await startControlUiE2eServer();
    browser = await chromium.launch({ executablePath: chromiumExecutablePath });
  });

  afterAll(async () => {
    await browser?.close();
    await server?.close();
  });

  it("opens the Model Studio dialog when Manage is clicked on the Model & Thinking card", async () => {
    const context = await browser.newContext({
      locale: "en-US",
      serviceWorkers: "block",
      viewport: { height: 900, width: 1280 },
    });
    const page = await context.newPage();
    const pageErrors: string[] = [];
    const consoleMessages: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(String(err)));
    page.on("console", (msg) => consoleMessages.push(`${msg.type()}: ${msg.text()}`));
    await installMockGateway(page, {
      models: [
        { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5 (LiteLLM)", provider: "litellm" },
      ],
      methodResponses: {
        "config.get": { hash: "hash-1", config: REAL_SHAPE_CONFIG },
        "config.schema": { schema: { type: "object", properties: {} }, uiHints: {} },
        "models.authStatus": { ts: 1, providers: [] },
      },
    });

    try {
      const response = await page.goto(`${server.baseUrl}config`);
      expect(response?.status()).toBe(200);

      const manage = page.locator(".qs-card--model button", { hasText: "Manage" }).first();
      try {
        await manage.waitFor({ timeout: 10_000 });
      } catch (err) {
        throw new Error(
          [
            "Manage button never rendered on the Model & Thinking card",
            `Page errors: ${JSON.stringify(pageErrors)}`,
            `Console: ${JSON.stringify(consoleMessages)}`,
            `Body text: ${await page.locator("body").textContent().catch(String)}`,
          ].join("\n"),
          { cause: err },
        );
      }

      await manage.click();

      const dialog = page.locator("dialog.model-studio");
      try {
        // `open` is only set once showModal() actually ran — visibility, not just DOM presence.
        await dialog.and(page.locator("[open]")).waitFor({ timeout: 10_000 });
      } catch (err) {
        const dialogCount = await dialog.count();
        throw new Error(
          [
            `Model Studio dialog did not open (dialog nodes in DOM: ${dialogCount})`,
            `Page errors: ${JSON.stringify(pageErrors)}`,
            `Console: ${JSON.stringify(consoleMessages)}`,
          ].join("\n"),
          { cause: err },
        );
      }

      await expect
        .poll(async () => dialog.locator(".model-studio__hero-name").textContent())
        .toContain("Claude Sonnet 4.5");
    } finally {
      await context.close();
    }
  });
});
