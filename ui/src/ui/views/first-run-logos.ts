// Inline SVG logos for the first-run wizard. Branded services use their
// recognizable marks (nominative use — the UI connects to these services);
// generic skills use clean colored glyphs so the grid reads as one set.
//
// Each logo is a SINGLE complete <svg> template: the browser's template parser
// switches to the SVG namespace at the <svg> boundary, so child elements
// (<path>, <circle>…) render correctly. Splitting the root from its children
// across separate html`` templates would parse the children in the HTML
// namespace and they would not render.
import { html, type TemplateResult } from "lit";
import { CHANNEL_LOGOS } from "./channel-logos.ts";

// ── Skill logos ────────────────────────────────────────────────────────────

const google = html`
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M21.6 12.2c0-.7-.06-1.2-.18-1.8H12v3.4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.1z"
    />
    <path
      fill="#34A853"
      d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z"
    />
    <path
      fill="#FBBC05"
      d="M6.4 14c-.2-.6-.32-1.3-.32-2s.12-1.4.32-2V7.4H3.1A10 10 0 0 0 2 12c0 1.6.4 3.2 1.1 4.6z"
    />
    <path
      fill="#EA4335"
      d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8C16.96 2.97 14.7 2 12 2 8.1 2 4.7 4.3 3.1 7.4L6.4 10c.8-2.4 3-4.1 5.6-4.1z"
    />
  </svg>
`;

const spotify = html`
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <circle cx="12" cy="12" r="11" fill="#1DB954" />
    <path
      fill="none"
      stroke="#fff"
      stroke-width="1.6"
      stroke-linecap="round"
      d="M7 9.6c3.2-.9 6.6-.6 9.4 1M7.6 12.6c2.6-.7 5.4-.4 7.6 1M8.2 15.4c2-.5 4.1-.3 5.8.8"
    />
  </svg>
`;

const notion = html`
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <rect
      x="2.5"
      y="2.5"
      width="19"
      height="19"
      rx="4"
      fill="#fff"
      stroke="#111"
      stroke-width="1.4"
    />
    <path fill="#111" d="M8 8h1.9l4.3 5.7V8H16v8h-1.9L9.8 10.2V16H8z" />
  </svg>
`;

const trello = html`
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <rect x="2.5" y="2.5" width="19" height="19" rx="4" fill="#0079BF" />
    <rect x="5.2" y="5.2" width="5.4" height="10.4" rx="1.2" fill="#fff" />
    <rect x="13.4" y="5.2" width="5.4" height="6.4" rx="1.2" fill="#fff" />
  </svg>
`;

const weather = html`
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <circle cx="9" cy="9" r="4" fill="#FBBF24" />
    <path fill="#93C5FD" d="M7 18a4 4 0 0 1 .6-8 5 5 0 0 1 9.4 1.4A3.3 3.3 0 0 1 16.7 18z" />
  </svg>
`;

const reminders = html`
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <circle cx="12" cy="13" r="7" fill="#FDE68A" stroke="#D97706" stroke-width="1.4" />
    <path
      fill="none"
      stroke="#D97706"
      stroke-width="1.6"
      stroke-linecap="round"
      d="M12 9.5V13l2.5 1.5M5.5 5 3 7.5M18.5 5 21 7.5"
    />
  </svg>
`;

const notes = html`
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <rect
      x="5"
      y="3.5"
      width="14"
      height="17"
      rx="2.5"
      fill="#FEF3C7"
      stroke="#CA8A04"
      stroke-width="1.3"
    />
    <path
      fill="none"
      stroke="#CA8A04"
      stroke-width="1.4"
      stroke-linecap="round"
      d="M8.5 8h7M8.5 11.5h7M8.5 15h4"
    />
  </svg>
`;

const tasks = html`
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="3" fill="#DDD6FE" />
    <path
      fill="none"
      stroke="#6D28D9"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      d="m7.5 9 1.4 1.4L11.5 8M7.5 15l1.4 1.4L11.5 14M14 9.5h3M14 15.5h3"
    />
  </svg>
`;

const briefing = html`
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path
      fill="none"
      stroke="#F59E0B"
      stroke-width="1.6"
      stroke-linecap="round"
      d="M3 18h18M6 18a6 6 0 0 1 12 0M12 6v2M5 9l1.4 1.4M19 9l-1.4 1.4"
    />
    <circle cx="12" cy="18" r="3.2" fill="#FCD34D" />
  </svg>
`;

const diagrams = html`
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <rect
      x="3.5"
      y="4"
      width="7"
      height="4.5"
      rx="1.2"
      fill="#BFDBFE"
      stroke="#2563EB"
      stroke-width="1.2"
    />
    <rect
      x="13.5"
      y="15.5"
      width="7"
      height="4.5"
      rx="1.2"
      fill="#BFDBFE"
      stroke="#2563EB"
      stroke-width="1.2"
    />
    <path fill="none" stroke="#2563EB" stroke-width="1.4" d="M7 8.5v4a3 3 0 0 0 3 3h3.5" />
  </svg>
`;

const memes = html`
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <rect
      x="3.5"
      y="3.5"
      width="17"
      height="17"
      rx="3.5"
      fill="#FBCFE8"
      stroke="#DB2777"
      stroke-width="1.3"
    />
    <circle cx="9" cy="10" r="1.1" fill="#9D174D" />
    <circle cx="15" cy="10" r="1.1" fill="#9D174D" />
    <path
      fill="none"
      stroke="#9D174D"
      stroke-width="1.5"
      stroke-linecap="round"
      d="M8.5 14a4 4 0 0 0 7 0"
    />
  </svg>
`;

const canvas = html`
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path
      fill="#A7F3D0"
      stroke="#059669"
      stroke-width="1.2"
      d="M12 3.5c5 0 8.5 3 8.5 6.8 0 2.4-2 3.4-3.8 3.4h-1.5c-1 0-1.7.8-1.7 1.7 0 .5.3.9.3 1.4 0 1-.9 1.7-2 1.7C7.4 20.5 3.5 16.8 3.5 12S7.3 3.5 12 3.5z"
    />
    <circle cx="8" cy="9" r="1.1" fill="#059669" />
    <circle cx="12" cy="7.5" r="1.1" fill="#DB2777" />
    <circle cx="15.5" cy="9.5" r="1.1" fill="#2563EB" />
  </svg>
`;

const skillFinder = html`
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path
      fill="#C4B5FD"
      stroke="#7C3AED"
      stroke-width="1.2"
      d="M10 3.5h2.5c.6 0 1 .5 1 1v1.2c0 .7.6 1.1 1.2 1.1.4 0 .8-.3 1.3-.3.9 0 1.2 1 1.2 1.9v2c0 .6.5 1 1.1 1 .4 0 .8-.3 1.2-.3v3.9c0 .6-.5 1-1 1h-3.9c-.6 0-1-.5-1-1.1 0-.5.3-.9.3-1.3 0-.6-.4-1.2-1.1-1.2H10c-.6 0-1-.5-1-1V4.5c0-.6.5-1 1-1z"
    />
  </svg>
`;

export const WIZARD_SKILL_LOGOS: Record<string, TemplateResult> = {
  gog: google,
  "spotify-player": spotify,
  notion,
  trello,
  weather,
  reminders,
  "quick-notes": notes,
  taskflow: tasks,
  "daily-briefing": briefing,
  "diagram-maker": diagrams,
  "meme-maker": memes,
  canvas,
  "skill-installer": skillFinder,
};

// ── AI provider logos (Add-your-brain screen) ───────────────────────────────

const anthropic = html`
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
    <path
      fill="#D97757"
      fill-rule="nonzero"
      d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z"
    />
  </svg>
`;

const openai = html`
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
    <path
      fill="#111"
      fill-rule="evenodd"
      d="M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z"
    />
  </svg>
`;

// xAI's Grok mark. Not a wizard preset — shared with Model Studio's grok
// family, which is a different company from Groq (the inference host) below.
const grok = html`
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
    <path
      fill="#111"
      fill-rule="evenodd"
      d="M9.27 15.29l7.978-5.897c.391-.29.95-.177 1.137.272.98 2.369.542 5.215-1.41 7.169-1.951 1.954-4.667 2.382-7.149 1.406l-2.711 1.257c3.889 2.661 8.611 2.003 11.562-.953 2.341-2.344 3.066-5.539 2.388-8.42l.006.007c-.983-4.232.242-5.924 2.75-9.383.06-.082.12-.164.179-.248l-3.301 3.305v-.01L9.267 15.292M7.623 16.723c-2.792-2.67-2.31-6.801.071-9.184 1.761-1.763 4.647-2.483 7.166-1.425l2.705-1.25a7.808 7.808 0 00-1.829-1A8.975 8.975 0 005.984 5.83c-2.533 2.536-3.33 6.436-1.962 9.764 1.022 2.487-.653 4.246-2.34 6.022-.599.63-1.199 1.259-1.682 1.925l7.62-6.815"
    />
  </svg>
`;

const openrouter = html`
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
    <path
      fill="#6467F2"
      fill-rule="evenodd"
      d="M18.654 3.87a5.087 5.087 0 110 10.174L23.7 19.09c.64.641.187 1.737-.72 1.737H8.48a8.479 8.479 0 010-16.958h10.175zM8.479 7.26a5.087 5.087 0 100 10.176 5.087 5.087 0 000-10.175z"
    />
  </svg>
`;

const gemini = html`
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
    <defs>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="daisy-gemini-0"
        x1="7"
        x2="11"
        y1="15.5"
        y2="12"
      >
        <stop stop-color="#08B962" />
        <stop offset="1" stop-color="#08B962" stop-opacity="0" />
      </linearGradient>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="daisy-gemini-1"
        x1="8"
        x2="11.5"
        y1="5.5"
        y2="11"
      >
        <stop stop-color="#F94543" />
        <stop offset="1" stop-color="#F94543" stop-opacity="0" />
      </linearGradient>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="daisy-gemini-2"
        x1="3.5"
        x2="17.5"
        y1="13.5"
        y2="12"
      >
        <stop stop-color="#FABC12" />
        <stop offset=".46" stop-color="#FABC12" stop-opacity="0" />
      </linearGradient>
    </defs>
    <path
      fill="#3186FF"
      d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"
    />
    <path
      fill="url(#daisy-gemini-0)"
      d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"
    />
    <path
      fill="url(#daisy-gemini-1)"
      d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"
    />
    <path
      fill="url(#daisy-gemini-2)"
      d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z"
    />
  </svg>
`;

const customServer = html`
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
    <rect
      x="4"
      y="4"
      width="16"
      height="6"
      rx="1.6"
      fill="#CBD5E1"
      stroke="#475569"
      stroke-width="1.1"
    />
    <rect
      x="4"
      y="14"
      width="16"
      height="6"
      rx="1.6"
      fill="#CBD5E1"
      stroke="#475569"
      stroke-width="1.1"
    />
    <circle cx="7.5" cy="7" r="1" fill="#22C55E" />
    <circle cx="7.5" cy="17" r="1" fill="#22C55E" />
  </svg>
`;

// Groq, the inference host. Drawn with currentColor, so callers set the tint.
const groq = html`
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
    <path
      fill="currentColor"
      fill-rule="evenodd"
      d="M12.036 2c-3.853-.035-7 3-7.036 6.781-.035 3.782 3.055 6.872 6.908 6.907h2.42v-2.566h-2.292c-2.407.028-4.38-1.866-4.408-4.23-.029-2.362 1.901-4.298 4.308-4.326h.1c2.407 0 4.358 1.915 4.365 4.278v6.305c0 2.342-1.944 4.25-4.323 4.279a4.375 4.375 0 01-3.033-1.252l-1.851 1.818A7 7 0 0012.029 22h.092c3.803-.056 6.858-3.083 6.879-6.816v-6.5C18.907 4.963 15.817 2 12.036 2z"
    />
  </svg>
`;

/** Groq's brand orange, applied where the mark inherits currentColor. */
export const GROQ_BRAND_COLOR = "#F55036";

export const WIZARD_PROVIDER_LOGOS: Record<string, TemplateResult> = {
  anthropic,
  openai,
  google: gemini,
  groq,
  grok,
  openrouter,
  custom: customServer,
};

// ── Channel logos (Chat-anywhere screen) ────────────────────────────────────
// Recognizable brand-colored marks; swap for official SVGs when available.

// Channel marks live in channel-logos.ts so the Settings list and the
// wizard cannot drift apart. Re-exported under the old name for callers.
export const WIZARD_CHANNEL_LOGOS: Record<string, TemplateResult> = CHANNEL_LOGOS;
