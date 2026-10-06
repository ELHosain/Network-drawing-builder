import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_SNAPSHOTS = 24;
const loadExporters = () => import('./utils/exportProject.js');

function filename(seq, ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `snapshot-${pad(seq)}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.png`;
}

// Quick in-session screenshot roll. Deliberately memory-only: these are
// working captures taken while laying a drawing out ("what did it look like
// before I moved that switch?"), not saved artefacts -- persisting a couple
// of dozen full-size PNGs into localStorage would blow its quota on the
// first handful. Anything worth keeping is one click away as a download.
export function useSnapshots({ canvasRef, getContentBounds, toast, getStats }) {
  const [shots, setShots] = useState([]);
  const [trayOpen, setTrayOpen] = useState(true);
  const [flashing, setFlashing] = useState(false);
  const busy = useRef(false);

  // Warm the renderer chunk once the page is idle. It is lazy-loaded so the
  // app starts fast, but a snapshot is supposed to be instant -- without this
  // the very first F2 would stall on a few hundred KB of network before it
  // even began rasterising.
  useEffect(() => {
    const warm = () => { loadExporters().catch(() => {}); };
    const idle = window.requestIdleCallback;
    const id = idle ? idle(warm, { timeout: 4000 }) : setTimeout(warm, 2500);
    return () => { if (idle) window.cancelIdleCallback?.(id); else clearTimeout(id); };
  }, []);
  const seq = useRef(0);

  const capture = useCallback(async () => {
    // Guard against a held-down shortcut key queueing a dozen renders.
    if (busy.current || !canvasRef.current) return;
    busy.current = true;
    setFlashing(true);
    setTimeout(() => setFlashing(false), 260);
    try {
      const { captureSnapshot } = await loadExporters();
      const shot = await captureSnapshot(canvasRef.current, getContentBounds());
      const stats = getStats ? getStats() : { devices: 0, links: 0 };
      seq.current += 1;
      const entry = { id: `${Date.now()}-${seq.current}`, seq: seq.current, ts: Date.now(), ...shot, ...stats };
      setShots((prev) => [entry, ...prev].slice(0, MAX_SNAPSHOTS));
      setTrayOpen(true);
      toast('Snapshot taken');
    } catch (e) {
      toast('Could not take a snapshot');
    } finally {
      busy.current = false;
    }
  }, [canvasRef, getContentBounds, toast, getStats]);

  const download = useCallback(async (shot) => {
    const { saveBlob } = await loadExporters();
    saveBlob(shot.blob, filename(shot.seq, shot.ts));
  }, []);

  const downloadAll = useCallback(async () => {
    const { saveBlob } = await loadExporters();
    // Browsers throttle rapid-fire programmatic downloads, so space them out.
    shots.slice().reverse().forEach((s, i) => {
      setTimeout(() => saveBlob(s.blob, filename(s.seq, s.ts)), i * 250);
    });
    toast(`Downloading ${shots.length} snapshot${shots.length !== 1 ? 's' : ''}`);
  }, [shots, toast]);

  const copy = useCallback(async (shot) => {
    try {
      const { copyBlobToClipboard } = await loadExporters();
      await copyBlobToClipboard(shot.blob);
      toast('Snapshot copied — paste it anywhere');
    } catch (e) {
      toast(e.message || 'Could not copy to clipboard');
    }
  }, [toast]);

  const remove = useCallback((id) => setShots((prev) => prev.filter((s) => s.id !== id)), []);
  const clear = useCallback(() => { setShots([]); toast('Snapshots cleared'); }, [toast]);
  const toggleTray = useCallback(() => setTrayOpen((o) => !o), []);

  return { shots, capture, download, downloadAll, copy, remove, clear, trayOpen, toggleTray, flashing };
}
