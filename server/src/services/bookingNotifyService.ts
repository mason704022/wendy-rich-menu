import { notifyAdmin, notifyUser } from "../lineClient.js";
import type { Booking } from "./bookingService.js";
import {
  getConfirmedCountForSlot,
  listActiveBookingsForSlot,
  slotLabelForBooking,
} from "./bookingService.js";
import { getCoffeeItem } from "./coffeeMenuService.js";
import { getMember } from "./memberService.js";

/** 正取人數達此門檻時，通知該時段所有已預約會員開課 */
export const MIN_CLASS_OPENING = 5;

function formatSlotLine(booking: Booking): string {
  const label = slotLabelForBooking(booking);
  return `${booking.slot_date}（${label}）${booking.start_time}-${booking.end_time}`;
}

export async function notifyBookingSuccess(booking: Booking): Promise<void> {
  const coffeeName = booking.coffee_item_id
    ? getCoffeeItem(booking.coffee_item_id)?.name ?? ""
    : "";
  const statusLabel = booking.status === "waitlist" ? "備取" : "正取";

  const lines = [
    "【預約成功】",
    formatSlotLine(booking),
    `狀態：${statusLabel}`,
  ];
  if (coffeeName) lines.push(`咖啡：${coffeeName}`);
  if (booking.status === "waitlist") {
    lines.push("若有正取名額釋出，將依序遞补為正取。");
  }

  await notifyUser(booking.line_user_id, lines.join("\n"));
}

export async function notifyClassOpeningIfNeeded(
  slotDate: string,
  startTime: string
): Promise<void> {
  const confirmedCount = getConfirmedCountForSlot(slotDate, startTime);
  if (confirmedCount !== MIN_CLASS_OPENING) return;

  const bookings = listActiveBookingsForSlot(slotDate, startTime);
  if (bookings.length === 0) return;

  const sample = bookings[0];
  const slotLine = formatSlotLine(sample);

  for (const booking of bookings) {
    await notifyUser(
      booking.line_user_id,
      [
        "【開課通知】",
        slotLine,
        `正取人數已達 ${MIN_CLASS_OPENING} 人，本時段確定開課！`,
        "期待與您見面。",
      ].join("\n")
    );
  }
}

export function notifyBookingSuccessSafe(booking: Booking): void {
  notifyBookingSuccess(booking).catch((err) => {
    console.error("[Booking notify success failed]", booking.id, err);
  });
}

export function notifyClassOpeningIfNeededSafe(slotDate: string, startTime: string): void {
  notifyClassOpeningIfNeeded(slotDate, startTime).catch((err) => {
    console.error("[Booking notify class opening failed]", slotDate, startTime, err);
  });
}

function formatRosterLines(slotDate: string, startTime: string): string[] {
  const bookings = listActiveBookingsForSlot(slotDate, startTime);
  if (bookings.length === 0) return ["（尚無預約）"];

  return bookings.map((b) => {
    const member = getMember(b.line_user_id);
    const coffee = b.coffee_item_id
      ? getCoffeeItem(b.coffee_item_id)?.name ?? ""
      : "";
    const status = b.status === "waitlist" ? "備取" : "正取";
    const coffeePart = coffee ? ` · ${coffee}` : "";
    return `· ${member?.name ?? "?"}（${status}）${coffeePart}`;
  });
}

export async function notifyAdminNewBooking(booking: Booking): Promise<void> {
  const member = getMember(booking.line_user_id);
  const coffeeName = booking.coffee_item_id
    ? getCoffeeItem(booking.coffee_item_id)?.name ?? ""
    : "";
  const statusLabel = booking.status === "waitlist" ? "備取" : "正取";
  const confirmed = getConfirmedCountForSlot(booking.slot_date, booking.start_time);

  const lines = [
    "【新預約】",
    formatSlotLine(booking),
    `會員：${member?.name ?? "?"} · ${member?.phone ?? ""}`,
    `狀態：${statusLabel}${coffeeName ? ` · 咖啡：${coffeeName}` : ""}`,
    "",
    `本堂正取 ${confirmed} 人，名單：`,
    ...formatRosterLines(booking.slot_date, booking.start_time),
  ];

  await notifyAdmin(lines.join("\n"));
}

export function notifyAdminNewBookingSafe(booking: Booking): void {
  notifyAdminNewBooking(booking).catch((err) => {
    console.error("[Admin booking notify failed]", booking.id, err);
  });
}
