// Turns near-white pixels transparent (product photos are almost always shot
// on a white/light background) with a soft feathered edge so it doesn't look
// hard-cut. This is a brightness-threshold trick, not real AI segmentation --
// good enough for typical white studio product shots.
export function stripWhiteFromImageData(imageData) {
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const minc = Math.min(r, g, b);
    if (minc > 238) {
      d[i + 3] = 0;
    } else if (minc > 198) {
      const alpha = (238 - minc) / (238 - 198);
      d[i + 3] = Math.round(d[i + 3] * alpha);
    }
  }
  return imageData;
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Encodes the canvas as WebP, falling back to PNG where that is not supported.
//
// This matters more than it looks. Every custom device photo is stored as a
// base64 data URL inside localStorage, which is a budget of a few megabytes
// shared by every workspace on the machine -- so the encoder's efficiency is
// directly how many devices a team can save before saving stops working.
// Lossy WebP at this quality is visually indistinguishable for a product photo
// at 220px and typically lands 3-5x smaller than PNG, and unlike JPEG it keeps
// the alpha channel, which the background removal depends on.
//
// toDataURL silently falls back to PNG when a format is unsupported rather than
// throwing, so the result is checked rather than the browser being sniffed.
function encode(canvas, quality = 0.82) {
  const webp = canvas.toDataURL('image/webp', quality);
  if (webp.startsWith('data:image/webp')) return webp;
  return canvas.toDataURL('image/png');
}

// Resize to a max dimension and strip the white background in one pass.
// Used both for the built-in library (on first load) and for user uploads.
export async function processDeviceImage(src, maxDim = 220) {
  const img = await loadImage(src);
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  if (w > h) {
    if (w > maxDim) { h = Math.round((h * maxDim) / w); w = maxDim; }
  } else if (h > maxDim) {
    w = Math.round((w * maxDim) / h); h = maxDim;
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  ctx.putImageData(stripWhiteFromImageData(data), 0, 0);
  return encode(canvas);
}

// Rough byte cost of a data URL, for storage reporting. base64 carries 3 bytes
// of payload in every 4 characters.
export function dataUrlBytes(dataUrl) {
  const comma = String(dataUrl).indexOf(',');
  if (comma < 0) return 0;
  return Math.round(((dataUrl.length - comma - 1) * 3) / 4);
}
