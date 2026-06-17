// OC Path module implements cli registration behavior.
import type { DaisyClawPluginApi } from "daisyclaw/plugin-sdk/plugin-entry";

export function registerOcPathCli(api: DaisyClawPluginApi): void {
  api.registerCli(
    async ({ program }) => {
      const { registerPathCli } = await import("./src/cli.js");
      registerPathCli(program);
    },
    {
      descriptors: [
        {
          name: "path",
          description: "Inspect and edit workspace files via oc:// paths",
          hasSubcommands: true,
        },
      ],
    },
  );
}
