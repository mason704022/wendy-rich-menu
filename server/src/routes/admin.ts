import { Router } from "express";
import { z } from "zod";
import { getConfig, liffUrl } from "../config.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import { notifyUser } from "../lineClient.js";
import { listBookingSessionsForAdmin } from "../services/bookingService.js";
import {
  assignToMember,
  buildCouponAssignedMessage,
  createTemplate,
  deleteTemplate,
  getTemplate,
  listAssignments,
  listTemplates,
  revokeAssignment,
} from "../services/couponService.js";
import { searchMembers } from "../services/memberService.js";
import { isGoogleSheetsConfigured } from "../services/googleSheetsService.js";
import {
  confirmPurchase,
  listPendingPurchasesWithMember,
  rejectPurchase,
} from "../services/purchaseService.js";
import { getBookingWindow } from "../services/bookingWindow.js";
import {
  addSessionThemeOverride,
  deleteSessionThemeOverride,
  getSessionThemes,
  getSlotOptions,
  listAdminThemeWeeks,
  listWeekThemesForAdmin,
  saveUploadedSessionImage,
  updateSessionThemeOverride,
  updateWeekSessionTheme,
  getWeekStart,
  todayIsoLocal,
} from "../services/sessionThemeService.js";

export const adminRouter = Router();

adminRouter.use(requireAdmin);

adminRouter.get("/check", (_req, res) => {
  const { googleSheetsUrl } = getConfig();
  res.json({
    ok: true,
    sheetsConfigured: isGoogleSheetsConfigured(),
    sheetsUrl: googleSheetsUrl || null,
  });
});

adminRouter.get("/purchases/pending", (_req, res) => {
  res.json({ purchases: listPendingPurchasesWithMember() });
});

adminRouter.get("/bookings/sessions", (req, res) => {
  const days = Number(req.query.days ?? 28);
  const safeDays = Number.isFinite(days) && days > 0 ? Math.min(days, 90) : 28;
  res.json({ sessions: listBookingSessionsForAdmin(safeDays) });
});

/** @deprecated 相容舊版 LIFF */
adminRouter.get("/bookings/upcoming", (req, res) => {
  const days = Number(req.query.days ?? 28);
  const safeDays = Number.isFinite(days) && days > 0 ? Math.min(days, 90) : 28;
  res.json({ sessions: listBookingSessionsForAdmin(safeDays) });
});

adminRouter.post("/purchases/:id/confirm", async (req, res) => {
  try {
    const purchase = confirmPurchase(Number(req.params.id));
    try {
      await notifyUser(
        purchase.line_user_id,
        `您的訂單 #${purchase.id} 已確認！已增加 ${purchase.sessions_count} 堂，可至「會員資訊」查看。`
      );
    } catch (notifyError) {
      console.warn("[Admin confirm notify failed]", notifyError);
    }
    res.json({ purchase });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    res.status(400).json({ error: message });
  }
});

adminRouter.post("/purchases/:id/reject", async (req, res) => {
  const schema = z.object({
    reason: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const purchase = rejectPurchase(Number(req.params.id));
    try {
      await notifyUser(
        purchase.line_user_id,
        `您的訂單 #${purchase.id} 未能確認，如有疑問請聯繫工作室。${
          parsed.data.reason ? `\n備註：${parsed.data.reason}` : ""
        }`
      );
    } catch (notifyError) {
      console.warn("[Admin reject notify failed]", notifyError);
    }
    res.json({ purchase });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    res.status(400).json({ error: message });
  }
});

adminRouter.get("/session-themes", (_req, res) => {
  const data = getSessionThemes();
  res.json({
    weeks: listWeekThemesForAdmin(),
    adminWeeks: listAdminThemeWeeks(),
    bookingWindow: getBookingWindow(),
    overrides: data.overrides,
    slotOptions: getSlotOptions(),
    currentWeekStart: getWeekStart(todayIsoLocal()),
  });
});

adminRouter.put("/session-themes/weekly", (req, res) => {
  const schema = z.object({
    weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    title: z.string().min(1).max(80),
    intro: z.string().min(1).max(200),
    image: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const { weekStart, ...patch } = parsed.data;
    const week = updateWeekSessionTheme(weekStart, patch);
    res.json({ week });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    const status = message === "INVALID_WEEK_START" ? 400 : 400;
    res.status(status).json({ error: message });
  }
});

adminRouter.post("/session-themes/overrides", (req, res) => {
  const schema = z.object({
    slotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().min(4),
    title: z.string().min(1).max(80),
    intro: z.string().min(1).max(200),
    image: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const override = addSessionThemeOverride(parsed.data);
    res.status(201).json({ override });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    const status = message === "OVERRIDE_EXISTS" ? 409 : 400;
    res.status(status).json({ error: message });
  }
});

adminRouter.put("/session-themes/overrides", (req, res) => {
  const schema = z.object({
    slotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().min(4),
    title: z.string().min(1).max(80),
    intro: z.string().min(1).max(200),
    image: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const { slotDate, startTime, ...patch } = parsed.data;
    const override = updateSessionThemeOverride(slotDate, startTime, patch);
    res.json({ override });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    const status = message === "OVERRIDE_NOT_FOUND" ? 404 : 400;
    res.status(status).json({ error: message });
  }
});

adminRouter.delete("/session-themes/overrides", (req, res) => {
  const schema = z.object({
    slotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().min(4),
  });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    deleteSessionThemeOverride(parsed.data.slotDate, parsed.data.startTime);
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    const status = message === "OVERRIDE_NOT_FOUND" ? 404 : 400;
    res.status(status).json({ error: message });
  }
});

adminRouter.post("/session-themes/upload-image", async (req, res) => {
  const schema = z.object({
    imageBase64: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const raw = parsed.data.imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(raw, "base64");
    if (buffer.length === 0) {
      return res.status(400).json({ error: "INVALID_IMAGE" });
    }
    const imageUrl = await saveUploadedSessionImage(buffer);
    res.json({ imageUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    const status = message === "IMAGE_TOO_LARGE" ? 413 : 400;
    res.status(status).json({ error: message });
  }
});

adminRouter.get("/coupons/templates", (_req, res) => {
  res.json({ templates: listTemplates() });
});

adminRouter.post("/coupons/templates", (req, res) => {
  const schema = z.object({
    name: z.string().min(1).max(80),
    discountType: z.enum(["fixed", "percent"]),
    discountValue: z.number().int().positive(),
    planIds: z.array(z.string()).optional(),
    expiresAt: z.string().nullable().optional(),
    note: z.string().max(200).optional(),
  });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  if (parsed.data.discountType === "percent" && parsed.data.discountValue > 100) {
    return res.status(400).json({ error: "PERCENT_TOO_HIGH" });
  }

  const template = createTemplate({
    name: parsed.data.name,
    discountType: parsed.data.discountType,
    discountValue: parsed.data.discountValue,
    planIds: parsed.data.planIds,
    expiresAt: parsed.data.expiresAt,
    note: parsed.data.note,
  });
  res.status(201).json({ template });
});

adminRouter.delete("/coupons/templates/:id", (req, res) => {
  try {
    deleteTemplate(Number(req.params.id));
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    res.status(400).json({ error: message });
  }
});

adminRouter.get("/coupons/assignments", (req, res) => {
  const status = req.query.status;
  const memberLineUserId = req.query.memberLineUserId;
  const assignments = listAssignments({
    status:
      status === "available" ||
      status === "reserved" ||
      status === "used" ||
      status === "expired"
        ? status
        : undefined,
    lineUserId:
      typeof memberLineUserId === "string" ? memberLineUserId : undefined,
  });
  res.json({ assignments });
});

adminRouter.post("/coupons/assignments", async (req, res) => {
  const schema = z.object({
    templateId: z.number().int().positive(),
    lineUserId: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const assignment = assignToMember(parsed.data.templateId, parsed.data.lineUserId);
    const template = getTemplate(parsed.data.templateId);

    let notified = false;
    let notifyError: string | undefined;
    if (template) {
      const purchasePageUrl = liffUrl("purchase");
      const message = buildCouponAssignedMessage(template, purchasePageUrl);
      try {
        await notifyUser(parsed.data.lineUserId, message);
        notified = true;
      } catch (err) {
        notifyError = err instanceof Error ? err.message : "NOTIFY_FAILED";
        console.error("[Coupon assign notify failed]", err);
      }
    }

    res.status(201).json({ assignment, notified, notifyError });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    res.status(400).json({ error: message });
  }
});

adminRouter.delete("/coupons/assignments/:id", (req, res) => {
  try {
    revokeAssignment(Number(req.params.id));
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    res.status(400).json({ error: message });
  }
});

adminRouter.get("/members/search", (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const onlyWithPurchase = req.query.onlyWithPurchase === "true";
  const members = searchMembers(q, onlyWithPurchase).map((m) => ({
    ...m,
    has_confirmed_purchase: Boolean(m.has_confirmed_purchase),
  }));
  res.json({ members });
});
