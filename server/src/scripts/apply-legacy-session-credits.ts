/**
 * 舊系統購課剩餘堂數補登（一次性或依 JSON 清單）。
 *
 *   npm run apply-legacy-credits -- --dry-run
 *   npm run apply-legacy-credits -- --apply
 *   npm run apply-legacy-credits -- --apply --file ./content/custom-credits.json
 */
import fs from "fs";
import path from "path";
import "dotenv/config";
import { SERVER_ROOT } from "../config.js";
import { initDatabase, getDb } from "../db/index.js";
import { addSessions, getMember } from "../services/memberService.js";
import { syncMemberToSheetSafe } from "../services/googleSheetsService.js";
import { SQLITE_TAIPEI_NOW } from "../lib/taipeiTime.js";

interface CreditRow {
  lineUserId: string;
  sessions: number;
}

const DEFAULT_FILE = path.join(SERVER_ROOT, "content", "legacy-session-credits.json");

function parseArgs() {
  const args = process.argv.slice(2);
  let apply = false;
  let file = DEFAULT_FILE;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--apply") apply = true;
    else if (args[i] === "--dry-run") apply = false;
    else if (args[i] === "--file" && args[i + 1]) file = path.resolve(args[++i]);
  }
  return { apply, file };
}

function loadCredits(file: string): CreditRow[] {
  const raw = JSON.parse(fs.readFileSync(file, "utf-8"));
  if (!Array.isArray(raw)) throw new Error("JSON must be an array");
  return raw.map((row) => {
    if (!row?.lineUserId || typeof row.sessions !== "number") {
      throw new Error("Each row needs lineUserId and sessions");
    }
    return { lineUserId: String(row.lineUserId).trim(), sessions: row.sessions };
  });
}

function ensureMemberStub(lineUserId: string): void {
  if (getMember(lineUserId)) return;
  getDb().prepare(
    `INSERT INTO members (
       line_user_id, display_name, name, phone, created_at
     ) VALUES (?, '', '（待註冊・舊系統補登）', '', ${SQLITE_TAIPEI_NOW})`
  ).run(lineUserId);
}

function recordLegacyPurchase(lineUserId: string, sessions: number): void {
  getDb().prepare(
    `INSERT INTO purchases (
       line_user_id, sessions_count, amount, original_amount, discount_amount,
       coupon_assignment_id, status, payer_name, transfer_last5, created_at, confirmed_at
     ) VALUES (?, ?, 0, 0, 0, NULL, 'confirmed', '舊系統補登', 'legacy', ${SQLITE_TAIPEI_NOW}, ${SQLITE_TAIPEI_NOW})`
  ).run(lineUserId, sessions);
}

function main() {
  const { apply, file } = parseArgs();
  if (!fs.existsSync(file)) {
    console.error("File not found:", file);
    process.exit(1);
  }

  initDatabase();
  const rows = loadCredits(file);

  let skipped = 0;
  let credited = 0;

  for (const row of rows) {
    if (row.sessions <= 0) {
      console.log(`SKIP ${row.lineUserId} (0 堂)`);
      skipped++;
      continue;
    }

    const before = getMember(row.lineUserId);
    const prevRemaining = before?.remaining_sessions ?? 0;
    const prevTotal = before?.total_sessions ?? 0;

    if (!apply) {
      console.log(
        `WOULD +${row.sessions} → ${row.lineUserId} (${before ? "已有會員" : "將建立佔位會員"}) ` +
          `餘額 ${prevRemaining} → ${prevRemaining + row.sessions}`
      );
      credited++;
      continue;
    }

    ensureMemberStub(row.lineUserId);
    addSessions(row.lineUserId, row.sessions);
    recordLegacyPurchase(row.lineUserId, row.sessions);
    const after = getMember(row.lineUserId)!;
    syncMemberToSheetSafe(after);
    console.log(
      `OK +${row.sessions} ${row.lineUserId} | 餘額 ${prevRemaining}→${after.remaining_sessions} (total ${after.total_sessions})`
    );
    credited++;
  }

  console.log(
    apply
      ? `Done. Credited ${credited} member(s), skipped ${skipped}.`
      : `Dry-run. Would credit ${credited}, skip ${skipped}. Re-run with --apply to write DB.`
  );
}

main();
