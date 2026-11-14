import { Client } from "@line/bot-sdk";
import { getConfig } from "./config.js";

let client: Client | null = null;

export function getLineClient(): Client {
  if (!client) {
    client = new Client({
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "",
    });
  }
  return client;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isLineRateLimitError(err: unknown): boolean {
  const code = (err as { statusCode?: number })?.statusCode;
  return code === 429;
}

async function pushTextWithRetry(to: string, message: string): Promise<void> {
  const maxAttempts = 8;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await getLineClient().pushMessage(to, { type: "text", text: message });
      await sleep(350);
      return;
    } catch (err) {
      if (isLineRateLimitError(err) && attempt < maxAttempts) {
        const waitMs = Math.min(60_000, 1500 * 2 ** (attempt - 1));
        console.warn(`[LINE push] 429 for ${to}, retry ${attempt}/${maxAttempts} in ${waitMs}ms`);
        await sleep(waitMs);
        continue;
      }
      throw err;
    }
  }
}

export async function notifyAdmin(message: string) {
  const { adminLineUserId } = getConfig();
  if (!adminLineUserId) {
    console.log("[Admin notification]", message);
    return;
  }

  await pushTextWithRetry(adminLineUserId, message);
}

export async function notifyUser(lineUserId: string, message: string) {
  await pushTextWithRetry(lineUserId, message);
}
