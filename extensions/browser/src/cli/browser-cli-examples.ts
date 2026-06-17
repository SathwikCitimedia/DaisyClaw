/**
 * Help examples shown by the Browser CLI root command.
 */
/** Core Browser CLI examples for lifecycle and inspection commands. */
export const browserCoreExamples = [
  "daisyclaw browser status",
  "daisyclaw browser start",
  "daisyclaw browser start --headless",
  "daisyclaw browser stop",
  "daisyclaw browser tabs",
  "daisyclaw browser open https://example.com",
  "daisyclaw browser focus abcd1234",
  "daisyclaw browser close abcd1234",
  "daisyclaw browser screenshot",
  "daisyclaw browser screenshot --full-page",
  "daisyclaw browser screenshot --ref 12",
  "daisyclaw browser snapshot",
  "daisyclaw browser snapshot --format aria --limit 200",
  "daisyclaw browser snapshot --efficient",
  "daisyclaw browser snapshot --labels",
];

/** Browser CLI examples for interaction/action commands. */
export const browserActionExamples = [
  "daisyclaw browser navigate https://example.com",
  "daisyclaw browser resize 1280 720",
  "daisyclaw browser click 12 --double",
  "daisyclaw browser click-coords 120 340",
  'daisyclaw browser type 23 "hello" --submit',
  "daisyclaw browser press Enter",
  "daisyclaw browser hover 44",
  "daisyclaw browser drag 10 11",
  "daisyclaw browser select 9 OptionA OptionB",
  "daisyclaw browser upload /tmp/daisyclaw/uploads/file.pdf",
  "daisyclaw browser upload media://inbound/file.pdf",
  'daisyclaw browser fill --fields \'[{"ref":"1","value":"Ada"}]\'',
  "daisyclaw browser dialog --accept",
  'daisyclaw browser wait --text "Done"',
  "daisyclaw browser evaluate --fn '(el) => el.textContent' --ref 7",
  "daisyclaw browser evaluate --fn 'const title = document.title; return title;'",
  "daisyclaw browser console --level error",
  "daisyclaw browser pdf",
];
