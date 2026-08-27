/**
 * Generate 6-grid rich menu:
 * - ①② from backup (unchanged)
 * - IG icon inside white frame (inset)
 * - ③ drawn fresh: same style as prev2, text 課程專區 (no patch over old text)
 */
import fs from "fs";
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "../../..");
const backup = path.join(root, "line-rich-menu-wendy-yunspa-style-backup.png");
const prev2 = path.join(root, "line-rich-menu-wendy-yunspa-style-prev2.png");
const output = path.join(root, "line-rich-menu-wendy-yunspa-style.png");

const W = 2500;
const H = 1686;
const G = 26;
const COL_W = 799;
const TOP_H = 830;
const BOTTOM_Y = 856;
const BOTTOM_H = 830;
const TOP_LEFT_W = COL_W * 2 + G;
const TOP_RIGHT_X = G + TOP_LEFT_W + G;

const CREAM = "#fbf4ef";

function sampleRgb(data: Buffer) {
  let r = 0,
    g = 0,
    b = 0;
  const n = data.length / 3;
  for (let i = 0; i < data.length; i += 3) {
    r += data[i]!;
    g += data[i + 1]!;
    b += data[i + 2]!;
  }
  return `#${[Math.round(r / n), Math.round(g / n), Math.round(b / n)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("")}`;
}

/** White corner frame matching prev2 cells */
function cellFrameSvg(w: number, h: number) {
  const m = 18;
  const li = 3;
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${m}" y="${m}" width="${w - m * 2}" height="${h - m * 2}" fill="none" stroke="#ffffff" stroke-width="${li}"/>
    <path d="M${m + 40} ${m} Q${m} ${m} ${m} ${m + 40}" fill="none" stroke="#ffffff" stroke-width="${li}"/>
    <path d="M${w - m - 40} ${m} Q${w - m} ${m} ${w - m} ${m + 40}" fill="none" stroke="#ffffff" stroke-width="${li}"/>
    <path d="M${m + 40} ${h - m} Q${m} ${h - m} ${m} ${h - m - 40}" fill="none" stroke="#ffffff" stroke-width="${li}"/>
    <path d="M${w - m - 40} ${h - m} Q${w - m} ${h - m} ${w - m} ${h - m - 40}" fill="none" stroke="#ffffff" stroke-width="${li}"/>
  </svg>`;
}

/** Grid ③ — book icon + 課程專區 (built clean, no pasted patch) */
function grid3CellSvg(taupe: string) {
  const w = COL_W;
  const h = TOP_H;
  const cx = w / 2;
  return Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="${taupe}"/>
    ${cellFrameSvg(w, h)}
    <!-- open book icon -->
    <g transform="translate(${cx - 80}, 248)" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M0 20 C0 8 12 0 80 0 C148 0 160 8 160 20 V120 C160 108 148 100 80 100 C12 100 0 108 0 120 Z"/>
      <line x1="80" y1="0" x2="80" y2="120"/>
      <path d="M20 36 H60 M20 56 H55 M100 36 H140 M105 56 H140"/>
    </g>
    <text x="${cx}" y="668" text-anchor="middle" dominant-baseline="middle"
          font-family="PMingLiU, MingLiU, SimSun, serif" font-size="46" font-weight="400"
          fill="#ffffff" letter-spacing="2">課程專區</text>
  </svg>`);
}

/** IG icon — inset inside ①② white frame */
function igOverlaySvg() {
  const size = 108;
  const padRight = 118;
  const padTop = 98;
  const x = G + TOP_LEFT_W - padRight - size;
  const y = G + padTop;
  const ix = x + 14;
  const iy = y + 14;
  const inner = size - 28;
  return Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="22"
          fill="none" stroke="#ffffff" stroke-width="5"/>
    <rect x="${ix}" y="${iy}" width="${inner}" height="${inner}" rx="16"
          fill="none" stroke="#ffffff" stroke-width="5"/>
    <circle cx="${ix + inner - 18}" cy="${iy + 18}" r="7" fill="#ffffff"/>
    <circle cx="${x + size / 2}" cy="${y + size / 2 + 8}" r="26"
            fill="none" stroke="#ffffff" stroke-width="5"/>
  </svg>`);
}

async function main() {
  for (const f of [backup, prev2]) {
    if (!fs.existsSync(f)) throw new Error(`Missing: ${f}`);
  }

  const backupFull = await sharp(backup).resize(W, H, { fit: "fill" }).png().toBuffer();
  const prev2Full = await sharp(prev2).resize(W, H, { fit: "fill" }).png().toBuffer();

  const topLeft = await sharp(backupFull)
    .extract({ left: G, top: G, width: TOP_LEFT_W, height: TOP_H })
    .png()
    .toBuffer();

  const { data: taupeSample } = await sharp(prev2Full)
    .extract({ left: TOP_RIGHT_X + 360, top: G + 360, width: 30, height: 30 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const TAUPE = sampleRgb(taupeSample);

  const grid3Cell = await sharp(grid3CellSvg(TAUPE)).png().toBuffer();

  const bottomLeft = await sharp(prev2Full)
    .extract({ left: G, top: BOTTOM_Y, width: COL_W, height: BOTTOM_H })
    .png()
    .toBuffer();
  const bottomMid = await sharp(prev2Full)
    .extract({ left: G + COL_W + G, top: BOTTOM_Y, width: COL_W, height: BOTTOM_H })
    .png()
    .toBuffer();
  const bottomRight = await sharp(prev2Full)
    .extract({ left: G + (COL_W + G) * 2, top: BOTTOM_Y, width: COL_W, height: BOTTOM_H })
    .png()
    .toBuffer();

  await sharp({
    create: { width: W, height: H, channels: 3, background: CREAM },
  })
    .composite([
      { input: topLeft, left: G, top: G },
      { input: grid3Cell, left: TOP_RIGHT_X, top: G },
      { input: bottomLeft, left: G, top: BOTTOM_Y },
      { input: bottomMid, left: G + COL_W + G, top: BOTTOM_Y },
      { input: bottomRight, left: G + (COL_W + G) * 2, top: BOTTOM_Y },
      { input: igOverlaySvg(), left: 0, top: 0 },
    ])
    .png()
    .toFile(output);

  console.log("Generated:", output);
  console.log("Grid3 taupe:", TAUPE);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
