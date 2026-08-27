import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { SERVER_ROOT } from "../config.js";
import { SLOT_TEMPLATES } from "./slotTemplates.js";
import {
  formatLocalDate,
  getWeekStart,
  parseLocalDateString,
  todayIsoLocal,
} from "../utils/localDate.js";

export { getWeekStart, todayIsoLocal } from "../utils/localDate.js";

const THEMES_FILE = path.join(SERVER_ROOT, "content", "session-themes.json");
const IMAGES_DIR = path.join(SERVER_ROOT, "content", "images", "sessions");
export const ADMIN_THEME_WEEK_COUNT = 5;

export interface WeekSessionTheme {
  weekStart: string;
  title: string;
  intro: string;
  image: string;
}

export interface SessionThemeOverride {
  slotDate: string;
  startTime: string;
  title: string;
  intro: string;
  image: string;
}

export interface SessionThemesData {
  weeks: WeekSessionTheme[];
  overrides: SessionThemeOverride[];
}

export interface ResolvedSessionTheme {
  title: string;
  intro: string;
  imageUrl: string;
}

const EMPTY_THEME: ResolvedSessionTheme = {
  title: "",
  intro: "",
  imageUrl: "",
};

function ensureImagesDir() {
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }
}

export function formatWeekRangeLabel(weekStart: string): string {
  const start = parseLocalDateString(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `${fmt(start)} – ${fmt(end)}`;
}

export interface AdminWeekSlotRef {
  slotDate: string;
  label: string;
  startTime: string;
  endTime: string;
  display: string;
}

export interface AdminWeekRef {
  weekStart: string;
  weekLabel: string;
  slots: AdminWeekSlotRef[];
}

export function listUpcomingWeekStarts(count = ADMIN_THEME_WEEK_COUNT): string[] {
  const current = getWeekStart(todayIsoLocal());
  const weeks: string[] = [];
  const cursor = parseLocalDateString(current);

  for (let i = 0; i < count; i++) {
    weeks.push(formatLocalDate(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }

  return weeks;
}

function listTemplateSlotsInWeek(weekStart: string): AdminWeekSlotRef[] {
  const start = parseLocalDateString(weekStart);
  const slots: AdminWeekSlotRef[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const slotDate = formatLocalDate(d);
    const weekday = d.getDay();

    for (const template of SLOT_TEMPLATES) {
      if (template.weekday !== weekday) continue;
      slots.push({
        slotDate,
        label: template.label,
        startTime: template.startTime,
        endTime: template.endTime,
        display: `${slotDate}（${template.label}）${template.startTime}-${template.endTime}`,
      });
    }
  }

  return slots;
}

export function listAdminThemeWeeks(): AdminWeekRef[] {
  return listUpcomingWeekStarts(ADMIN_THEME_WEEK_COUNT).map((weekStart) => ({
    weekStart,
    weekLabel: formatWeekRangeLabel(weekStart),
    slots: listTemplateSlotsInWeek(weekStart),
  }));
}

function emptyWeekTheme(weekStart: string): WeekSessionTheme {
  return { weekStart, title: "", intro: "", image: "" };
}

function hasThemeContent(theme: Pick<WeekSessionTheme, "title" | "intro" | "image">): boolean {
  return Boolean(theme.title || theme.intro || theme.image);
}

function migrateLegacyData(raw: unknown): SessionThemesData {
  if (!raw || typeof raw !== "object") {
    return { weeks: [], overrides: [] };
  }

  const obj = raw as Record<string, unknown>;

  if (Array.isArray(obj.weeks)) {
    return {
      weeks: (obj.weeks as WeekSessionTheme[]).map((w) => ({
        weekStart: w.weekStart,
        title: w.title ?? "",
        intro: w.intro ?? "",
        image: w.image ?? "",
      })),
      overrides: Array.isArray(obj.overrides)
        ? (obj.overrides as SessionThemeOverride[])
        : [],
    };
  }

  const overrides = Array.isArray(obj.overrides)
    ? (obj.overrides as SessionThemeOverride[])
    : [];

  if (obj.weekly && typeof obj.weekly === "object") {
    const weekly = obj.weekly as Omit<WeekSessionTheme, "weekStart">;
    return {
      weeks: [
        {
          weekStart: getWeekStart(todayIsoLocal()),
          title: weekly.title ?? "",
          intro: weekly.intro ?? "",
          image: weekly.image ?? "",
        },
      ],
      overrides,
    };
  }

  const templates = Array.isArray(obj.templates) ? obj.templates : [];
  const first = templates[0] as Omit<WeekSessionTheme, "weekStart"> | undefined;

  return {
    weeks: first
      ? [
          {
            weekStart: getWeekStart(todayIsoLocal()),
            title: first.title ?? "",
            intro: first.intro ?? "",
            image: first.image ?? "",
          },
        ]
      : [],
    overrides,
  };
}

export function getSessionThemes(): SessionThemesData {
  if (!fs.existsSync(THEMES_FILE)) {
    return { weeks: [], overrides: [] };
  }
  const raw = JSON.parse(fs.readFileSync(THEMES_FILE, "utf-8"));
  return migrateLegacyData(raw);
}

export function saveSessionThemes(data: SessionThemesData): void {
  ensureImagesDir();
  data.weeks.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  fs.writeFileSync(THEMES_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export function getSlotOptions() {
  return SLOT_TEMPLATES.map((t) => ({
    weekday: t.weekday,
    label: t.label,
    startTime: t.startTime,
    endTime: t.endTime,
    display: `${t.label} ${t.startTime}-${t.endTime}`,
  }));
}

function findWeekTheme(
  weeks: WeekSessionTheme[],
  weekStart: string
): WeekSessionTheme | undefined {
  return weeks.find((w) => w.weekStart === weekStart);
}

function findFallbackWeekTheme(
  weeks: WeekSessionTheme[],
  weekStart: string
): WeekSessionTheme | undefined {
  const candidates = weeks
    .filter((w) => w.weekStart <= weekStart && hasThemeContent(w))
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  return candidates[0];
}

export function resolveSessionTheme(
  slotDate: string,
  startTime: string,
  _weekday?: number
): ResolvedSessionTheme {
  const data = getSessionThemes();

  const override = data.overrides.find(
    (o) => o.slotDate === slotDate && o.startTime === startTime
  );
  if (override) {
    return {
      title: override.title,
      intro: override.intro,
      imageUrl: override.image,
    };
  }

  const weekStart = getWeekStart(slotDate);
  const theme =
    findWeekTheme(data.weeks, weekStart) ??
    findFallbackWeekTheme(data.weeks, weekStart);

  if (theme && hasThemeContent(theme)) {
    return {
      title: theme.title,
      intro: theme.intro,
      imageUrl: theme.image,
    };
  }

  return EMPTY_THEME;
}

export function listWeekThemesForAdmin(): WeekSessionTheme[] {
  const data = getSessionThemes();
  return listUpcomingWeekStarts(ADMIN_THEME_WEEK_COUNT).map((weekStart) => {
    const stored = findWeekTheme(data.weeks, weekStart);
    return stored ?? emptyWeekTheme(weekStart);
  });
}

export function updateWeekSessionTheme(
  weekStart: string,
  patch: { title: string; intro: string; image?: string }
): WeekSessionTheme {
  if (getWeekStart(weekStart) !== weekStart) {
    throw new Error("INVALID_WEEK_START");
  }

  const allowedWeeks = listUpcomingWeekStarts(ADMIN_THEME_WEEK_COUNT);
  if (!allowedWeeks.includes(weekStart)) {
    throw new Error("WEEK_OUT_OF_RANGE");
  }

  const data = getSessionThemes();
  const index = data.weeks.findIndex((w) => w.weekStart === weekStart);
  const updated: WeekSessionTheme = {
    weekStart,
    title: patch.title,
    intro: patch.intro,
    image: patch.image ?? (index >= 0 ? data.weeks[index].image : ""),
  };

  if (index === -1) {
    data.weeks.push(updated);
  } else {
    data.weeks[index] = updated;
  }

  saveSessionThemes(data);
  return updated;
}

export function addSessionThemeOverride(
  entry: SessionThemeOverride
): SessionThemeOverride {
  const data = getSessionThemes();
  const exists = data.overrides.some(
    (o) => o.slotDate === entry.slotDate && o.startTime === entry.startTime
  );
  if (exists) throw new Error("OVERRIDE_EXISTS");

  data.overrides.push(entry);
  data.overrides.sort((a, b) =>
    a.slotDate === b.slotDate
      ? a.startTime.localeCompare(b.startTime)
      : a.slotDate.localeCompare(b.slotDate)
  );
  saveSessionThemes(data);
  return entry;
}

export function updateSessionThemeOverride(
  slotDate: string,
  startTime: string,
  patch: { title: string; intro: string; image?: string }
): SessionThemeOverride {
  const data = getSessionThemes();
  const index = data.overrides.findIndex(
    (o) => o.slotDate === slotDate && o.startTime === startTime
  );
  if (index === -1) throw new Error("OVERRIDE_NOT_FOUND");

  const updated: SessionThemeOverride = {
    ...data.overrides[index],
    title: patch.title,
    intro: patch.intro,
    ...(patch.image !== undefined ? { image: patch.image } : {}),
  };
  data.overrides[index] = updated;
  saveSessionThemes(data);
  return updated;
}

export function deleteSessionThemeOverride(
  slotDate: string,
  startTime: string
): void {
  const data = getSessionThemes();
  const before = data.overrides.length;
  data.overrides = data.overrides.filter(
    (o) => !(o.slotDate === slotDate && o.startTime === startTime)
  );
  if (data.overrides.length === before) throw new Error("OVERRIDE_NOT_FOUND");
  saveSessionThemes(data);
}

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export async function saveUploadedSessionImage(buffer: Buffer): Promise<string> {
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error("IMAGE_TOO_LARGE");
  }

  ensureImagesDir();

  const filename = `${randomUUID()}.webp`;
  const outPath = path.join(IMAGES_DIR, filename);

  await sharp(buffer)
    .rotate()
    .resize(400, 400, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(outPath);

  return `/content/images/sessions/${filename}`;
}
