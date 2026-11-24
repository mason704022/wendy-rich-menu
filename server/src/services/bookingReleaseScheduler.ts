import { runBookingReleaseTick } from "./bookingReleaseService.js";

const CHECK_INTERVAL_MS = 60 * 1000;

export function startBookingReleaseScheduler(): void {
  const tick = () => {
    try {
      runBookingReleaseTick();
    } catch (err) {
      console.error("[booking-release] scheduler error", err);
    }
  };

  tick();
  setInterval(tick, CHECK_INTERVAL_MS);
  console.log("[booking-release] scheduler started");
}