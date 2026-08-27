import { middleware, webhook } from "@line/bot-sdk";
import express, { type Request, Response, RequestHandler } from "express";

const channelSecret = process.env.LINE_CHANNEL_SECRET ?? "";

const lineSignatureMiddleware: RequestHandler = channelSecret
  ? middleware({ channelSecret })
  : (_req, _res, next) => {
      console.warn(
        "[Webhook] LINE_CHANNEL_SECRET not set — skipping signature verification"
      );
      next();
    };

export async function lineWebhookHandler(req: Request, res: Response) {
  try {
    const events: webhook.Event[] = req.body?.events ?? [];
    if (events.length > 0) {
      await Promise.all(events.map(handleEvent));
    }
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Webhook failed" });
  }
}

async function handleEvent(event: webhook.Event) {
  if (event.type === "follow") {
    console.log("New follower:", event.source?.userId);
  }

  if (event.type === "postback") {
    console.log("Postback:", event.postback.data);
  }
}

/** Register webhook route — call once in index.ts */
export function registerLineWebhook(app: express.Application) {
  if (channelSecret) {
    // Signed webhooks: LINE middleware parses raw body (must NOT use express.json first)
    app.post("/webhook/line", lineSignatureMiddleware, lineWebhookHandler);
  } else {
    // Dev without secret: parse JSON manually
    app.post("/webhook/line", express.json(), lineWebhookHandler);
  }

  // Helpful for manual checks (LINE Verify uses POST, not GET)
  app.get("/webhook/line", (_req, res) => {
    res.status(200).json({
      ok: true,
      message: "Webhook endpoint is reachable. LINE Verify requires POST.",
    });
  });
}
