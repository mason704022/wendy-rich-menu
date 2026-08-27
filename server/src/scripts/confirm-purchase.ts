import "dotenv/config";
import { confirmPurchase, getPurchase } from "../services/purchaseService.js";
import { initDatabase } from "../db/index.js";
import { notifyUser } from "../lineClient.js";

const purchaseId = Number(process.argv[2]);

if (!purchaseId) {
  console.error("Usage: npm run confirm-purchase -- <purchase_id>");
  console.error("Tip: npm run list-purchases  — see pending order IDs");
  process.exit(1);
}

initDatabase();

const existing = getPurchase(purchaseId);
if (!existing) {
  console.error(`Purchase #${purchaseId} not found.`);
  console.error("Run: npm run list-purchases");
  process.exit(1);
}

if (existing.status !== "pending") {
  console.error(`Purchase #${purchaseId} is already "${existing.status}" (not pending).`);
  console.error("Run: npm run list-purchases  — find a pending order ID");
  process.exit(1);
}

try {
  const purchase = confirmPurchase(purchaseId);
  try {
    await notifyUser(
      purchase.line_user_id,
      `您的訂單 #${purchase.id} 已確認！已增加 ${purchase.sessions_count} 堂，可至「會員資訊」查看。`
    );
  } catch (notifyError) {
    console.warn("[Notify user failed]", notifyError);
  }
  console.log("Confirmed purchase:", purchase);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
