import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/adminAuth.js";
import { loadJson, getConfig } from "../config.js";
import { notifyAdmin, notifyUser } from "../lineClient.js";
import { getMember } from "../services/memberService.js";
import {
  confirmPurchase,
  createPurchase,
  listPurchasesByUser,
  rejectPurchase,
} from "../services/purchaseService.js";

export const purchasesRouter = Router();

interface Plan {
  id: string;
  name: string;
  description: string;
  durationLabel: string;
  sessionsCount: number;
  price: number;
}

interface PlansFile {
  categories: Array<{ id: string; label: string; plans: Plan[] }>;
}

function findPlan(planId: string): Plan | undefined {
  const data = loadJson<PlansFile>("plans.json");
  for (const category of data.categories) {
    const plan = category.plans.find((p) => p.id === planId);
    if (plan) return plan;
  }
  return undefined;
}

purchasesRouter.get("/plans", (_req, res) => {
  res.json(loadJson("plans.json"));
});

purchasesRouter.get("/payment-info", (_req, res) => {
  const payment = loadJson<{
    bankName: string;
    accountNumber: string;
    accountName: string;
    note: string;
  }>("payment.json");
  res.json(payment);
});

purchasesRouter.get("/user/:lineUserId", (req, res) => {
  res.json({ purchases: listPurchasesByUser(req.params.lineUserId) });
});

purchasesRouter.post("/", async (req, res) => {
  const schema = z.object({
    lineUserId: z.string().min(1),
    planId: z.string().min(1),
    payerName: z.string().min(1),
    transferLast5: z.string().regex(/^\d{5}$/),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const member = getMember(parsed.data.lineUserId);
  if (!member) {
    return res.status(400).json({ error: "NOT_REGISTERED" });
  }

  const plan = findPlan(parsed.data.planId);
  if (!plan) {
    return res.status(400).json({ error: "INVALID_PLAN" });
  }

  const purchase = createPurchase({
    lineUserId: parsed.data.lineUserId,
    amount: plan.price,
    sessionsCount: plan.sessionsCount,
    payerName: parsed.data.payerName,
    transferLast5: parsed.data.transferLast5,
  });

  const { liffBaseUrl } = getConfig();
  const adminPageHint = liffBaseUrl ? `\n\n管理頁：${liffBaseUrl}?page=admin` : "";
  const adminMsg = `【待確認付款】\n匯款人：${parsed.data.payerName}\n後五碼：${parsed.data.transferLast5}\n會員：${member.name}（${member.display_name}）\n電話：${member.phone}\n堂數：${purchase.sessions_count}\n金額：${purchase.amount}\n訂單編號：${purchase.id}${adminPageHint}`;

  res.status(201).json({ purchase });

  void (async () => {
    try {
      await notifyAdmin(adminMsg);
      await notifyUser(
        parsed.data.lineUserId,
        `已收到您的匯款通知（訂單 #${purchase.id}）。工作室將於 1-2 個工作天確認並更新堂數。`
      );
    } catch (notifyError) {
      console.error("[Purchase notify failed]", notifyError);
    }
  })();
});

purchasesRouter.post("/:id/confirm", requireAdmin, (req, res) => {
  try {
    const purchase = confirmPurchase(Number(req.params.id));
    res.json({ purchase });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    res.status(400).json({ error: message });
  }
});

purchasesRouter.post("/:id/reject", requireAdmin, (req, res) => {
  try {
    const purchase = rejectPurchase(Number(req.params.id));
    res.json({ purchase });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    res.status(400).json({ error: message });
  }
});
