// Control UI chat module orchestrates submitting an edited user turn.
//
// Editing a message means: fork the session so history ends just before that
// message, hide the old turn (and the reply it produced), and send the edited
// text as a fresh query. The order matters. Hiding is persisted locally and the
// fork is a gateway call that can fail; hiding first and forking second left
// the user with an empty thread and a toast when the fork was rejected (seen
// with "unknown method: sessions.forkFromMessage" on a stale gateway). So the
// fork goes first, the old turn disappears only once the gateway has accepted
// it, and a failure hands the text back to the editor with the reason.

export type EditForkTarget = { messageId?: string; lastUser?: boolean };

export type EditForkResult = { ok: true } | { ok: false; error: string };

export type EditForkHooks = {
  /** Called once the gateway accepted the fork, before the edited text is sent. */
  onForked: () => void;
};

export type EditFork = (
  target: EditForkTarget,
  text: string,
  hooks: EditForkHooks,
) => Promise<EditForkResult>;

export type SubmitEditedTurnParams = {
  text: string;
  /** Null when the message cannot be forked (no transcript id and not the last user turn). */
  target: EditForkTarget | null;
  fork?: EditFork;
  /** Fallback when no fork is available: send the text as a new message. */
  sendText?: (text: string) => void;
  /** Last resort: put the text in the composer for the user to send. */
  draftChange: (text: string) => void;
  /** Hide the edited turn and everything it produced. */
  hide: () => void;
  /** Show progress on the bubble while the fork and send run. */
  setBusy: (busy: boolean) => void;
  /** Reopen the editor with the text and an explanation. */
  onFailure: (text: string, error: string) => void;
};

export function describeEditFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const trimmed = message.trim();
  if (!trimmed) {
    return "Unknown error";
  }
  return trimmed.replace(/^GatewayRequestError:\s*/i, "");
}

export async function submitEditedTurn(params: SubmitEditedTurnParams): Promise<boolean> {
  const { text } = params;
  if (params.fork && params.target) {
    params.setBusy(true);
    let hidden = false;
    let result: EditForkResult;
    try {
      result = await params.fork(params.target, text, {
        onForked: () => {
          if (!hidden) {
            hidden = true;
            params.hide();
          }
        },
      });
    } catch (err) {
      result = { ok: false, error: describeEditFailure(err) };
    } finally {
      params.setBusy(false);
    }
    if (result.ok) {
      return true;
    }
    // Nothing was hidden, nothing was sent: give the words back.
    params.onFailure(text, result.error);
    return false;
  }

  // No server-side fork possible: behave like a plain resend.
  params.hide();
  if (params.sendText) {
    params.sendText(text);
  } else {
    params.draftChange(text);
  }
  return true;
}
