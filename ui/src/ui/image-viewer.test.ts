import { afterEach, describe, expect, it } from "vitest";
import { openImageViewer, resolveImageDownloadName } from "./image-viewer.ts";

afterEach(() => {
  document.querySelectorAll("dialog.image-viewer").forEach((dialog) => dialog.remove());
});

describe("resolveImageDownloadName", () => {
  it("keeps a real file name and names inline pictures by type", () => {
    expect(resolveImageDownloadName("https://x.test/media/receipt%20may.jpg?t=1", 0)).toBe(
      "receipt may.jpg",
    );
    expect(resolveImageDownloadName("data:image/jpeg;base64,AAAA", 1)).toBe("image-2.jpg");
    expect(resolveImageDownloadName("blob:http://localhost/abc", 0)).toBe("image-1.png");
    expect(resolveImageDownloadName("/api/media/abc", 2)).toBe("image-3");
  });
});

describe("openImageViewer", () => {
  it("shows the picture inside the app with a counter for several", () => {
    openImageViewer({
      images: [
        { src: "https://x.test/a.png", alt: "first" },
        { src: "https://x.test/b.png", alt: "second" },
      ],
      index: 1,
    });
    const dialog = document.querySelector<HTMLDialogElement>("dialog.image-viewer");
    expect(dialog).not.toBeNull();
    const img = dialog!.querySelector<HTMLImageElement>(".image-viewer__image")!;
    expect(img.src).toBe("https://x.test/b.png");
    expect(dialog!.querySelector(".image-viewer__counter")?.textContent).toBe("2 of 2");

    dialog!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(img.src).toBe("https://x.test/a.png");
    expect(dialog!.querySelector<HTMLAnchorElement>("a.image-viewer__btn")?.download).toBe("a.png");

    dialog!.querySelector<HTMLButtonElement>(".image-viewer__close")!.click();
    expect(document.querySelector("dialog.image-viewer")).toBeNull();
  });

  it("hides the arrows and counter for one picture", () => {
    openImageViewer({ images: [{ src: "https://x.test/a.png" }] });
    const dialog = document.querySelector("dialog.image-viewer")!;
    expect(dialog.querySelector<HTMLElement>(".image-viewer__nav--prev")!.hidden).toBe(true);
    expect(dialog.querySelector<HTMLElement>(".image-viewer__counter")!.hidden).toBe(true);
  });

  it("refuses addresses a browser should not open as pictures", () => {
    openImageViewer({
      images: [{ src: "javascript:alert(1)" }, { src: "data:image/svg+xml;base64,PHN2Zz4=" }],
    });
    expect(document.querySelector("dialog.image-viewer")).toBeNull();
  });
});
