import { getDb } from "../db/index.js";
import {
  markUsedByPurchase,
  releaseByPurchase,
  reserveForPurchase,
} from "./couponService.js";
import { addSessions } from "./memberService.js";
import { syncPurchaseToSheetSafe } from "./googleSheetsService.js";
import { getMember } from "./memberService.js";

export interface Purchase {
  id: number;
  line_user_id: string;
  sessions_count: number;
  amount: number;
  original_amount: number | null;
  discount_amount: number;
  coupon_assignment_id: number | null;
  status: "pending" | "confirmed" | "rejected";
  payer_name: string;
  transfer_last5: string;
  created_at: string;
  confirmed_at: string | null;
}

export interface PurchaseWithMember extends Purchase {
  member_name: string;
  member_phone: string;
  coupon_name?: string;
}

export function createPurchase(input: {
  lineUserId: string;
  sessionsCount: number;
  amount: number;
  originalAmount?: number;
  discountAmount?: number;
  couponAssignmentId?: number | null;
  payerName?: string;
  transferLast5?: string;
}): Purchase {
  const db = getDb();
  const originalAmount = input.originalAmount ?? input.amount;
  const discountAmount = input.discountAmount ?? 0;

  const result = db
    .prepare(
      `INSERT INTO purchases (
         line_user_id, sessions_count, amount, original_amount, discount_amount,
         coupon_assignment_id, status, payer_name, transfer_last5
       )
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
    )
    .run(
      input.lineUserId,
      input.sessionsCount,
      input.amount,
      originalAmount,
      discountAmount,
      input.couponAssignmentId ?? null,
      input.payerName ?? "",
      input.transferLast5 ?? ""
    );

  const purchase = getPurchase(Number(result.lastInsertRowid))!;

  if (input.couponAssignmentId) {
    reserveForPurchase(input.couponAssignmentId, purchase.id);
  }

  syncPurchaseToSheetSafe(purchase);
  return purchase;
}

function enrichPurchase(purchase: Purchase): PurchaseWithMember {
  const member = getMember(purchase.line_user_id);
  let coupon_name = "";
  if (purchase.coupon_assignment_id) {
    const row = getDb()
      .prepare(
        `SELECT ct.name FROM coupon_assignments ca
         JOIN coupon_templates ct ON ct.id = ca.template_id
         WHERE ca.id = ?`
      )
      .get(purchase.coupon_assignment_id) as { name: string } | undefined;
    coupon_name = row?.name ?? "";
  }
  return {
    ...purchase,
    member_name: member?.name ?? "",
    member_phone: member?.phone ?? "",
    coupon_name,
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
  if (purchase.coupon_assignment_id) {
    markUsedByPurchase(id);
  }
  const updated = getPurchase(id)!;
  syncPurchaseToSheetSafe(updated);
  return updated;
}

export function rejectPurchase(id: number): Purchase {
  const db = getDb();
  const purchase = getPurchase(id);
  if (!purchase) throw new Error("PURCHASE_NOT_FOUND");

  db.prepare(`UPDATE purchases SET status = 'rejected' WHERE id = ?`).run(id);
  if (purchase.coupon_assignment_id) {
    releaseByPurchase(id);
  }
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
