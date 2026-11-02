import fs from "fs";
import path from "path";
import { google, sheets_v4 } from "googleapis";
import { getConfig, resolveServerPath } from "../config.js";
import type { Booking } from "./bookingService.js";
import { formatCoffeeDisplayName } from "./coffeeMenuService.js";
import {
  getMember,
  listAllMembers,
  memberProfileSummary,
  type Member,
} from "./memberService.js";
import type { Purchase } from "./purchaseService.js";
import { getCouponNameForPurchase } from "./couponService.js";

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

const MEMBER_HEADERS = [
  "LINE User ID",
  "姓名",
  "手機",
  "LINE顯示名稱",
  "年齡",
  "職業",
  "居住地",
  "註冊時間",
];

let sheetsClient: sheets_v4.Sheets | null = null;

export type GoogleSheetsCredentialsSource = "inline" | "file" | "missing";

export interface GoogleSheetsDiagnostics {
  spreadsheetIdSet: boolean;
  credentialsConfigured: boolean;
  credentialsSource: GoogleSheetsCredentialsSource;
  credentialsPath: string | null;
  syncReady: boolean;
  bookingsTab: string;
}

function isConfigured(): boolean {
  const { googleSheetsSpreadsheetId, googleServiceAccountJson } = getConfig();
  return Boolean(googleSheetsSpreadsheetId && googleServiceAccountJson.trim());
}

function loadServiceAccountCredentials(): {
  credentials: Record<string, unknown> | null;
  source: GoogleSheetsCredentialsSource;
  path: string | null;
} {
  const raw = getConfig().googleServiceAccountJson.trim();
  if (!raw) {
    return { credentials: null, source: "missing", path: null };
  }

  if (raw.startsWith("{")) {
    try {
      return {
        credentials: JSON.parse(raw) as Record<string, unknown>,
        source: "inline",
        path: null,
      };
    } catch {
      console.warn("[Google Sheets] GOOGLE_SERVICE_ACCOUNT_JSON JSON parse failed");
      return { credentials: null, source: "missing", path: null };
    }
  }

  const keyPath = path.isAbsolute(raw) ? raw : resolveServerPath(raw);
  if (!fs.existsSync(keyPath)) {
    console.warn("[Google Sheets] Credentials file not found:", keyPath);
    return { credentials: null, source: "missing", path: keyPath };
  }

  try {
    return {
      credentials: JSON.parse(fs.readFileSync(keyPath, "utf-8")) as Record<string, unknown>,
      source: "file",
      path: keyPath,
    };
  } catch {
    console.warn("[Google Sheets] Credentials file is not valid JSON:", keyPath);
    return { credentials: null, source: "missing", path: keyPath };
  }
}

function getSheetsClient(): sheets_v4.Sheets | null {
  if (!isConfigured()) return null;
  if (sheetsClient) return sheetsClient;

  const { credentials } = loadServiceAccountCredentials();
  if (!credentials) return null;

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

export function getGoogleSheetsDiagnostics(): GoogleSheetsDiagnostics {
  const {
    googleSheetsSpreadsheetId,
    googleServiceAccountJson,
    googleSheetsBookingsTab,
  } = getConfig();
  const { source, path: credPath } = loadServiceAccountCredentials();
  const spreadsheetIdSet = Boolean(googleSheetsSpreadsheetId.trim());
  const credentialsConfigured = Boolean(googleServiceAccountJson.trim());
  const syncReady =
    spreadsheetIdSet && credentialsConfigured && getSheetsClient() !== null;

  return {
    spreadsheetIdSet,
    credentialsConfigured,
    credentialsSource: source,
    credentialsPath: credPath,
    syncReady,
    bookingsTab: googleSheetsBookingsTab,
  };
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
    ? formatCoffeeDisplayName(booking.coffee_item_id, booking.coffee_temperature)
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
  const original = purchase.original_amount ?? purchase.amount;
  const couponName = getCouponNameForPurchase(purchase.coupon_assignment_id);

  return [
    String(purchase.id),
    member?.name ?? "",
    member?.phone ?? "",
    purchase.payer_name,
    purchase.transfer_last5,
    String(purchase.sessions_count),
    String(original),
    String(purchase.discount_amount ?? 0),
    String(purchase.amount),
    couponName,
    purchaseStatusLabel(purchase.status),
    purchase.created_at,
    purchase.confirmed_at ?? "",
  ];
}

function memberToRow(member: Member): string[] {
  const profile = memberProfileSummary(member);
  return [
    member.line_user_id,
    member.name,
    member.phone,
    member.display_name,
    profile.ageLabel,
    profile.occupationLabel,
    profile.residenceLabel,
    member.created_at,
  ];
}

async function ensureHeaders(
  tab: string,
  headers: string[],
  colCount = headers.length
): Promise<void> {
  const sheets = getSheetsClient();
  const { googleSheetsSpreadsheetId } = getConfig();
  if (!sheets || !googleSheetsSpreadsheetId) return;

  const endCol = String.fromCharCode(64 + colCount);
  const range = `${tab}!A1:${endCol}1`;
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
  return findRowByColA(tab, String(id));
}

async function findRowByColA(tab: string, value: string): Promise<number | null> {
  const sheets = getSheetsClient();
  const { googleSheetsSpreadsheetId } = getConfig();
  if (!sheets || !googleSheetsSpreadsheetId) return null;

  const range = `${tab}!A:A`;
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: googleSheetsSpreadsheetId,
    range,
  });

  const rows = result.data.values ?? [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === value) return i + 1;
  }
  return null;
}

async function upsertRow(
  tab: string,
  headers: string[],
  row: string[],
  colCount = headers.length
): Promise<void> {
  const sheets = getSheetsClient();
  const { googleSheetsSpreadsheetId } = getConfig();
  if (!sheets || !googleSheetsSpreadsheetId) return;

  await ensureHeaders(tab, headers, colCount);

  const key = row[0];
  const existingRow = await findRowByColA(tab, key);
  const endCol = String.fromCharCode(64 + colCount);

  if (existingRow) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: googleSheetsSpreadsheetId,
      range: `${tab}!A${existingRow}:${endCol}${existingRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [row] },
    });
    return;
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: googleSheetsSpreadsheetId,
    range: `${tab}!A:${endCol}`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
}

export async function syncBookingToSheet(booking: Booking): Promise<void> {
  if (!isConfigured()) return;
  if (!getSheetsClient()) {
    console.warn("[Google Sheets] Skip booking sync — credentials not ready");
    return;
  }
  const { googleSheetsBookingsTab } = getConfig();
  await upsertRow(
    googleSheetsBookingsTab,
    BOOKING_HEADERS,
    bookingToRow(booking),
    BOOKING_HEADERS.length
  );
}

export async function syncPurchaseToSheet(purchase: Purchase): Promise<void> {
  if (!isConfigured()) return;
  const { googleSheetsPurchasesTab } = getConfig();
  await upsertRow(
    googleSheetsPurchasesTab,
    PURCHASE_HEADERS,
    purchaseToRow(purchase),
    PURCHASE_HEADERS.length
  );
}

export async function syncMemberToSheet(member: Member): Promise<void> {
  if (!isConfigured()) return;
  const { googleSheetsMembersTab } = getConfig();
  await upsertRow(googleSheetsMembersTab, MEMBER_HEADERS, memberToRow(member), 8);
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

export function syncMemberToSheetSafe(member: Member): void {
  syncMemberToSheet(member).catch((err) => {
    console.error("[Google Sheets] sync member failed:", member.line_user_id, err);
  });
}

export function isGoogleSheetsConfigured(): boolean {
  return getGoogleSheetsDiagnostics().syncReady;
}
