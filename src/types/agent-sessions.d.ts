// Declares extension points for agent session type augmentation.
export type DaisyClawAgentSessionSkillSourceAugmentation = never;

declare module "daisyclaw/plugin-sdk/agent-sessions" {
  interface Skill {
    // DaisyClaw relies on the source identifier returned by skill loaders.
    source: string;
  }
}
