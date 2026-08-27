import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const input = path.join(root, "line-rich-menu-wendy-yunspa-style-pre-edit.png");
const output = path.join(root, "line-rich-menu-wendy-yunspa-style.png");

const W = 2500;
const G = 26;
const TOP_RIGHT_X = G + 799 * 2 + G + G;
const COL_W = 799;
const LABEL_CX = TOP_RIGHT_X + COL_W / 2;
const LABEL_CY = 668;

async function avgColor(left: number, top: number) {
  const { data } = await sharp(input)
    .extract({ left, top, width: 30, height: 30 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let r = 0,
    g = 0,
    b = 0;
  const n = data.length / 3;
  for (let i = 0; i < data.length; i += 3) {
    r += data[i]!;
    g += data[i + 1]!;
    b += data[i + 2]!;
  }
  return `#${[r, g, b].map((x) => Math.round(x / n).toString(16).padStart(2, "0")).join("")}`;
}

// Sample tan fill inside grid ③ (avoid white border)
const CELL3_BG = await avgColor(TOP_RIGHT_X + 200, 450);

// Patch sized for 4-char label, same row as 「課程資訊」
const LABEL_PATCH_X = LABEL_CX - 178;
const LABEL_PATCH_Y = 638;
const LABEL_PATCH_W = 356;
const LABEL_PATCH_H = 52;

const svg = Buffer.from(`<svg width="${W}" height="1686" xmlns="http://www.w3.org/2000/svg">
  <rect x="${LABEL_PATCH_X}" y="${LABEL_PATCH_Y}" width="${LABEL_PATCH_W}" height="${LABEL_PATCH_H}" fill="${CELL3_BG}"/>
  <text x="${LABEL_CX}" y="${LABEL_CY}" text-anchor="middle" dominant-baseline="middle"
        font-family="PMingLiU, MingLiU, SimSun, STSong, serif"
        font-size="48" font-weight="400" fill="#ffffff" letter-spacing="4">
    課程專區
  </text>
</svg>`);

await sharp(input).composite([{ input: svg, top: 0, left: 0 }]).png().toFile(output);
console.log("Background:", CELL3_BG);
console.log("Output:", output);
