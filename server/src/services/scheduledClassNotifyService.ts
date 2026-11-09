import { getDb } from "../db/index.js";
import { getConfig } from "../config.js";
import { notifyAdmin, notifyUser } from "../lineClient.js";
import {
  getConfirmedCountForSlot,
  listActiveBookingsForSlot,
} from "./bookingService.js";
import {
  buildStaffClassOpenedMessage,
  buildStudentClassOpenedMessage,
  type StaffRosterExtra,
} from "./classOpeningMessages.js";

/** 2026-11-11 週三早堂：11/10 09:00（台北）發開班通知 */
const SCHEDULED_JOBS: Array<{
  kvKey: string;
  slotDate: string;
  startTime: string;
  /** 最早執行時刻（ISO 含 +08:00） */
  notBeforeIso: string;
  minConfirmedInDb: number;
  displayHeadcount: number;
  rosterExtras: StaffRosterExtra[];
  /** 不發學員個別 LINE（僅計入管理／回咖啡彙整） */
  excludeStudentNotifyLineIds: string[];
}> = [
  {
    kvKey: "scheduled_notify:2026-11-11T09:00",
    slotDate: "2026-11-11",
    startTime: "09:00",
    notBeforeIso: "2026-11-10T09:00:00+08:00",
    minConfirmedInDb: 9,
    displayHeadcount: 10,
    rosterExtras: [{ name: "毓雯", drinkLabel: "髒髒咖啡（冰）" }],
    excludeStudentNotifyLineIds: [],
  },
];

const CHECK_INTERVAL_MS = 60 * 1000;

function isJobDone(kvKey: string): boolean {
  const row = getDb()
    .prepare("SELECT value FROM scheduler_kv WHERE key = ?")
    .get(kvKey) as { value: string } | undefined;
  return row?.value === "done";
}

function markJobDone(kvKey: string): void {
  getDb()
    .prepare(
      `INSERT INTO scheduler_kv (key, value) VALUES (?, 'done')
       ON CONFLICT(key) DO UPDATE SET value = 'done'`
    )
    .run(kvKey);
}

async function runScheduledClassNotifyJob(job: (typeof SCHEDULED_JOBS)[number]): Promise<boolean> {
  if (isJobDone(job.kvKey)) return false;
  if (Date.now() < Date.parse(job.notBeforeIso)) return false;

  const db = getDb();
  const confirmedCount = getConfirmedCountForSlot(job.slotDate, job.startTime);
  if (confirmedCount < job.minConfirmedInDb) {
    console.warn(
      `[Scheduled class notify] ${job.slotDate} ${job.startTime}: only ${confirmedCount} confirmed, need ${job.minConfirmedInDb}`
    );
    return false;
  }

  const bookings = listActiveBookingsForSlot(job.slotDate, job.startTime);
  const confirmed = bookings.filter((b) => b.status === "confirmed");
  if (confirmed.length === 0) return false;

  const exclude = new Set(job.excludeStudentNotifyLineIds);
  const endTime = confirmed[0].end_time;

  const staffMessage = buildStaffClassOpenedMessage(
    job.slotDate,
    job.startTime,
    endTime,
    job.displayHeadcount,
    confirmed,
    job.rosterExtras
  );

  let studentsSent = 0;
  for (const booking of confirmed) {
    if (exclude.has(booking.line_user_id)) continue;
    await notifyUser(booking.line_user_id, buildStudentClassOpenedMessage(booking));
    studentsSent += 1;
  }

  const { drinkOrderLineUserId, adminLineUserId } = getConfig();
  const staffId = drinkOrderLineUserId || adminLineUserId;
  if (staffId) {
    await notifyUser(staffId, staffMessage);
  }
  await notifyAdmin(staffMessage);

  const decided = db
    .prepare(
      `SELECT 1 FROM slot_opening_decisions WHERE slot_date = ? AND start_time = ?`
    )
    .get(job.slotDate, job.startTime);

  if (decided) {
    db.prepare(
      `UPDATE slot_opening_decisions SET status = 'opened', confirmed_count = ? WHERE slot_date = ? AND start_time = ?`
    ).run(job.displayHeadcount, job.slotDate, job.startTime);
  } else {
    db.prepare(
      `INSERT INTO slot_opening_decisions (slot_date, start_time, status, confirmed_count)
       VALUES (?, ?, 'opened', ?)`
    ).run(job.slotDate, job.startTime, job.displayHeadcount);
  }

  markJobDone(job.kvKey);
  console.log(
    `[Scheduled class notify] Sent ${job.slotDate} ${job.startTime}: ${studentsSent} students, staff/admin notified (headcount ${job.displayHeadcount})`
  );
  return true;
}

export async function processScheduledClassNotifyJobs(): Promise<number> {
  let ran = 0;
  for (const job of SCHEDULED_JOBS) {
    try {
      if (await runScheduledClassNotifyJob(job)) ran += 1;
    } catch (err) {
      console.error("[Scheduled class notify]", job.kvKey, err);
    }
  }
  return ran;
}

export function startScheduledClassNotifyScheduler(): void {
  const tick = () => {
    processScheduledClassNotifyJobs().catch((err) => {
      console.error("[Scheduled class notify scheduler]", err);
    });
  };
  tick();
  setInterval(tick, CHECK_INTERVAL_MS);
  console.log(
    `[Scheduled class notify] Checker every ${CHECK_INTERVAL_MS / 1000}s (${SCHEDULED_JOBS.length} job(s))`
  );
}
