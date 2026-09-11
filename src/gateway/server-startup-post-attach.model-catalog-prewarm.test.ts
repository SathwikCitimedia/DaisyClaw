// The model catalog prewarm sidecar moves the slow first catalog build off the
// first client request, so a freshly started gateway can answer models.list
// inside client timeouts (the Windows app waits 10s).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadGatewayModelCatalog: vi.fn(async () => [{ id: "m1" }, { id: "m2" }]),
  repairUntitledControlSessions: vi.fn(async () => ({ scanned: 3, repaired: 2 })),
}));

vi.mock("./server-model-catalog.js", () => ({
  loadGatewayModelCatalog: mocks.loadGatewayModelCatalog,
}));

vi.mock("./session-title-repair.js", () => ({
  repairUntitledControlSessions: mocks.repairUntitledControlSessions,
}));

const { testing } = await import("./server-startup-post-attach.js");

function createLog() {
  return { info: vi.fn(), warn: vi.fn() };
}

describe("scheduleModelCatalogPrewarm", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.loadGatewayModelCatalog.mockClear();
    mocks.loadGatewayModelCatalog.mockImplementation(async () => [{ id: "m1" }, { id: "m2" }]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds the catalog after the startup delay and reports the model count", async () => {
    const log = createLog();
    testing.scheduleModelCatalogPrewarm({ log, delayMs: 10 });

    expect(mocks.loadGatewayModelCatalog).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(10);
    await vi.waitFor(() => expect(log.info).toHaveBeenCalled());

    expect(mocks.loadGatewayModelCatalog).toHaveBeenCalledTimes(1);
    expect(log.info.mock.calls[0]?.[0]).toContain("model catalog pre-warmed");
    expect(log.info.mock.calls[0]?.[0]).toContain("2 models");
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("does not run when stopped before the delay elapses", async () => {
    const log = createLog();
    const handle = testing.scheduleModelCatalogPrewarm({ log, delayMs: 10 });

    handle.stop();
    await vi.advanceTimersByTimeAsync(50);

    expect(mocks.loadGatewayModelCatalog).not.toHaveBeenCalled();
    expect(log.info).not.toHaveBeenCalled();
  });

  it("logs and swallows catalog failures so startup is never blocked", async () => {
    mocks.loadGatewayModelCatalog.mockRejectedValueOnce(new Error("catalog boom"));
    const log = createLog();
    testing.scheduleModelCatalogPrewarm({ log, delayMs: 10 });

    await vi.advanceTimersByTimeAsync(10);
    await vi.waitFor(() => expect(log.warn).toHaveBeenCalled());

    expect(log.warn.mock.calls[0]?.[0]).toContain("model catalog pre-warm failed");
    expect(log.warn.mock.calls[0]?.[0]).toContain("catalog boom");
    expect(log.info).not.toHaveBeenCalled();
  });

  it("keeps the startup delay short enough to beat a 10s client timeout", () => {
    expect(testing.modelCatalogPrewarmStartDelayMs).toBeLessThan(10_000);
  });
});

describe("scheduleUntitledSessionTitleRepair", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.repairUntitledControlSessions.mockClear();
    mocks.repairUntitledControlSessions.mockResolvedValue({ scanned: 3, repaired: 2 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("repairs untitled chats after the delay and reports the count", async () => {
    const log = createLog();
    testing.scheduleUntitledSessionTitleRepair({
      getConfig: () => ({}) as never,
      log,
      delayMs: 10,
    });

    expect(mocks.repairUntitledControlSessions).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10);
    await vi.waitFor(() => expect(log.info).toHaveBeenCalled());

    expect(mocks.repairUntitledControlSessions).toHaveBeenCalledTimes(1);
    expect(log.info.mock.calls[0]?.[0]).toContain("2/3");
  });

  it("stays silent when nothing needed repair", async () => {
    mocks.repairUntitledControlSessions.mockResolvedValueOnce({ scanned: 0, repaired: 0 });
    const log = createLog();
    testing.scheduleUntitledSessionTitleRepair({
      getConfig: () => ({}) as never,
      log,
      delayMs: 10,
    });

    await vi.advanceTimersByTimeAsync(10);
    await vi.waitFor(() => expect(mocks.repairUntitledControlSessions).toHaveBeenCalled());
    await Promise.resolve();

    expect(log.info).not.toHaveBeenCalled();
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("does not run once stopped", async () => {
    const log = createLog();
    const handle = testing.scheduleUntitledSessionTitleRepair({
      getConfig: () => ({}) as never,
      log,
      delayMs: 10,
    });
    handle.stop();
    await vi.advanceTimersByTimeAsync(50);
    expect(mocks.repairUntitledControlSessions).not.toHaveBeenCalled();
  });
});
