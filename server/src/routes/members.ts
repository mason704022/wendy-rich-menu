import { Router } from "express";
import { z } from "zod";
import { loadJson } from "../config.js";
import {
  findMemberByPhone,
  getMember,
  registerMember,
  updateMemberName,
} from "../services/memberService.js";
import { syncMemberToSheetSafe } from "../services/googleSheetsService.js";
import { sendOtp, verifyOtp } from "../services/otpService.js";

export const membersRouter = Router();

membersRouter.get("/content/terms", (_req, res) => {
  res.json(loadJson("terms.json"));
});

membersRouter.get("/content/store", (_req, res) => {
  res.json(loadJson("store.json"));
});

membersRouter.post("/send-otp", (req, res) => {
  const schema = z.object({ phone: z.string().min(8) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_PHONE" });
  }

  try {
    const result = sendOtp(parsed.data.phone);
    res.json({ ok: true, ...result });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    if (code === "OTP_COOLDOWN") {
      return res.status(429).json({ error: "OTP_COOLDOWN", message: "請稍候再重新發送" });
    }
    return res.status(400).json({ error: code });
  }
});

membersRouter.get("/:lineUserId", (req, res) => {
  const member = getMember(req.params.lineUserId);
  if (!member) {
    return res.status(404).json({ registered: false });
  }
  res.json({ registered: true, member });
});

membersRouter.post("/register", (req, res) => {
  const schema = z.object({
    lineUserId: z.string().min(1),
    displayName: z.string().default(""),
    name: z.string().min(1),
    phone: z.string().min(8),
    otpCode: z.string().length(6),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  if (!verifyOtp(parsed.data.phone, parsed.data.otpCode)) {
    return res.status(400).json({ error: "INVALID_OTP", message: "簡訊驗證碼錯誤或已過期" });
  }

  try {
    const { member, isNew } = registerMember(parsed.data);
    syncMemberToSheetSafe(member);
    res.json({ member, isNew });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "PHONE_ALREADY_REGISTERED") {
      const existing = findMemberByPhone(parsed.data.phone);
      return res.status(409).json({
        error: message,
        message: "此手機號碼已被其他會員註冊",
        existingMember: existing
          ? { name: existing.name, phone: existing.phone }
          : undefined,
      });
    }
    return res.status(400).json({ error: message });
  }
});

membersRouter.patch("/:lineUserId/name", (req, res) => {
  const schema = z.object({ name: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const member = updateMemberName(req.params.lineUserId, parsed.data.name);
    res.json({ member });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    res.status(400).json({ error: message });
  }
});

membersRouter.get("/:lineUserId/summary", (req, res) => {
  const member = getMember(req.params.lineUserId);
  if (!member) {
    return res.status(404).json({ error: "NOT_REGISTERED" });
  }

  res.json({
    name: member.name,
    phone: member.phone,
    totalSessions: member.total_sessions,
    remainingSessions: member.remaining_sessions,
    memberSince: member.created_at,
  });
});
