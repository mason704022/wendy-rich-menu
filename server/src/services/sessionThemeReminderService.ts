import { getDb } from "../db/index.js";
import { getConfig, liffUrl } from "../config.js";
import { notifyAdmin } from "../lineClient.js";
import { listBookableWeeksInWindow } from "./bookingWindow.js";
import {
  formatWeekRangeLabel,
  getSessionThemes,
} from "./sessionThemeService.js";

const REMINDER_KEY = "theme_upload_reminder_last_sent";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

function getLastReminderMs(): number {
  const db = getDb();
  const row = db
    .prepare("SELECT value FROM scheduler_kv WHERE key = ?")
    .get(REMINDER_KEY) as { value: string } | undefined;
  if (!row?.value) return 0;
  const ms = Date.parse(row.value);
  return Number.isFinite(ms) ? ms : 0;
}

function setLastReminderNow(): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO scheduler_kv (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(REMINDER_KEY, new Date().toISOString());
}

function listWeekStartsMissingTheme(): string[] {
  const { weeks } = getSessionThemes();
  const bookable = listBookableWeeksInWindow();
  const missing: string[] = [];

  for (const { weekStart } of bookable) {
    const theme = weeks.find((w) => w.weekStart === weekStart);
    const hasContent = Boolean(
      theme && (theme.title.trim() || theme.intro.trim() || theme.image.trim())
    );
    if (!hasContent) missing.push(weekStart);
  }

  return missing;
}

export async function sendThemeUploadReminderIfDue(): Promise<boolean> {
  const { adminLineUserId } = getConfig();
  if (!adminLineUserId) return false;

  const now = Date.now();
  if (now - getLastReminderMs() < WEEK_MS) return false;

  const missing = listWeekStartsMissingTheme();
  if (missing.length === 0) return false;

  const lines = missing.map((ws) => `· ${formatWeekRangeLabel(ws)}（週起 ${ws}）`);
  const adminPage = liffUrl("admin");

  await notifyAdmin(
    [
      "【系統】每週課程內容提醒",
      "以下「一週內可預約」的週次尚未上傳課程（標題／簡介／圖片至少填一項）：",
      "",
      ...lines,
      "",
      `請至管理後台「課程主題」補上：${adminPage}`,
    ].join("\n")
  );

  setLastReminderNow();
  return true;
}

export function startSessionThemeReminderScheduler(): void {
  const tick = () => {
    sendThemeUploadReminderIfDue().catch((err) => {
      console.error("[Theme upload reminder]", err);
    });
  };
  tick();
  setInterval(tick, CHECK_INTERVAL_MS);
  console.log("[Theme upload reminder] Weekly check (every 7 days when themes missing)");
}
