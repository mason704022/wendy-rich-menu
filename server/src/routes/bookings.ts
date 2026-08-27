import { Router } from "express";
import { z } from "zod";
import { getBookingWindow } from "../services/bookingWindow.js";
import { getCoffeeMenu } from "../services/coffeeMenuService.js";
import {
  cancelBooking,
  createBooking,
  getAvailabilityRange,
  listBookingsByUser,
  SLOT_TEMPLATES,
} from "../services/bookingService.js";
import {
  notifyAdminNewBookingSafe,
  notifyBookingSuccessSafe,
  notifyClassOpeningIfNeededSafe,
} from "../services/bookingNotifyService.js";

export const bookingsRouter = Router();

bookingsRouter.get("/coffee-menu", (_req, res) => {
  res.json(getCoffeeMenu());
});

bookingsRouter.get("/templates", (_req, res) => {
  res.json({ templates: SLOT_TEMPLATES });
});

bookingsRouter.get("/availability", (req, res) => {
  const window = getBookingWindow();
  const from = (req.query.from as string) ?? window.from;
  const to = (req.query.to as string) ?? window.to;
  const lineUserId =
    typeof req.query.lineUserId === "string" ? req.query.lineUserId : undefined;

  res.json({ slots: getAvailabilityRange(from, to, lineUserId) });
});

bookingsRouter.get("/user/:lineUserId", (req, res) => {
  res.json({ bookings: listBookingsByUser(req.params.lineUserId) });
});

bookingsRouter.post("/", (req, res) => {
  const schema = z.object({
    lineUserId: z.string().min(1),
    slotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().min(4),
    coffeeItemId: z.string().min(1),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const booking = createBooking(parsed.data);
    notifyBookingSuccessSafe(booking);
    notifyAdminNewBookingSafe(booking);
    if (booking.status === "confirmed") {
      notifyClassOpeningIfNeededSafe(booking.slot_date, booking.start_time);
    }
    res.status(201).json({ booking });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    const status =
      message === "NOT_REGISTERED"
        ? 401
        : message === "INSUFFICIENT_SESSIONS" ||
            message === "SLOT_FULL" ||
            message === "BOOKING_CLOSED" ||
            message === "ALREADY_BOOKED"
          ? 409
          : 400;
    res.status(status).json({ error: message });
  }
});

bookingsRouter.post("/:id/cancel", (req, res) => {
  const schema = z.object({
    lineUserId: z.string().min(1),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const booking = cancelBooking(Number(req.params.id), parsed.data.lineUserId);
    res.json({ booking });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    const status =
      message === "CANCEL_WITHIN_24H" || message === "SAME_DAY_CANCEL" ? 403 : 400;
    res.status(status).json({
      error: message,
      message:
        message === "CANCEL_WITHIN_24H" || message === "SAME_DAY_CANCEL"
          ? "開課前 24 小時內無法取消預約"
          : undefined,
    });
  }
});
