const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("無法讀取圖片"));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("圖片壓縮失敗"))),
      type,
      quality
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("讀取圖片失敗"));
    reader.readAsDataURL(blob);
  });
}

export async function compressImageForUpload(file: File): Promise<string> {
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("圖片太大，請選 8 MB 以內的檔案");
  }

  const img = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("圖片處理失敗");

  ctx.drawImage(img, 0, 0, width, height);

  let quality = JPEG_QUALITY;
  let blob = await canvasToBlob(canvas, "image/jpeg", quality);

  while (blob.size > 2 * 1024 * 1024 && quality > 0.5) {
    quality -= 0.08;
    blob = await canvasToBlob(canvas, "image/jpeg", quality);
  }

  if (blob.size > 2 * 1024 * 1024) {
    throw new Error("圖片太大，請換一張較小的照片");
  }

  return blobToDataUrl(blob);
}
