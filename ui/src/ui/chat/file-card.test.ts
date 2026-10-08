import { render } from "lit";
import { describe, expect, it } from "vitest";
import { renderFileCard, resolveFileKind } from "./file-card.ts";

describe("resolveFileKind", () => {
  it("names a file the way people call it", () => {
    expect(resolveFileKind({ fileName: "Blueprint.pdf" })).toEqual({ kind: "pdf", label: "PDF" });
    expect(resolveFileKind({ fileName: "PlanetGeo Paper 5.docx" })).toEqual({
      kind: "word",
      label: "Document",
    });
    expect(resolveFileKind({ fileName: "budget.XLSX" })).toEqual({
      kind: "spreadsheet",
      label: "Spreadsheet",
    });
    expect(resolveFileKind({ fileName: "deck.pptx" }).label).toBe("Presentation");
    expect(resolveFileKind({ fileName: "data.csv" }).label).toBe("CSV");
    expect(resolveFileKind({ fileName: "notes.md" }).label).toBe("Markdown");
    expect(resolveFileKind({ fileName: "script.py" }).label).toBe("Code");
    expect(resolveFileKind({ fileName: "photos.zip" }).label).toBe("Archive");
  });

  it("falls back to the MIME type, then to the extension", () => {
    expect(resolveFileKind({ fileName: "report", mimeType: "application/pdf" }).kind).toBe("pdf");
    expect(
      resolveFileKind({
        fileName: "contract",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }).kind,
    ).toBe("word");
    expect(resolveFileKind({ fileName: "model.stl" })).toEqual({ kind: "file", label: "STL file" });
    expect(resolveFileKind({ fileName: "mystery" })).toEqual({ kind: "file", label: "File" });
  });
});

describe("renderFileCard", () => {
  it("shows the type icon, the name and the kind", () => {
    const host = document.createElement("div");
    render(renderFileCard({ fileName: "Intelligent_Media_Planner.pdf" }), host);
    const card = host.querySelector(".chat-file-card");
    expect(card?.getAttribute("data-file-kind")).toBe("pdf");
    expect(card?.querySelector(".chat-file-card__icon svg")).not.toBeNull();
    expect(card?.querySelector(".chat-file-card__name")?.textContent).toBe(
      "Intelligent_Media_Planner.pdf",
    );
    expect(card?.querySelector(".chat-file-card__type")?.textContent).toBe("PDF");
    expect(card?.getAttribute("title")).toBe("Intelligent_Media_Planner.pdf");
  });

  it("opens a sent file, and says why one cannot be opened", () => {
    const host = document.createElement("div");
    render(renderFileCard({ fileName: "a.docx", href: "/media/a.docx" }), host);
    expect(host.querySelector("a.chat-file-card")?.getAttribute("href")).toBe("/media/a.docx");

    render(renderFileCard({ fileName: "a.docx", status: "Unavailable" }), host);
    expect(host.querySelector("a.chat-file-card")).toBeNull();
    expect(host.querySelector(".chat-file-card__type")?.textContent).toBe("Unavailable");
  });
});
