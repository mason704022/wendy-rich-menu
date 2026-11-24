import { getDb } from "../db/index.js";
import { addDaysLocal, getWeekStart, parseLocalDateString } from "../utils/localDate.js";
import { getTaipeiClock } from "../utils/taipeiTime.js";

export const BOOKING_RELEASE_WEEKS_AHEAD = 6;

/** 一次性：2026-11-25 08:00 台北，開到含 2027/1/2（六）那週 */
export const ONE_TIME_SEED_MS = Date.parse("2026-11-25T08:00:00+08:00");
export const ONE_TIME_RELEASED_THROUGH_WEEK_START = "2026-12-28";

const RELEASED_THROUGH_KEY = "booking_released_through_week_start";
const ONE_TIME_SEED_KEY = "booking_one_time_seed_20261125";
const WEEKLY_RELEASE_PREFIX = "booking_weekly_release_";

function readKv(key: string): string | undefined {
  const row = getDb()
    .prepare("SELECT value FROM scheduler_kv WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value;
}

function writeKv(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO scheduler_kv (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(key, value);
}

function maxWeekStart(a: string, b: string): string {
  return a >= b ? a : b;
}

export function getReleasedThroughWeekStart(): string | null {
  const value = readKv(RELEASED_THROUGH_KEY);
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function setReleasedThroughWeekStart(weekStart: string): void {
  writeKv(RELEASED_THROUGH_KEY, weekStart);
}

/** 該週日 21:00 台北：本週週一 + 6 週 */
export function weekStartToReleaseOnSunday(sundayDate: string): string {
  return addDaysLocal(getWeekStart(sundayDate), BOOKING_RELEASE_WEEKS_AHEAD * 7);
}

export function applyWeeklyBookingRelease(sundayDate: string): boolean {
  const dedupeKey = `${WEEKLY_RELEASE_PREFIX}${sundayDate}`;
  if (readKv(dedupeKey) === "done") return false;

  const target = weekStartToReleaseOnSunday(sundayDate);
  const current = getReleasedThroughWeekStart();
  const next = current ? maxWeekStart(current, target) : target;

  const changed = current !== next;
  if (changed) {
    setReleasedThroughWeekStart(next);
    console.log(
      `[booking-release] weekly sunday=${sundayDate} releasedThroughWeekStart=${next}`
    );
  }
  writeKv(dedupeKey, "done");
  return changed;
}

export function applyOneTimeBookingSeedIfDue(): boolean {
  if (Date.now() < ONE_TIME_SEED_MS) return false;
  if (readKv(ONE_TIME_SEED_KEY) === "done") return false;

  const current = getReleasedThroughWeekStart();
  const next = current
    ? maxWeekStart(current, ONE_TIME_RELEASED_THROUGH_WEEK_START)
    : ONE_TIME_RELEASED_THROUGH_WEEK_START;
  setReleasedThroughWeekStart(next);
  writeKv(ONE_TIME_SEED_KEY, "done");
  console.log(
    `[booking-release] one-time seed releasedThroughWeekStart=${next}`
  );
  return true;
}

export function runBookingReleaseTick(): void {
  applyOneTimeBookingSeedIfDue();

  if (readKv(ONE_TIME_SEED_KEY) !== "done") return;

  const { date, hour, minute } = getTaipeiClock();
  const weekday = parseLocalDateString(date).getDay();
  if (weekday !== 0) return;
  if (hour !== 21 || minute > 4) return;

  applyWeeklyBookingRelease(date);
}