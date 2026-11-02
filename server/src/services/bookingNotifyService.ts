import { notifyUser } from "../lineClient.js";
import type { Booking } from "./bookingService.js";
import { slotLabelForBooking } from "./bookingService.js";
import { formatCoffeeDisplayName } from "./coffeeMenuService.js";

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
    "開課確認：開課前 24 小時截止預約與取消後，若正取滿 5 人即確定開課，屆時將另行通知。"
  );

  await notifyUser(booking.line_user_id, lines.join("\n"));
}

export function notifyBookingSuccessSafe(booking: Booking): void {
  notifyBookingSuccess(booking).catch((err) => {
    console.error("[Booking notify success failed]", booking.id, err);
  });
}
