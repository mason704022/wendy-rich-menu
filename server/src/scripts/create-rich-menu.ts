import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client } from "@line/bot-sdk";
import { getConfig, liffUrl } from "../config.js";
import { RICH_MENU_BOUNDS, RICH_MENU_SIZE } from "../richMenuBounds.js";
import { compressRichMenuImage } from "./compressRichMenuImage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAX_BYTES = 1024 * 1024;

async function main() {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.error("Missing LINE_CHANNEL_ACCESS_TOKEN in .env");
    process.exit(1);
  }

  const { igUrl } = getConfig();
  const client = new Client({ channelAccessToken: token });

  const projectRoot = path.join(__dirname, "../../..");
  const defaultPng = path.join(projectRoot, "line-rich-menu-wendy-yunspa-style.png");
  const defaultJpg = path.join(projectRoot, "line-rich-menu-wendy-yunspa-style-upload.jpg");
  const imagePath =
    process.env.RICH_MENU_IMAGE_PATH ??
    (fs.existsSync(defaultPng) ? defaultPng : defaultJpg);
  const optimizedJpgPath = path.join(
    path.dirname(imagePath),
    "line-rich-menu-wendy-yunspa-style-upload.jpg"
  );

  if (!fs.existsSync(imagePath)) {
    console.error("Rich menu image not found. Tried:", defaultPng, "and", defaultJpg);
    console.error("Set RICH_MENU_IMAGE_PATH to your PNG or JPG path.");
    process.exit(1);
  }

  let uploadBuffer: Buffer;
  let contentType: "image/jpeg" | "image/png";

  const optimizedExists =
    fs.existsSync(optimizedJpgPath) && fs.statSync(optimizedJpgPath).size <= MAX_BYTES;

  if (optimizedExists && !process.env.RICH_MENU_FORCE_RECOMPRESS) {
    uploadBuffer = fs.readFileSync(optimizedJpgPath);
    contentType = "image/jpeg";
    console.log(
      `Using optimized upload JPEG (${(uploadBuffer.length / 1024).toFixed(0)} KB): ${optimizedJpgPath}`
    );
  } else {
    const originalSize = fs.statSync(imagePath).size;
    console.log(`Original image: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);

    if (originalSize <= MAX_BYTES) {
      uploadBuffer = fs.readFileSync(imagePath);
      contentType = imagePath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
      console.log("Image already under 1 MB, uploading as-is.");
    } else {
      console.log("Image exceeds 1 MB — compressing for LINE (high quality)...");
      const compressed = await compressRichMenuImage(imagePath, optimizedJpgPath);
      uploadBuffer = compressed.buffer;
      contentType = compressed.contentType;
      if (compressed.savedPath) {
        console.log("Saved optimized upload file:", compressed.savedPath);
      }
    }
  }

  const richMenu = {
    size: RICH_MENU_SIZE,
    selected: true,
    name: "Wendy Studio Rich Menu",
    chatBarText: "選單",
    areas: [
      {
        bounds: RICH_MENU_BOUNDS.igLeft,
        action: { type: "uri" as const, label: "Instagram", uri: igUrl },
      },
      {
        bounds: RICH_MENU_BOUNDS.igRight,
        action: { type: "uri" as const, label: "Instagram", uri: igUrl },
      },
      {
        bounds: RICH_MENU_BOUNDS.courses,
        action: {
          type: "uri" as const,
          label: "課程專區",
          uri: liffUrl("/courses"),
        },
      },
      {
        bounds: RICH_MENU_BOUNDS.purchase,
        action: {
          type: "uri" as const,
          label: "購買課程",
          uri: liffUrl("/purchase"),
        },
      },
      {
        bounds: RICH_MENU_BOUNDS.booking,
        action: {
          type: "uri" as const,
          label: "我要預約",
          uri: liffUrl("/booking"),
        },
      },
      {
        bounds: RICH_MENU_BOUNDS.member,
        action: {
          type: "uri" as const,
          label: "會員資訊",
          uri: liffUrl("/member"),
        },
      },
    ],
  };

  const { liffId } = getConfig();
  console.log("LIFF_ID:", liffId || "(empty)");
  console.log("Action URIs:");
  for (const area of richMenu.areas) {
    console.log(`  ${area.action.label}: ${area.action.uri}`);
  }

  if (!liffId) {
    console.error("Missing LIFF_ID in server/.env — Rich Menu LIFF links will fail.");
    process.exit(1);
  }

  let richMenuId: string | null = null;

  try {
    console.log("Creating rich menu...");
    richMenuId = await client.createRichMenu(richMenu);
    console.log("Rich menu ID:", richMenuId);

    await client.setRichMenuImage(richMenuId, uploadBuffer, contentType);
    console.log(`Image uploaded (${(uploadBuffer.length / 1024).toFixed(0)} KB, ${contentType})`);

    await client.setDefaultRichMenu(richMenuId);
    console.log("Set as default rich menu.");

    console.log("\nDone! Close and reopen the LINE chat to see the menu.");
    console.log(JSON.stringify(RICH_MENU_BOUNDS, null, 2));
  } catch (error) {
    if (richMenuId) {
      console.warn("Upload failed — deleting orphaned rich menu:", richMenuId);
      await client.deleteRichMenu(richMenuId).catch(() => undefined);
    }
    throw error;
  }
}

function printLineApiError(err: unknown) {
  const e = err as {
    status?: number;
    statusCode?: number;
    message?: string;
    originalError?: { response?: { data?: unknown } };
  };
  const status = e.status ?? e.statusCode;
  const body = e.originalError?.response?.data;
  console.error("\n--- LINE API error ---");
  if (status) console.error("HTTP status:", status);
  if (e.message) console.error("Message:", e.message);
  if (body) console.error("Response:", JSON.stringify(body, null, 2));
  if (status === 400) {
    console.error(`
常見 400 原因：
1. LIFF 未連結官方帳號 → LINE Login Channel → Basic settings → Linked LINE Official Account
2. LIFF Endpoint 未設為 Railway 網域 → LIFF 設定 → Endpoint URL
3. LIFF URL 不屬於此 Provider 的 LIFF App
4. 圖片尺寸不是 2500×1686（若錯在 upload 步驟）
`);
  }
}

main().catch((err) => {
  printLineApiError(err);
  process.exit(1);
});
