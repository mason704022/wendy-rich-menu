import { loadJson } from "../config.js";
import { getLineClient } from "../lineClient.js";

interface WelcomeFollowContent {
  paragraphs: string[];
}

export function getFollowWelcomeText(): string {
  const data = loadJson<WelcomeFollowContent>("welcome-follow.json");
  return data.paragraphs.join("\n\n");
}

export async function sendFollowWelcomeMessage(
  replyToken: string,
  lineUserId?: string
): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
  if (!token) {
    console.warn("[Follow welcome] LINE_CHANNEL_ACCESS_TOKEN not set — skip message");
    return;
  }

  const text = getFollowWelcomeText();
  const client = getLineClient();

  try {
    if (replyToken) {
      await client.replyMessage(replyToken, { type: "text", text });
      return;
    }
    if (lineUserId) {
      await client.pushMessage(lineUserId, { type: "text", text });
    }
  } catch (err) {
    console.error("[Follow welcome] Failed to send:", err);
  }
}
