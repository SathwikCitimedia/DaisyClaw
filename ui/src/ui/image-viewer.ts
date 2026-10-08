// In-app image viewer: a chat image opens over the app instead of throwing the
// user out to a browser window. Imperative (like confirm-dialog.ts) so a click
// handler anywhere can open it without threading state through the view layer.
import { t } from "../i18n/index.ts";
import { openExternalUrlSafe, resolveSafeExternalUrl } from "./open-external-url.ts";

export type ImageViewerImage = {
  src: string;
  alt?: string;
};

export type OpenImageViewerOptions = {
  images: readonly ImageViewerImage[];
  index?: number;
};

// Static inline glyphs (24x24, stroke-based) — this module is imperative DOM,
// so the lit icon set can't be reused here.
const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const CLOSE_SVG = svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>');
const PREV_SVG = svg('<path d="m15 18-6-6 6-6"/>');
const NEXT_SVG = svg('<path d="m9 18 6-6-6-6"/>');
const DOWNLOAD_SVG = svg(
  '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
);
const EXTERNAL_SVG = svg(
  '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
);

/** A file name for the download button: the image's own name when the URL has one. */
export function resolveImageDownloadName(src: string, index: number): string {
  const fallback = `image-${index + 1}`;
  if (/^(data|blob):/i.test(src)) {
    const mime = /^data:image\/([a-z0-9.+-]+)/i.exec(src)?.[1]?.toLowerCase();
    const ext = mime === "jpeg" ? "jpg" : mime && /^[a-z0-9]+$/.test(mime) ? mime : "png";
    return `${fallback}.${ext}`;
  }
  try {
    const last = new URL(src, "http://localhost/").pathname.split("/").pop() ?? "";
    const name = decodeURIComponent(last).trim();
    return /\.[a-z0-9]{2,5}$/i.test(name) ? name : fallback;
  } catch {
    return fallback;
  }
}

function iconButton(className: string, label: string, icon: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `image-viewer__btn ${className}`;
  button.setAttribute("aria-label", label);
  button.title = label;
  button.innerHTML = icon;
  return button;
}

let activeViewer: { close: () => void } | null = null;

export function openImageViewer(options: OpenImageViewerOptions): void {
  // Only pictures a browser can show safely: http(s), blob, and non-SVG data images.
  const images = options.images.flatMap((image) => {
    const src = resolveSafeExternalUrl(image.src, window.location.href, { allowDataImage: true });
    return src ? [{ ...image, src }] : [];
  });
  if (images.length === 0) {
    return;
  }
  activeViewer?.close();
  let index = Math.min(Math.max(options.index ?? 0, 0), images.length - 1);

  const dialog = document.createElement("dialog");
  dialog.className = "image-viewer";
  dialog.setAttribute("aria-label", t("chat.imageViewer.label"));

  const toolbar = document.createElement("div");
  toolbar.className = "image-viewer__toolbar";
  const counter = document.createElement("span");
  counter.className = "image-viewer__counter";
  const downloadLink = document.createElement("a");
  downloadLink.className = "image-viewer__btn";
  downloadLink.setAttribute("aria-label", t("chat.imageViewer.download"));
  downloadLink.title = t("chat.imageViewer.download");
  downloadLink.innerHTML = DOWNLOAD_SVG;
  const openButton = iconButton(
    "image-viewer__open",
    t("chat.imageViewer.openInNewWindow"),
    EXTERNAL_SVG,
  );
  const closeButton = iconButton("image-viewer__close", t("chat.imageViewer.close"), CLOSE_SVG);
  toolbar.append(counter, downloadLink, openButton, closeButton);

  const stage = document.createElement("div");
  stage.className = "image-viewer__stage";
  const img = document.createElement("img");
  img.className = "image-viewer__image";
  stage.append(img);

  const prevButton = iconButton(
    "image-viewer__nav image-viewer__nav--prev",
    t("chat.imageViewer.previous"),
    PREV_SVG,
  );
  const nextButton = iconButton(
    "image-viewer__nav image-viewer__nav--next",
    t("chat.imageViewer.next"),
    NEXT_SVG,
  );
  const multiple = images.length > 1;
  prevButton.hidden = !multiple;
  nextButton.hidden = !multiple;
  counter.hidden = !multiple;

  dialog.append(toolbar, stage, prevButton, nextButton);

  const show = (next: number) => {
    index = (next + images.length) % images.length;
    const image = images[index];
    img.src = image.src;
    img.alt = image.alt ?? t("chat.imageViewer.label");
    downloadLink.href = image.src;
    downloadLink.download = resolveImageDownloadName(image.src, index);
    counter.textContent = t("chat.imageViewer.counter", {
      index: String(index + 1),
      total: String(images.length),
    });
  };

  const close = () => {
    if (activeViewer?.close === close) {
      activeViewer = null;
    }
    if (dialog.open) {
      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    }
    dialog.remove();
  };

  closeButton.addEventListener("click", close);
  openButton.addEventListener("click", () => {
    openExternalUrlSafe(images[index].src, { allowDataImage: true });
  });
  prevButton.addEventListener("click", () => show(index - 1));
  nextButton.addEventListener("click", () => show(index + 1));
  dialog.addEventListener("keydown", (event) => {
    if (multiple && event.key === "ArrowLeft") {
      event.preventDefault();
      show(index - 1);
    } else if (multiple && event.key === "ArrowRight") {
      event.preventDefault();
      show(index + 1);
    }
  });
  // Escape fires "cancel"; the dialog closes itself, and "close" cleans up.
  dialog.addEventListener("close", close);
  // A click on the dark area around the picture closes it, like a photo app.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog || event.target === stage) {
      close();
    }
  });

  show(index);
  document.body.append(dialog);
  activeViewer = { close };
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
  closeButton.focus();
}

/**
 * Opens the viewer from a click on one image in a group: every image beside it
 * becomes a page, so ← and → walk through the pictures in that message.
 */
export function openImageViewerFromElement(target: HTMLImageElement): void {
  const group = target.closest(".chat-message-images, .chat-assistant-attachments");
  const elements = group
    ? [...group.querySelectorAll<HTMLImageElement>("img.chat-message-image")]
    : [target];
  const images = elements.map((element) => ({
    src: element.currentSrc || element.src,
    alt: element.alt,
  }));
  const index = Math.max(elements.indexOf(target), 0);
  openImageViewer({ images, index });
}
