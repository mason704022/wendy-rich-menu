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

  const imagePath =
    process.env.RICH_MENU_IMAGE_PATH ??
    path.join(__dirname, "../../../line-rich-menu-wendy-yunspa-style.png");

  if (!fs.existsSync(imagePath)) {
    console.error("Rich menu image not found:", imagePath);
    process.exit(1);
  }

  const originalSize = fs.statSync(imagePath).size;
  console.log(`Original image: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);

  let uploadBuffer: Buffer;
  let contentType: "image/jpeg" | "image/png";

  if (originalSize <= MAX_BYTES) {
    uploadBuffer = fs.readFileSync(imagePath);
    contentType = imagePath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
    console.log("Image already under 1 MB, uploading as-is.");
  } else {
    console.log("Image exceeds 1 MB — compressing for LINE...");
    const compressed = await compressRichMenuImage(
      imagePath,
      path.join(path.dirname(imagePath), "line-rich-menu-wendy-yunspa-style-upload.jpg")
    );
    uploadBuffer = compressed.buffer;
    contentType = compressed.contentType;
    if (compressed.savedPath) {
      console.log("Saved compressed file:", compressed.savedPath);
    }
  }

  const richMenu = {
    size: RICH_MENU_SIZE,
    selected: true,
    name: "Wendy Studio Rich Menu",
    chatBarText: "選單",
    areas: [
      {
        bounds: RICH_MENU_BOUNDS.ig,
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
