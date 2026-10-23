import { getDb } from "../db/index.js";
import { getConfig } from "../config.js";
import { notifyAdmin, notifyUser } from "../lineClient.js";
import {
  getConfirmedCountForSlot,
  listActiveBookingsForSlot,
  slotLabelForBooking,
  type Booking,
} from "./bookingService.js";
import { formatCoffeeDisplayName } from "./coffeeMenuService.js";
import { getMember, refundSession } from "./memberService.js";
import { getSlotStartMs, isWithinBookingCutoff } from "./bookingTimeUtils.js";
import { syncBookingToSheetSafe } from "./googleSheetsService.js";

/** 開課門檻：截止預約後正取人數 */
export const MIN_CLASS_OPENING = 6;

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

type SlotKey = { slotDate: string; startTime: string };

function formatSlotLine(booking: Booking): string {
  const label = slotLabelForBooking(booking);
  return `${booking.slot_date}（${label}）${booking.start_time}-${booking.end_time}`;
}

function listSlotsPendingDecision(): SlotKey[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT DISTINCT slot_date AS slotDate, start_time AS startTime
       FROM bookings
       WHERE status IN ('confirmed', 'waitlist')`
    )
    .all() as SlotKey[];

  const now = Date.now();
  return rows.filter((s) => {
    if (getSlotStartMs(s.slotDate, s.startTime) <= now) return false;
    if (!isWithinBookingCutoff(s.slotDate, s.startTime)) return false;
    const decided = db
      .prepare(
        `SELECT 1 FROM slot_opening_decisions
         WHERE slot_date = ? AND start_time = ?`
      )
      .get(s.slotDate, s.startTime);
    return !decided;
  });
}

function recordDecision(
  slotDate: string,
  startTime: string,
  status: "opened" | "failed",
  confirmedCount: number
) {
  const db = getDb();
  db.prepare(
    `INSERT INTO slot_opening_decisions (slot_date, start_time, status, confirmed_count)
     VALUES (?, ?, ?, ?)`
  ).run(slotDate, startTime, status, confirmedCount);
}

function systemCancelAllBookings(slotDate: string, startTime: string) {
  const db = getDb();
  const bookings = listActiveBookingsForSlot(slotDate, startTime);
  for (const booking of bookings) {
    if (booking.status === "cancelled") continue;
    db.prepare(`UPDATE bookings SET status = 'cancelled' WHERE id = ?`).run(booking.id);
    if (booking.status === "confirmed") {
      refundSession(booking.line_user_id);
    }
    const updated = db.prepare("SELECT * FROM bookings WHERE id = ?").get(booking.id) as
      | Booking
      | undefined;
    if (updated) syncBookingToSheetSafe(updated);
  }
}

function buildDrinkLines(slotDate: string, startTime: string): string[] {
  const bookings = listActiveBookingsForSlot(slotDate, startTime).filter(
    (b) => b.status === "confirmed"
  );
  if (bookings.length === 0) return ["（無正取飲品）"];

  return bookings.map((b, i) => {
    const member = getMember(b.line_user_id);
    const drink = b.coffee_item_id
      ? formatCoffeeDisplayName(b.coffee_item_id, b.coffee_temperature)
      : "（未選飲品）";
    return `${i + 1}. ${member?.name ?? "?"} · ${drink}`;
  });
}

async function notifyClassOpened(slotDate: string, startTime: string, confirmedCount: number) {
  const bookings = listActiveBookingsForSlot(slotDate, startTime);
  if (bookings.length === 0) return;

  const slotLine = formatSlotLine(bookings[0]);
  const studentMessage = [
    "【開課成功】",
    slotLine,
    `已過預約截止時間，正取 ${confirmedCount} 人，本堂確定開課！`,
    "期待與您見面。",
  ].join("\n");

  for (const booking of bookings) {
    await notifyUser(booking.line_user_id, studentMessage);
  }

  const drinkLines = buildDrinkLines(slotDate, startTime);
  const staffMessage = [
    "【開課成功｜飲品整理】",
    slotLine,
    `正取 ${confirmedCount} 人`,
    "",
    ...drinkLines,
  ].join("\n");

  const { drinkOrderLineUserId, adminLineUserId } = getConfig();
  const staffId = drinkOrderLineUserId || adminLineUserId;
  if (staffId) {
    await notifyUser(staffId, staffMessage);
  } else {
    console.log("[Drink order notification — no DRINK_ORDER_LINE_USER_ID]", staffMessage);
  }

  await notifyAdmin(
    [
      "【系統】開課成功",
      slotLine,
      `正取 ${confirmedCount} 人，已通知學員並送出飲品整理。`,
    ].join("\n")
  );
}

async function notifyClassFailed(slotDate: string, startTime: string, confirmedCount: number) {
  const bookings = listActiveBookingsForSlot(slotDate, startTime);
  if (bookings.length === 0) return;

  const slotLine = formatSlotLine(bookings[0]);
  const studentMessage = [
    "【開課取消】",
    slotLine,
    `已過預約截止時間，正取僅 ${confirmedCount} 人，未達 ${MIN_CLASS_OPENING} 人開班門檻。`,
    "本堂無法開課，已為您取消預約；若已扣堂數將退回帳戶。",
    "若有疑問請私訊工作室。",
  ].join("\n");

  for (const booking of bookings) {
    await notifyUser(booking.line_user_id, studentMessage);
  }

  await notifyAdmin(
    [
      "【系統】開課失敗",
      slotLine,
      `正取 ${confirmedCount} 人（需 ${MIN_CLASS_OPENING} 人），已取消該堂預約並退回堂數。`,
    ].join("\n")
  );
}

export async function processSlotOpeningDecisions(): Promise<number> {
  const pending = listSlotsPendingDecision();
  let processed = 0;

  for (const { slotDate, startTime } of pending) {
    const confirmedCount = getConfirmedCountForSlot(slotDate, startTime);

    if (confirmedCount >= MIN_CLASS_OPENING) {
      await notifyClassOpened(slotDate, startTime, confirmedCount);
      recordDecision(slotDate, startTime, "opened", confirmedCount);
    } else {
      await notifyClassFailed(slotDate, startTime, confirmedCount);
      systemCancelAllBookings(slotDate, startTime);
      recordDecision(slotDate, startTime, "failed", confirmedCount);
    }
    processed += 1;
  }

  return processed;
}

export function startClassOpeningScheduler(): void {
  const tick = () => {
    processSlotOpeningDecisions().catch((err) => {
      console.error("[Class opening scheduler]", err);
    });
  };
  tick();
  setInterval(tick, CHECK_INTERVAL_MS);
  console.log(
    `[Class opening] Scheduler every ${CHECK_INTERVAL_MS / 60000} min (min ${MIN_CLASS_OPENING} confirmed after cutoff)`
  );
}
