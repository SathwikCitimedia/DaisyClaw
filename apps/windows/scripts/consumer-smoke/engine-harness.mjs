// Lifecycle for an ISOLATED copy of the shipped engine bundle.
//
// The consumer smoke suite must never touch the developer's own gateway: it
// runs on its own port, its own scheduled task and its own state directory,
// and every one of those is asserted before a single process is started.
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import {
    existsSync,
    mkdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { join } from "node:path";

/** The developer's real gateway. Nothing in this file may address it. */
const PROTECTED_PORT = 18789;
const PROTECTED_TASK_NAME = "DaisyClaw Gateway";

const POWERSHELL = join(
    process.env.SystemRoot ?? "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
);

/** Picks a free TCP port, never the developer gateway's. */
export async function pickFreePort() {
    for (let attempt = 0; attempt < 40; attempt += 1) {
        const port = await new Promise((resolve, reject) => {
            const server = createServer();
            server.unref();
            server.on("error", reject);
            server.listen(0, "127.0.0.1", () => {
                const address = server.address();
                const value =
                    typeof address === "object" && address ? address.port : 0;
                server.close(() => resolve(value));
            });
        });
        if (port >= 1024 && port !== PROTECTED_PORT) {
            return port;
        }
    }
    throw new Error("could not find a free port for the smoke gateway");
}

function assertIsolated(options) {
    if (options.port === PROTECTED_PORT) {
        throw new Error(
            `refusing to run the smoke suite on the real gateway port ${PROTECTED_PORT}`,
        );
    }
    if (
        !options.taskName.includes("Smoke") ||
        options.taskName === PROTECTED_TASK_NAME
    ) {
        throw new Error(
            `smoke task name must contain "Smoke", got "${options.taskName}"`,
        );
    }
    if (!options.stateDir.includes("consumer-smoke")) {
        throw new Error(
            `smoke state dir must live under consumer-smoke, got "${options.stateDir}"`,
        );
    }
    if (!existsSync(join(options.engineRoot, "node.exe"))) {
        throw new Error(
            `no engine bundle at ${options.engineRoot} (build it first)`,
        );
    }
}

export class SmokeEngine {
    constructor(options) {
        assertIsolated(options);
        this.engineRoot = options.engineRoot;
        this.stateDir = options.stateDir;
        this.taskName = options.taskName;
        this.port = options.port;
        this.scriptPath = join(options.engineRoot, "Manage-DaisyGateway.ps1");
        this.logPath = join(options.stateDir, "gateway-setup.log");
        this.configPath = join(options.stateDir, "daisyclaw.json");
        this.httpOrigin = `http://127.0.0.1:${options.port}`;
        this.wsUrl = `ws://127.0.0.1:${options.port}/`;
        this.onLog = options.onLog ?? (() => {});
    }

    /** Removes any leftovers from an interrupted previous run. */
    resetState() {
        this.#schtasks(["/Delete", "/F", "/TN", this.taskName]);
        if (existsSync(this.stateDir)) {
            rmSync(this.stateDir, { recursive: true, force: true });
        }
        mkdirSync(this.stateDir, { recursive: true });
    }

    async runAction(action, timeoutMs = 300_000) {
        const args = [
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            this.scriptPath,
            "-Action",
            action,
            "-EngineRoot",
            this.engineRoot,
            "-Port",
            String(this.port),
            "-TaskName",
            this.taskName,
            "-StateDir",
            this.stateDir,
            "-LogPath",
            this.logPath,
        ];
        this.onLog(`engine ${action}…`);
        const code = await new Promise((resolve) => {
            const child = spawn(POWERSHELL, args, {
                cwd: this.engineRoot,
                windowsHide: true,
                stdio: "ignore",
            });
            const timer = setTimeout(() => {
                try {
                    child.kill();
                } catch {
                    // already gone
                }
                resolve(-1);
            }, timeoutMs);
            child.on("exit", (exitCode) => {
                clearTimeout(timer);
                resolve(exitCode ?? -1);
            });
            child.on("error", () => {
                clearTimeout(timer);
                resolve(-1);
            });
        });
        this.onLog(`engine ${action} exited ${code}`);
        return code;
    }

    /** Reads the engine's own config, tolerating the comments it writes. */
    readConfig() {
        const raw = readFileSync(this.configPath, "utf8").replace(
            /^\s*\/\/.*$/gm,
            "",
        );
        return JSON.parse(raw);
    }

    writeConfig(config) {
        writeFileSync(this.configPath, JSON.stringify(config, null, 2), "utf8");
    }

    get token() {
        return this.readConfig()?.gateway?.auth?.token ?? null;
    }

    /** Pins the port the suite listens on, without any other concession. */
    pinPort() {
        const config = this.readConfig();
        config.gateway = { ...(config.gateway ?? {}), port: this.port };
        this.writeConfig(config);
    }

    /** True once the gateway answers any HTTP request at all (liveness). */
    async isHttpAnswering() {
        try {
            // Any status at all counts: 401 and 404 both prove a listener is there.
            await fetch(`${this.httpOrigin}/`, {
                signal: AbortSignal.timeout(2500),
            });
            return true;
        } catch {
            return false;
        }
    }

    /** Readiness as the engine itself reports it. */
    async readReadiness() {
        try {
            const response = await fetch(`${this.httpOrigin}/ready`, {
                signal: AbortSignal.timeout(2500),
            });
            let body = null;
            try {
                body = await response.json();
            } catch {
                body = null;
            }
            return { status: response.status, body };
        } catch {
            return { status: 0, body: null };
        }
    }

    async cleanup() {
        await this.runAction("uninstall", 120_000);
        this.#schtasks(["/Delete", "/F", "/TN", this.taskName]);
    }

    #schtasks(args) {
        const schtasks = join(
            process.env.SystemRoot ?? "C:\\Windows",
            "System32",
            "schtasks.exe",
        );
        try {
            spawnSync(schtasks, args, { windowsHide: true, stdio: "ignore" });
        } catch {
            // Nothing to delete is the normal case.
        }
    }
}
