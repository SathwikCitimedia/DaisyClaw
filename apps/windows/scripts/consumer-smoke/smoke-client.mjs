// A real WebSocket gateway client, shaped exactly like the one the Control UI
// controllers are handed: `request(method, params, opts)` resolves the payload
// and rejects with an error carrying the gateway's message.
//
// It connects as the Control UI, because that is who runs these controllers in
// the product. The dashboard signs a device identity in the browser, which a
// script cannot produce, so the suite's engine is configured to accept
// token-only operator auth from localhost. That concession covers how the
// connection is authorised and nothing else: every request below is the
// product's own code path.
import WebSocket from "ws";

const CONNECT_PROTOCOL = 4;
const OPERATOR_SCOPES = [
    "operator.admin",
    "operator.read",
    "operator.write",
    "operator.approvals",
    "operator.pairing",
];

export class SmokeGatewayError extends Error {
    constructor(error) {
        super(error?.message ?? "request failed");
        this.name = "SmokeGatewayError";
        this.code = error?.code ?? "UNAVAILABLE";
        this.details = error?.details;
        this.retryable = error?.retryable === true;
        this.retryAfterMs = error?.retryAfterMs;
    }
}

/**
 * Opens one connection. Rejects when the gateway refuses the handshake, which
 * is what a still-starting gateway does, so callers can retry.
 */
export function connectSmokeClient(params) {
    const { url, token, instanceId = "consumer-smoke" } = params;
    const origin = url.replace(/^ws/, "http").replace(/\/$/, "");
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(url, {
            origin,
            headers: { Origin: origin },
        });
        const pending = new Map();
        let nextId = 1;
        let settled = false;

        const fail = (err) => {
            if (!settled) {
                settled = true;
                reject(err);
            }
        };

        const client = {
            url,
            request(method, requestParams, opts) {
                const timeoutMs = opts?.timeoutMs ?? 45_000;
                const id = `smoke-${nextId++}`;
                return new Promise((resolveRequest, rejectRequest) => {
                    const timer = setTimeout(() => {
                        pending.delete(id);
                        rejectRequest(
                            new SmokeGatewayError({
                                message: `timeout after ${timeoutMs}ms`,
                            }),
                        );
                    }, timeoutMs);
                    pending.set(id, (frame) => {
                        clearTimeout(timer);
                        if (frame.ok) {
                            resolveRequest(frame.payload);
                            return;
                        }
                        rejectRequest(new SmokeGatewayError(frame.error));
                    });
                    try {
                        socket.send(
                            JSON.stringify({
                                type: "req",
                                id,
                                method,
                                params: requestParams,
                            }),
                        );
                    } catch (err) {
                        clearTimeout(timer);
                        pending.delete(id);
                        rejectRequest(err);
                    }
                });
            },
            close() {
                try {
                    socket.close();
                } catch {
                    // already closing
                }
            },
        };

        socket.on("message", (data) => {
            let frame;
            try {
                frame = JSON.parse(String(data));
            } catch {
                return;
            }
            if (
                (frame.type === "res" || frame.type === "err") &&
                pending.has(frame.id)
            ) {
                const handler = pending.get(frame.id);
                pending.delete(frame.id);
                handler(frame);
            }
        });
        socket.on("error", (err) => fail(err));
        socket.on("close", (code, reason) => {
            for (const [id, handler] of pending) {
                pending.delete(id);
                handler({
                    ok: false,
                    error: { message: `socket closed (${code})` },
                });
            }
            fail(
                new Error(
                    `socket closed before connect (${code}): ${String(reason ?? "")}`,
                ),
            );
        });
        socket.on("open", () => {
            client
                .request(
                    "connect",
                    {
                        minProtocol: CONNECT_PROTOCOL,
                        maxProtocol: CONNECT_PROTOCOL,
                        client: {
                            id: "daisyclaw-control-ui",
                            version: "consumer-smoke",
                            platform: process.platform,
                            mode: "webchat",
                            instanceId,
                        },
                        role: "operator",
                        scopes: OPERATOR_SCOPES,
                        caps: ["tool-events"],
                        auth: { token },
                        userAgent: "daisyclaw-consumer-smoke",
                        locale: "en",
                    },
                    { timeoutMs: 20_000 },
                )
                .then(() => {
                    if (!settled) {
                        settled = true;
                        resolve(client);
                    }
                })
                .catch((err) => {
                    client.close();
                    fail(err);
                });
        });
    });
}

/**
 * Retries until the gateway accepts a connection. Returns the client and how
 * long the wait took, so a check can assert on the startup window.
 */
export async function waitForSmokeClient(params) {
    const { url, token, timeoutMs = 240_000, onAttempt } = params;
    const startedAt = Date.now();
    let lastError = null;
    while (Date.now() - startedAt < timeoutMs) {
        try {
            const client = await connectSmokeClient({ url, token });
            return { client, waitedMs: Date.now() - startedAt };
        } catch (err) {
            lastError = err;
            onAttempt?.(err, Date.now() - startedAt);
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }
    throw new Error(
        `gateway never accepted a connection within ${Math.round(timeoutMs / 1000)}s: ${
            lastError instanceof Error ? lastError.message : String(lastError)
        }`,
    );
}
