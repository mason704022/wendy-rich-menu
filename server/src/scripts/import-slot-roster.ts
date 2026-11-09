/**
 * 特例：手動匯入時段正取名單（僅預約 + 扣堂 + 同步試算表，不發 LINE）
 *
 *   npx tsx src/scripts/import-slot-roster.ts --dry-run
 *   npx tsx src/scripts/import-slot-roster.ts --apply
 *
 * 開課通知請用 send-class-opening-notifications.ts（開課前一日、人數達標後）
 */
import "dotenv/config";
import { initDatabase, getDb } from "../db/index.js";
import { getMember, deductSession } from "../services/memberService.js";
import { syncBookingToSheetSafe, syncMemberToSheetSafe } from "../services/googleSheetsService.js";
import {
  type Booking,
} from "../services/bookingService.js";

const SLOT_DATE = "2026-11-11";
const START_TIME = "09:00";
const END_TIME = "11:00";
const WEEKDAY = 3;

type RosterRow = {
  name: string;
  lineUserId: string;
  coffeeItemId: string;
  coffeeTemperature: string;
};

/** 11/11 週三早上 — 有 LINE ID 者 */
const ROSTER: RosterRow[] = [
  { name: "月瓊", lineUserId: "U0fe43955b5475103822d6a61e22698d6", coffeeItemId: "honey-cinnamon-cap-hot", coffeeTemperature: "" },
  { name: "Kayla", lineUserId: "Ub83d9b6c1a53c0e50942d4ff7005f5ff", coffeeItemId: "honey-cinnamon-cap-hot", coffeeTemperature: "" },
  { name: "Vivian", lineUserId: "U7282b684564d23c1d75c93a5d05098b9", coffeeItemId: "dirty-coffee", coffeeTemperature: "" },
  { name: "雅淇", lineUserId: "U3851bc500cf84adc6603816fef4c132d", coffeeItemId: "honey-cinnamon-cap-ice", coffeeTemperature: "" },
  { name: "Kiki", lineUserId: "Ue2e6fbc65cf850cedfb982c3552921ba", coffeeItemId: "honey-lemon-chia", coffeeTemperature: "" },
  { name: "Sabrina", lineUserId: "Uc4e76abf29bfa1ced4cf2feef80e788c", coffeeItemId: "honey-cinnamon-cap-hot", coffeeTemperature: "" },
  { name: "怡葶", lineUserId: "Uc68ee2bb0cde203251a7357ea4488bd8", coffeeItemId: "latte-hot", coffeeTemperature: "" },
];

function parseArgs() {
  return {
    apply: process.argv.includes("--apply"),
    dryRun: process.argv.includes("--dry-run") || !process.argv.includes("--apply"),
  };
}

function main() {
  const { apply, dryRun } = parseArgs();
  initDatabase();
  const db = getDb();

  const results: Array<Record<string, unknown>> = [];

  for (const row of ROSTER) {
    const member = getMember(row.lineUserId);
    if (!member) {
      results.push({ name: row.name, lineUserId: row.lineUserId, error: "NOT_REGISTERED" });
      continue;
    }

    const existing = db
      .prepare(
        `SELECT id FROM bookings
         WHERE line_user_id = ? AND slot_date = ? AND start_time = ? AND status != 'cancelled'`
      )
      .get(row.lineUserId, SLOT_DATE, START_TIME) as { id: number } | undefined;

    if (existing) {
      results.push({
        name: row.name,
        lineUserId: row.lineUserId,
        skip: "ALREADY_BOOKED",
        bookingId: existing.id,
      });
      continue;
    }

    const beforeRemaining = member.remaining_sessions;
    const beforeTotal = member.total_sessions;

    if (beforeRemaining <= 0) {
      results.push({
        name: row.name,
        lineUserId: row.lineUserId,
        error: "INSUFFICIENT_SESSIONS",
        beforeRemaining,
      });
      continue;
    }

    if (dryRun) {
      results.push({
        name: row.name,
        lineUserId: row.lineUserId,
        dryRun: true,
        beforeRemaining,
        afterRemaining: beforeRemaining - 1,
        coffee: row.coffeeItemId,
      });
      continue;
    }

    const insert = db
      .prepare(
        `INSERT INTO bookings (line_user_id, slot_date, weekday, start_time, end_time, status, coffee_item_id, coffee_temperature, created_at)
         VALUES (?, ?, ?, ?, ?, 'confirmed', ?, ?, datetime('now', '+8 hours'))`
      )
      .run(
        row.lineUserId,
        SLOT_DATE,
        WEEKDAY,
        START_TIME,
        END_TIME,
        row.coffeeItemId,
        row.coffeeTemperature
      );

    deductSession(row.lineUserId);
    const after = getMember(row.lineUserId)!;
    const booking = db
      .prepare("SELECT * FROM bookings WHERE id = ?")
      .get(insert.lastInsertRowid) as unknown as Booking;
    syncBookingToSheetSafe(booking);
    syncMemberToSheetSafe(after);

    results.push({
      name: row.name,
      lineUserId: row.lineUserId,
      bookingId: insert.lastInsertRowid,
      beforeRemaining,
      afterRemaining: after.remaining_sessions,
      beforeTotal,
      afterTotal: after.total_sessions,
      coffee: row.coffeeItemId,
    });
  }

  console.log(JSON.stringify({ slot: `${SLOT_DATE} ${START_TIME}`, dryRun, results }, null, 2));
}

main();
