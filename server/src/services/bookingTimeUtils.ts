/** 預約／取消截止：開課前幾小時 */
export const BOOKING_CUTOFF_HOURS = 24;

/** 開課時間（Asia/Taipei）的 timestamp */
export function getSlotStartMs(slotDate: string, startTime: string): number {
  return new Date(`${slotDate}T${startTime}:00+08:00`).getTime();
}

/** 已進入開課前 24 小時內（不可預約、不可取消） */
export function isWithinBookingCutoff(slotDate: string, startTime: string): boolean {
  const cutoffMs =
    getSlotStartMs(slotDate, startTime) - BOOKING_CUTOFF_HOURS * 60 * 60 * 1000;
  return Date.now() >= cutoffMs;
}

export function canCancelBooking(slotDate: string, startTime: string): boolean {
  return !isWithinBookingCutoff(slotDate, startTime);
}

export function canBookSlot(slotDate: string, startTime: string): boolean {
  return !isWithinBookingCutoff(slotDate, startTime);
}
