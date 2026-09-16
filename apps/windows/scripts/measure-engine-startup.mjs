// Boots the shipped engine in an isolated state dir on a free port with the
// startup trace on, and reports where the time goes.
//
// Usage:  node apps/windows/scripts/measure-engine-startup.mjs [cold|warm]
//   cold  wipes the probe state dir first (fresh config, first-run work)
//   warm  reuses it (models every later start)
//
// Note: this cannot model a real first start after install, where Windows is
// also reading and scanning 650 MB of freshly written engine files for the
// first time. Expect the laptop's first start to be several times slower than
// a cold run here.
//
// Safe by construction: its own free port and its own state directory, and it
// runs `gateway run` directly, so it never touches the gateway on 18789 or any
// scheduled task on this machine.
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../../..");
const engineRoot = join(repoRoot, "apps", "windows", "engine-x64");
const nodeExe = join(engineRoot, "node.exe");
const entry = join(engineRoot, "dist", "index.js");
const label = process.argv[2] ?? "cold";
const stateDir = join(repoRoot, ".artifacts", "engine-startup", "state");
const outFile = join(repoRoot, ".artifacts", "engine-startup", `startup-${label}.log`);

function freePort() {
    return new Promise((res, rej) => {
        const s = createServer();
        s.on("error", rej);
        s.listen(0, "127.0.0.1", () => {
            const p = s.address().port;
            s.close(() => res(p));
        });
    });
}

if (label === "cold" && existsSync(stateDir)) rmSync(stateDir, { recursive: true, force: true });
mkdirSync(stateDir, { recursive: true });
const port = await freePort();
if (port === 18789) throw new Error("refusing to use the dev gateway port");
const token = "perf-probe-token-0000000000";
if (label === "cold") {
    writeFileSync(
        join(stateDir, "daisyclaw.json"),
        JSON.stringify({ gateway: { mode: "local", port, bind: "loopback", auth: { mode: "token", token } } }, null, 2),
    );
} else {
    const cfg = JSON.parse(readFileSync(join(stateDir, "daisyclaw.json"), "utf8").replace(/^\s*\/\/.*$/gm, ""));
    cfg.gateway.port = port;
    writeFileSync(join(stateDir, "daisyclaw.json"), JSON.stringify(cfg, null, 2));
}

const chunks = [];
const t0 = Date.now();
const child = spawn(nodeExe, [entry, "gateway", "run", "--port", String(port)], {
    cwd: engineRoot,
    windowsHide: true,
    env: {
        ...process.env,
        DAISYCLAW_STATE_DIR: stateDir,
        DAISYCLAW_GATEWAY_STARTUP_TRACE: "1",
        DAISYCLAW_PROFILE: "",
        DAISYCLAW_CONFIG_PATH: "",
    },
});
child.stdout.on("data", (d) => chunks.push(d.toString()));
child.stderr.on("data", (d) => chunks.push(d.toString()));

let httpAt = null;
let readyAt = null;
const deadline = t0 + 300_000;
while (Date.now() < deadline) {
    try {
        const res = await fetch(`http://127.0.0.1:${port}/ready`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        httpAt ??= Date.now();
        if (res.status === 200) { readyAt = Date.now(); break; }
    } catch { /* not listening yet */ }
    await new Promise((r) => setTimeout(r, 250));
}
const out = chunks.join("");
mkdirSync(join(repoRoot, ".artifacts", "engine-startup"), { recursive: true });
writeFileSync(outFile, out);
try { child.kill(); } catch { /* gone */ }

console.log(`run=${label} port=${port}`);
console.log(`  http answered : ${httpAt ? ((httpAt - t0) / 1000).toFixed(1) + "s" : "never"}`);
console.log(`  /ready 200    : ${readyAt ? ((readyAt - t0) / 1000).toFixed(1) + "s" : "never"}`);
const traces = out.split(/\r?\n/).filter((l) => l.includes("startup trace:"));
console.log(`  trace lines   : ${traces.length} (full log: ${outFile})`);
const parsed = traces
    .map((l) => l.match(/startup trace: (\S+) ([\d.]+)ms total=([\d.]+)ms/))
    .filter(Boolean)
    .map((m) => ({ name: m[1], ms: Number(m[2]), total: Number(m[3]) }));
parsed.sort((a, b) => b.ms - a.ms);
for (const p of parsed.slice(0, 14)) {
    console.log(`  ${p.ms.toFixed(0).padStart(7)} ms  ${p.name}`);
}
