// Skill tool binary helpers make tools downloaded into the per-skill tools
// directory count as installed (requirement checks) and runnable (exec PATH).
import fs from "node:fs";
import path from "node:path";
import { hasBinary } from "../../shared/config-eval.js";
import { resolveConfigDir } from "../../utils.js";
import type { SkillEntry } from "../types.js";
import { resolveSkillToolsRootDir } from "./tools-dir.js";

function executableExtensions(): string[] {
  if (process.platform !== "win32") {
    return [""];
  }
  const raw = process.env.PATHEXT;
  const list =
    raw !== undefined ? raw.split(";").map((v) => v.trim()) : [".EXE", ".CMD", ".BAT", ".COM"];
  return ["", ...list.filter(Boolean)];
}

function binDirCandidates(root: string): string[] {
  const dirs = [root, path.join(root, "bin")];
  // Archives often extract into a versioned top folder (ripgrep-x.y/rg.exe,
  // ffmpeg-x.y/bin/ffmpeg.exe, MinGit's cmd/git.exe); scan one level deep
  // plus the conventional bin/cmd subdirs beneath it.
  let children: fs.Dirent[];
  try {
    children = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const child of children) {
    if (child.isDirectory()) {
      const sub = path.join(root, child.name);
      dirs.push(sub, path.join(sub, "bin"), path.join(sub, "cmd"));
    }
  }
  return dirs;
}

function dirHasBinary(dir: string, bin: string): boolean {
  for (const ext of executableExtensions()) {
    try {
      fs.accessSync(path.join(dir, bin + ext), fs.constants.X_OK);
      return true;
    } catch {
      // keep scanning
    }
  }
  return false;
}

/**
 * DaisyClaw's managed npm prefix: skill `node` install recipes put their
 * global bin shims here (prefix root on Windows, prefix/bin elsewhere).
 */
function npmPrefixBinDirs(): string[] {
  const prefix = path.join(resolveConfigDir(), "tools", "node", "npm");
  return process.platform === "win32" ? [prefix] : [path.join(prefix, "bin")];
}

/** True when the binary exists inside this skill's private tools directory. */
export function hasSkillToolBinary(entry: SkillEntry, bin: string): boolean {
  const root = resolveSkillToolsRootDir(entry);
  return (
    binDirCandidates(root).some((dir) => dirHasBinary(dir, bin)) ||
    npmPrefixBinDirs().some((dir) => dirHasBinary(dir, bin))
  );
}

/** PATH-or-tools-dir binary check for skill requirement evaluation. */
export function createSkillBinChecker(entry: SkillEntry): (bin: string) => boolean {
  return (bin) => hasBinary(bin) || hasSkillToolBinary(entry, bin);
}

/**
 * Existing skill tool directories (and their bin/ subdirs) to prepend to exec
 * PATH so the agent can run tools DaisyClaw downloaded. Only directories that
 * exist are returned, so a machine with no downloaded tools adds nothing.
 */
export function collectSkillToolPathDirs(): string[] {
  const toolsRoot = path.join(resolveConfigDir(), "tools");
  let skillDirs: fs.Dirent[];
  try {
    skillDirs = fs.readdirSync(toolsRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  const dirs: string[] = [];
  const pushIfDir = (dir: string) => {
    try {
      if (fs.statSync(dir).isDirectory() && !dirs.includes(dir)) {
        dirs.push(dir);
      }
    } catch {
      // not present
    }
  };
  for (const skillDir of skillDirs) {
    if (!skillDir.isDirectory()) {
      continue;
    }
    const root = path.join(toolsRoot, skillDir.name);
    dirs.push(root);
    pushIfDir(path.join(root, "bin"));
    // Mirror binDirCandidates: archive top folders and their bin/cmd dirs.
    let children: fs.Dirent[] = [];
    try {
      children = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const child of children) {
      if (!child.isDirectory() || child.name === "bin") {
        continue;
      }
      const sub = path.join(root, child.name);
      pushIfDir(sub);
      pushIfDir(path.join(sub, "bin"));
      pushIfDir(path.join(sub, "cmd"));
    }
  }
  for (const npmDir of npmPrefixBinDirs()) {
    try {
      if (fs.statSync(npmDir).isDirectory() && !dirs.includes(npmDir)) {
        dirs.push(npmDir);
      }
    } catch {
      // no managed npm prefix yet
    }
  }
  return dirs;
}
