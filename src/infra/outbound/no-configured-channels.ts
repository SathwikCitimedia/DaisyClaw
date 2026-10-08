// The error raised when no chat app is set up at all, kept apart from channel
// selection so callers can recognise it without loading every channel plugin.

export const NO_CONFIGURED_CHANNELS_LEAD = "Channel is required (no configured channels detected).";

/**
 * True for the error raised when no chat app is set up at all, as opposed to a
 * wrong or ambiguous target. Callers with another way to reach the user, like
 * the Daisy chat, can take that way instead of failing.
 */
export function isNoConfiguredChannelsMessage(message: string | undefined): boolean {
  return typeof message === "string" && message.includes(NO_CONFIGURED_CHANNELS_LEAD);
}
