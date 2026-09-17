// Covers control-plane write rate-limit windows, stale bucket pruning, and
// hard bucket cap behavior.
import { afterEach, describe, expect, test } from "vitest";
import {
  consumeControlPlaneWriteBudget,
  pruneStaleControlPlaneBuckets,
  testing,
} from "./control-plane-rate-limit.js";

describe("control-plane-rate-limit", () => {
  afterEach(() => {
    testing.resetControlPlaneRateLimitState();
  });

  test("pruneStaleControlPlaneBuckets removes expired buckets (#63643)", () => {
    // Create buckets at different times
    const baseMs = 1_000_000;
    consumeControlPlaneWriteBudget({
      client: { connect: { device: { id: "dev-old" } }, clientIp: "1.2.3.4" } as never,
      nowMs: baseMs,
    });
    consumeControlPlaneWriteBudget({
      client: { connect: { device: { id: "dev-recent" } }, clientIp: "5.6.7.8" } as never,
      nowMs: baseMs + 4 * 60_000,
    });

    // Prune at baseMs + 6 minutes — "dev-old" is > 5 min stale, "dev-recent" is only 2 min
    const pruned = pruneStaleControlPlaneBuckets(baseMs + 6 * 60_000);
    expect(pruned).toBe(1);

    // "dev-recent" should still have budget
    const result = consumeControlPlaneWriteBudget({
      client: { connect: { device: { id: "dev-recent" } }, clientIp: "5.6.7.8" } as never,
      nowMs: baseMs + 6 * 60_000,
    });
    expect(result.allowed).toBe(true);
  });

  test("pruneStaleControlPlaneBuckets is safe on empty map", () => {
    expect(pruneStaleControlPlaneBuckets()).toBe(0);
  });

  test("control-plane bucket map stays bounded between prune sweeps", () => {
    const baseMs = 2_000_000;
    for (let i = 0; i < 10_001; i++) {
      consumeControlPlaneWriteBudget({
        client: {
          connect: { device: { id: `dev-${i}` } },
          clientIp: "1.2.3.4",
        } as never,
        nowMs: baseMs,
      });
    }

    expect(testing.getControlPlaneRateLimitBucketCount()).toBe(10_000);
  });
});

test("a setup session's worth of writes is allowed within one minute", () => {
  // Saving a key and choosing a model is two writes; a custom server two more;
  // a second provider or "Make default" a few more. The old limit of three
  // made the app tell its own user "rate limit exceeded ... retry after 21s".
  const client = { connect: { device: { id: "dev-setup" } }, clientIp: "127.0.0.1" } as never;
  let allowed = 0;
  for (let i = 0; i < 12; i++) {
    if (consumeControlPlaneWriteBudget({ client, nowMs: 5_000_000 + i * 1000 }).allowed) {
      allowed += 1;
    }
  }
  expect(allowed).toBe(12);
});
