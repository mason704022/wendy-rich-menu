/**
 * 若剩餘堂數高於 legacy-session-credits.json 目標值，扣回差額（修正重複補登）。
 *   npx tsx src/scripts/fix-legacy-session-over-credit.ts --dry-run
 *   npx tsx src/scripts/fix-legacy-session-over-credit.ts --apply
 */
import fs from "fs";
import path from "path";
import "dotenv/config";
import { SERVER_ROOT } from "../config.js";
import { initDatabase, getDb } from "../db/index.js";
import { getMember } from "../services/memberService.js";

const DEFAULT_FILE = path.join(SERVER_ROOT, "content", "legacy-session-credits.json");

function parseArgs() {
  const apply = process.argv.includes("--apply");
  return { apply };
}

function loadTargets(): { lineUserId: string; sessions: number }[] {
  const raw = JSON.parse(fs.readFileSync(DEFAULT_FILE, "utf-8"));
  return raw as { lineUserId: string; sessions: number }[];
}

function main() {
  const { apply } = parseArgs();
  initDatabase();
  const db = getDb();

  for (const { lineUserId, sessions: target } of loadTargets()) {
    const member = getMember(lineUserId);
    if (!member) {
      console.log(`SKIP ${lineUserId} (無會員)`);
      continue;
    }
    const excess = member.remaining_sessions - target;
    if (excess <= 0) {
      console.log(
        `OK ${lineUserId} 剩餘 ${member.remaining_sessions}（目標 ${target}，無需調整）`
      );
      continue;
    }

    if (!apply) {
      console.log(
        `WOULD -${excess} ${lineUserId} 餘額 ${member.remaining_sessions} → ${target}`
      );
      continue;
    }

    db.prepare(
      `UPDATE members
       SET remaining_sessions = remaining_sessions - ?,
           total_sessions = MAX(0, total_sessions - ?)
       WHERE line_user_id = ?`
    ).run(excess, excess, lineUserId);

    const after = getMember(lineUserId)!;
    console.log(
      `FIXED -${excess} ${lineUserId} 餘額 ${member.remaining_sessions} → ${after.remaining_sessions}`
    );
  }
}

main();
