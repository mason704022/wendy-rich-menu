import { initDatabase, getDb } from "../db/index.js";
import "../config.js";

initDatabase();
const db = getDb();

function section(title: string) {
  console.log(`\n=== ${title} ===\n`);
}

const members = db
  .prepare(
    `SELECT line_user_id, display_name, name, phone,
            total_sessions, remaining_sessions, created_at
     FROM members ORDER BY created_at DESC`
  )
  .all() as Array<{
  line_user_id: string;
  display_name: string;
  name: string;
  phone: string;
  total_sessions: number;
  remaining_sessions: number;
  created_at: string;
}>;

section("會員（已註冊）");
if (members.length === 0) {
  console.log("（尚無）");
} else {
  console.log("姓名 | LINE User ID | LINE名稱 | 手機 | 剩餘/總堂數 | 註冊時間");
  console.log("-".repeat(100));
  for (const m of members) {
    console.log(
      `${m.name} | ${m.line_user_id} | ${m.display_name} | ${m.phone} | ${m.remaining_sessions}/${m.total_sessions} | ${m.created_at}`
    );
  }
  console.log("\n提示：將您的 LINE User ID 填入 server/.env → ADMIN_LINE_USER_ID");
}

const purchases = db
  .prepare(
    `SELECT p.id, p.status, p.sessions_count, p.amount, p.created_at,
            p.payer_name, p.transfer_last5,
            m.name, m.phone
     FROM purchases p
     LEFT JOIN members m ON m.line_user_id = p.line_user_id
     ORDER BY p.id DESC`
  )
  .all() as Array<{
  id: number;
  status: string;
  sessions_count: number;
  amount: number;
  created_at: string;
  payer_name: string;
  transfer_last5: string;
  name: string | null;
  phone: string | null;
}>;

section("購課紀錄");
if (purchases.length === 0) {
  console.log("（尚無）");
} else {
  console.log("訂單# | 狀態 | 會員 | 手機 | 堂數 | 金額 | 時間");
  console.log("-".repeat(70));
  for (const p of purchases) {
    const statusLabel =
      p.status === "pending" ? "待確認" : p.status === "confirmed" ? "已確認" : "已拒絕";
    console.log(
      `#${p.id} | ${statusLabel} | ${p.name ?? "?"} | ${p.phone ?? "?"} | ${p.sessions_count}堂 | $${p.amount} | 後五碼:${p.transfer_last5 || "-"} | ${p.created_at}`
    );
  }
  const pending = purchases.filter((p) => p.status === "pending");
  if (pending.length > 0) {
    console.log("\n待確認指令：");
    for (const p of pending) {
      console.log(`  npm run confirm-purchase -- ${p.id}`);
    }
  }
}

const bookings = db
  .prepare(
    `SELECT b.id, b.slot_date, b.start_time, b.end_time, b.status, b.created_at,
            m.name, m.phone
     FROM bookings b
     LEFT JOIN members m ON m.line_user_id = b.line_user_id
     WHERE b.status != 'cancelled'
     ORDER BY b.slot_date, b.start_time`
  )
  .all() as Array<{
  id: number;
  slot_date: string;
  start_time: string;
  end_time: string;
  status: string;
  created_at: string;
  name: string | null;
  phone: string | null;
}>;

section("預約（含正取/備取，不含已取消）");
if (bookings.length === 0) {
  console.log("（尚無）");
} else {
  console.log("預約# | 日期 | 時段 | 狀態 | 會員 | 手機 | 建立時間");
  console.log("-".repeat(70));
  for (const b of bookings) {
    const statusLabel = b.status === "waitlist" ? "備取" : "正取";
    console.log(
      `#${b.id} | ${b.slot_date} | ${b.start_time}-${b.end_time} | ${statusLabel} | ${b.name ?? "?"} | ${b.phone ?? "?"} | ${b.created_at}`
    );
  }
}

console.log("");
