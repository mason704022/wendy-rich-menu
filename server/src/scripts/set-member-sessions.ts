/**
 * 營運用：將會員剩餘／總堂數設為指定值（非加總）。
 *
 *   npx tsx src/scripts/set-member-sessions.ts --id Uxxxx --sessions 5 [--apply]
 */
import "dotenv/config";
import { initDatabase, getDb } from "../db/index.js";
import { getMember } from "../services/memberService.js";
import { syncMemberToSheetSafe } from "../services/googleSheetsService.js";

function parseArgs() {
  const args = process.argv.slice(2);
  let lineUserId = "";
  let sessions = 0;
  let apply = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--id" && args[i + 1]) lineUserId = args[++i];
    else if (args[i] === "--sessions" && args[i + 1]) sessions = Number(args[++i]);
    else if (args[i] === "--apply") apply = true;
  }
  if (!lineUserId || !Number.isFinite(sessions) || sessions < 0) {
    console.error("Usage: --id LINE_USER_ID --sessions N [--apply]");
    process.exit(1);
  }
  return { lineUserId, sessions, apply };
}

function main() {
  const { lineUserId, sessions, apply } = parseArgs();
  initDatabase();
  const before = getMember(lineUserId);
  if (!before) {
    console.error("NOT_REGISTERED:", lineUserId);
    process.exit(1);
  }

  const payload = {
    lineUserId,
    name: before.name,
    before: {
      remaining: before.remaining_sessions,
      total: before.total_sessions,
    },
    target: sessions,
  };

  if (!apply) {
    console.log(JSON.stringify({ ...payload, dryRun: true }, null, 2));
    console.log("Dry run — 加 --apply 才寫入。");
    return;
  }

  getDb()
    .prepare(
      `UPDATE members SET remaining_sessions = ?, total_sessions = ? WHERE line_user_id = ?`
    )
    .run(sessions, sessions, lineUserId);

  const after = getMember(lineUserId)!;
  syncMemberToSheetSafe(after);
  console.log(
    JSON.stringify(
      {
        ...payload,
        after: { remaining: after.remaining_sessions, total: after.total_sessions },
      },
      null,
      2
    )
  );
}

main();
