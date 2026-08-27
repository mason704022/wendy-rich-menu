import "dotenv/config";
import { initDatabase, getDb } from "../db/index.js";
import { getPurchase } from "../services/purchaseService.js";

initDatabase();
const db = getDb();

const rows = db
  .prepare(
    `SELECT p.id, p.status, p.sessions_count, p.amount, p.created_at,
            m.name, m.phone, p.line_user_id
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
  name: string | null;
  phone: string | null;
  line_user_id: string;
}>;

if (rows.length === 0) {
  console.log("No purchases yet.");
  process.exit(0);
}

console.log("ID | Status    | Member | Phone       | Sessions | Amount | Created");
console.log("-".repeat(72));
for (const r of rows) {
  console.log(
    `${String(r.id).padEnd(2)} | ${r.status.padEnd(9)} | ${(r.name ?? "?").padEnd(6)} | ${(r.phone ?? "?").padEnd(11)} | ${String(r.sessions_count).padEnd(8)} | ${String(r.amount).padEnd(6)} | ${r.created_at}`
  );
}

const pending = rows.filter((r) => r.status === "pending");
if (pending.length > 0) {
  console.log("\nPending — confirm with:");
  for (const p of pending) {
    console.log(`  npm run confirm-purchase -- ${p.id}`);
  }
}
