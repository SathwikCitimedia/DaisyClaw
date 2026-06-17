/**
 * Hosts the local DaisyClaw sandbox exec-server that Codex app-server native
 * execution can register as an external environment.
 */
import { createHash, randomUUID } from "node:crypto";
import { once } from "node:events";
import type { IncomingMessage } from "node:http";
import { isIP, type AddressInfo } from "node:net";
import { embeddedAgentLog } from "daisyclaw/plugin-sdk/agent-harness-runtime";
import type { SandboxContext } from "daisyclaw/plugin-sdk/sandbox";
import { WebSocketServer, type RawData, type WebSocket } from "ws";
import { compareCodexAppServerVersions, type CodexAppServerClient } from "./client.js";
import type { CodexAppServerStartOptions } from "./config.js";
import type { JsonValue } from "./protocol.js";
import {
  createDirectory,
  copyPath,
  getMetadata,
  readDirectory,
  readFile,
  removePath,
  writeFile,
} from "./sandbox-exec-server/filesystem.js";
import { httpRequest } from "./sandbox-exec-server/http.js";
import {
  JsonRpcProtocolError,
  parseRequest,
  sendError,
  sendResult,
} from "./sandbox-exec-server/json-rpc.js";
import {
  readProcess,
  startProcess,
  terminateProcess,
  writeProcess,
} from "./sandbox-exec-server/processes.js";
import type {
  JsonRpcRequest,
  ManagedProcess,
  DaisyClawExecServer,
} from "./sandbox-exec-server/types.js";
import { MIN_CODEX_SANDBOX_EXEC_SERVER_APP_SERVER_VERSION } from "./version.js";

/** Codex environment metadata registered for one sandbox exec-server lease. */
export type CodexSandboxExecEnvironment = {
  environmentId: string;
  cwd: string;
};

const SANDBOX_EXEC_SERVERS = new Map<string, Promise<DaisyClawExecServer>>();

/** Closes all cached sandbox exec-server instances for deterministic tests. */
export async function closeCodexSandboxExecServersForTests(): Promise<void> {
  const servers = await Promise.allSettled(SANDBOX_EXEC_SERVERS.values());
  SANDBOX_EXEC_SERVERS.clear();
  await Promise.all(
    servers.map(async (entry) => {
      if (entry.status === "fulfilled") {
        entry.value.refCount = 0;
        await closeDaisyClawExecServer(entry.value);
      }
    }),
  );
}

/** Starts or reuses a sandbox exec-server and registers it with Codex app-server. */
export async function ensureCodexSandboxExecServerEnvironment(params: {
  client: CodexAppServerClient;
  sandbox: SandboxContext | null;
  appServerStartOptions?: CodexAppServerStartOptions;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<CodexSandboxExecEnvironment | undefined> {
  if (!params.sandbox?.enabled || !params.sandbox.backend) {
    return undefined;
  }
  if (!canExposeLocalExecServerToAppServer(params.appServerStartOptions)) {
    throw new Error(
      "DaisyClaw Codex exec-server uses a local loopback URL and cannot be registered with a remote Codex app-server.",
    );
  }
  assertCodexSandboxExecServerSupported(params.client);
  const execServer = await acquireDaisyClawExecServer(params.sandbox);
  try {
    await params.client.request(
      "environment/add",
      {
        environmentId: execServer.environmentId,
        execServerUrl: execServer.url,
      },
      { timeoutMs: params.timeoutMs, signal: params.signal },
    );
  } catch (error) {
    await releaseDaisyClawExecServer(execServer);
    if (isEnvironmentAddUnsupported(error)) {
      embeddedAgentLog.warn("codex app-server does not support remote environments yet", {
        environmentId: execServer.environmentId,
      });
      return undefined;
    }
    throw error;
  }
  return {
    environmentId: execServer.environmentId,
    cwd: params.sandbox.containerWorkdir,
  };
}

/** Releases the sandbox exec-server lease associated with a sandbox runtime. */
export async function releaseCodexSandboxExecServerEnvironment(
  sandbox: SandboxContext | null | undefined,
): Promise<void> {
  if (!sandbox?.enabled) {
    return;
  }
  const server = await SANDBOX_EXEC_SERVERS.get(sandbox.runtimeId)?.catch(() => undefined);
  if (server) {
    await releaseDaisyClawExecServer(server);
  }
}

function assertCodexSandboxExecServerSupported(client: CodexAppServerClient): void {
  const detectedVersion = client.getServerVersion();
  if (
    !detectedVersion ||
    compareCodexAppServerVersions(
      detectedVersion,
      MIN_CODEX_SANDBOX_EXEC_SERVER_APP_SERVER_VERSION,
    ) < 0
  ) {
    throw new Error(
      `Codex app-server ${MIN_CODEX_SANDBOX_EXEC_SERVER_APP_SERVER_VERSION} or newer is required for DaisyClaw sandbox exec-server environments, but detected ${
        detectedVersion ?? "an unknown version"
      }. Disable appServer.experimental.sandboxExecServer or configure a newer Codex app-server binary.`,
    );
  }
}

function isEnvironmentAddUnsupported(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    error.message.includes("environment/add") &&
    (error.message.includes("unknown variant") || error.message.includes("Method not found"))
  );
}

function canExposeLocalExecServerToAppServer(
  startOptions: CodexAppServerStartOptions | undefined,
): boolean {
  if (!startOptions || startOptions.transport !== "websocket") {
    return true;
  }
  if (typeof startOptions.url !== "string") {
    return false;
  }
  try {
    const host = new URL(startOptions.url).hostname.toLowerCase();
    const ipHost = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
    if (host === "localhost" || ipHost === "::1") {
      return true;
    }
    return isIP(ipHost) === 4 && ipHost.split(".")[0] === "127";
  } catch {
    return false;
  }
}

async function acquireDaisyClawExecServer(sandbox: SandboxContext): Promise<DaisyClawExecServer> {
  const key = sandbox.runtimeId;
  while (true) {
    const existing = SANDBOX_EXEC_SERVERS.get(key);
    const promise = existing ?? startAndRememberDaisyClawExecServer(sandbox);
    const server = await promise;
    if (!server.closed && SANDBOX_EXEC_SERVERS.get(key) === promise) {
      server.refCount += 1;
      return server;
    }
  }
}

function startAndRememberDaisyClawExecServer(sandbox: SandboxContext): Promise<DaisyClawExecServer> {
  const created = startDaisyClawExecServer(sandbox);
  const key = sandbox.runtimeId;
  SANDBOX_EXEC_SERVERS.set(key, created);
  void created.catch(() => {
    if (SANDBOX_EXEC_SERVERS.get(key) === created) {
      SANDBOX_EXEC_SERVERS.delete(key);
    }
  });
  return created;
}

async function startDaisyClawExecServer(sandbox: SandboxContext): Promise<DaisyClawExecServer> {
  const server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("DaisyClaw Codex exec-server did not bind to a TCP port.");
  }
  const environmentId = buildEnvironmentId(sandbox);
  const authPath = `/daisyclaw-${randomUUID()}`;
  const url = `ws://127.0.0.1:${(address as AddressInfo).port}${authPath}`;
  const execServer: DaisyClawExecServer = {
    authPath,
    closed: false,
    environmentId,
    refCount: 0,
    url,
    sandbox,
    server,
  };
  server.on("connection", (socket, request) => {
    if (!isAuthorizedExecServerRequest(execServer, request)) {
      socket.close(1008, "unauthorized");
      return;
    }
    handleConnection(execServer, socket);
  });
  embeddedAgentLog.info("codex sandbox exec-server started", {
    environmentId,
    runtimeId: sandbox.runtimeId,
    backendId: sandbox.backendId,
  });
  return execServer;
}

async function releaseDaisyClawExecServer(execServer: DaisyClawExecServer): Promise<void> {
  if (execServer.closed) {
    return;
  }
  execServer.refCount = Math.max(0, execServer.refCount - 1);
  if (execServer.refCount > 0) {
    return;
  }
  const current = await SANDBOX_EXEC_SERVERS.get(execServer.sandbox.runtimeId)?.catch(
    () => undefined,
  );
  if (execServer.refCount > 0 || execServer.closed) {
    return;
  }
  if (current === execServer) {
    SANDBOX_EXEC_SERVERS.delete(execServer.sandbox.runtimeId);
  }
  await closeDaisyClawExecServer(execServer);
}

async function closeDaisyClawExecServer(execServer: DaisyClawExecServer): Promise<void> {
  if (execServer.closed) {
    return;
  }
  execServer.closed = true;
  for (const client of execServer.server.clients) {
    client.close(1001, "shutdown");
  }
  await new Promise<void>((resolve) => {
    execServer.server.close(() => resolve());
  });
}

function buildEnvironmentId(sandbox: SandboxContext): string {
  const hash = createHash("sha256").update(sandbox.runtimeId).digest("hex").slice(0, 16);
  return `daisyclaw-sandbox-${hash}`;
}

function isAuthorizedExecServerRequest(
  execServer: DaisyClawExecServer,
  request: IncomingMessage,
): boolean {
  const url = new URL(request.url ?? "", "ws://127.0.0.1");
  return url.pathname === execServer.authPath;
}

function handleConnection(execServer: DaisyClawExecServer, socket: WebSocket): void {
  const processes = new Map<string, ManagedProcess>();
  socket.on("message", (data) => {
    void handleMessage(execServer, processes, socket, data).catch((error: unknown) => {
      embeddedAgentLog.warn("codex sandbox exec-server message failed", { error });
    });
  });
  socket.on("close", () => {
    for (const process of processes.values()) {
      process.abortController.abort();
    }
  });
}

async function handleMessage(
  execServer: DaisyClawExecServer,
  processes: Map<string, ManagedProcess>,
  socket: WebSocket,
  data: RawData,
): Promise<void> {
  const request = parseRequest(data);
  if (!request.method) {
    sendError(socket, request.id, -32600, "Invalid Request");
    return;
  }
  const method = request.method;
  if (request.id === undefined) {
    if (method !== "initialized") {
      sendError(socket, -1, -32600, `Unexpected notification: ${method}`);
    }
    return;
  }
  try {
    const result = await dispatchRequest(execServer, processes, socket, { ...request, method });
    sendResult(socket, request.id, result);
  } catch (error) {
    sendError(
      socket,
      request.id,
      error instanceof JsonRpcProtocolError ? error.code : -32603,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function dispatchRequest(
  execServer: DaisyClawExecServer,
  processes: Map<string, ManagedProcess>,
  socket: WebSocket,
  request: Required<Pick<JsonRpcRequest, "method">> & Pick<JsonRpcRequest, "id" | "params">,
): Promise<JsonValue | undefined> {
  switch (request.method) {
    case "initialize":
      return { sessionId: randomUUID() };
    // These method names are the Codex exec-server remote-environment RPCs.
    // The app-server process-control surface uses different names such as
    // process/spawn, but those are not sent to registered exec-server URLs.
    case "process/start":
      return startProcess(execServer, processes, socket, request.params);
    case "process/read":
      return await readProcess(processes, request.params);
    case "process/write":
      return writeProcess(processes, request.params);
    case "process/terminate":
      return terminateProcess(processes, request.params);
    case "fs/readFile":
      return await readFile(execServer, request.params);
    case "fs/writeFile":
      await writeFile(execServer, request.params);
      return {};
    case "fs/createDirectory":
      await createDirectory(execServer, request.params);
      return {};
    case "fs/getMetadata":
      return await getMetadata(execServer, request.params);
    case "fs/readDirectory":
      return await readDirectory(execServer, request.params);
    case "fs/remove":
      await removePath(execServer, request.params);
      return {};
    case "fs/copy":
      await copyPath(execServer, request.params);
      return {};
    case "http/request":
      return await httpRequest(execServer, socket, request.params);
    default:
      throw new Error(`Unsupported DaisyClaw sandbox exec-server method: ${request.method}`);
  }
}
