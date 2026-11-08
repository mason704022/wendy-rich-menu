import fs from "fs";
import path from "path";
import { getWritableContentRoot, SERVER_ROOT } from "../config.js";

const CONTENT_ROOT = () => getWritableContentRoot();
const SEED_ROOT = path.join(SERVER_ROOT, "content-seed");
const themesFile = () => path.join(CONTENT_ROOT(), "session-themes.json");
const SEED_THEMES = path.join(SEED_ROOT, "session-themes.json");

function copyFileIfMissing(src: string, dest: string) {
  if (!fs.existsSync(src)) return;
  if (fs.existsSync(dest)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function seedSessionImages() {
  const seedDir = path.join(SEED_ROOT, "images", "sessions");
  const destDir = path.join(CONTENT_ROOT(), "images", "sessions");
  if (!fs.existsSync(seedDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const name of fs.readdirSync(seedDir)) {
    copyFileIfMissing(path.join(seedDir, name), path.join(destDir, name));
  }
}

function sessionThemesEmpty(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return true;
  const o = raw as { weeks?: unknown; overrides?: unknown };
  const weeks = Array.isArray(o.weeks) ? o.weeks : [];
  const overrides = Array.isArray(o.overrides) ? o.overrides : [];
  return weeks.length === 0 && overrides.length === 0;
}

function seedSessionThemesJson() {
  if (!fs.existsSync(SEED_THEMES)) return;

  const THEMES_FILE = themesFile();
  if (!fs.existsSync(THEMES_FILE)) {
    fs.mkdirSync(path.dirname(THEMES_FILE), { recursive: true });
    fs.copyFileSync(SEED_THEMES, THEMES_FILE);
    console.log("[Content seed] Created session-themes.json at", THEMES_FILE);
    return;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(THEMES_FILE, "utf-8"));
    if (sessionThemesEmpty(raw)) {
      console.warn(
        "[Content seed] session-themes.json has no weeks/overrides — using courses.json default on booking UI until admin re-saves themes"
      );
    }
  } catch {
    fs.copyFileSync(SEED_THEMES, THEMES_FILE);
    console.warn("[Content seed] session-themes.json invalid — recreated from seed");
  }
}

/** Volume mount can hide image-bundled content; seed only missing files, never overwrite admin data. */
export function seedWritableContentIfNeeded() {
  if (!fs.existsSync(SEED_ROOT)) return;
  seedSessionImages();
  seedSessionThemesJson();
}
