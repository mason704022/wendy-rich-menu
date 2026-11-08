import fs from "fs";
import path from "path";
import sharp from "sharp";

const MAX_BYTES = 1024 * 1024; // LINE limit: 1 MB

/** Flood-fill white from image edges so icons/text stay opaque. */
function knockOutEdgeWhiteBackground(
  data: Buffer,
  width: number,
  height: number,
  threshold = 245
): void {
  const isWhite = (idx: number) => {
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    return r >= threshold && g >= threshold && b >= threshold;
  };

  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  const tryEnqueue = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (visited[p]) return;
    const idx = p * 4;
    if (!isWhite(idx)) return;
    visited[p] = 1;
    queue.push(p);
  };

  for (let x = 0; x < width; x++) {
    tryEnqueue(x, 0);
    tryEnqueue(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    tryEnqueue(0, y);
    tryEnqueue(width - 1, y);
  }

  while (queue.length > 0) {
    const p = queue.pop()!;
    const x = p % width;
    const y = (p - x) / width;
    const idx = p * 4;
    data[idx + 3] = 0;
    tryEnqueue(x - 1, y);
    tryEnqueue(x + 1, y);
    tryEnqueue(x, y - 1);
    tryEnqueue(x, y + 1);
  }
}

async function loadRgba(inputPath: string, width: number, height: number): Promise<Buffer> {
  const { data, info } = await sharp(inputPath)
    .resize(width, height, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== width || info.height !== height) {
    throw new Error("Unexpected image dimensions after resize");
  }
  return data;
}

export async function compressRichMenuImage(
  inputPath: string,
  outputPath?: string,
  options?: {
    preserveAlpha?: boolean;
    removeEdgeWhite?: boolean;
    /** Fill knocked-out / transparent areas (LINE shows transparency as white). */
    matteBackground?: string;
  }
): Promise<{ buffer: Buffer; contentType: "image/jpeg" | "image/png"; savedPath?: string }> {
  const meta = await sharp(inputPath).metadata();
  const width = meta.width ?? 2500;
  const height = meta.height ?? 1686;
  const preserveAlpha = options?.preserveAlpha ?? false;
  const matte = options?.matteBackground;

  if (options?.removeEdgeWhite || matte) {
    let rgba = await loadRgba(inputPath, width, height);
    if (options?.removeEdgeWhite) {
      knockOutEdgeWhiteBackground(rgba, width, height);
    }
    if (matte) {
      let pipeline = sharp(rgba, { raw: { width, height, channels: 4 } }).flatten({
        background: matte,
      });
      for (const quality of [92, 88, 85, 82, 80, 75, 70, 65, 60]) {
        const buffer = await pipeline
          .clone()
          .jpeg({ quality, mozjpeg: true, chromaSubsampling: "4:4:4" })
          .toBuffer();
        if (buffer.length <= MAX_BYTES) {
          const savedPath =
            outputPath ??
            inputPath.replace(/\.(png|jpg|jpeg)$/i, `-matted-q${quality}.jpg`);
          fs.writeFileSync(savedPath, buffer);
          console.log(
            `Compressed: ${(buffer.length / 1024).toFixed(0)} KB (JPEG matte ${matte}, q=${quality}, ${width}x${height})`
          );
          return { buffer, contentType: "image/jpeg", savedPath };
        }
      }
      throw new Error("Cannot compress matted JPEG below 1 MB.");
    }
  }

  if (preserveAlpha) {
    let rgba = await loadRgba(inputPath, width, height);
    if (options?.removeEdgeWhite) {
      knockOutEdgeWhiteBackground(rgba, width, height);
    }
    let base = sharp(rgba, { raw: { width, height, channels: 4 } });

    const pngAttempts: Array<{ palette: boolean; colors?: number; compressionLevel: number }> = [
      { palette: false, compressionLevel: 9 },
      { palette: false, compressionLevel: 8 },
      { palette: true, colors: 256, compressionLevel: 9 },
      { palette: true, colors: 128, compressionLevel: 9 },
      { palette: true, colors: 96, compressionLevel: 9 },
      { palette: true, colors: 64, compressionLevel: 9 },
    ];
    for (const attempt of pngAttempts) {
      const buffer = await base
        .clone()
        .png({
          compressionLevel: attempt.compressionLevel,
          palette: attempt.palette,
          colors: attempt.colors,
          effort: 10,
        })
        .toBuffer();
      if (buffer.length <= MAX_BYTES) {
        const savedPath =
          outputPath ??
          inputPath.replace(/\.(png|jpg|jpeg)$/i, "-compressed.png");
        fs.writeFileSync(savedPath, buffer);
        const paletteNote = attempt.palette
          ? `palette=${attempt.colors}`
          : "truecolor";
        console.log(
          `Compressed: ${(buffer.length / 1024).toFixed(0)} KB (PNG alpha, ${paletteNote}, level=${attempt.compressionLevel}, ${width}x${height})`
        );
        return { buffer, contentType: "image/png", savedPath };
      }
    }
    throw new Error("Cannot compress PNG with alpha below 1 MB.");
  }

  let pipeline = sharp(inputPath)
    .resize(width, height, { fit: "fill" })
    .flatten({ background: "#fbf4ef" });

  // Try JPEG qualities (highest first) until under 1 MB
  for (const quality of [92, 88, 85, 82, 80, 75, 70, 65, 60]) {
    const buffer = await pipeline
      .clone()
      .jpeg({ quality, mozjpeg: true, chromaSubsampling: "4:4:4" })
      .toBuffer();
    if (buffer.length <= MAX_BYTES) {
      const savedPath =
        outputPath ??
        inputPath.replace(/\.(png|jpg|jpeg)$/i, `-compressed-q${quality}.jpg`);
      if (outputPath || !fs.existsSync(savedPath)) {
        fs.writeFileSync(savedPath, buffer);
      }
      console.log(
        `Compressed: ${(buffer.length / 1024).toFixed(0)} KB (JPEG q=${quality}, ${width}x${height})`
      );
      return { buffer, contentType: "image/jpeg", savedPath };
    }
  }

  // Fallback: PNG with high compression
  const pngBuffer = await pipeline.png({ compressionLevel: 9, palette: true }).toBuffer();
  if (pngBuffer.length <= MAX_BYTES) {
    const savedPath = outputPath ?? inputPath.replace(/\.(png|jpg|jpeg)$/i, "-compressed.png");
    fs.writeFileSync(savedPath, pngBuffer);
    console.log(`Compressed: ${(pngBuffer.length / 1024).toFixed(0)} KB (PNG)`);
    return { buffer: pngBuffer, contentType: "image/png", savedPath };
  }

  throw new Error(
    `Cannot compress below 1 MB (last attempt: ${(pngBuffer.length / 1024).toFixed(0)} KB). Simplify the design or reduce colors.`
  );
}
