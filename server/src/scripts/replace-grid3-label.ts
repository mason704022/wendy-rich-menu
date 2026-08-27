/** Replace grid③ 課程資訊 → 課程專區 — cover text band on cell, redraw label */
import fs from "fs";
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const input = path.join(root, "line-rich-menu-wendy-yunspa-style-prev2.png");
const output = path.join(root, "line-rich-menu-wendy-yunspa-style.png");

const W = 2500;
const H = 1686;
const G = 26;
const COL_W = 799;
const TOP_H = 830;
const TOP_RIGHT_X = G + COL_W * 2 + G + G;

function sampleRgb(data: Buffer) {
  let r = 0, g = 0, b = 0;
  const n = data.length / 3;
  for (let i = 0; i < data.length; i += 3) {
    r += data[i]!; g += data[i + 1]!; b += data[i + 2]!;
  }
  return `#${[r, g, b].map((x) => Math.round(x / n).toString(16).padStart(2, "0")).join("")}`;
}

const img = await sharp(input).resize(W, H, { fit: "fill" }).png().toBuffer();

const grid3 = await sharp(img)
  .extract({ left: TOP_RIGHT_X, top: G, width: COL_W, height: TOP_H })
  .png()
  .toBuffer();

const { data: sample } = await sharp(grid3)
  .extract({ left: 360, top: 520, width: 40, height: 30 })
  .raw()
  .toBuffer({ resolveWithObject: true });
const bg = sampleRgb(sample);

const cellOverlay = Buffer.from(`<svg width="${COL_W}" height="${TOP_H}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="598" width="${COL_W}" height="100" fill="${bg}"/>
  <text x="${COL_W / 2}" y="642" text-anchor="middle" dominant-baseline="middle"
        font-family="PMingLiU, MingLiU, SimSun, serif" font-size="46" font-weight="400"
        fill="#ffffff" letter-spacing="2">課程專區</text>
</svg>`);

const grid3Fixed = await sharp(grid3)
  .composite([{ input: cellOverlay, top: 0, left: 0 }])
  .png()
  .toBuffer();

const tmp = output + ".tmp";
await sharp(img)
  .composite([{ input: grid3Fixed, left: TOP_RIGHT_X, top: G }])
  .png()
  .toFile(tmp);
fs.renameSync(tmp, output);
console.log("Done:", output);
