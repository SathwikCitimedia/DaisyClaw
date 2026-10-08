// Control UI chat module draws a file as a card: a coloured icon for its type,
// its name, and what kind of file it is ("PDF", "Document", "Spreadsheet").
//
// The same card is used in the message box before sending, in the user's sent
// message, and for files Daisy sends back, so a file looks the same wherever
// it appears. The type comes from the file name, then its MIME type.
import { html, nothing, svg, type TemplateResult } from "lit";

export type FileKind =
  | "pdf"
  | "word"
  | "spreadsheet"
  | "presentation"
  | "csv"
  | "text"
  | "markdown"
  | "json"
  | "code"
  | "archive"
  | "audio"
  | "video"
  | "image"
  | "file";

type FileKindInfo = { kind: FileKind; label: string };

const EXTENSION_KINDS: Record<string, FileKind> = {
  pdf: "pdf",
  doc: "word",
  docx: "word",
  docm: "word",
  dot: "word",
  dotx: "word",
  odt: "word",
  rtf: "word",
  pages: "word",
  xls: "spreadsheet",
  xlsx: "spreadsheet",
  xlsm: "spreadsheet",
  ods: "spreadsheet",
  numbers: "spreadsheet",
  csv: "csv",
  tsv: "csv",
  ppt: "presentation",
  pptx: "presentation",
  odp: "presentation",
  key: "presentation",
  txt: "text",
  log: "text",
  md: "markdown",
  markdown: "markdown",
  json: "json",
  jsonl: "json",
  zip: "archive",
  rar: "archive",
  "7z": "archive",
  tar: "archive",
  gz: "archive",
  tgz: "archive",
  mp3: "audio",
  wav: "audio",
  m4a: "audio",
  ogg: "audio",
  oga: "audio",
  opus: "audio",
  flac: "audio",
  aac: "audio",
  mp4: "video",
  mov: "video",
  webm: "video",
  mkv: "video",
  avi: "video",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  heic: "image",
  bmp: "image",
  svg: "image",
};

const CODE_EXTENSIONS = new Set([
  "js",
  "mjs",
  "cjs",
  "ts",
  "tsx",
  "jsx",
  "py",
  "java",
  "kt",
  "c",
  "h",
  "cpp",
  "hpp",
  "cs",
  "go",
  "rs",
  "rb",
  "php",
  "swift",
  "html",
  "htm",
  "css",
  "scss",
  "sh",
  "ps1",
  "bat",
  "yml",
  "yaml",
  "toml",
  "ini",
  "xml",
  "sql",
]);

const KIND_LABELS: Record<FileKind, string> = {
  pdf: "PDF",
  word: "Document",
  spreadsheet: "Spreadsheet",
  presentation: "Presentation",
  csv: "CSV",
  text: "Text",
  markdown: "Markdown",
  json: "JSON",
  code: "Code",
  archive: "Archive",
  audio: "Audio",
  video: "Video",
  image: "Image",
  file: "File",
};

function kindFromMimeType(mimeType: string): FileKind | null {
  const mime = mimeType.toLowerCase().split(";")[0].trim();
  if (!mime) {
    return null;
  }
  if (mime === "application/pdf") {
    return "pdf";
  }
  if (
    mime.includes("wordprocessingml") ||
    mime === "application/msword" ||
    mime.includes("opendocument.text") ||
    mime === "application/rtf"
  ) {
    return "word";
  }
  if (
    mime.includes("spreadsheetml") ||
    mime === "application/vnd.ms-excel" ||
    mime.includes("opendocument.spreadsheet")
  ) {
    return "spreadsheet";
  }
  if (
    mime.includes("presentationml") ||
    mime === "application/vnd.ms-powerpoint" ||
    mime.includes("opendocument.presentation")
  ) {
    return "presentation";
  }
  if (mime === "text/csv" || mime === "text/tab-separated-values") {
    return "csv";
  }
  if (mime === "text/markdown") {
    return "markdown";
  }
  if (mime === "application/json" || mime.endsWith("+json")) {
    return "json";
  }
  if (
    mime.includes("zip") ||
    mime.includes("compressed") ||
    mime.includes("x-tar") ||
    mime.includes("gzip") ||
    mime.includes("x-7z")
  ) {
    return "archive";
  }
  if (mime.startsWith("audio/")) {
    return "audio";
  }
  if (mime.startsWith("video/")) {
    return "video";
  }
  if (mime.startsWith("image/")) {
    return "image";
  }
  if (mime.startsWith("text/")) {
    return "text";
  }
  return null;
}

/** What kind of file this is, from its name first and its MIME type second. */
export function resolveFileKind(params: {
  fileName?: string | null;
  mimeType?: string | null;
}): FileKindInfo {
  const name = (params.fileName ?? "").trim().toLowerCase();
  const dot = name.lastIndexOf(".");
  const extension = dot > 0 && dot < name.length - 1 ? name.slice(dot + 1) : "";
  const fromName = EXTENSION_KINDS[extension] ?? (CODE_EXTENSIONS.has(extension) ? "code" : null);
  const kind = fromName ?? kindFromMimeType(params.mimeType ?? "") ?? "file";
  if (kind === "file" && extension && extension.length <= 5) {
    // An unknown type still says what it is: "ABC file".
    return { kind, label: `${extension.toUpperCase()} file` };
  }
  return { kind, label: KIND_LABELS[kind] };
}

const docOutline = svg`<path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" /><path d="M14 2v5h5" />`;

/** The glyph inside the icon tile; coloured by CSS per kind. */
function glyph(kind: FileKind) {
  switch (kind) {
    case "pdf":
      return svg`${docOutline}<text x="12" y="17.2" text-anchor="middle" class="chat-file-card__glyph-text">PDF</text>`;
    case "word":
      return svg`${docOutline}<path d="M8.5 11.5l1.25 5 1.5-4 1.5 4 1.25-5" />`;
    case "spreadsheet":
    case "csv":
      return svg`${docOutline}<path d="M8 11h8v6H8z" /><path d="M8 14h8" /><path d="M11.5 11v6" />`;
    case "presentation":
      return svg`${docOutline}<path d="M8 11h8v5H8z" /><path d="M12 16v2" />`;
    case "archive":
      return svg`${docOutline}<path d="M10 4h1M11 6h1M10 8h1M11 10h1" /><rect x="9.5" y="12" width="3" height="4" rx="0.8" />`;
    case "code":
    case "json":
      return svg`${docOutline}<path d="M10 12l-2 2 2 2" /><path d="M14 12l2 2-2 2" />`;
    case "markdown":
    case "text":
      return svg`${docOutline}<path d="M8 12h8" /><path d="M8 15h8" /><path d="M8 18h5" />`;
    case "audio":
      return svg`<path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />`;
    case "video":
      return svg`<rect x="2" y="5" width="15" height="14" rx="2" /><path d="M17 10l5-3v10l-5-3z" />`;
    case "image":
      return svg`<rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" />`;
    default:
      return docOutline;
  }
}

export function renderFileKindIcon(kind: FileKind): TemplateResult {
  return html`<span class="chat-file-card__icon" data-file-kind=${kind} aria-hidden="true"
    ><svg viewBox="0 0 24 24">${glyph(kind)}</svg></span
  >`;
}

export type FileCardOptions = {
  fileName: string;
  mimeType?: string | null;
  /** Opens the file when the card is clicked (sent files). */
  href?: string | null;
  /** Replaces the type line, e.g. "Unavailable" for a file that can't be opened. */
  status?: string;
  /** Extra controls on the card, such as the remove button in the message box. */
  extra?: TemplateResult | typeof nothing;
};

export function renderFileCard(opts: FileCardOptions): TemplateResult {
  const info = resolveFileKind({ fileName: opts.fileName, mimeType: opts.mimeType });
  const body = html`
    ${renderFileKindIcon(info.kind)}
    <span class="chat-file-card__text">
      <span class="chat-file-card__name">${opts.fileName}</span>
      <span class="chat-file-card__type">${opts.status ?? info.label}</span>
    </span>
  `;
  return opts.href
    ? html`<a
        class="chat-file-card chat-file-card--link"
        data-file-kind=${info.kind}
        href=${opts.href}
        target="_blank"
        rel="noreferrer"
        title=${opts.fileName}
        >${body}${opts.extra ?? nothing}</a
      >`
    : html`<div class="chat-file-card" data-file-kind=${info.kind} title=${opts.fileName}>
        ${body}${opts.extra ?? nothing}
      </div>`;
}
