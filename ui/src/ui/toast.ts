// Lightweight toast notifications — bottom-right, auto-dismissing.
// Imperative (like confirm-dialog.ts) so any handler can call it without
// threading state through the view layer.

export type ToastTone = "success" | "error" | "info";

export type ToastOptions = {
  tone?: ToastTone;
  /** Auto-dismiss delay in ms (default 3500). */
  duration?: number;
};

const TOAST_EXIT_MS = 300;

function toastContainer(): HTMLElement {
  let container = document.querySelector<HTMLElement>(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.append(container);
  }
  return container;
}

export function showToast(message: string, options?: ToastOptions): void {
  const tone = options?.tone ?? "info";
  const duration = options?.duration ?? 3500;

  const toast = document.createElement("div");
  toast.className = `toast toast--${tone}`;
  toast.setAttribute("role", "status");
  toast.textContent = message;

  toastContainer().append(toast);
  requestAnimationFrame(() => toast.classList.add("toast--visible"));

  window.setTimeout(() => {
    toast.classList.remove("toast--visible");
    window.setTimeout(() => toast.remove(), TOAST_EXIT_MS);
  }, duration);
}
