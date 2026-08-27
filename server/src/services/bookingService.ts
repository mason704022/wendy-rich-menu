import { getDb } from "../db/index.js";
import { canBookSlot, canCancelBooking } from "./bookingTimeUtils.js";
import { getCoffeeItem } from "./coffeeMenuService.js";
import { syncBookingToSheetSafe } from "./googleSheetsService.js";
import { deductSession, getMember, refundSession } from "./memberService.js";
import { resolveSessionTheme } from "./sessionThemeService.js";
import { formatLocalDate } from "../utils/localDate.js";
import { SLOT_TEMPLATES } from "./slotTemplates.js";

export { SLOT_TEMPLATES };

export const MAX_CONFIRMED = 10;
export const MAX_WAITLIST = 2;

export function slotLabelForBooking(booking: Booking): string {
  const template = SLOT_TEMPLATES.find((t) => t.weekday === booking.weekday);
  return template?.label ?? "";
}

export function getConfirmedCountForSlot(slotDate: string, startTime: string): number {
  return countByStatus(slotDate, startTime, "confirmed");
}

export function listActiveBookingsForSlot(
  slotDate: string,
  startTime: string
): Booking[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM bookings
       WHERE slot_date = ? AND start_time = ? AND status IN ('confirmed', 'waitlist')
       ORDER BY created_at ASC`
    )
    .all(slotDate, startTime) as unknown as Booking[];
}

export interface Booking {
  id: number;
  line_user_id: string;
  slot_date: string;
  weekday: number;
  start_time: string;
  end_time: string;
  status: "confirmed" | "waitlist" | "cancelled";
  coffee_item_id: string;
  created_at: string;
}

export interface BookingWithCoffee extends Booking {
  coffee_name: string;
  can_cancel: boolean;
}

export interface BookingWithMember extends BookingWithCoffee {
  member_name: string;
  member_phone: string;
}

export interface SessionAttendee {
  booking_id: number;
  member_name: string;
  member_phone: string;
  status: "confirmed" | "waitlist";
  coffee_name: string;
}

export interface BookingSessionSummary {
  slot_date: string;
  start_time: string;
  end_time: string;
  label: string;
  confirmed_count: number;
  waitlist_count: number;
  total_count: number;
  attendees: SessionAttendee[];
}

export interface SlotAvailability {
  slotDate: string;
  weekday: number;
  label: string;
  startTime: string;
  endTime: string;
  confirmedCount: number;
  waitlistCount: number;
  maxConfirmed: number;
  maxWaitlist: number;
  canBookConfirmed: boolean;
  canBookWaitlist: boolean;
  bookingClosed: boolean;
  alreadyBooked: boolean;
  sessionTitle: string;
  sessionIntro: string;
  sessionImageUrl: string;
}

function countByStatus(
  slotDate: string,
  startTime: string,
  status: "confirmed" | "waitlist"
): number {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COUNT(*) as count FROM bookings
       WHERE slot_date = ? AND start_time = ? AND status = ?`
    )
    .get(slotDate, startTime, status) as { count: number };
  return row.count;
}

function hasActiveBooking(
  lineUserId: string,
  slotDate: string,
  startTime: string
): boolean {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT 1 FROM bookings
       WHERE line_user_id = ? AND slot_date = ? AND start_time = ?
         AND status IN ('confirmed', 'waitlist')
       LIMIT 1`
    )
    .get(lineUserId, slotDate, startTime);
  return row !== undefined;
}

export function getAvailabilityForDate(
  slotDate: string,
  lineUserId?: string
): SlotAvailability[] {
  const date = new Date(`${slotDate}T00:00:00`);
  const weekday = date.getDay();

  return SLOT_TEMPLATES.filter((t) => t.weekday === weekday).map((template) => {
    const confirmedCount = countByStatus(slotDate, template.startTime, "confirmed");
    const waitlistCount = countByStatus(slotDate, template.startTime, "waitlist");
    const bookingClosed = !canBookSlot(slotDate, template.startTime);
    const alreadyBooked = lineUserId
      ? hasActiveBooking(lineUserId, slotDate, template.startTime)
      : false;
    const theme = resolveSessionTheme(slotDate, template.startTime, template.weekday);

    return {
      slotDate,
      weekday: template.weekday,
      label: template.label,
      startTime: template.startTime,
      endTime: template.endTime,
      confirmedCount,
      waitlistCount,
      maxConfirmed: MAX_CONFIRMED,
      maxWaitlist: MAX_WAITLIST,
      bookingClosed,
      alreadyBooked,
      sessionTitle: theme.title,
      sessionIntro: theme.intro,
      sessionImageUrl: theme.imageUrl,
      canBookConfirmed:
        !alreadyBooked && !bookingClosed && confirmedCount < MAX_CONFIRMED,
      canBookWaitlist:
        !alreadyBooked &&
        !bookingClosed &&
        confirmedCount >= MAX_CONFIRMED &&
        waitlistCount < MAX_WAITLIST,
    };
  });
}

export function getAvailabilityRange(
  fromDate: string,
  toDate: string,
  lineUserId?: string
): SlotAvailability[] {
  const results: SlotAvailability[] = [];
  const start = new Date(`${fromDate}T00:00:00`);
  const end = new Date(`${toDate}T00:00:00`);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = formatLocalDate(d);
    results.push(...getAvailabilityForDate(iso, lineUserId));
  }

  return results;
}

export function createBooking(input: {
  lineUserId: string;
  slotDate: string;
  startTime: string;
  coffeeItemId: string;
}): Booking {
  const member = getMember(input.lineUserId);
  if (!member) throw new Error("NOT_REGISTERED");

  const coffee = getCoffeeItem(input.coffeeItemId);
  if (!coffee) throw new Error("INVALID_COFFEE_ITEM");

  const slots = getAvailabilityForDate(input.slotDate, input.lineUserId);
  const slot = slots.find((s) => s.startTime === input.startTime);
  if (!slot) throw new Error("INVALID_SLOT");
  if (slot.alreadyBooked) throw new Error("ALREADY_BOOKED");
  if (slot.bookingClosed || !canBookSlot(input.slotDate, input.startTime)) {
    throw new Error("BOOKING_CLOSED");
  }

  let status: "confirmed" | "waitlist";
  if (slot.canBookConfirmed) {
    status = "confirmed";
  } else if (slot.canBookWaitlist) {
    status = "waitlist";
  } else {
    throw new Error("SLOT_FULL");
  }

  if (status === "confirmed" && member.remaining_sessions <= 0) {
    throw new Error("INSUFFICIENT_SESSIONS");
  }

  const db = getDb();
  try {
    const result = db
      .prepare(
        `INSERT INTO bookings (line_user_id, slot_date, weekday, start_time, end_time, status, coffee_item_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.lineUserId,
        input.slotDate,
        slot.weekday,
        slot.startTime,
        slot.endTime,
        status,
        input.coffeeItemId
      );

    if (status === "confirmed") {
      deductSession(input.lineUserId);
    }

    const booking = getBooking(Number(result.lastInsertRowid))!;
    syncBookingToSheetSafe(booking);
    return booking;
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) {
      throw new Error("ALREADY_BOOKED");
    }
    throw error;
  }
}

export function getBooking(id: number): Booking | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM bookings WHERE id = ?").get(id) as
    | Booking
    | undefined;
}

export function listBookingsByUser(lineUserId: string): BookingWithCoffee[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM bookings
       WHERE line_user_id = ? AND status != 'cancelled'
       ORDER BY slot_date DESC, start_time DESC`
    )
    .all(lineUserId) as unknown as Booking[];

  return rows.map((b) => ({
    ...b,
    coffee_name: b.coffee_item_id ? getCoffeeItem(b.coffee_item_id)?.name ?? "" : "",
    can_cancel: canCancelBooking(b.slot_date, b.start_time),
  }));
}

export function cancelBooking(id: number, lineUserId: string): Booking {
  const booking = getBooking(id);
  if (!booking || booking.line_user_id !== lineUserId) {
    throw new Error("BOOKING_NOT_FOUND");
  }
  if (booking.status === "cancelled") throw new Error("ALREADY_CANCELLED");

  if (!canCancelBooking(booking.slot_date, booking.start_time)) {
    throw new Error("CANCEL_WITHIN_24H");
  }

  const db = getDb();
  db.prepare(`UPDATE bookings SET status = 'cancelled' WHERE id = ?`).run(id);

  if (booking.status === "confirmed") {
    refundSession(lineUserId);
    promoteWaitlist(booking.slot_date, booking.start_time);
  }

  const updated = getBooking(id)!;
  syncBookingToSheetSafe(updated);
  return updated;
}

function promoteWaitlist(slotDate: string, startTime: string) {
  const db = getDb();
  const next = db
    .prepare(
      `SELECT * FROM bookings
       WHERE slot_date = ? AND start_time = ? AND status = 'waitlist'
       ORDER BY created_at ASC LIMIT 1`
    )
    .get(slotDate, startTime) as Booking | undefined;

  if (!next) return;

  const member = getMember(next.line_user_id);
  if (!member || member.remaining_sessions <= 0) return;

  db.prepare(`UPDATE bookings SET status = 'confirmed' WHERE id = ?`).run(next.id);
  deductSession(next.line_user_id);

  const promoted = getBooking(next.id);
  if (promoted) {
    syncBookingToSheetSafe(promoted);
    void import("./bookingNotifyService.js").then((m) =>
      m.notifyClassOpeningIfNeededSafe(slotDate, startTime)
    );
  }
}

export function listAllBookings(): Booking[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM bookings ORDER BY slot_date DESC, start_time DESC")
    .all() as unknown as Booking[];
}

export function listUpcomingBookings(days: number): BookingWithMember[] {
  const today = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM bookings
       WHERE status != 'cancelled' AND slot_date >= ? AND slot_date <= ?
       ORDER BY slot_date ASC, start_time ASC`
    )
    .all(today, end) as unknown as Booking[];

  return rows.map((b) => {
    const member = getMember(b.line_user_id);
    return {
      ...b,
      coffee_name: b.coffee_item_id
        ? getCoffeeItem(b.coffee_item_id)?.name ?? ""
        : "",
      member_name: member?.name ?? "",
      member_phone: member?.phone ?? "",
      can_cancel: canCancelBooking(b.slot_date, b.start_time),
    };
  });
}

export function listBookingSessionsForAdmin(days: number): BookingSessionSummary[] {
  const bookings = listUpcomingBookings(days);
  const sessionMap = new Map<string, BookingSessionSummary>();

  for (const b of bookings) {
    const key = `${b.slot_date}|${b.start_time}`;
    if (!sessionMap.has(key)) {
      sessionMap.set(key, {
        slot_date: b.slot_date,
        start_time: b.start_time,
        end_time: b.end_time,
        label: slotLabelForBooking(b),
        confirmed_count: 0,
        waitlist_count: 0,
        total_count: 0,
        attendees: [],
      });
    }
    const session = sessionMap.get(key)!;
    session.attendees.push({
      booking_id: b.id,
      member_name: b.member_name,
      member_phone: b.member_phone,
      status: b.status as "confirmed" | "waitlist",
      coffee_name: b.coffee_name,
    });
    if (b.status === "confirmed") session.confirmed_count += 1;
    else if (b.status === "waitlist") session.waitlist_count += 1;
    session.total_count = session.attendees.length;
  }

  return [...sessionMap.values()].sort((a, b) =>
    a.slot_date === b.slot_date
      ? a.start_time.localeCompare(b.start_time)
      : a.slot_date.localeCompare(b.slot_date)
  );
}
