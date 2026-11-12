import { getDb } from "../db/index.js";
import { getConfig } from "../config.js";
import { notifyAdmin, notifyUser } from "../lineClient.js";
import {
  getConfirmedCountForSlot,
  getManualClassNotifyRule,
  listActiveBookingsForSlot,
  type Booking,
} from "./bookingService.js";
import { refundSession } from "./memberService.js";
import { getSlotStartMs, isWithinBookingCutoff } from "./bookingTimeUtils.js";
import { syncBookingToSheetSafe } from "./googleSheetsService.js";
import {
  buildStaffClassCancelledMessage,
  buildStaffClassOpenedMessage,
  buildStudentClassCancelledMessage,
  buildStudentClassOpenedMessage,
} from "./classOpeningMessages.js";
import { MIN_CLASS_OPENING } from "./classOpeningConfig.js";

export { MIN_CLASS_OPENING };

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

type SlotKey = { slotDate: string; startTime: string };

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
    if (getManualClassNotifyRule(s.slotDate, s.startTime)) return false;
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

async function notifyClassOpened(slotDate: string, startTime: string, confirmedCount: number) {
  const bookings = listActiveBookingsForSlot(slotDate, startTime);
  if (bookings.length === 0) return;

  const sample = bookings[0];
  const endTime = sample.end_time;
  const confirmed = bookings.filter((b) => b.status === "confirmed");

  for (const booking of confirmed) {
    await notifyUser(booking.line_user_id, buildStudentClassOpenedMessage(booking));
  }

  const staffMessage = buildStaffClassOpenedMessage(
    slotDate,
    startTime,
    endTime,
    confirmedCount,
    confirmed
  );

  const { drinkOrderLineUserId, adminLineUserId } = getConfig();
  const staffId = drinkOrderLineUserId || adminLineUserId;
  if (staffId) {
    await notifyUser(staffId, staffMessage);
  } else {
    console.log("[Class opening staff notify — no DRINK_ORDER_LINE_USER_ID]", staffMessage);
  }

  await notifyAdmin(staffMessage);
}

async function notifyClassFailed(slotDate: string, startTime: string, confirmedCount: number) {
  const bookings = listActiveBookingsForSlot(slotDate, startTime);
  if (bookings.length === 0) return;

  const sample = bookings[0];
  const studentMessage = buildStudentClassCancelledMessage();
  const staffMessage = buildStaffClassCancelledMessage(
    slotDate,
    startTime,
    sample.end_time,
    confirmedCount
  );

  for (const booking of bookings) {
    await notifyUser(booking.line_user_id, studentMessage);
  }

  const { drinkOrderLineUserId, adminLineUserId } = getConfig();
  const staffId = drinkOrderLineUserId || adminLineUserId;
  if (staffId && staffId !== adminLineUserId) {
    await notifyUser(staffId, staffMessage);
  }

  await notifyAdmin(staffMessage);
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
