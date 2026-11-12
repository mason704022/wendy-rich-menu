/**
 * 手動／滿班時段：開課前一日、人數達標後才發開班 LINE。
 *
 *   npx tsx src/scripts/send-class-opening-notifications.ts --date 2026-11-11 --start 09:00 --apply
 *   npx tsx src/scripts/send-class-opening-notifications.ts --date 2026-11-11 --start 09:00 --apply --force
 *
 * 預設 --require-day-before（slot 須為明天）；本機測試可加 --skip-day-check
 */
import "dotenv/config";
import { initDatabase, getDb } from "../db/index.js";
import { getConfig } from "../config.js";
import { notifyAdmin, notifyUser } from "../lineClient.js";
import {
  getConfirmedCountForSlot,
  getManualClassNotifyRule,
  listActiveBookingsForSlot,
} from "../services/bookingService.js";
import {
  buildStaffClassOpenedMessage,
  buildStudentClassOpenedMessage,
} from "../services/classOpeningMessages.js";
import { formatLocalDate } from "../utils/localDate.js";
import { MIN_CLASS_OPENING } from "../services/classOpeningConfig.js";

function parseArgs() {
  const args = process.argv.slice(2);
  let slotDate = "";
  let startTime = "";
  let minConfirmed = 0;
  let apply = false;
  let force = false;
  let skipDayCheck = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--date" && args[i + 1]) slotDate = args[++i];
    else if (args[i] === "--start" && args[i + 1]) startTime = args[++i];
    else if (args[i] === "--min" && args[i + 1]) minConfirmed = Number(args[++i]);
    else if (args[i] === "--apply") apply = true;
    else if (args[i] === "--force") force = true;
    else if (args[i] === "--skip-day-check") skipDayCheck = true;
  }
  if (!slotDate || !startTime) {
    console.error(
      "Usage: --date YYYY-MM-DD --start HH:MM [--min N] --apply [--force] [--skip-day-check]"
    );
    process.exit(1);
  }
  const manual = getManualClassNotifyRule(slotDate, startTime);
  const min = minConfirmed > 0 ? minConfirmed : (manual?.minConfirmed ?? MIN_CLASS_OPENING);
  return { slotDate, startTime, minConfirmed: min, apply, force, skipDayCheck };
}

function isSlotTomorrow(slotDate: string): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return formatLocalDate(tomorrow) === slotDate;
}

async function main() {
  const { slotDate, startTime, minConfirmed, apply, force, skipDayCheck } = parseArgs();
  initDatabase();
  const db = getDb();

  if (!skipDayCheck && !isSlotTomorrow(slotDate)) {
    console.error(
      `SKIP: ${slotDate} 不是明天（開課前一日才發）。加 --skip-day-check 僅供測試。`
    );
    process.exit(1);
  }

  const confirmedCount = getConfirmedCountForSlot(slotDate, startTime);
  if (confirmedCount < minConfirmed) {
    console.error(
      `SKIP: 正取 ${confirmedCount} 人，未達 ${minConfirmed} 人。湊滿後再發。`
    );
    process.exit(1);
  }

  const decided = db
    .prepare(`SELECT 1 FROM slot_opening_decisions WHERE slot_date = ? AND start_time = ?`)
    .get(slotDate, startTime);

  if (decided && !force) {
    console.error("SKIP: 已有 slot_opening_decisions。若需重發加 --force");
    process.exit(1);
  }

  const bookings = listActiveBookingsForSlot(slotDate, startTime);
  const confirmed = bookings.filter((b) => b.status === "confirmed");
  if (confirmed.length === 0) {
    console.error("SKIP: 無正取");
    process.exit(1);
  }

  const endTime = confirmed[0].end_time;
  const staffMessage = buildStaffClassOpenedMessage(
    slotDate,
    startTime,
    endTime,
    confirmedCount,
    confirmed
  );

  console.log(
    JSON.stringify(
      { dryRun: !apply, slotDate, startTime, confirmedCount, staffPreview: staffMessage.slice(0, 120) },
      null,
      2
    )
  );

  if (!apply) {
    console.log("Dry run — 加 --apply 才會發 LINE。");
    return;
  }

  for (const booking of confirmed) {
    await notifyUser(booking.line_user_id, buildStudentClassOpenedMessage(booking));
  }

  const { drinkOrderLineUserId, adminLineUserId } = getConfig();
  const staffId = drinkOrderLineUserId || adminLineUserId;
  if (staffId) {
    await notifyUser(staffId, staffMessage);
  }
  await notifyAdmin(staffMessage);

  if (decided && force) {
    db.prepare(
      `UPDATE slot_opening_decisions SET status = 'opened', confirmed_count = ? WHERE slot_date = ? AND start_time = ?`
    ).run(confirmedCount, slotDate, startTime);
  } else {
    db.prepare(
      `INSERT INTO slot_opening_decisions (slot_date, start_time, status, confirmed_count)
       VALUES (?, ?, 'opened', ?)`
    ).run(slotDate, startTime, confirmedCount);
  }

  console.log(`Sent to ${confirmed.length} students + admin/staff.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
