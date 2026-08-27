/**
 * Grid ③ only: replace 「課程資訊」 → 「課程專區」
 * Default source: line-rich-menu-wendy-yunspa-style-pre-edit.png
 * Output: line-rich-menu-wendy-yunspa-style.png (for review)
 *
 * Run: npm run edit-rich-menu
 */
import fs from "fs";
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "../../..");
const input =
  process.argv[2] ??
  path.join(root, "line-rich-menu-wendy-yunspa-style-pre-edit.png");
const output =
  process.argv[3] ?? path.join(root, "line-rich-menu-wendy-yunspa-style.png");

const W = 2500;
const G = 26;
const TOP_LEFT_W = 799 * 2 + G;
const TOP_RIGHT_X = G + TOP_LEFT_W + G;
const COL_W = 799;

// Match grid ③ cell background
const CELL3_BG = "#b8a99a";
const LABEL_PATCH_X = TOP_RIGHT_X + 120;
const LABEL_PATCH_Y = 618;
const LABEL_PATCH_W = 560;
const LABEL_PATCH_H = 88;
const LABEL_CX = TOP_RIGHT_X + COL_W / 2;
const LABEL_CY = 668;

const svg = Buffer.from(`<svg width="${W}" height="1686" xmlns="http://www.w3.org/2000/svg">
  <rect x="${LABEL_PATCH_X}" y="${LABEL_PATCH_Y}" width="${LABEL_PATCH_W}" height="${LABEL_PATCH_H}" fill="${CELL3_BG}"/>
  <text x="${LABEL_CX}" y="${LABEL_CY}" text-anchor="middle" dominant-baseline="middle"
        font-family="PMingLiU, MingLiU, SimSun, serif" font-size="50" fill="#ffffff">
    課程專區
  </text>
</svg>`);

const tmp = output + ".tmp";
await sharp(input).composite([{ input: svg, top: 0, left: 0 }]).png().toFile(tmp);
fs.renameSync(tmp, output);
console.log("Source:", input);
console.log("Output:", output);
