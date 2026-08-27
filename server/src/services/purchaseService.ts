import { getDb } from "../db/index.js";
import { addSessions } from "./memberService.js";
import { syncPurchaseToSheetSafe } from "./googleSheetsService.js";
import { getMember } from "./memberService.js";

export interface Purchase {
  id: number;
  line_user_id: string;
  sessions_count: number;
  amount: number;
  status: "pending" | "confirmed" | "rejected";
  payer_name: string;
  transfer_last5: string;
  created_at: string;
  confirmed_at: string | null;
}

export interface PurchaseWithMember extends Purchase {
  member_name: string;
  member_phone: string;
}
export function createPurchase(input: {
  lineUserId: string;
  sessionsCount: number;
  amount: number;
  payerName?: string;
  transferLast5?: string;
}): Purchase {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO purchases (line_user_id, sessions_count, amount, status, payer_name, transfer_last5)
       VALUES (?, ?, ?, 'pending', ?, ?)`
    )
    .run(
      input.lineUserId,
      input.sessionsCount,
      input.amount,
      input.payerName ?? "",
      input.transferLast5 ?? ""
    );

  const purchase = getPurchase(Number(result.lastInsertRowid))!;
  syncPurchaseToSheetSafe(purchase);
  return purchase;
}

function enrichPurchase(purchase: Purchase): PurchaseWithMember {
  const member = getMember(purchase.line_user_id);
  return {
    ...purchase,
    member_name: member?.name ?? "",
    member_phone: member?.phone ?? "",
  };
}

export function getPurchase(id: number): Purchase | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM purchases WHERE id = ?").get(id) as
    | Purchase
    | undefined;
}

export function confirmPurchase(id: number): Purchase {
  const db = getDb();
  const purchase = getPurchase(id);
  if (!purchase) throw new Error("PURCHASE_NOT_FOUND");
  if (purchase.status !== "pending") throw new Error("PURCHASE_NOT_PENDING");

  db.prepare(
    `UPDATE purchases SET status = 'confirmed', confirmed_at = datetime('now') WHERE id = ?`
  ).run(id);

  addSessions(purchase.line_user_id, purchase.sessions_count);
  const updated = getPurchase(id)!;
  syncPurchaseToSheetSafe(updated);
  return updated;
}

export function rejectPurchase(id: number): Purchase {
  const db = getDb();
  db.prepare(`UPDATE purchases SET status = 'rejected' WHERE id = ?`).run(id);
  const updated = getPurchase(id)!;
  syncPurchaseToSheetSafe(updated);
  return updated;
}

export function listPendingPurchases(): Purchase[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM purchases WHERE status = 'pending' ORDER BY created_at DESC")
    .all() as unknown as Purchase[];
}

export function listPendingPurchasesWithMember(): PurchaseWithMember[] {
  return listPendingPurchases().map(enrichPurchase);
}

export function listAllPurchases(): Purchase[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM purchases ORDER BY created_at DESC")
    .all() as unknown as Purchase[];
}

export function listPurchasesByUser(lineUserId: string): Purchase[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM purchases WHERE line_user_id = ? ORDER BY created_at DESC"
    )
    .all(lineUserId) as unknown as Purchase[];
}
