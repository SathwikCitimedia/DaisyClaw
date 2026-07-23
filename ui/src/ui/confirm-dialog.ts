// In-app confirmation dialog — replaces native window.confirm() so destructive
// actions get a styled modal instead of the browser alert box.

export type ConfirmDialogOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  /** Label shown on the confirm button while `onConfirm` runs (default "Working…"). */
  loadingLabel?: string;
  cancelLabel?: string;
  /** Style the confirm button as destructive (default true). */
  danger?: boolean;
  /**
   * Optional async work to run when the user confirms. While it runs the
   * confirm button shows a loading spinner and the dialog stays open (dismissal
   * is blocked). The dialog closes when it resolves; if it rejects the dialog
   * stays open so the user can retry or cancel.
   */
  onConfirm?: () => Promise<void>;
};

/**
 * Shows a modal confirmation dialog and resolves true when the user confirms.
 * Escape, backdrop click, and the cancel button all resolve false.
 *
 * When `onConfirm` is provided the promise resolves true only after that work
 * completes successfully (with the confirm button in a loading state), or false
 * if the user cancels.
 */
export function confirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "confirm-dialog";

    const panel = document.createElement("div");
    panel.className = "confirm-dialog__panel";

    const title = document.createElement("div");
    title.className = "confirm-dialog__title";
    title.textContent = options.title;

    const message = document.createElement("div");
    message.className = "confirm-dialog__message";
    message.textContent = options.message;

    const actions = document.createElement("div");
    actions.className = "confirm-dialog__actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn";
    cancelBtn.textContent = options.cancelLabel ?? "Cancel";

    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = options.danger === false ? "btn primary" : "btn danger";
    const confirmLabelText = options.confirmLabel ?? "OK";

    const confirmLabel = document.createElement("span");
    confirmLabel.className = "confirm-dialog__confirm-label";
    confirmLabel.textContent = confirmLabelText;
    const spinner = document.createElement("span");
    spinner.className = "confirm-dialog__spinner";
    spinner.setAttribute("aria-hidden", "true");
    confirmBtn.append(spinner, confirmLabel);

    actions.append(cancelBtn, confirmBtn);
    panel.append(title, message, actions);
    dialog.append(panel);

    let settled = false;
    let loading = false;

    const finish = (result: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(result);
      if (dialog.open) {
        dialog.close();
      }
    };

    const setLoading = (value: boolean) => {
      loading = value;
      confirmBtn.disabled = value;
      cancelBtn.disabled = value;
      confirmBtn.classList.toggle("confirm-dialog__confirm--loading", value);
      confirmLabel.textContent = value ? (options.loadingLabel ?? "Working…") : confirmLabelText;
    };

    const onConfirmClick = async () => {
      if (loading) {
        return;
      }
      if (!options.onConfirm) {
        finish(true);
        return;
      }
      setLoading(true);
      try {
        await options.onConfirm();
        finish(true);
      } catch {
        // Keep the dialog open so the user can retry or cancel.
        setLoading(false);
      }
    };

    cancelBtn.addEventListener("click", () => {
      if (!loading) {
        finish(false);
      }
    });
    confirmBtn.addEventListener("click", () => {
      void onConfirmClick();
    });
    // Escape key fires "cancel"; blocked while the confirm work is running.
    dialog.addEventListener("cancel", (e) => {
      if (loading) {
        e.preventDefault();
        return;
      }
      finish(false);
    });
    dialog.addEventListener("close", () => {
      finish(false);
      dialog.remove();
    });
    // Click on the backdrop (outside the panel) dismisses — not while loading.
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog && !loading) {
        finish(false);
      }
    });

    document.body.append(dialog);
    dialog.showModal();
    cancelBtn.focus();
  });
}
