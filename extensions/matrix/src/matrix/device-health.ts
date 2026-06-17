// Matrix plugin module implements device health behavior.
export type MatrixManagedDeviceInfo = {
  deviceId: string;
  displayName: string | null;
  current: boolean;
};

export type MatrixDeviceHealthSummary = {
  currentDeviceId: string | null;
  staleDaisyClawDevices: MatrixManagedDeviceInfo[];
  currentDaisyClawDevices: MatrixManagedDeviceInfo[];
};

const DAISYCLAW_DEVICE_NAME_PREFIX = "DaisyClaw ";

export function isDaisyClawManagedMatrixDevice(displayName: string | null | undefined): boolean {
  return displayName?.startsWith(DAISYCLAW_DEVICE_NAME_PREFIX) === true;
}

export function summarizeMatrixDeviceHealth(
  devices: MatrixManagedDeviceInfo[],
): MatrixDeviceHealthSummary {
  const currentDeviceId = devices.find((device) => device.current)?.deviceId ?? null;
  const daisyClawDevices = devices.filter((device) =>
    isDaisyClawManagedMatrixDevice(device.displayName),
  );
  return {
    currentDeviceId,
    staleDaisyClawDevices: daisyClawDevices.filter((device) => !device.current),
    currentDaisyClawDevices: daisyClawDevices.filter((device) => device.current),
  };
}
