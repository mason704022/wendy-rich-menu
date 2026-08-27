import fs from "fs";
import path from "path";
import sharp from "sharp";

const MAX_BYTES = 1024 * 1024; // LINE limit: 1 MB

export async function compressRichMenuImage(
  inputPath: string,
  outputPath?: string
): Promise<{ buffer: Buffer; contentType: "image/jpeg" | "image/png"; savedPath?: string }> {
  const meta = await sharp(inputPath).metadata();
  const width = meta.width ?? 2500;
  const height = meta.height ?? 1686;

  let pipeline = sharp(inputPath)
    .resize(width, height, { fit: "fill" })
    .flatten({ background: "#fbf4ef" });

  // Try JPEG qualities until under 1 MB
  for (const quality of [85, 80, 75, 70, 65, 60]) {
    const buffer = await pipeline.clone().jpeg({ quality, mozjpeg: true }).toBuffer();
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
