import { notifyAdmin, notifyUser } from "../lineClient.js";
import type { Booking } from "./bookingService.js";
import {
  getConfirmedCountForSlot,
  listActiveBookingsForSlot,
  slotLabelForBooking,
} from "./bookingService.js";
import { formatCoffeeDisplayName } from "./coffeeMenuService.js";
import { getMember } from "./memberService.js";

function formatSlotLine(booking: Booking): string {
  const label = slotLabelForBooking(booking);
  return `${booking.slot_date}（${label}）${booking.start_time}-${booking.end_time}`;
}

export async function notifyBookingSuccess(booking: Booking): Promise<void> {
  const coffeeName = booking.coffee_item_id
    ? formatCoffeeDisplayName(booking.coffee_item_id, booking.coffee_temperature)
    : "";
  const statusLabel = booking.status === "waitlist" ? "備取" : "正取";

  const lines = [
    "【預約成功】",
    formatSlotLine(booking),
    `狀態：${statusLabel}`,
  ];
  if (coffeeName) lines.push(`飲品：${coffeeName}`);
  if (booking.status === "waitlist") {
    lines.push("若有正取名額釋出，將依序遞補為正取。");
  }
  lines.push(
    "",
    "開課確認：開課前 24 小時截止預約與取消後，若正取滿 6 人即確定開課，屆時將另行通知。"
  );

  await notifyUser(booking.line_user_id, lines.join("\n"));
}

export function notifyBookingSuccessSafe(booking: Booking): void {
  notifyBookingSuccess(booking).catch((err) => {
    console.error("[Booking notify success failed]", booking.id, err);
  });
}

function formatRosterLines(slotDate: string, startTime: string): string[] {
  const bookings = listActiveBookingsForSlot(slotDate, startTime);
  if (bookings.length === 0) return ["（尚無預約）"];

  return bookings.map((b) => {
    const member = getMember(b.line_user_id);
    const coffee = b.coffee_item_id
      ? formatCoffeeDisplayName(b.coffee_item_id, b.coffee_temperature)
      : "";
    const status = b.status === "waitlist" ? "備取" : "正取";
    const coffeePart = coffee ? ` · ${coffee}` : "";
    return `· ${member?.name ?? "?"}（${status}）${coffeePart}`;
  });
}

export async function notifyAdminNewBooking(booking: Booking): Promise<void> {
  const member = getMember(booking.line_user_id);
  const coffeeName = booking.coffee_item_id
    ? formatCoffeeDisplayName(booking.coffee_item_id, booking.coffee_temperature)
    : "";
  const statusLabel = booking.status === "waitlist" ? "備取" : "正取";
  const confirmed = getConfirmedCountForSlot(booking.slot_date, booking.start_time);

  const lines = [
    "【新預約】",
    formatSlotLine(booking),
    `會員：${member?.name ?? "?"} · ${member?.phone ?? ""}`,
    `狀態：${statusLabel}${coffeeName ? ` · 飲品：${coffeeName}` : ""}`,
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
