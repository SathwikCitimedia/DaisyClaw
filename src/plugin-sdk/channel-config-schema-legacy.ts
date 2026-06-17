/**
 * @deprecated Compatibility surface for bundled channel schemas.
 *
 * DaisyClaw-maintained bundled plugins should import
 * daisyclaw/plugin-sdk/bundled-channel-config-schema. Third-party plugins should
 * define plugin-local schemas and import primitives from
 * daisyclaw/plugin-sdk/channel-config-schema instead of depending on bundled
 * channel schemas.
 */
export * from "./bundled-channel-config-schema.js";
