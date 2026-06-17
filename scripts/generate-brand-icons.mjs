#!/usr/bin/env node
// Regenerate all raster brand assets (PNG) from the master daisy SVG.
// Each existing PNG is re-rendered at its own current dimensions, so iOS
// AppIcon sizes, Apple Watch sizes, Android mipmaps, and web icons all stay
// correct without a hardcoded size table.
//
// Usage:  node scripts/generate-brand-icons.mjs
// Requires: sharp (devDependency). For favicon.ico use png-to-ico separately;
// for macOS .icns run scripts/build_icon.sh on macOS (sips/iconutil).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { glob } from "node:fs/promises";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const markSvg = readFileSync(path.join(root, "docs/assets/daisyclaw-mark.svg"));
const lockupLight = readFileSync(path.join(root, "docs/assets/daisyclaw-logo-text.svg"));
const lockupDark = readFileSync(path.join(root, "docs/assets/daisyclaw-logo-text-dark.svg"));

const { default: sharp } = await import("sharp");

// All raster brand targets (relative to repo root).
const patterns = [
  "ui/public/favicon-32.png",
  "ui/public/apple-touch-icon.png",
  "docs/assets/daisyclaw-logo-text.png",
  "docs/assets/daisyclaw-logo-text-dark.png",
  "apps/ios/Sources/Assets.xcassets/AppIcon.appiconset/*.png",
  "apps/ios/Sources/Assets.xcassets/DaisyClawIcon.imageset/*.png",
  "apps/ios/WatchApp/Assets.xcassets/AppIcon.appiconset/*.png",
  "apps/android/app/src/main/res/mipmap-*/*.png",
];

function sourceFor(file) {
  if (file.includes("daisyclaw-logo-text-dark")) return lockupDark;
  if (file.includes("daisyclaw-logo-text")) return lockupLight;
  return markSvg; // square icon mark
}

let count = 0;
for (const pattern of patterns) {
  for await (const rel of glob(pattern, { cwd: root })) {
    const abs = path.join(root, rel);
    const meta = await sharp(abs).metadata();
    const w = meta.width ?? 256;
    const h = meta.height ?? 256;
    const src = sourceFor(rel);
    await sharp(src, { density: 384 })
      .resize(w, h, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(abs + ".tmp");
    const { renameSync } = await import("node:fs");
    renameSync(abs + ".tmp", abs);
    count++;
    console.log(`rendered ${rel} (${w}x${h})`);
  }
}
console.log(`\nDone. Regenerated ${count} raster assets from docs/assets/daisyclaw-mark.svg.`);
console.log("Next: favicon.ico via png-to-ico; macOS .icns via scripts/build_icon.sh on a Mac.");
