import { getDb } from "../db/index.js";

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_COOLDOWN_MS = 60 * 1000;

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function sendOtp(phone: string): { devCode?: string } {
  const normalized = normalizePhone(phone);
  if (normalized.length < 8) {
    throw new Error("INVALID_PHONE");
  }

  const db = getDb();
  const recent = db
    .prepare(
      `SELECT created_at FROM otp_codes
       WHERE phone = ? ORDER BY created_at DESC LIMIT 1`
    )
    .get(normalized) as { created_at: string } | undefined;

  if (recent) {
    const elapsed = Date.now() - new Date(recent.created_at).getTime();
    if (elapsed < OTP_COOLDOWN_MS) {
      throw new Error("OTP_COOLDOWN");
    }
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  db.prepare(`DELETE FROM otp_codes WHERE phone = ?`).run(normalized);
  db.prepare(
    `INSERT INTO otp_codes (phone, code, expires_at) VALUES (?, ?, ?)`
  ).run(normalized, code, expiresAt);

  // TODO: integrate real SMS provider (Twilio / AWS SNS)
  console.log(`[OTP] ${normalized} -> ${code}`);

  const devMode = process.env.OTP_DEV_MODE !== "false";
  return devMode ? { devCode: code } : {};
}

export function verifyOtp(phone: string, code: string): boolean {
  const normalized = normalizePhone(phone);
  const db = getDb();
  const row = db
    .prepare(
      `SELECT code, expires_at FROM otp_codes
       WHERE phone = ? ORDER BY created_at DESC LIMIT 1`
    )
    .get(normalized) as { code: string; expires_at: string } | undefined;

  if (!row) return false;
  if (new Date(row.expires_at).getTime() < Date.now()) return false;
  if (row.code !== code.trim()) return false;

  db.prepare(`DELETE FROM otp_codes WHERE phone = ?`).run(normalized);
  return true;
}
