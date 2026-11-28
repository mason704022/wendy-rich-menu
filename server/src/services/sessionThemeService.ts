import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { getWritableContentRoot, loadJson } from "../config.js";
import { SLOT_TEMPLATES } from "./slotTemplates.js";
import {
  formatLocalDate,
  getWeekStart,
  parseLocalDateString,
  todayIsoLocal,
} from "../utils/localDate.js";

export { getWeekStart, todayIsoLocal } from "../utils/localDate.js";

function themesFile(): string {
  return path.join(getWritableContentRoot(), "session-themes.json");
}

function imagesDir(): string {
  return path.join(getWritableContentRoot(), "images", "sessions");
}
export const ADMIN_THEME_WEEK_COUNT = 8;

/** 週三=3、週五=5、週六=6；未設定或 true = 開放預約 */
export type SlotBookingEnabled = Partial<Record<3 | 5 | 6, boolean>>;

export interface WeekSessionTheme {
  weekStart: string;
  title: string;
  intro: string;
  image: string;
  slotBookingEnabled?: SlotBookingEnabled;
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

function platformDefaultTheme(): ResolvedSessionTheme {
  try {
    const courses = loadJson<{ courseName?: string; introduction?: string }>("courses.json");
    return {
      title: courses.courseName ?? "藏在咖啡廳裡的畫畫課",
      intro: courses.introduction ?? "",
      imageUrl: "/content/images/sessions/weekly-default.svg",
    };
  } catch {
    return {
      title: "藏在咖啡廳裡的畫畫課",
      intro: "",
      imageUrl: "/content/images/sessions/weekly-default.svg",
    };
  }
}

function ensureImagesDir() {
  const dir = imagesDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
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

function parseSlotBookingEnabled(raw: unknown): SlotBookingEnabled | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  const out: SlotBookingEnabled = {};
  for (const wd of [3, 5, 6] as const) {
    const v = obj[String(wd)];
    if (v === false) out[wd] = false;
    else if (v === true) out[wd] = true;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function isWeekdayBookingEnabled(
  slotBookingEnabled: SlotBookingEnabled | undefined,
  weekday: number
): boolean {
  if (weekday !== 3 && weekday !== 5 && weekday !== 6) return true;
  return slotBookingEnabled?.[weekday as 3 | 5 | 6] !== false;
}

/** 該堂是否在學員可預約列表中顯示（不影響特別班覆寫文案、不處理滿班特例） */
export function isSlotOfferedForBooking(slotDate: string, startTime: string): boolean {
  const weekday = parseLocalDateString(slotDate).getDay();
  const template = SLOT_TEMPLATES.find(
    (t) => t.weekday === weekday && t.startTime === startTime
  );
  if (!template) return false;

  const weekStart = getWeekStart(slotDate);
  const theme = findWeekTheme(getSessionThemes().weeks, weekStart);
  return isWeekdayBookingEnabled(theme?.slotBookingEnabled, weekday);
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
        slotBookingEnabled: parseSlotBookingEnabled(
          (w as WeekSessionTheme).slotBookingEnabled
        ),
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
  const file = themesFile();
  if (!fs.existsSync(file)) {
    return { weeks: [], overrides: [] };
  }
  const raw = JSON.parse(fs.readFileSync(file, "utf-8"));
  return migrateLegacyData(raw);
}

export function saveSessionThemes(data: SessionThemesData): void {
  ensureImagesDir();
  data.weeks.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  fs.writeFileSync(themesFile(), JSON.stringify(data, null, 2), "utf-8");
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
  const theme = findWeekTheme(data.weeks, weekStart);

  if (theme && hasThemeContent(theme)) {
    return {
      title: theme.title,
      intro: theme.intro,
      imageUrl: theme.image,
    };
  }

  return platformDefaultTheme();
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
  patch: {
    title: string;
    intro: string;
    image?: string;
    slotBookingEnabled?: SlotBookingEnabled;
  }
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
  const prior = index >= 0 ? data.weeks[index] : undefined;
  const updated: WeekSessionTheme = {
    weekStart,
    title: patch.title,
    intro: patch.intro,
    image: patch.image ?? prior?.image ?? "",
    slotBookingEnabled:
      patch.slotBookingEnabled !== undefined
        ? patch.slotBookingEnabled
        : prior?.slotBookingEnabled,
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
  const outPath = path.join(imagesDir(), filename);

  await sharp(buffer)
    .rotate()
    .resize(400, 400, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(outPath);

  return `/content/images/sessions/${filename}`;
}
