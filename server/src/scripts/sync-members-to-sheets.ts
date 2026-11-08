import { initDatabase } from "../db/index.js";
import "../config.js";
import { listAllMembers } from "../services/memberService.js";
import {
  isGoogleSheetsConfigured,
  syncAllMembersToSheet,
} from "../services/googleSheetsService.js";

initDatabase();

if (!isGoogleSheetsConfigured()) {
  console.error("Google Sheets not configured");
  process.exit(1);
}

async function main() {
  const count = listAllMembers().length;
  console.log(`Syncing ${count} members...`);
  await syncAllMembersToSheet();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
