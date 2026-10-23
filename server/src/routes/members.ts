import { Router } from "express";
import { z } from "zod";
import { loadJson } from "../config.js";
import {
  findMemberByPhone,
  getMember,
  memberProfileSummary,
  registerMember,
  updateMemberDetails,
  updateMemberName,
  updateMemberProfile,
} from "../services/memberService.js";
import { syncMemberToSheetSafe } from "../services/googleSheetsService.js";
import { sendOtp, verifyOtp } from "../services/otpService.js";

export const membersRouter = Router();

const profileSchema = z.object({
  ageRange: z.enum(["20-30", "30-40", "40-50", "50+"]),
  occupation: z.enum([
    "student",
    "freelance",
    "service",
    "education",
    "medical",
    "manufacturing",
    "other",
  ]),
  occupationOther: z.string().optional(),
  residenceKind: z.enum(["hsinchu", "other"]),
  residenceDistrict: z.enum(["north", "east", "xiangshan"]).optional(),
  residenceOther: z.string().optional(),
});

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
  res.json({ registered: true, member, profile: memberProfileSummary(member) });
});

membersRouter.post("/register", (req, res) => {
  const schema = z.object({
    lineUserId: z.string().min(1),
    displayName: z.string().default(""),
    name: z.string().min(1),
    phone: z.string().min(8),
    otpCode: z.string().length(6),
    profile: profileSchema,
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  if (!verifyOtp(parsed.data.phone, parsed.data.otpCode)) {
    return res.status(400).json({ error: "INVALID_OTP", message: "簡訊驗證碼錯誤或已過期" });
  }

  const profile = parsed.data.profile;
  if (profile.occupation === "other" && !profile.occupationOther?.trim()) {
    return res.status(400).json({ error: "OCCUPATION_OTHER_REQUIRED" });
  }
  if (profile.residenceKind === "hsinchu" && !profile.residenceDistrict) {
    return res.status(400).json({ error: "RESIDENCE_DISTRICT_REQUIRED" });
  }
  if (profile.residenceKind === "other" && !profile.residenceOther?.trim()) {
    return res.status(400).json({ error: "RESIDENCE_OTHER_REQUIRED" });
  }

  try {
    const { member, isNew } = registerMember({
      lineUserId: parsed.data.lineUserId,
      displayName: parsed.data.displayName,
      name: parsed.data.name,
      phone: parsed.data.phone,
      profile: {
        ageRange: profile.ageRange,
        occupation: profile.occupation,
        occupationOther: profile.occupationOther,
        residenceKind: profile.residenceKind,
        residenceDistrict: profile.residenceDistrict,
        residenceOther: profile.residenceOther,
      },
    });
    syncMemberToSheetSafe(member);
    res.json({ member, isNew, profile: memberProfileSummary(member) });
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

membersRouter.patch("/:lineUserId/details", (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    phone: z.string().min(8),
    otpCode: z.string().length(6).optional(),
    profile: profileSchema,
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const member = getMember(req.params.lineUserId);
  if (!member) {
    return res.status(404).json({ error: "NOT_REGISTERED" });
  }

  const profile = parsed.data.profile;
  if (profile.occupation === "other" && !profile.occupationOther?.trim()) {
    return res.status(400).json({ error: "OCCUPATION_OTHER_REQUIRED" });
  }
  if (profile.residenceKind === "hsinchu" && !profile.residenceDistrict) {
    return res.status(400).json({ error: "RESIDENCE_DISTRICT_REQUIRED" });
  }
  if (profile.residenceKind === "other" && !profile.residenceOther?.trim()) {
    return res.status(400).json({ error: "RESIDENCE_OTHER_REQUIRED" });
  }

  const phoneChanged =
    member.phone.replace(/\D/g, "") !== parsed.data.phone.replace(/\D/g, "");
  if (phoneChanged) {
    if (!parsed.data.otpCode || !verifyOtp(parsed.data.phone, parsed.data.otpCode)) {
      return res.status(400).json({
        error: "INVALID_OTP",
        message: "變更手機請完成簡訊驗證",
      });
    }
  }

  try {
    const updated = updateMemberDetails({
      lineUserId: req.params.lineUserId,
      name: parsed.data.name,
      phone: parsed.data.phone,
      profile: {
        ageRange: profile.ageRange,
        occupation: profile.occupation,
        occupationOther: profile.occupationOther,
        residenceKind: profile.residenceKind,
        residenceDistrict: profile.residenceDistrict,
        residenceOther: profile.residenceOther,
      },
    });
    syncMemberToSheetSafe(updated);
    res.json({ member: updated, profile: memberProfileSummary(updated) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "PHONE_ALREADY_REGISTERED") {
      return res.status(409).json({ error: message, message: "此手機號碼已被其他會員使用" });
    }
    return res.status(400).json({ error: message });
  }
});

membersRouter.patch("/:lineUserId/profile", (req, res) => {
  const schema = z.object({ profile: profileSchema });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const profile = parsed.data.profile;
  if (profile.occupation === "other" && !profile.occupationOther?.trim()) {
    return res.status(400).json({ error: "OCCUPATION_OTHER_REQUIRED" });
  }
  if (profile.residenceKind === "hsinchu" && !profile.residenceDistrict) {
    return res.status(400).json({ error: "RESIDENCE_DISTRICT_REQUIRED" });
  }
  if (profile.residenceKind === "other" && !profile.residenceOther?.trim()) {
    return res.status(400).json({ error: "RESIDENCE_OTHER_REQUIRED" });
  }

  try {
    const member = updateMemberProfile(req.params.lineUserId, {
      ageRange: profile.ageRange,
      occupation: profile.occupation,
      occupationOther: profile.occupationOther,
      residenceKind: profile.residenceKind,
      residenceDistrict: profile.residenceDistrict,
      residenceOther: profile.residenceOther,
    });
    syncMemberToSheetSafe(member);
    res.json({ member, profile: memberProfileSummary(member) });
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

  const profile = memberProfileSummary(member);
  res.json({
    name: member.name,
    phone: member.phone,
    totalSessions: member.total_sessions,
    remainingSessions: member.remaining_sessions,
    memberSince: member.created_at,
    ageLabel: profile.ageLabel,
    occupationLabel: profile.occupationLabel,
    residenceLabel: profile.residenceLabel,
    ageRange: member.age_range,
    occupation: member.occupation,
    occupationOther: member.occupation_other,
    residenceKind: member.residence_kind,
    residenceDistrict: member.residence_district,
    residenceOther: member.residence_other,
  });
});
