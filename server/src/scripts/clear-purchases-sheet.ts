/** 僅清空 Google Sheets「匯款訂單」分頁（保留表頭） */
import "dotenv/config";
import { google } from "googleapis";
import fs from "fs";
import path from "path";
import { getConfig, resolveServerPath } from "../config.js";
import { isGoogleSheetsConfigured } from "../services/googleSheetsService.js";

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

async function main() {
  if (!process.argv.includes("--yes")) {
    console.error("Usage: npx tsx src/scripts/clear-purchases-sheet.ts --yes");
    process.exit(1);
  }
  if (!isGoogleSheetsConfigured()) {
    console.error("Google Sheets not configured");
    process.exit(1);
  }
  const { googleSheetsSpreadsheetId, googleSheetsPurchasesTab } = getConfig();
  const creds = loadCredentials();
  if (!creds) process.exit(1);

  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.values.clear({
    spreadsheetId: googleSheetsSpreadsheetId,
    range: `${googleSheetsPurchasesTab}!A:Z`,
  });
  const endCol = String.fromCharCode(64 + PURCHASE_HEADERS.length);
  await sheets.spreadsheets.values.update({
    spreadsheetId: googleSheetsSpreadsheetId,
    range: `${googleSheetsPurchasesTab}!A1:${endCol}1`,
    valueInputOption: "RAW",
    requestBody: { values: [PURCHASE_HEADERS] },
  });
  console.log(`[Sheets] Cleared tab: ${googleSheetsPurchasesTab}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
