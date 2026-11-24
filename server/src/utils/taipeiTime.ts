const TZ = "Asia/Taipei";

/** YYYY-MM-DD in Asia/Taipei */
export function todayIsoTaipei(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export interface TaipeiClock {
  date: string;
  hour: number;
  minute: number;
}

export function getTaipeiClock(now = new Date()): TaipeiClock {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const year = pick("year");
  const month = pick("month");
  const day = pick("day");
  let hour = Number(pick("hour"));
  const minute = Number(pick("minute"));
  if (hour === 24) hour = 0;

  return {
    date: `${year}-${month}-${day}`,
    hour,
    minute,
  };
}