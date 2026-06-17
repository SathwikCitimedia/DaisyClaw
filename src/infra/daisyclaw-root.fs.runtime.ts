// DaisyClaw root resolution imports fs through this facade so tests can replace
// filesystem behavior without mocking node:fs globally.
export { default as daisyClawRootFsSync } from "node:fs";
export { default as daisyClawRootFs } from "node:fs/promises";
