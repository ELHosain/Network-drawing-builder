import html2canvas from 'html2canvas';

// Renders the REAL live canvas (not a clone). Cloning detached the wire SVG
// paths -- which are computed from live port positions -- from where the
// ports actually ended up in the clone, so wires landed in the wrong spot in
// exports. Instead we temporarily put the canvas into "export mode" via a
// class (zoom reset to 1, editor chrome hidden, forced light theme, ports
// made solid), snapshot it with html2canvas, then restore everything. Because
// nothing is cloned or moved, wires and ports stay perfectly aligned.
async function renderCanvasElement(canvasEl, contentBounds, scale = 2) {
  const pad = 40;
  const maxX = Math.max(1000, contentBounds.maxX + pad);
  const maxY = Math.max(1560, contentBounds.maxY + pad);

  const prevTransform = canvasEl.style.transform;
  const prevTheme = canvasEl.getAttribute('data-theme');

  // html2canvas renders live <input> values unreliably (blurry/clipped), so
  // temporarily overlay a plain text node on top of each input carrying the
  // same value and style, then remove them after the snapshot.
  // The light palette is applied to the CANVAS, not to the document.
  //
  // Setting it on <html> re-themed the entire interface for the length of the
  // capture, so taking a snapshot in dark mode flashed the whole app white for
  // a moment -- it looked like the editor was changing theme and back. The
  // palette is declared with a plain [data-theme=light] attribute selector,
  // not a :root one, so putting the attribute on the canvas redefines the
  // tokens for that subtree alone. The drawing renders light and printable;
  // the editor around it never changes.
  //
  // ORDER MATTERS. Apply it FIRST, then read the computed styles. Reading them
  // first was a real bug: in dark mode every label's computed colour is
  // near-white, that near-white got baked into the overlay's inline style, and
  // the snapshot rendered it on the forced white background -- invisible device
  // names in every export taken from the dark theme.
  canvasEl.setAttribute('data-theme', 'light');
  canvasEl.style.transform = 'none';
  canvasEl.classList.add('exporting');

  const overlays = [];
  canvasEl.querySelectorAll('input').forEach((inp) => {
    const cs = window.getComputedStyle(inp);
    const span = document.createElement('div');
    span.textContent = inp.value;
    span.className = 'export-text-overlay';
    span.style.cssText = `position:absolute; left:${inp.offsetLeft}px; top:${inp.offsetTop}px;
      width:${inp.offsetWidth}px; height:${inp.offsetHeight}px; display:flex; align-items:center;
      font:${cs.font}; font-weight:${cs.fontWeight}; color:${cs.color}; padding:${cs.padding};
      box-sizing:border-box; white-space:nowrap; overflow:hidden; pointer-events:none;
      letter-spacing:${cs.letterSpacing};`;
    inp.parentNode.appendChild(span);
    inp.style.visibility = 'hidden';
    overlays.push({ inp, span });
  });

  let shot;
  try {
    shot = await html2canvas(canvasEl, {
      backgroundColor: '#ffffff',
      width: maxX,
      height: maxY,
      scale,
      windowWidth: maxX,
      windowHeight: maxY,
    });
  } finally {
    canvasEl.style.transform = prevTransform;
    canvasEl.classList.remove('exporting');
    if (prevTheme) canvasEl.setAttribute('data-theme', prevTheme);
    else canvasEl.removeAttribute('data-theme');
    overlays.forEach(({ inp, span }) => { span.remove(); inp.style.visibility = ''; });
  }
  return shot;
}

export async function exportPNG(canvasEl, contentBounds, filename = 'network-drawing.png') {
  const shot = await renderCanvasElement(canvasEl, contentBounds);
  const blob = await canvasToBlob(shot);
  downloadBlob(blob, filename);
  return blob;
}

// Copies the rendered drawing straight to the system clipboard as an image,
// so it can be pasted directly into an email, a chat, a Word doc, etc.
// without round-tripping through a saved file first.
export async function copyToClipboard(canvasEl, contentBounds) {
  if (!navigator.clipboard || typeof window.ClipboardItem === 'undefined') {
    throw new Error('Your browser does not support copying images to the clipboard');
  }
  const shot = await renderCanvasElement(canvasEl, contentBounds);
  await copyBlobToClipboard(await canvasToBlob(shot));
}

// jsPDF is imported on demand rather than at module scope: it is ~150KB and
// only the PDF button needs it, while this module is also what the snapshot
// and PNG paths load. Keeping it out of the shared chunk is what lets the
// first snapshot start rendering sooner.
export async function exportPDF(canvasEl, contentBounds, filename = 'network-drawing.pdf') {
  const [{ jsPDF }, shot] = await Promise.all([import('jspdf'), renderCanvasElement(canvasEl, contentBounds)]);
  const imgData = shot.toDataURL('image/jpeg', 0.92);
  const orientation = shot.width >= shot.height ? 'landscape' : 'portrait';
  const pdf = new jsPDF({ orientation, unit: 'pt', format: [shot.width / 2, shot.height / 2] });
  pdf.addImage(imgData, 'JPEG', 0, 0, shot.width / 2, shot.height / 2);
  const blob = pdf.output('blob');
  downloadBlob(blob, filename);
  return blob;
}

// ---- quick snapshot ----------------------------------------------------
// The same pipeline as the PNG export, but rendered at scale 1 instead of 2.
// A snapshot is meant to be taken mid-work, over and over, so it has to feel
// instant -- half the resolution is a quarter of the pixels to rasterise,
// which is the difference between a noticeable pause and being done before
// you let go of the key. Returns a full-resolution blob (for download/copy)
// plus a small data-URL thumbnail for the tray, so the tray never holds a
// second full-size bitmap per snapshot in memory.
export async function captureSnapshot(canvasEl, contentBounds, { scale = 1, thumbWidth = 260 } = {}) {
  const shot = await renderCanvasElement(canvasEl, contentBounds, scale);
  const blob = await canvasToBlob(shot);

  const thumb = document.createElement('canvas');
  thumb.width = thumbWidth;
  thumb.height = Math.max(1, Math.round((shot.height * thumbWidth) / shot.width));
  const tctx = thumb.getContext('2d');
  tctx.fillStyle = '#ffffff';
  tctx.fillRect(0, 0, thumb.width, thumb.height);
  tctx.drawImage(shot, 0, 0, thumb.width, thumb.height);

  return { blob, thumb: thumb.toDataURL('image/jpeg', 0.7), width: shot.width, height: shot.height };
}

export function canvasToBlob(canvas, type = 'image/png', quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not render image'))), type, quality);
  });
}

export async function copyBlobToClipboard(blob) {
  if (!navigator.clipboard || typeof window.ClipboardItem === 'undefined') {
    throw new Error('Your browser does not support copying images to the clipboard');
  }
  await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
}

export function saveBlob(blob, filename) {
  downloadBlob(blob, filename);
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
