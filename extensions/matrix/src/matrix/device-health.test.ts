// Matrix tests cover device health plugin behavior.
import { describe, expect, it } from "vitest";
import { isDaisyClawManagedMatrixDevice, summarizeMatrixDeviceHealth } from "./device-health.js";

describe("matrix device health", () => {
  it("detects DaisyClaw-managed device names", () => {
    expect(isDaisyClawManagedMatrixDevice("DaisyClaw Gateway")).toBe(true);
    expect(isDaisyClawManagedMatrixDevice("DaisyClaw Debug")).toBe(true);
    expect(isDaisyClawManagedMatrixDevice("Element iPhone")).toBe(false);
    expect(isDaisyClawManagedMatrixDevice(null)).toBe(false);
  });

  it("summarizes stale DaisyClaw-managed devices separately from the current device", () => {
    const summary = summarizeMatrixDeviceHealth([
      {
        deviceId: "du314Zpw3A",
        displayName: "DaisyClaw Gateway",
        current: true,
      },
      {
        deviceId: "BritdXC6iL",
        displayName: "DaisyClaw Gateway",
        current: false,
      },
      {
        deviceId: "G6NJU9cTgs",
        displayName: "DaisyClaw Debug",
        current: false,
      },
      {
        deviceId: "phone123",
        displayName: "Element iPhone",
        current: false,
      },
    ]);

    expect(summary).toEqual({
      currentDeviceId: "du314Zpw3A",
      currentDaisyClawDevices: [
        {
          deviceId: "du314Zpw3A",
          displayName: "DaisyClaw Gateway",
          current: true,
        },
      ],
      staleDaisyClawDevices: [
        {
          deviceId: "BritdXC6iL",
          displayName: "DaisyClaw Gateway",
          current: false,
        },
        {
          deviceId: "G6NJU9cTgs",
          displayName: "DaisyClaw Debug",
          current: false,
        },
      ],
    });
  });
});
