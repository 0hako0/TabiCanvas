const TARGET_MIN_QUALITY = 0.58;

export async function resizeImage(file: File, maxSize = 1600, quality = 0.78, targetMaxBytes = 800 * 1024): Promise<Blob> {
  const image = await loadImage(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported.');

  let currentMaxSize = maxSize;
  let currentQuality = quality;

  // Supabase無料枠を使いやすくするため、WebPで300KBから800KB程度を狙います。
  for (let attempt = 0; attempt < 7; attempt += 1) {
    const scale = Math.min(1, currentMaxSize / Math.max(image.width, image.height));
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await canvasToBlob(canvas, 'image/webp', currentQuality);
    if (blob.size <= targetMaxBytes || currentQuality <= TARGET_MIN_QUALITY) {
      return blob;
    }
    currentQuality = Math.max(TARGET_MIN_QUALITY, currentQuality - 0.08);
    currentMaxSize = Math.round(currentMaxSize * 0.88);
  }

  return canvasToBlob(canvas, 'image/webp', TARGET_MIN_QUALITY);
}

export function resizeThumbnail(file: File): Promise<Blob> {
  return resizeImage(file, 560, 0.72, 220 * 1024);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = URL.createObjectURL(file);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to compress image.'))),
      type,
      quality,
    );
  });
}
