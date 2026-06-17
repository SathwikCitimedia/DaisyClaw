// Qa Lab plugin module implements temp dir helper behavior.
import {
  tempWorkspace,
  resolvePreferredDaisyClawTmpDir,
  type TempWorkspace,
} from "daisyclaw/plugin-sdk/temp-path";

export function createTempDirHarness() {
  const tempDirs: TempWorkspace[] = [];

  return {
    cleanup: async () => {
      await Promise.all(tempDirs.splice(0).map((dir) => dir.cleanup()));
    },
    makeTempDir: async (prefix: string) => {
      const dir = await tempWorkspace({
        rootDir: resolvePreferredDaisyClawTmpDir(),
        prefix,
      });
      tempDirs.push(dir);
      return dir.dir;
    },
  };
}
