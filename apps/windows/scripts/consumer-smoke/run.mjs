// Consumer smoke suite: boots the SHIPPED engine bundle into a throwaway state
// directory and drives the REAL Control UI controller functions against it.
//
// Why it exists: every consumer bug this project has shipped twice was "proved
// fixed" by a hand-written probe that resembled the product's call sequence
// instead of being it. Every check below imports the function the dashboard
// actually calls, so the test and the product cannot drift apart.
//
// Run:  node --import tsx apps/windows/scripts/consumer-smoke/run.mjs
// Flags: --keep (leave the state dir for inspection)
//        --only <name[,name]>  (run a subset)
//        --allow-offline (downgrade provider-reachability checks to warnings)
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

import { pickFreePort, SmokeEngine } from "./engine-harness.mjs";
import { connectSmokeClient, waitForSmokeClient } from "./smoke-client.mjs";

// The product's own code. Anything asserted below runs through these.
import { connectWhatsApp } from "../../../../ui/src/ui/controllers/channels.ts";
import {
    loadModels,
    saveProviderApiKey,
    testProviderConnection,
    verifyProviderModelCandidates,
} from "../../../../ui/src/ui/controllers/models.ts";
import { listProviderModelCandidates } from "../../../../ui/src/ui/controllers/model-pick.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..", "..");

const args = process.argv.slice(2);
const KEEP_STATE = args.includes("--keep");
const ALLOW_OFFLINE = args.includes("--allow-offline");
const ONLY = (() => {
    const index = args.indexOf("--only");
    return index >= 0 && args[index + 1]
        ? new Set(args[index + 1].split(","))
        : null;
})();

/** Engine bundle under test; defaults to the checked-out x64 bundle. */
const ENGINE_ROOT = (() => {
    const index = args.indexOf("--engine");
    return index >= 0 && args[index + 1]
        ? resolve(args[index + 1])
        : join(repoRoot, "apps", "windows", "engine-x64");
})();

// A key that is syntactically fine and certainly invalid. Reaching OpenAI with
// it must produce a rejected-key verdict, which is how we prove the request
// left the machine at all.
const UNUSABLE_OPENAI_KEY = "sk-consumer-smoke-not-a-real-key-000000000000";

const results = [];
function record(name, status, detail) {
    results.push({ name, status, detail });
    const mark =
        status === "pass" ? "PASS" : status === "warn" ? "WARN" : "FAIL";
    console.log(`  ${mark}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function log(message) {
    console.log(`  ·  ${message}`);
}

function shouldRun(name) {
    return !ONLY || ONLY.has(name);
}

/** Minimal stand-in for the dashboard's reactive state object. */
function makeControllerState(client) {
    return {
        client,
        connected: true,
        channelsLoading: false,
        channelsSnapshot: null,
        channelsError: null,
        channelsLastSuccess: null,
        whatsappLoginMessage: null,
        whatsappLoginQrDataUrl: null,
        whatsappLoginConnected: null,
        whatsappBusy: false,
        modelsError: null,
        modelsBusy: false,
    };
}

async function main() {
    const engineRoot = ENGINE_ROOT;
    const stateDir = join(repoRoot, ".artifacts", "consumer-smoke", "state");
    const port = await pickFreePort();
    const engine = new SmokeEngine({
        engineRoot,
        stateDir,
        taskName: `DaisyClaw Gateway Smoke ${process.pid}`,
        port,
        onLog: log,
    });

    console.log("Consumer smoke suite");
    console.log(`  engine : ${engineRoot}`);
    console.log(`  state  : ${stateDir}`);
    console.log(`  port   : ${port}`);
    console.log("");

    let client = null;
    try {
        engine.resetState();
        const installCode = await engine.runAction("install");
        if (installCode !== 0 && installCode !== 3) {
            record(
                "engine-installs",
                "fail",
                `Manage-DaisyGateway install exited ${installCode}`,
            );
            return;
        }
        // Pin the port the suite listens on, then restart so it takes effect. This
        // is the only change made to a stock consumer config.
        engine.pinPortAndAllowScriptOperator();
        await engine.runAction("stop", 120_000);
        const restartStartedAt = Date.now();
        await engine.runAction("install");

        const token = engine.token;
        if (!token) {
            record(
                "engine-installs",
                "fail",
                "no gateway token in the seeded config",
            );
            return;
        }
        record(
            "engine-installs",
            "pass",
            `fresh consumer config seeded in ${stateDir}`,
        );

        const connection = await waitForSmokeClient({
            url: engine.wsUrl,
            token,
        });
        client = connection.client;
        log(`connected after ${Math.round(connection.waitedMs / 1000)}s`);

        // ── readiness ────────────────────────────────────────────────────────
        if (shouldRun("ready-means-ready")) {
            await checkReadyMeansReady(engine, token, restartStartedAt, client);
        }

        // ── WhatsApp ─────────────────────────────────────────────────────────
        if (shouldRun("whatsapp-qr-on-fresh-install")) {
            await checkWhatsAppQr(client);
        }
        if (shouldRun("whatsapp-idle-until-scan")) {
            await checkWhatsAppIdle(client);
        }

        // ── models ───────────────────────────────────────────────────────────
        if (shouldRun("openai-key-lists-usable-models")) {
            await checkOpenAiModels(client);
        }
        if (shouldRun("unknown-model-message-is-honest")) {
            await checkUnknownModelMessage(client);
        }
        if (shouldRun("no-phantom-model-calls")) {
            await checkNoPhantomModelCalls(client);
        }
    } catch (err) {
        record(
            "suite",
            "fail",
            err instanceof Error ? err.message : String(err),
        );
    } finally {
        try {
            client?.close();
        } catch {
            // nothing to close
        }
        if (!KEEP_STATE) {
            await engine.cleanup();
        } else {
            log(
                `--keep: leaving ${stateDir} and task "${engine.taskName}" in place`,
            );
        }
    }

    console.log("");
    const failed = results.filter((entry) => entry.status === "fail");
    const warned = results.filter((entry) => entry.status === "warn");
    console.log(
        `${results.length - failed.length - warned.length} passed, ${warned.length} warned, ${failed.length} failed`,
    );
    process.exit(failed.length > 0 ? 1 : 0);
}

/**
 * The engine must not report itself ready before it accepts connections. The
 * installer and the tray both gate the dashboard on this, so a ready flag that
 * runs ahead of the connect handler is what puts a login form in front of the
 * user on a cold start.
 */
async function checkReadyMeansReady(engine, token, startedAt, client) {
    const deadline = Date.now() + 150_000;
    let httpAnsweredMs = null;
    let readyAtMs = null;
    let lastReadiness = null;
    while (Date.now() < deadline) {
        if (httpAnsweredMs === null && (await engine.isHttpAnswering())) {
            httpAnsweredMs = Date.now() - startedAt;
        }
        const readiness = await engine.readReadiness();
        lastReadiness = readiness;
        if (readiness.status === 200) {
            readyAtMs = Date.now() - startedAt;
            break;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (readyAtMs === null) {
        const failing = lastReadiness?.body?.failing ?? [];
        let detail = "";
        try {
            const status = await client?.request("channels.status", { probe: false });
            const snapshots = Object.fromEntries(
                failing.map((channelId) => [
                    channelId,
                    status?.channelAccounts?.[channelId] ?? "no accounts",
                ]),
            );
            detail = ` channel snapshots: ${JSON.stringify(snapshots)}`;
        } catch (err) {
            detail = ` (channels.status unavailable: ${err instanceof Error ? err.message : String(err)})`;
        }
        record(
            "ready-means-ready",
            "fail",
            `gateway never reported ready; last answer: ${JSON.stringify(lastReadiness?.body)}.${detail}`,
        );
        return;
    }
    // Ready was just claimed. A connection must succeed right now.
    try {
        const client = await connectSmokeClient({ url: engine.wsUrl, token });
        client.close();
        record(
            "ready-means-ready",
            "pass",
            `http answered at ${Math.round((httpAnsweredMs ?? 0) / 1000)}s, ready and accepting connections at ${Math.round(readyAtMs / 1000)}s`,
        );
    } catch (err) {
        record(
            "ready-means-ready",
            "fail",
            `gateway reported ready but refused a connection: ${err instanceof Error ? err.message : String(err)}`,
        );
    }
}

/**
 * The exact first-run path: a user opens channel setup and presses the button.
 * No configuration is written by the test beforehand, because the wizard does
 * not write any either.
 */
async function checkWhatsAppQr(client) {
    const state = makeControllerState(client);
    const running = connectWhatsApp(state, false).catch(() => {
        // The login poll keeps running until teardown; its failure is not the
        // property under test.
    });
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
        if (
            typeof state.whatsappLoginQrDataUrl === "string" &&
            state.whatsappLoginQrDataUrl
        ) {
            record(
                "whatsapp-qr-on-fresh-install",
                "pass",
                `QR returned (${state.whatsappLoginQrDataUrl.length} bytes)`,
            );
            void running;
            return;
        }
        if (state.whatsappLoginConnected === true) {
            record(
                "whatsapp-qr-on-fresh-install",
                "fail",
                "reported already linked on a fresh install",
            );
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    record(
        "whatsapp-qr-on-fresh-install",
        "fail",
        state.channelsError ?? state.whatsappLoginMessage ?? "no QR within 90s",
    );
}

/** Loading the plugin must not open a WhatsApp connection by itself. */
async function checkWhatsAppIdle(client) {
    try {
        const status = await client.request("channels.status", {
            probe: false,
        });
        const accounts = status?.channelAccounts?.whatsapp ?? [];
        const live = accounts.filter((account) => account?.connected === true);
        if (live.length > 0) {
            record(
                "whatsapp-idle-until-scan",
                "fail",
                `${live.length} account(s) already connected`,
            );
            return;
        }
        record(
            "whatsapp-idle-until-scan",
            "pass",
            "no WhatsApp account connected before a scan",
        );
    } catch (err) {
        record(
            "whatsapp-idle-until-scan",
            "fail",
            err instanceof Error ? err.message : String(err),
        );
    }
}

/**
 * A pasted API key must produce a model list the engine can actually use. The
 * proof is that the model the product picks reaches the provider: with a key
 * we know is invalid, the verdict must be a rejected key, never "your account
 * cannot use this model".
 */
async function checkOpenAiModels(client) {
    const state = makeControllerState(client);
    try {
        await saveProviderApiKey(state, "openai", UNUSABLE_OPENAI_KEY);
    } catch (err) {
        record(
            "openai-key-lists-usable-models",
            "fail",
            `saving the key failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        return;
    }
    let catalog = [];
    try {
        catalog = await loadModels(client);
    } catch (err) {
        record(
            "openai-key-lists-usable-models",
            "fail",
            `models.list failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        return;
    }
    const candidates = listProviderModelCandidates(catalog, "openai");
    if (candidates.length === 0) {
        record(
            "openai-key-lists-usable-models",
            "fail",
            "no OpenAI model offered after saving a key",
        );
        return;
    }
    // The product's own walk: try models until one reaches the provider. With a
    // key we know is invalid, reaching the provider means a rejected key.
    const verified = await verifyProviderModelCandidates({
        client,
        providerId: "openai",
        candidates,
        apiKey: UNUSABLE_OPENAI_KEY,
    });
    const verdict = verified.verdict;
    const tried = verified.attempted.map((entry) => entry.modelId).join(", ");
    if (!verdict) {
        record(
            "openai-key-lists-usable-models",
            "fail",
            "models.testProvider returned nothing",
        );
        return;
    }
    if (verdict.reason === "invalid_key") {
        // Every model the list offers must be one the engine can run. A walk
        // that needed a second candidate means the first was a name the engine
        // did not know: the list promised something it could not deliver.
        if (verified.attempted.length > 1) {
            record(
                "openai-key-lists-usable-models",
                "fail",
                `the list offered models the engine cannot run; needed ${verified.attempted.length} tries (${tried}) before reaching OpenAI`,
            );
            return;
        }
        record(
            "openai-key-lists-usable-models",
            "pass",
            `first offered model (${tried}) reached OpenAI (key rejected, as expected)`,
        );
        return;
    }
    if (verdict.reason === "network" || verdict.reason === "timeout") {
        record(
            "openai-key-lists-usable-models",
            ALLOW_OFFLINE ? "warn" : "fail",
            `could not reach OpenAI after trying ${tried}: ${verdict.message}`,
        );
        return;
    }
    record(
        "openai-key-lists-usable-models",
        "fail",
        `setup never reached OpenAI; tried ${tried}; last verdict ${verdict.reason}: ${verdict.message}`,
    );
}

/**
 * A model name the engine does not know is a local miss. Saying the account
 * lacks access is a claim about the user's OpenAI plan that we never checked.
 */
async function checkUnknownModelMessage(client) {
    const verdict = await testProviderConnection(client, {
        providerId: "openai",
        modelId: "totally-not-a-real-model-xyz",
        apiKey: UNUSABLE_OPENAI_KEY,
    });
    if (!verdict) {
        record(
            "unknown-model-message-is-honest",
            "fail",
            "models.testProvider returned nothing",
        );
        return;
    }
    const claimsAccountLimit = /account cannot use|not available on your/i.test(
        verdict.message,
    );
    if (verdict.reason === "unknown_model" && !claimsAccountLimit) {
        record("unknown-model-message-is-honest", "pass", verdict.message);
        return;
    }
    record(
        "unknown-model-message-is-honest",
        "fail",
        `reason=${verdict.reason}; message blames the account: ${verdict.message}`,
    );
}

/**
 * A fresh install has no AI provider, yet the engine carries a built-in default
 * model name. Background niceties (chat titles, follow-up chips) used to call
 * that phantom model and fail with "No API key found" on every message. The
 * dashboard asks for chip refinement exactly like this; the answer must be the
 * instant heuristic set, never an error.
 */
async function checkNoPhantomModelCalls(client) {
    const messageText =
        "Here is a long answer with several steps.\n1. First do this.\n2. Then do that.\n3. Finally check the result. " +
        "It goes on for a while so the heuristics have something to chew on and suggest a summary.";
    let result;
    const startedAt = Date.now();
    try {
        result = await client.request(
            "chat.recommendActions",
            { sessionKey: "main", messageText, refine: true },
            { timeoutMs: 20_000 },
        );
    } catch (err) {
        record(
            "no-phantom-model-calls",
            "fail",
            `chat.recommendActions rejected: ${err instanceof Error ? err.message : String(err)}`,
        );
        return;
    }
    const elapsedMs = Date.now() - startedAt;
    if (!result || !Array.isArray(result.actions)) {
        record("no-phantom-model-calls", "fail", `unexpected reply ${JSON.stringify(result)}`);
        return;
    }
    if (result.source !== "heuristic") {
        record(
            "no-phantom-model-calls",
            "fail",
            `refinement claimed a model answered (source=${result.source}) with no provider configured`,
        );
        return;
    }
    record(
        "no-phantom-model-calls",
        "pass",
        `heuristic chips only (${result.actions.length}) in ${elapsedMs} ms; no model was asked`,
    );
}

await main();
