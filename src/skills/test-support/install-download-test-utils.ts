// Install download test utilities provide isolated state and workspace paths.
import {
  createDaisyClawTestState,
  type DaisyClawTestState,
} from "../../test-utils/daisyclaw-test-state.js";

/** Creates isolated DaisyClaw state for install download tests. */
export async function createInstallDownloadTestState(): Promise<DaisyClawTestState> {
  return await createDaisyClawTestState({
    layout: "state-only",
    prefix: "daisyclaw-skills-install-",
  });
}
