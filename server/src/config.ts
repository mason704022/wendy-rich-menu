import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.join(__dirname, "..");

dotenv.config({ path: path.join(SERVER_ROOT, ".env") });

export function resolveServerPath(relativePath: string): string {
  return path.resolve(SERVER_ROOT, relativePath.replace(/^\.\//, ""));
}

/** Bundled JSON shipped with the app (courses, terms, …). */
const BUNDLED_CONTENT_DIR = path.join(SERVER_ROOT, "content");

/**
 * Writable course themes + uploaded images. Defaults to DATABASE_PATH's directory + /content
 * so one Railway Volume on /app/server/data keeps DB and themes together.
 */
export function getWritableContentRoot(): string {
  const explicit = process.env.CONTENT_DIR?.trim();
  if (explicit) return path.resolve(explicit);

  const dbPath = process.env.DATABASE_PATH?.trim();
  if (dbPath) {
    return path.join(path.dirname(path.resolve(dbPath)), "content");
  }

  return BUNDLED_CONTENT_DIR;
}

export function loadJson<T>(filename: string): T {
  const filePath = path.join(BUNDLED_CONTENT_DIR, filename);
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

export function getConfig() {
  return {
    port: Number(process.env.PORT ?? 3000),
    baseUrl: process.env.BASE_URL ?? "http://localhost:3000",
    liffId: process.env.LIFF_ID ?? "",
    liffBaseUrl:
      process.env.LIFF_BASE_URL ??
      (process.env.LIFF_ID
        ? `https://liff.line.me/${process.env.LIFF_ID}`
        : ""),
    igUrl: process.env.IG_URL ?? "https://www.instagram.com/",
    adminLineUserId: process.env.ADMIN_LINE_USER_ID ?? "",
    drinkOrderLineUserId: process.env.DRINK_ORDER_LINE_USER_ID ?? "",
    googleSheetsSpreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID ?? "",
    googleServiceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "",
    googleSheetsBookingsTab: process.env.GOOGLE_SHEETS_BOOKINGS_TAB ?? "預約",
    googleSheetsPurchasesTab: process.env.GOOGLE_SHEETS_PURCHASES_TAB ?? "匯款訂單",
    googleSheetsMembersTab: process.env.GOOGLE_SHEETS_MEMBERS_TAB ?? "會員註冊",
    googleSheetsUrl: process.env.GOOGLE_SHEETS_URL ?? "",
    defaultSessions: Number(process.env.DEFAULT_SESSIONS_PER_PURCHASE ?? 10),
    defaultAmount: Number(process.env.DEFAULT_PURCHASE_AMOUNT ?? 3000),
  };
}

export function liffUrl(pathSuffix: string): string {
  const { liffBaseUrl } = getConfig();
  const base = liffBaseUrl.replace(/\/$/, "");
  const page = pathSuffix.replace(/^\//, "");
  // Query param is reliable across LIFF login redirects; path suffix needs concat mode.
  return `${base}?page=${encodeURIComponent(page)}`;
}
