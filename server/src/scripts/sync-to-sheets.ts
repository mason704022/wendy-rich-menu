import { initDatabase } from "../db/index.js";
import "../config.js";
import { listAllBookings } from "../services/bookingService.js";
import {
  isGoogleSheetsConfigured,
  syncBookingToSheet,
  syncPurchaseToSheet,
} from "../services/googleSheetsService.js";
import { listAllPurchases } from "../services/purchaseService.js";

initDatabase();

if (!isGoogleSheetsConfigured()) {
  console.error(
    "Google Sheets is not configured. Set GOOGLE_SHEETS_SPREADSHEET_ID and GOOGLE_SERVICE_ACCOUNT_JSON in .env"
  );
  console.error("See docs/GOOGLE_SHEETS_SETUP.md");
  process.exit(1);
}

async function main() {
  const bookings = listAllBookings();
  const purchases = listAllPurchases();

  console.log(`Syncing ${bookings.length} bookings...`);
  for (const booking of bookings) {
    await syncBookingToSheet(booking);
  }

  console.log(`Syncing ${purchases.length} purchases...`);
  for (const purchase of purchases) {
    await syncPurchaseToSheet(purchase);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
