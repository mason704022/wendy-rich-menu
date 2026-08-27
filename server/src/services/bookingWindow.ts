import { canBookSlot } from "./bookingTimeUtils.js";
import {
  addDaysLocal,
  formatLocalDate,
  getWeekStart,
  parseLocalDateString,
  todayIsoLocal,
} from "../utils/localDate.js";
import { SLOT_TEMPLATES } from "./slotTemplates.js";

export const BOOKING_WINDOW_DAYS = 28;

export function getBookingWindow(): { from: string; to: string } {
  const from = todayIsoLocal();
  return { from, to: addDaysLocal(from, BOOKING_WINDOW_DAYS) };
}

export interface BookableSlotRef {
  slotDate: string;
  label: string;
  startTime: string;
  endTime: string;
  display: string;
}

export interface BookableWeekRef {
  weekStart: string;
  weekLabel: string;
  slots: BookableSlotRef[];
}

function formatWeekLabel(weekStart: string): string {
  const start = parseLocalDateString(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `${fmt(start)} – ${fmt(end)}`;
}

export function listBookableWeeksInWindow(): BookableWeekRef[] {
  const { from, to } = getBookingWindow();
  const byWeek = new Map<string, BookableSlotRef[]>();

  const start = parseLocalDateString(from);
  const end = parseLocalDateString(to);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const slotDate = formatLocalDate(d);
    const weekday = d.getDay();

    for (const template of SLOT_TEMPLATES) {
      if (template.weekday !== weekday) continue;
      if (!canBookSlot(slotDate, template.startTime)) continue;

      const weekStart = getWeekStart(slotDate);
      const entry: BookableSlotRef = {
        slotDate,
        label: template.label,
        startTime: template.startTime,
        endTime: template.endTime,
        display: `${slotDate}（${template.label}）${template.startTime}-${template.endTime}`,
      };

      const list = byWeek.get(weekStart) ?? [];
      list.push(entry);
      byWeek.set(weekStart, list);
    }
  }

  return [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, slots]) => ({
      weekStart,
      weekLabel: formatWeekLabel(weekStart),
      slots: slots.sort((a, b) =>
        a.slotDate === b.slotDate
          ? a.startTime.localeCompare(b.startTime)
          : a.slotDate.localeCompare(b.slotDate)
      ),
    }));
}

export function listBookableWeekStartsInWindow(): string[] {
  return listBookableWeeksInWindow().map((w) => w.weekStart);
}
