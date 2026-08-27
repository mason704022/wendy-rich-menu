import "dotenv/config";
import { initDatabase, getDb } from "../db/index.js";
import { getMember } from "../services/memberService.js";

const lineUserId = process.argv[2];

if (!lineUserId) {
  console.error("Usage: npm run reset-member -- <line_user_id>");
  console.error("Example: npm run reset-member -- Ue793d718561c5bd535c7e6c12baa2cd2");
  process.exit(1);
}

initDatabase();
const db = getDb();

const member = getMember(lineUserId);
if (!member) {
  console.error("Member not found:", lineUserId);
  process.exit(1);
}

db.prepare("DELETE FROM bookings WHERE line_user_id = ?").run(lineUserId);
db.prepare("DELETE FROM purchases WHERE line_user_id = ?").run(lineUserId);
db.prepare("DELETE FROM members WHERE line_user_id = ?").run(lineUserId);

console.log(`Removed member: ${member.name} (${member.phone})`);
console.log("You can re-register from LINE → 購買課程 → 開始預約.");
