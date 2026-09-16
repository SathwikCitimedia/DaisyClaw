// Whether this Control UI bundle was built for the packaged consumer product.
//
// The Daisy Assistant installer builds the UI with
// DAISYCLAW_CONSUMER_LOCKDOWN_BAKED=1 (the same flag that locks the engine), and
// Vite inlines it as DAISYCLAW_CONTROL_UI_CONSUMER_BUILD. A consumer never logs
// in by hand: the desktop app carries the credentials, so screens that ask for
// a gateway address, token, or terminal command have no audience there and are
// replaced by plain cards. Dev builds and source runs leave the flag unset and
// keep the full developer surfaces.
declare const DAISYCLAW_CONTROL_UI_CONSUMER_BUILD: boolean | undefined;

export function isConsumerBuild(): boolean {
  return (
    typeof DAISYCLAW_CONTROL_UI_CONSUMER_BUILD !== "undefined" &&
    DAISYCLAW_CONTROL_UI_CONSUMER_BUILD === true
  );
}
