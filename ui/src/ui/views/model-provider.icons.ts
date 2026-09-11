// Brand icons for model rows in Model Studio. Families we have an official
// brand SVG for render that logo on a neutral tile (shared with the first-run
// wizard so both surfaces show the same marks). The rest fall back to a tile
// tinted in the family's brand color with a drawn emblem or a monogram.
import { html, svg, type TemplateResult } from "lit";
import { ifDefined } from "lit/directives/if-defined.js";
import { GROQ_BRAND_COLOR, WIZARD_PROVIDER_LOGOS } from "./first-run-logos.ts";
import { MODEL_BRAND_LOGOS, type ModelBrandLogo } from "./model-brand-logos.ts";

type ModelBrand = {
  color: string;
  /** SVG inner markup for a 24x24 viewBox, drawn with currentColor. */
  glyph?: TemplateResult;
  /** Single-letter fallback rendered in the brand color. */
  monogram?: string;
};

// Emblems are deliberately simple geometry: an asterisk spark for Claude, a
// four-point star for Gemini, a hexagon ring for OpenAI-family models, an
// infinity loop for Llama/Meta — recognizable without shipping trademarked
// logo paths.
const STROKE = { fill: "none", width: 2.2 };

const claudeSpark = svg`<path d="M12 4v16M4 12h16M6.4 6.4l11.2 11.2M17.6 6.4L6.4 17.6" fill="none" stroke="currentColor" stroke-width="${STROKE.width}" stroke-linecap="round" />`;
const geminiStar = svg`<path d="M12 2c.65 5.35 4.65 9.35 10 10-5.35.65-9.35 4.65-10 10-.65-5.35-4.65-9.35-10-10 5.35-.65 9.35-4.65 10-10z" />`;
const openaiHex = svg`<path d="M12 3.2l7.6 4.4v8.8L12 20.8l-7.6-4.4V7.6L12 3.2z" fill="none" stroke="currentColor" stroke-width="${STROKE.width}" stroke-linejoin="round" /><circle cx="12" cy="12" r="2.4" />`;
const metaLoop = svg`<path d="M7 8.6c-4.2 0-4.2 6.8 0 6.8 4.2 0 5.8-6.8 10-6.8 4.2 0 4.2 6.8 0 6.8-4.2 0-5.8-6.8-10-6.8z" fill="none" stroke="currentColor" stroke-width="${STROKE.width}" stroke-linecap="round" />`;
const chipGlyph = svg`<rect x="7" y="7" width="10" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="${STROKE.width}" /><path d="M9.5 3.5v3M14.5 3.5v3M9.5 17.5v3M14.5 17.5v3M3.5 9.5h3M3.5 14.5h3M17.5 9.5h3M17.5 14.5h3" stroke="currentColor" stroke-width="${STROKE.width}" stroke-linecap="round" />`;

const FAMILY_BRANDS: Record<string, ModelBrand> = {
  claude: { color: "#CC785C", glyph: claudeSpark },
  gemini: { color: "#4285F4", glyph: geminiStar },
  openai: { color: "#10A37F", glyph: openaiHex },
  llama: { color: "#0866FF", glyph: metaLoop },
  qwen: { color: "#7C3AED", monogram: "Q" },
  mistral: { color: "#F97316", monogram: "M" },
  deepseek: { color: "#4D6BFE", monogram: "D" },
  grok: { color: "#64748B", monogram: "X" },
  kimi: { color: "#0EA5E9", monogram: "K" },
  groq: { color: "#F55036", monogram: "G" },
  openrouter: { color: "#6366F1", monogram: "O" },
  google: { color: "#4285F4", glyph: geminiStar },
  anthropic: { color: "#CC785C", glyph: claudeSpark },
};

const FALLBACK: ModelBrand = { color: "var(--muted)", glyph: chipGlyph };

// Official brand SVGs, keyed by the family/provider keys used above. Anything
// missing here keeps its drawn emblem or monogram until a real logo is added.
// Groq (the inference host) and Grok (xAI) are different companies with
// different marks — keep them distinct.
const REAL_LOGOS: Record<string, ModelBrandLogo | undefined> = {
  groq: { svg: WIZARD_PROVIDER_LOGOS.groq, tint: GROQ_BRAND_COLOR },
  claude: { svg: WIZARD_PROVIDER_LOGOS.anthropic },
  anthropic: { svg: WIZARD_PROVIDER_LOGOS.anthropic },
  openai: { svg: WIZARD_PROVIDER_LOGOS.openai },
  gemini: { svg: WIZARD_PROVIDER_LOGOS.google },
  google: { svg: WIZARD_PROVIDER_LOGOS.google },
  openrouter: { svg: WIZARD_PROVIDER_LOGOS.openrouter },
  grok: { svg: WIZARD_PROVIDER_LOGOS.grok },
  ...MODEL_BRAND_LOGOS,
};

/** Inline style for a logo tile's plate and ink, when either is pinned. */
function buildLogoTileStyle(logo: ModelBrandLogo): string | undefined {
  const parts = [
    logo.plate ? `--model-brand-plate: ${logo.plate};` : "",
    logo.tint ? `color: ${logo.tint};` : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : undefined;
}

/** Match a model to its family by id/name keywords, falling back to provider. */
export function resolveModelBrandKey(entry: {
  id: string;
  name?: string;
  provider?: string;
}): string | null {
  const haystack = `${entry.id} ${entry.name ?? ""}`.toLowerCase();
  const families = [
    ["claude", /claude/],
    ["gemini", /gemini|gemma/],
    ["openai", /\bgpt|\bo[134]\b|openai|\boss\b/],
    ["llama", /llama|meta-/],
    ["qwen", /qwen|qwq/],
    ["mistral", /mistral|mixtral|magistral|devstral/],
    ["deepseek", /deepseek/],
    ["grok", /grok|xai/],
    ["kimi", /kimi|moonshot/],
  ] as const;
  for (const [key, pattern] of families) {
    if (pattern.test(haystack)) {
      return key;
    }
  }
  const provider = entry.provider?.toLowerCase() ?? "";
  return provider in FAMILY_BRANDS ? provider : null;
}

export function renderModelBrandIcon(entry: {
  id: string;
  name?: string;
  provider?: string;
}): TemplateResult {
  const key = resolveModelBrandKey(entry);
  const logo = key ? REAL_LOGOS[key] : undefined;
  if (logo) {
    // Official logos carry their own colors, so the tile stays neutral unless
    // the mark needs a fixed plate behind it.
    return html`<span
      class="model-brand model-brand--logo ${logo.plate ? "model-brand--plate" : ""}"
      style=${ifDefined(buildLogoTileStyle(logo))}
      aria-hidden="true"
      >${logo.svg}</span
    >`;
  }
  const brand = (key && FAMILY_BRANDS[key]) || FALLBACK;
  return html`
    <span class="model-brand" style="--model-brand-color: ${brand.color};" aria-hidden="true">
      ${brand.glyph
        ? html`<svg class="model-brand__glyph" viewBox="0 0 24 24">${brand.glyph}</svg>`
        : html`<span class="model-brand__monogram">${brand.monogram ?? "?"}</span>`}
    </span>
  `;
}

/** Icon for a provider preset row in the "Add a provider" list. */
export function renderProviderBrandIcon(providerId: string): TemplateResult {
  return renderModelBrandIcon({ id: "", provider: providerId });
}
