export interface ResizedImage {
  base64: string;
  mimeType: 'image/jpeg';
  bytes: number;
  previewUrl: string;
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

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
      reject(new Error('That file could not be read as an image.'));
    };
    img.src = url;
  });
}

export async function resizeImageFile(file: File, maxDimension = 1600, maxBytes = 1.5 * 1024 * 1024): Promise<ResizedImage> {
  if (!ACCEPTED.includes(file.type)) {
    throw new Error('Please choose a JPEG, PNG or WebP image.');
  }
  if (file.size > 25 * 1024 * 1024) {
    throw new Error('That image is too large. Please choose one under 25MB.');
  }
  const img = await loadImage(file);
  const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not process this image.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  for (const quality of [0.85, 0.75, 0.65, 0.55]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const bytes = Math.floor((base64.length * 3) / 4);
    if (bytes <= maxBytes) {
      return { base64, mimeType: 'image/jpeg', bytes, previewUrl: dataUrl };
    }
  }
  throw new Error('This image is still too large after resizing. Please choose a smaller one.');
}
