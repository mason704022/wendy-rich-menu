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

export async function notifyAdmin(message: string) {
  const { adminLineUserId } = getConfig();
  if (!adminLineUserId) {
    console.log("[Admin notification]", message);
    return;
  }

  await getLineClient().pushMessage(adminLineUserId, {
    type: "text",
    text: message,
  });
}

export async function notifyUser(lineUserId: string, message: string) {
  await getLineClient().pushMessage(lineUserId, {
    type: "text",
    text: message,
  });
}
