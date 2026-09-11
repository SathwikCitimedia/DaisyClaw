// Control UI chat module implements history limits behavior.
export const CHAT_HISTORY_RENDER_LIMIT = 100;
/**
 * Ceiling for the scroll-back window. The view still starts at a small window
 * and grows in batches as the user scrolls up; this only stops the cap itself
 * from clipping history the gateway already sent, which used to strand the
 * transcript ~100 messages back with no way to reach anything older.
 */
export const CHAT_HISTORY_RENDER_LIMIT_MAX = 1000;
export const CHAT_HISTORY_RENDER_CHAR_BUDGET = 240_000;
