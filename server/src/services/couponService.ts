import { getDb } from "../db/index.js";
import { getMember } from "./memberService.js";

export type DiscountType = "fixed" | "percent";
export type CouponAssignmentStatus = "available" | "reserved" | "used" | "expired";

export interface CouponTemplate {
  id: number;
  name: string;
  discount_type: DiscountType;
  discount_value: number;
  plan_ids: string;
  expires_at: string | null;
  note: string;
  created_at: string;
}

export interface CouponAssignment {
  id: number;
  template_id: number;
  line_user_id: string;
  status: CouponAssignmentStatus;
  assigned_at: string;
  used_at: string | null;
  purchase_id: number | null;
}

export interface CouponAssignmentWithTemplate extends CouponAssignment {
  template_name: string;
  discount_type: DiscountType;
  discount_value: number;
  plan_ids: string;
  expires_at: string | null;
}

export interface DiscountCalculation {
  original: number;
  discount: number;
  final: number;
  templateName: string;
}

export interface PlanCouponPrice extends DiscountCalculation {
  couponAssignmentId: number;
  expiresAt: string | null;
}

function parsePlanIds(planIdsJson: string): string[] {
  try {
    const parsed = JSON.parse(planIdsJson) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function calculateDiscount(
  template: Pick<CouponTemplate, "discount_type" | "discount_value">,
  planPrice: number
): DiscountCalculation {
  let discount = 0;
  if (template.discount_type === "fixed") {
    discount = Math.min(template.discount_value, Math.max(planPrice - 1, 0));
  } else {
    discount = Math.floor((planPrice * template.discount_value) / 100);
    discount = Math.min(discount, Math.max(planPrice - 1, 0));
  }
  return {
    original: planPrice,
    discount,
    final: planPrice - discount,
    templateName: "",
  };
}

function isTemplateExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

function isPlanEligible(planIdsJson: string, planId: string): boolean {
  const planIds = parsePlanIds(planIdsJson);
  return planIds.length === 0 || planIds.includes(planId);
}

export function createTemplate(input: {
  name: string;
  discountType: DiscountType;
  discountValue: number;
  planIds?: string[];
  expiresAt?: string | null;
  note?: string;
}): CouponTemplate {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO coupon_templates (name, discount_type, discount_value, plan_ids, expires_at, note)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.name,
      input.discountType,
      input.discountValue,
      JSON.stringify(input.planIds ?? []),
      input.expiresAt ?? null,
      input.note ?? ""
    );
  return getTemplate(Number(result.lastInsertRowid))!;
}

export function getTemplate(id: number): CouponTemplate | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM coupon_templates WHERE id = ?").get(id) as
    | CouponTemplate
    | undefined;
}

export function listTemplates(): CouponTemplate[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM coupon_templates ORDER BY created_at DESC")
    .all() as unknown as CouponTemplate[];
}

export function assignToMember(templateId: number, lineUserId: string): CouponAssignment {
  const template = getTemplate(templateId);
  if (!template) throw new Error("TEMPLATE_NOT_FOUND");
  const member = getMember(lineUserId);
  if (!member) throw new Error("MEMBER_NOT_FOUND");

  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO coupon_assignments (template_id, line_user_id, status)
       VALUES (?, ?, 'available')`
    )
    .run(templateId, lineUserId);
  return getAssignment(Number(result.lastInsertRowid))!;
}

export function formatCouponDiscountLabel(
  template: Pick<CouponTemplate, "discount_type" | "discount_value">
): string {
  if (template.discount_type === "fixed") {
    return `折 NT$${template.discount_value.toLocaleString()}`;
  }
  return `${template.discount_value}% 折扣`;
}

export function buildCouponAssignedMessage(
  template: CouponTemplate,
  purchasePageUrl: string
): string {
  const discountLabel = formatCouponDiscountLabel(template);
  const expiryLine = template.expires_at
    ? `\n有效期限：${template.expires_at.slice(0, 10)}`
    : "";
  return (
    `【折扣券通知】\n` +
    `您收到一張折扣券：${template.name}\n` +
    `優惠：${discountLabel}${expiryLine}\n\n` +
    `請至購買課程頁選用折扣券：\n${purchasePageUrl}`
  );
}

export function getAssignment(id: number): CouponAssignment | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM coupon_assignments WHERE id = ?").get(id) as
    | CouponAssignment
    | undefined;
}

function getAssignmentWithTemplate(id: number): CouponAssignmentWithTemplate | undefined {
  const db = getDb();
  return db
    .prepare(
      `SELECT ca.*, ct.name AS template_name, ct.discount_type, ct.discount_value,
              ct.plan_ids, ct.expires_at
       FROM coupon_assignments ca
       JOIN coupon_templates ct ON ct.id = ca.template_id
       WHERE ca.id = ?`
    )
    .get(id) as CouponAssignmentWithTemplate | undefined;
}

export function listAssignments(filters?: {
  status?: CouponAssignmentStatus;
  lineUserId?: string;
}): CouponAssignmentWithTemplate[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: string[] = [];

  if (filters?.status) {
    conditions.push("ca.status = ?");
    params.push(filters.status);
  }
  if (filters?.lineUserId) {
    conditions.push("ca.line_user_id = ?");
    params.push(filters.lineUserId);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return db
    .prepare(
      `SELECT ca.*, ct.name AS template_name, ct.discount_type, ct.discount_value,
              ct.plan_ids, ct.expires_at
       FROM coupon_assignments ca
       JOIN coupon_templates ct ON ct.id = ca.template_id
       ${where}
       ORDER BY ca.assigned_at DESC`
    )
    .all(...params) as unknown as CouponAssignmentWithTemplate[];
}

export function listAvailableForUser(lineUserId: string, planId?: string) {
  expireStaleAssignments();
  const assignments = listAssignments({ lineUserId, status: "available" });
  return assignments
    .filter((a) => !isTemplateExpired(a.expires_at))
    .filter((a) => !planId || isPlanEligible(a.plan_ids, planId))
    .map((a) => ({
      id: a.id,
      templateName: a.template_name,
      discountType: a.discount_type,
      discountValue: a.discount_value,
      expiresAt: a.expires_at,
      planIds: parsePlanIds(a.plan_ids),
    }));
}

/** Best applicable coupon price per plan (within validity). */
export function listBestDiscountsForUser(
  lineUserId: string,
  plans: Array<{ id: string; price: number }>
): Record<string, PlanCouponPrice> {
  expireStaleAssignments();
  const assignments = listAssignments({ lineUserId, status: "available" }).filter(
    (a) => !isTemplateExpired(a.expires_at)
  );

  const result: Record<string, PlanCouponPrice> = {};

  for (const plan of plans) {
    let best: PlanCouponPrice | null = null;
    for (const a of assignments) {
      if (!isPlanEligible(a.plan_ids, plan.id)) continue;
      const calc = calculateDiscount(a, plan.price);
      if (calc.discount <= 0) continue;
      const candidate: PlanCouponPrice = {
        original: calc.original,
        discount: calc.discount,
        final: calc.final,
        templateName: a.template_name,
        couponAssignmentId: a.id,
        expiresAt: a.expires_at,
      };
      if (!best || candidate.final < best.final) {
        best = candidate;
      }
    }
    if (best) result[plan.id] = best;
  }

  return result;
}

export function validateAndCalculate(
  assignmentId: number,
  lineUserId: string,
  planId: string,
  planPrice: number
): DiscountCalculation {
  expireStaleAssignments();
  const assignment = getAssignmentWithTemplate(assignmentId);
  if (!assignment) throw new Error("COUPON_NOT_FOUND");
  if (assignment.line_user_id !== lineUserId) throw new Error("COUPON_NOT_YOURS");
  if (assignment.status !== "available") throw new Error("COUPON_NOT_AVAILABLE");
  if (isTemplateExpired(assignment.expires_at)) throw new Error("COUPON_EXPIRED");
  if (!isPlanEligible(assignment.plan_ids, planId)) throw new Error("COUPON_PLAN_NOT_ELIGIBLE");

  const calc = calculateDiscount(assignment, planPrice);
  calc.templateName = assignment.template_name;
  return calc;
}

export function reserveForPurchase(assignmentId: number, purchaseId: number): void {
  const db = getDb();
  const assignment = getAssignment(assignmentId);
  if (!assignment) throw new Error("COUPON_NOT_FOUND");
  if (assignment.status !== "available") throw new Error("COUPON_NOT_AVAILABLE");

  db.prepare(
    `UPDATE coupon_assignments
     SET status = 'reserved', purchase_id = ?
     WHERE id = ? AND status = 'available'`
  ).run(purchaseId, assignmentId);
}

export function markUsedByPurchase(purchaseId: number): void {
  const db = getDb();
  db.prepare(
    `UPDATE coupon_assignments
     SET status = 'used', used_at = datetime('now')
     WHERE purchase_id = ? AND status = 'reserved'`
  ).run(purchaseId);
}

export function releaseByPurchase(purchaseId: number): void {
  const db = getDb();
  db.prepare(
    `UPDATE coupon_assignments
     SET status = 'available', purchase_id = NULL, used_at = NULL
     WHERE purchase_id = ? AND status = 'reserved'`
  ).run(purchaseId);
}

export function revokeAssignment(assignmentId: number): void {
  const db = getDb();
  const assignment = getAssignment(assignmentId);
  if (!assignment) throw new Error("COUPON_NOT_FOUND");
  if (assignment.status !== "available") throw new Error("COUPON_NOT_REVOKABLE");

  db.prepare("DELETE FROM coupon_assignments WHERE id = ?").run(assignmentId);
}

export function deleteTemplate(templateId: number): void {
  const template = getTemplate(templateId);
  if (!template) throw new Error("TEMPLATE_NOT_FOUND");

  const db = getDb();
  const active = db
    .prepare(
      `SELECT COUNT(*) AS count FROM coupon_assignments
       WHERE template_id = ? AND status IN ('reserved', 'used')`
    )
    .get(templateId) as { count: number };
  if (active.count > 0) throw new Error("TEMPLATE_HAS_ACTIVE_ASSIGNMENTS");

  db.prepare("DELETE FROM coupon_assignments WHERE template_id = ?").run(templateId);
  db.prepare("DELETE FROM coupon_templates WHERE id = ?").run(templateId);
}

function expireStaleAssignments(): void {
  const db = getDb();
  db.prepare(
    `UPDATE coupon_assignments
     SET status = 'expired'
     WHERE status = 'available'
       AND template_id IN (
         SELECT id FROM coupon_templates
         WHERE expires_at IS NOT NULL AND expires_at < datetime('now')
       )`
  ).run();
}

export function getCouponNameForPurchase(couponAssignmentId: number | null): string {
  if (!couponAssignmentId) return "";
  const assignment = getAssignmentWithTemplate(couponAssignmentId);
  return assignment?.template_name ?? "";
}
