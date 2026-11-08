/**
 * Fill a slot with placeholder confirmed bookings (e.g. show 10/10 滿班).
 * Usage:
 *   npx tsx src/scripts/fill-slot-confirmed.ts --date 2026-11-11 --start 09:00 --count 10
 */
import "dotenv/config";
import { getDb } from "../db/index.js";
import { SLOT_TEMPLATES } from "../services/slotTemplates.js";
import { getConfirmedCountForSlot } from "../services/bookingService.js";

function parseArgs() {
  const args = process.argv.slice(2);
  let slotDate = "";
  let startTime = "";
  let count = 10;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--date" && args[i + 1]) slotDate = args[++i];
    else if (args[i] === "--start" && args[i + 1]) startTime = args[++i];
    else if (args[i] === "--count" && args[i + 1]) count = Number(args[++i]);
  }
  if (!slotDate || !startTime) {
    console.error("Usage: --date YYYY-MM-DD --start HH:MM [--count 10]");
    process.exit(1);
  }
  return { slotDate, startTime, count };
}

async function main() {
  const { slotDate, startTime, count } = parseArgs();
  const d = new Date(`${slotDate}T12:00:00`);
  const weekday = d.getDay();
  const template = SLOT_TEMPLATES.find(
    (t) => t.weekday === weekday && t.startTime === startTime
  );
  if (!template) {
    console.error("No slot template for", slotDate, startTime, "weekday", weekday);
    process.exit(1);
  }

  const db = getDb();
  const existing = getConfirmedCountForSlot(slotDate, startTime);
  const need = Math.max(0, count - existing);
  if (need === 0) {
    console.log(`Already ${existing} confirmed — nothing to add.`);
    return;
  }

  const insertMember = db.prepare(
    `INSERT OR IGNORE INTO members (line_user_id, display_name, name, phone)
     VALUES (?, ?, ?, ?)`
  );
  const insertBooking = db.prepare(
    `INSERT INTO bookings (line_user_id, slot_date, weekday, start_time, end_time, status, coffee_item_id, coffee_temperature)
     VALUES (?, ?, ?, ?, ?, 'confirmed', '', '')`
  );

  const prefix = `placeholder-${slotDate}-${startTime.replace(":", "")}`;
  let added = 0;
  for (let i = 1; i <= need + 20 && added < need; i++) {
    const lineUserId = `${prefix}-${i}`;
    const taken = db
      .prepare(
        `SELECT 1 FROM bookings
         WHERE line_user_id = ? AND slot_date = ? AND start_time = ? AND status != 'cancelled'`
      )
      .get(lineUserId, slotDate, startTime);
    if (taken) continue;

    insertMember.run(lineUserId, "滿班佔位", `佔位${i}`, `0900000${String(i).padStart(3, "0")}`);
    insertBooking.run(
      lineUserId,
      slotDate,
      template.weekday,
      template.startTime,
      template.endTime
    );
    added++;
  }

  console.log(
    `Slot ${slotDate} ${startTime}: was ${existing} confirmed, added ${added}, now ${getConfirmedCountForSlot(slotDate, startTime)}/${count}.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
