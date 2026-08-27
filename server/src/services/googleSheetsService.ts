import fs from "fs";
import { google, sheets_v4 } from "googleapis";
import { getConfig, resolveServerPath } from "../config.js";
import type { Booking } from "./bookingService.js";
import { getCoffeeItem } from "./coffeeMenuService.js";
import { getMember } from "./memberService.js";
import type { Purchase } from "./purchaseService.js";

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
  "金額",
  "狀態",
  "建立時間",
  "確認時間",
];

let sheetsClient: sheets_v4.Sheets | null = null;

function isConfigured(): boolean {
  const { googleSheetsSpreadsheetId, googleServiceAccountJson } = getConfig();
  return Boolean(googleSheetsSpreadsheetId && googleServiceAccountJson);
}

function getSheetsClient(): sheets_v4.Sheets | null {
  if (!isConfigured()) return null;
  if (sheetsClient) return sheetsClient;

  const { googleServiceAccountJson } = getConfig();
  const keyPath = resolveServerPath(googleServiceAccountJson);
  if (!fs.existsSync(keyPath)) {
    console.warn("[Google Sheets] Credentials file not found:", keyPath);
    return null;
  }

  const credentials = JSON.parse(fs.readFileSync(keyPath, "utf-8"));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

function weekdayLabel(weekday: number): string {
  const labels = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
  return labels[weekday] ?? String(weekday);
}

function bookingStatusLabel(status: Booking["status"]): string {
  if (status === "confirmed") return "正取";
  if (status === "waitlist") return "備取";
  return "已取消";
}

function purchaseStatusLabel(status: Purchase["status"]): string {
  if (status === "pending") return "待確認";
  if (status === "confirmed") return "已確認";
  return "已拒絕";
}

function bookingToRow(booking: Booking): string[] {
  const member = getMember(booking.line_user_id);
  const coffeeName = booking.coffee_item_id
    ? getCoffeeItem(booking.coffee_item_id)?.name ?? booking.coffee_item_id
    : "";
  const updatedAt = new Date().toISOString().replace("T", " ").slice(0, 19);

  return [
    String(booking.id),
    member?.name ?? "",
    member?.phone ?? "",
    booking.slot_date,
    weekdayLabel(booking.weekday),
    `${booking.start_time}-${booking.end_time}`,
    bookingStatusLabel(booking.status),
    coffeeName,
    booking.created_at,
    updatedAt,
  ];
}

function purchaseToRow(purchase: Purchase): string[] {
  const member = getMember(purchase.line_user_id);

  return [
    String(purchase.id),
    member?.name ?? "",
    member?.phone ?? "",
    purchase.payer_name,
    purchase.transfer_last5,
    String(purchase.sessions_count),
    String(purchase.amount),
    purchaseStatusLabel(purchase.status),
    purchase.created_at,
    purchase.confirmed_at ?? "",
  ];
}

async function ensureHeaders(tab: string, headers: string[]): Promise<void> {
  const sheets = getSheetsClient();
  const { googleSheetsSpreadsheetId } = getConfig();
  if (!sheets || !googleSheetsSpreadsheetId) return;

  const range = `${tab}!A1:J1`;
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: googleSheetsSpreadsheetId,
    range,
  });

  const firstRow = existing.data.values?.[0];
  if (firstRow?.length) return;

  await sheets.spreadsheets.values.update({
    spreadsheetId: googleSheetsSpreadsheetId,
    range,
    valueInputOption: "RAW",
    requestBody: { values: [headers] },
  });
}

async function findRowById(tab: string, id: number): Promise<number | null> {
  const sheets = getSheetsClient();
  const { googleSheetsSpreadsheetId } = getConfig();
  if (!sheets || !googleSheetsSpreadsheetId) return null;

  const range = `${tab}!A:A`;
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: googleSheetsSpreadsheetId,
    range,
  });

  const rows = result.data.values ?? [];
  const idStr = String(id);
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === idStr) return i + 1;
  }
  return null;
}

async function upsertRow(tab: string, headers: string[], row: string[]): Promise<void> {
  const sheets = getSheetsClient();
  const { googleSheetsSpreadsheetId } = getConfig();
  if (!sheets || !googleSheetsSpreadsheetId) return;

  await ensureHeaders(tab, headers);

  const id = Number(row[0]);
  const existingRow = await findRowById(tab, id);

  if (existingRow) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: googleSheetsSpreadsheetId,
      range: `${tab}!A${existingRow}:J${existingRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [row] },
    });
    return;
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: googleSheetsSpreadsheetId,
    range: `${tab}!A:J`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
}

export async function syncBookingToSheet(booking: Booking): Promise<void> {
  if (!isConfigured()) return;
  const { googleSheetsBookingsTab } = getConfig();
  await upsertRow(googleSheetsBookingsTab, BOOKING_HEADERS, bookingToRow(booking));
}

export async function syncPurchaseToSheet(purchase: Purchase): Promise<void> {
  if (!isConfigured()) return;
  const { googleSheetsPurchasesTab } = getConfig();
  await upsertRow(googleSheetsPurchasesTab, PURCHASE_HEADERS, purchaseToRow(purchase));
}

export function syncBookingToSheetSafe(booking: Booking): void {
  syncBookingToSheet(booking).catch((err) => {
    console.error("[Google Sheets] sync booking failed:", booking.id, err);
  });
}

export function syncPurchaseToSheetSafe(purchase: Purchase): void {
  syncPurchaseToSheet(purchase).catch((err) => {
    console.error("[Google Sheets] sync purchase failed:", purchase.id, err);
  });
}

export function isGoogleSheetsConfigured(): boolean {
  return isConfigured() && getSheetsClient() !== null;
}
