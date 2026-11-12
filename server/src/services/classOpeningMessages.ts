import type { Booking } from "./bookingService.js";
import { formatCoffeeDisplayName } from "./coffeeMenuService.js";
import { getMember } from "./memberService.js";
import { MIN_CLASS_OPENING } from "./classOpeningConfig.js";
const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

const VENUE_LINES = [
  "📍 地點：新竹市回咖啡。上課前 20 分鐘入場。",
  "附近備有汽機車停車場。",
];

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatClassDateLabel(slotDate: string): string {
  const d = parseLocalDate(slotDate);
  return `${d.getMonth() + 1}月${d.getDate()}日（星期${WEEKDAY_LABELS[d.getDay()]}）`;
}

export function formatClassTimeLabel(startTime: string, endTime: string): string {
  return `${startTime}-${endTime}`;
}

function drinkLabelForBooking(booking: Booking): string {
  if (!booking.coffee_item_id) return "（未選飲品）";
  return formatCoffeeDisplayName(booking.coffee_item_id, booking.coffee_temperature);
}

export type StaffRosterExtra = { name: string; drinkLabel: string };

/** 依品項彙整杯數（送回咖啡備料） */
function summarizeDrinkCounts(
  bookings: Booking[],
  rosterExtras: StaffRosterExtra[] = []
): string[] {
  const counts = new Map<string, number>();
  for (const b of bookings) {
    const label = drinkLabelForBooking(b);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  for (const extra of rosterExtras) {
    counts.set(extra.drinkLabel, (counts.get(extra.drinkLabel) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hant"))
    .map(([name, n]) => `・${name}：${n} 杯`);
}

/** 達開班門檻 — 學員（正取） */
export function buildStudentClassOpenedMessage(booking: Booking): string {
  return [
    `您好！您預約的課程已達 ${MIN_CLASS_OPENING} 人開班標準，確定開班囉！課程日期及時間如下：`,
    "",
    `🗓️ 日期：${formatClassDateLabel(booking.slot_date)}`,
    `🕒 時間：${formatClassTimeLabel(booking.start_time, booking.end_time)}`,
    ...VENUE_LINES,
    `☕️ 選擇飲品：${drinkLabelForBooking(booking)}`,
    "",
    "期待與您一起享受愉快的創作時光！",
  ].join("\n");
}

/** 未達開班門檻 — 學員 */
export function buildStudentClassCancelledMessage(): string {
  return [
    `您好！因本次課程預約人數未達 ${MIN_CLASS_OPENING} 人開班標準，本次課程將不予開班。`,
    "",
    "該堂課程堂數將自動歸還至您的帳戶，不影響原有剩餘堂數。",
    "",
    "感謝您的理解，歡迎再次預約其他課程時段！",
  ].join("\n");
}

/** 達開班門檻 — 老師及回咖啡 */
export function buildStaffClassOpenedMessage(
  slotDate: string,
  startTime: string,
  endTime: string,
  confirmedCount: number,
  confirmedBookings: Booking[],
  rosterExtras: StaffRosterExtra[] = []
): string {
  const summaryLines =
    confirmedBookings.length === 0 && rosterExtras.length === 0
      ? ["（無正取學員）"]
      : summarizeDrinkCounts(confirmedBookings, rosterExtras);

  const detailLines = [
    ...confirmedBookings.map((b) => {
      const member = getMember(b.line_user_id);
      const name = member?.name?.trim() || "學員";
      return `${name}：${drinkLabelForBooking(b)}`;
    }),
    ...rosterExtras.map((e) => `${e.name}：${e.drinkLabel}`),
  ];

  return [
    "☕️🪑 畫畫課程預約通知",
    "您好，以下為本次課程預約資訊，再麻煩協助準備，謝謝！",
    "",
    `🗓️ 日期：${formatClassDateLabel(slotDate)}`,
    `🕒 時間：${formatClassTimeLabel(startTime, endTime)}`,
    `👥 預約人數：${confirmedCount} 人`,
    "",
    "飲品數量彙整：",
    ...summaryLines,
    ...(detailLines.length > 0
      ? ["", "學員明細：", ...detailLines]
      : []),
  ].join("\n");
}

/** 未達開班門檻 — 老師／管理端簡訊 */
export function buildStaffClassCancelledMessage(
  slotDate: string,
  startTime: string,
  endTime: string,
  confirmedCount: number
): string {
  return [
    `您好！因本次課程預約人數未達 ${MIN_CLASS_OPENING} 人開班標準，本次課程將不予開班。`,
    "",
    `🗓️ 日期：${formatClassDateLabel(slotDate)}`,
    `🕒 時間：${formatClassTimeLabel(startTime, endTime)}`,
    `👥 正取人數：${confirmedCount}人`,
  ].join("\n");
}
