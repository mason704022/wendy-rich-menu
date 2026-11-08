/**
 * 清空會員、預約、匯款（及折扣券指派），並清除 Google Sheets「會員註冊」「預約」「匯款訂單」分頁資料列。
 * 使用：npm run clear-members-bookings -- --yes
 */
import "dotenv/config";
import { google } from "googleapis";
import { initDatabase, getDb } from "../db/index.js";
import { getConfig, resolveServerPath } from "../config.js";
import {
  getGoogleSheetsDiagnostics,
  isGoogleSheetsConfigured,
  MEMBER_HEADERS,
} from "../services/googleSheetsService.js";
import fs from "fs";
import path from "path";

const BOOKING_HEADERS = [
  "預約編號",
  "會員姓名",
  "手機",
  "日期",
  "星期",
  "時段",
  "狀態",
  "咖啡品項",
  "建立時間",
  "更新時間",
];

const PURCHASE_HEADERS = [
  "訂單編號",
  "會員姓名",
  "手機",
  "匯款人",
  "後五碼",
  "堂數",
  "原價",
  "折扣",
  "實付金額",
  "折扣券",
  "狀態",
  "建立時間",
  "確認時間",
];

function loadCredentials(): Record<string, unknown> | null {
  const raw = getConfig().googleServiceAccountJson.trim();
  if (!raw) return null;
  if (raw.startsWith("{")) {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  const keyPath = path.isAbsolute(raw) ? raw : resolveServerPath(raw);
  if (!fs.existsSync(keyPath)) return null;
  return JSON.parse(fs.readFileSync(keyPath, "utf-8")) as Record<string, unknown>;
}

async function clearSheetTab(tab: string, headers: string[]): Promise<void> {
  const { googleSheetsSpreadsheetId } = getConfig();
  const creds = loadCredentials();
  if (!googleSheetsSpreadsheetId || !creds) {
    console.warn("[Sheets] Skip clear — not configured");
    return;
  }

  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.values.clear({
    spreadsheetId: googleSheetsSpreadsheetId,
    range: `${tab}!A:Z`,
  });

  const endCol = String.fromCharCode(64 + headers.length);
  await sheets.spreadsheets.values.update({
    spreadsheetId: googleSheetsSpreadsheetId,
    range: `${tab}!A1:${endCol}1`,
    valueInputOption: "RAW",
    requestBody: { values: [headers] },
  });

  console.log(`[Sheets] Cleared tab: ${tab}`);
}

function clearDatabase(): void {
  const db = getDb();

  const counts = {
    coupon_assignments: (
      db.prepare("SELECT COUNT(*) AS c FROM coupon_assignments").get() as { c: number }
    ).c,
    bookings: (db.prepare("SELECT COUNT(*) AS c FROM bookings").get() as { c: number }).c,
    purchases: (db.prepare("SELECT COUNT(*) AS c FROM purchases").get() as { c: number }).c,
    members: (db.prepare("SELECT COUNT(*) AS c FROM members").get() as { c: number }).c,
    slot_opening_decisions: (
      db.prepare("SELECT COUNT(*) AS c FROM slot_opening_decisions").get() as { c: number }
    ).c,
  };

  console.log("[DB] Before:", counts);

  db.exec("DELETE FROM coupon_assignments");
  db.exec("DELETE FROM bookings");
  db.exec("DELETE FROM purchases");
  db.exec("DELETE FROM members");
  db.exec("DELETE FROM slot_opening_decisions");

  console.log("[DB] Cleared members, bookings, purchases, coupon_assignments, slot_opening_decisions");
}

async function main() {
  const yes = process.argv.includes("--yes");
  if (!yes) {
    console.error("Refusing to run without --yes");
    console.error("Usage: npm run clear-members-bookings -- --yes");
    process.exit(1);
  }

  initDatabase();
  const diag = getGoogleSheetsDiagnostics();
  console.log("[Google Sheets diagnostics]", diag);

  clearDatabase();

  if (isGoogleSheetsConfigured()) {
    const { googleSheetsMembersTab, googleSheetsBookingsTab, googleSheetsPurchasesTab } =
      getConfig();
    await clearSheetTab(googleSheetsMembersTab, MEMBER_HEADERS);
    await clearSheetTab(googleSheetsBookingsTab, BOOKING_HEADERS);
    await clearSheetTab(googleSheetsPurchasesTab, PURCHASE_HEADERS);
  } else {
    console.warn("[Sheets] Not configured — database cleared only");
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
