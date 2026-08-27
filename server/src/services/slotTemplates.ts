export const SLOT_TEMPLATES = [
  { weekday: 3, label: "週三", startTime: "09:00", endTime: "11:00" },
  { weekday: 5, label: "週五", startTime: "19:00", endTime: "21:00" },
  { weekday: 6, label: "週六", startTime: "09:00", endTime: "11:00" },
] as const;

export type SlotTemplate = (typeof SLOT_TEMPLATES)[number];
