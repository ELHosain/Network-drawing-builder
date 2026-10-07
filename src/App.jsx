import React, { useRef, useState, useCallback, useEffect, useLayoutEffect, useMemo, lazy, Suspense } from 'react';
import './App.css';
import Toolbar from './components/Toolbar.jsx';
import Palette from './components/Palette.jsx';
import DeviceNode from './components/DeviceNode.jsx';
import TitleBlock from './components/TitleBlock.jsx';
import { useToasts } from './components/Toasts.jsx';
import SnapshotTray from './components/SnapshotTray.jsx';
import { useSnapshots } from './useSnapshots.js';
import { useProject } from './useProject.js';

// The dock is the only thing pulling in framer-motion (~40KB gzipped). It is
// decorative chrome over the canvas, not something needed to start drawing, so
// it loads on its own after the app is interactive. It animates itself in on
// mount regardless, which makes the deferred arrival invisible.
const Dock = lazy(() => import('./components/Dock.jsx'));
import { BUILTIN_PRESETS } from './data/presets.js';
import { processDeviceImage } from './utils/imageTools.js';
import { routeWire, routeGhost } from './utils/routing.js';
import ProfileMenu from './components/ProfileMenu.jsx';
import ValidationPanel from './components/ValidationPanel.jsx';

import {
  UndoIcon, RedoIcon, FitIcon, CameraIcon, ShieldIcon, DownloadIcon,
} from './components/icons.jsx';
import DrawingDetailsDialog from './components/DrawingDetailsDialog.jsx';
import { validateProject } from './utils/validate.js';
import { profileKey } from './profiles.js';

// html2canvas + jsPDF are heavy (~700KB combined) and only needed when the
// user actually exports. Lazy-load them on first use so the app itself starts
// fast instead of shipping that weight in the initial bundle.
const loadExporters = () => import('./utils/exportProject.js');

function relativeTime(ts) {
  if (!ts) return null;
  const secs = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (secs < 2) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs}h ago`;
}

const SAVE_ERROR_TEXT = {
  full: 'Browser storage is full — your work is NOT being saved. Use Save to export a file.',
  blocked: 'This browser is blocking storage — your work is NOT being saved. Use Save to export a file.',
};

function SaveStatus({ lastSaved, saveError }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);
  if (saveError) {
    return (
      <span className="save-status error" title={SAVE_ERROR_TEXT[saveError]}>
        <span className="save-dot" /> Not saving — {saveError === 'full' ? 'storage full' : 'storage blocked'}
      </span>
    );
  }
  if (!lastSaved) return <span className="save-status">Not saved yet</span>;
  return (
    <span className="save-status">
      <span className="save-dot" /> Saved {relativeTime(lastSaved)}
    </span>
  );
}

function useTheme(profileId) {
  const key = profileKey('netbuilder-theme', profileId);
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (e) { /* ignore */ }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(key, theme); } catch (e) { /* ignore */ }
  }, [theme, key]);
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}

export default function App({
  profileId, profiles, onSwitchProfile, onCreateProfile, onRenameProfile, onDeleteProfile,
  onBackToProfiles,
}) {
  const proj = useProject(profileId);
  const { toast, toastHost } = useToasts();
  const [theme, toggleTheme] = useTheme(profileId);
  const [locked, setLocked] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [checkOpen, setCheckOpen] = useState(false);

  // useProject() returns a fresh object literal every render, so any callback
  // listing `proj` as a dependency is rebuilt every render too -- which in turn
  // changes every DeviceNode's props and defeats React.memo on the one
  // component that is rendered dozens of times. Reading through a ref keeps
  // the handlers below permanently stable while still always seeing the
  // latest project state.
  const projRef = useRef(proj);
  projRef.current = proj;

  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const portRefs = useRef({});
  const nodeRefs = useRef({});
  const [ghostPath, setGhostPath] = useState(null);
  // Bumped whenever the measured geometry needs re-reading. See the
  // convergence effect below the wire-path computation.
  const [geomTick, setGeomTick] = useState(0);
  const [hoveredWireId, setHoveredWireId] = useState(null);
  const [dropHover, setDropHover] = useState(false);
  // Which save/export the details dialog is standing in front of. Null when it
  // is closed.
  const [pendingIntent, setPendingIntent] = useState(null);
  const builtinProcessedRef = useRef(false);

  // ---- strip white backgrounds off built-in presets, once, after mount ----
  useEffect(() => {
    if (builtinProcessedRef.current) return;
    builtinProcessedRef.current = true;
    (async () => {
      const updates = {};
      for (const key of Object.keys(BUILTIN_PRESETS)) {
        const raw = BUILTIN_PRESETS[key]?.img;
        if (!raw) continue;
        try {
          updates[key] = await processDeviceImage(raw, 220);
        } catch (e) { /* skip on failure */ }
      }
      proj.setPresets((p) => {
        const next = { ...p };
        Object.keys(updates).forEach((k) => { next[k] = { ...next[k], img: updates[k] }; });
        return next;
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Uses getBoundingClientRect (the actual rendered/visual position) rather
  // than offsetLeft/offsetTop (the pre-transform layout position). Any CSS
  // transform in the ancestor chain -- like the switch's port grid using
  // translateY(-50%) to center itself -- makes offsetTop silently wrong,
  // which is exactly why wires used to land in the wrong spot. This way is
  // correct regardless of any transform, now or in the future.
  // All the geometry below is read against ONE canvas rect per pass. The
  // previous version called canvasRef.getBoundingClientRect() inside every
  // port and node lookup, so a drawing with 20 wires did ~60 extra layout
  // reads per render -- each a potential forced reflow, on the hot path of a
  // drag. Reading it once and threading it through removes that entirely.
  const canvasRect = useCallback(() => canvasRef.current?.getBoundingClientRect() || null, []);

  const portCenterIn = useCallback((cr, nodeId, port) => {
    const el = portRefs.current[`${nodeId}:${port}`];
    if (!el || !cr) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    const z = proj.zoom || 1;
    return { x: (r.left + r.width / 2 - cr.left) / z, y: (r.top + r.height / 2 - cr.top) / z };
  }, [proj.zoom]);

  const portCenter = useCallback(
    (nodeId, port) => portCenterIn(canvasRect(), nodeId, port),
    [portCenterIn, canvasRect],
  );

  // Where a wire actually meets a port: the middle of the box's OUTER edge,
  // on the face the port presents, rather than the box's centre.
  //
  // This is what lets the wire layer sit above the device cards. Aiming at the
  // centre meant the last few pixels of every wire were drawn across the port
  // box itself, hiding the number -- so the wires had to be painted
  // underneath, and then they vanished behind the cards and the device photos
  // instead, which is why a link appeared to stop at a card edge with no way
  // to tell which port it belonged to. Ending at the edge means the cable
  // docks into the connector from outside and nothing overlaps anything.
  const portAnchorIn = useCallback((cr, nodeId, port, side) => {
    const el = portRefs.current[`${nodeId}:${port}`];
    if (!el || !cr) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    const z = proj.zoom || 1;
    const left = (r.left - cr.left) / z;
    const top = (r.top - cr.top) / z;
    const w = r.width / z;
    const h = r.height / z;
    switch (side) {
      case 'left': return { x: left, y: top + h / 2 };
      case 'right': return { x: left + w, y: top + h / 2 };
      case 'top': return { x: left + w / 2, y: top };
      case 'bottom':
      default: return { x: left + w / 2, y: top + h };
    }
  }, [proj.zoom]);

  const portSide = useCallback((nodeId, port) => {
    const el = portRefs.current[`${nodeId}:${port}`];
    return el?.dataset?.side || null;
  }, []);


  // Wire paths are derived straight from live DOM port positions during
  // render -- not stored in their own state updated by an effect. That
  // earlier effect+state approach caused a real crash: every pointer-move
  // during a drag updated node position state, which re-ran the effect,
  // which updated wire-path state again synchronously, and a fast drag could
  // fire enough of these nested updates in a row to hit React's safety limit
  // ("Maximum update depth exceeded"). Computing it inline here means moving
  // a device just redraws its wires as a normal part of that same render --
  // nothing nested, nothing that can runaway.
  // geomTick is read here purely so this computation is tied to it: bumping
  // the tick is what forces the re-measure.
  void geomTick;
  const rect = canvasRect();
  const wirePaths = proj.wires.map((w) => {
    const aSide = portSide(w.fromId, w.fromPort);
    const bSide = portSide(w.toId, w.toPort);
    const a = portAnchorIn(rect, w.fromId, w.fromPort, aSide);
    const b = portAnchorIn(rect, w.toId, w.toPort, bSide);
    return { id: w.id, d: routeWire(a, aSide, b, bSide), style: w.style };
  });

  // Wire paths are measured from the live DOM during render, which means they
  // describe the layout as it was at the START of this render. Any change that
  // moves a port -- adding or removing one, a device photo finishing loading,
  // resizing a card -- lands in the DOM only after this render commits, and
  // nothing re-renders afterwards, so the wires stay frozen at the old
  // positions. That is why a link could sit a whole port-width away from the
  // port it belongs to.
  //
  // This re-renders once more whenever the freshly measured paths differ from
  // what was just painted. It is self-terminating by construction: the second
  // pass measures the settled DOM, the signature matches, and it stops. The
  // comparison is on the path strings themselves, so there is no way for it to
  // oscillate.
  const paintedPathsRef = useRef('');
  useLayoutEffect(() => {
    const signature = wirePaths.map((w) => w.d).join('|');
    if (signature !== paintedPathsRef.current) {
      paintedPathsRef.current = signature;
      setGeomTick((t) => t + 1);
    }
  });

  // Images load asynchronously and resizing a card changes its box without any
  // React state change in between, so neither triggers a render on its own.
  // Observing the cards directly catches both.
  const resizeObsRef = useRef(null);
  if (!resizeObsRef.current && typeof ResizeObserver !== 'undefined') {
    resizeObsRef.current = new ResizeObserver(() => setGeomTick((t) => t + 1));
  }
  useEffect(() => () => resizeObsRef.current?.disconnect(), []);

  // ---- ghost (preview) wire while connecting ----
  // Throttled to one update per animation frame. A mouse can emit well over
  // 100 move events a second; without this, each one triggered its own React
  // render of the whole canvas just to redraw a single dashed preview line.
  const ghostFrame = useRef(0);
  const handleCanvasMouseMove = useCallback((e) => {
    if (!proj.connectFrom || !canvasRef.current) { if (ghostPath) setGhostPath(null); return; }
    if (ghostFrame.current) return;
    const { clientX, clientY } = e;
    ghostFrame.current = requestAnimationFrame(() => {
      ghostFrame.current = 0;
      const cr = canvasRef.current?.getBoundingClientRect();
      if (!cr || !proj.connectFrom) return;
      const { nodeId, port } = proj.connectFrom;
      const side = portSide(nodeId, port);
      const a = portAnchorIn(cr, nodeId, port, side);
      const b = { x: (clientX - cr.left) / proj.zoom, y: (clientY - cr.top) / proj.zoom };
      setGhostPath(routeGhost(a, side, b));
    });
  }, [proj.connectFrom, proj.zoom, portAnchorIn, portSide, ghostPath]);

  useEffect(() => () => { if (ghostFrame.current) cancelAnimationFrame(ghostFrame.current); }, []);

  // ---- port ref registration ----
  const onPortRef = useCallback((nodeId, port, el) => {
    const key = `${nodeId}:${port}`;
    if (el) portRefs.current[key] = el; else delete portRefs.current[key];
  }, []);

  // ---- hovering a port highlights the wire attached to it, same as
  // hovering the wire itself -- makes it obvious which port a curve lands on
  const handlePortHover = useCallback((nodeId, port, entering) => {
    if (!entering) { setHoveredWireId(null); return; }
    const w = projRef.current.wires.find((x) => (
      (x.fromId === nodeId && String(x.fromPort) === String(port)) ||
      (x.toId === nodeId && String(x.toPort) === String(port))
    ));
    setHoveredWireId(w ? w.id : null);
  }, []);

  // ---- port click (wiring) ----
  const handlePortClick = useCallback((nodeId, port) => {
    const result = projRef.current.clickPort(nodeId, port);
    if (result?.toast) toast(result.toast);
    setGhostPath(null);
  }, [toast]);

  // ---- node drag ----
  const handleNodeMove = useCallback((id, x, y) => projRef.current.moveNodeLive(id, x, y), []);
  const handleNodeMoveEnd = useCallback((id) => projRef.current.finishMove(id), []);

  // ---- palette -> canvas, via pointer events (not native HTML5 drag) ----
  // Native HTML5 drag-and-drop on an element makes the browser treat any
  // mousedown inside it -- including on a child button -- as the possible
  // start of a drag gesture, which can swallow that child's click event.
  // That was the recurring "can't click the X" bug. Pointer events give us
  // full manual control with no such ambiguity: we decide exactly when a
  // drag starts, and a plain click on a button never triggers it.
  const paletteDrag = useRef(null);

  const handlePaletteDragStart = useCallback((key, label, e) => {
    if (e.button !== undefined && e.button !== 0) return; // left click / primary touch only
    e.preventDefault();
    const ghost = document.createElement('div');
    ghost.textContent = label || 'Device';
    Object.assign(ghost.style, {
      position: 'fixed', left: '0', top: '0', zIndex: 9999, pointerEvents: 'none',
      transform: `translate(${e.clientX + 12}px, ${e.clientY + 12}px)`,
      background: 'var(--ink)', color: 'var(--bg)', font: '600 11px Segoe UI, Arial, sans-serif',
      padding: '5px 10px', borderRadius: '6px', boxShadow: '0 6px 16px rgba(0,0,0,.3)', opacity: '0.95',
    });
    document.body.appendChild(ghost);
    paletteDrag.current = { key, pid: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false, ghost };

    const onMove = (ev) => {
      const d = paletteDrag.current;
      if (!d || ev.pointerId !== d.pid) return;
      if (!d.moved && (Math.abs(ev.clientX - d.startX) > 3 || Math.abs(ev.clientY - d.startY) > 3)) d.moved = true;
      d.ghost.style.transform = `translate(${ev.clientX + 12}px, ${ev.clientY + 12}px)`;
      const wrap = wrapRef.current;
      if (wrap) {
        const r = wrap.getBoundingClientRect();
        const over = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
        setDropHover(over);
      }
    };
    const onUp = (ev) => {
      const d = paletteDrag.current;
      if (!d || ev.pointerId !== d.pid) return;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      d.ghost.remove();
      setDropHover(false);
      paletteDrag.current = null;

      const wrap = wrapRef.current;
      const cv = canvasRef.current;
      if (!wrap || !cv) return;
      const r = wrap.getBoundingClientRect();
      const droppedOnCanvas = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;

      if (droppedOnCanvas) {
        const cr = cv.getBoundingClientRect();
        const x = (ev.clientX - cr.left) / proj.zoom - 75;
        const y = (ev.clientY - cr.top) / proj.zoom - 20;
        proj.addNode(d.key, x, y);
      } else if (!d.moved) {
        // a plain tap/click on a palette item (no real drag) -- add it near
        // the current scroll position so tapping still works on touch
        const scrollX = wrap.scrollLeft, scrollY = wrap.scrollTop;
        proj.addNode(d.key, scrollX / proj.zoom + 40, scrollY / proj.zoom + 40);
        toast('Device added');
      }
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [proj, toast]);

  // ---- zoom / fit ----
  const setZoomClamped = useCallback((z) => projRef.current.setZoom(Math.min(2, Math.max(0.25, z))), []);
  // offsetWidth/offsetHeight are PRE-transform, so a card scaled to 180% would
  // otherwise be measured at its unscaled size and fall outside the fit. The
  // card's own scale is read back off data-size and applied here.
  const nodeExtent = (el) => {
    const s = parseFloat(el.dataset.size) || 1;
    return { w: el.offsetWidth * s, h: el.offsetHeight * s };
  };

  const handleFit = useCallback(() => {
    const ids = Object.keys(nodeRefs.current);
    if (!ids.length) { setZoomClamped(1); wrapRef.current?.scrollTo(0, 0); return; }
    let minX = 1e9, minY = 1e9, maxX = 0, maxY = 0;
    ids.forEach((id) => {
      const el = nodeRefs.current[id];
      if (!el) return;
      const { w, h } = nodeExtent(el);
      minX = Math.min(minX, el.offsetLeft);
      minY = Math.min(minY, el.offsetTop);
      maxX = Math.max(maxX, el.offsetLeft + w);
      maxY = Math.max(maxY, el.offsetTop + h);
    });
    const pad = 60;
    const w = maxX - minX + pad * 2, h = maxY - minY + pad * 2;
    const vw = wrapRef.current.clientWidth, vh = wrapRef.current.clientHeight;
    const scale = Math.min(vw / w, vh / h, 2);
    setZoomClamped(scale);
    requestAnimationFrame(() => wrapRef.current?.scrollTo((minX - pad) * scale, (minY - pad) * scale));
  }, [setZoomClamped]);

  // ---- content bounds for export ----
  const getContentBounds = useCallback(() => {
    let maxX = 960, maxY = 1520;
    Object.values(nodeRefs.current).forEach((el) => {
      if (!el) return;
      const { w, h } = nodeExtent(el);
      maxX = Math.max(maxX, el.offsetLeft + w + 40);
      maxY = Math.max(maxY, el.offsetTop + h + 40);
    });
    return { maxX, maxY };
  }, []);

  // Pure derivation from the project data, so the results are always in step
  // with the canvas without anything having to remember to re-run them.
  const check = useMemo(
    () => validateProject(proj.nodes, proj.wires, proj.title),
    [proj.nodes, proj.wires, proj.title],
  );

  // Selects the offending device and brings it into view. Reading the live
  // element rather than the stored x/y means it lands correctly whatever the
  // zoom and whatever scale the card has been resized to.
  const focusNode = useCallback((id) => {
    proj.setSelectedNodeId(id);
    const el = nodeRefs.current[id];
    const wrap = wrapRef.current;
    if (!el || !wrap) return;
    const z = proj.zoom || 1;
    const x = el.offsetLeft * z - wrap.clientWidth / 2 + (el.offsetWidth * z) / 2;
    const y = el.offsetTop * z - wrap.clientHeight / 2 + (el.offsetHeight * z) / 2;
    wrap.scrollTo({ left: Math.max(0, x), top: Math.max(0, y), behavior: 'smooth' });
  }, [proj]);

  const getStats = useCallback(
    () => ({ devices: proj.nodes.length, links: proj.wires.length }),
    [proj.nodes.length, proj.wires.length],
  );

  const snaps = useSnapshots({ canvasRef, getContentBounds, toast, getStats });

  const runExportPNG = useCallback(async () => {
    toast('Rendering PNG…');
    try {
      const { exportPNG } = await loadExporters();
      await exportPNG(canvasRef.current, getContentBounds());
      toast('Saved');
    } catch (e) { toast('Export failed'); }
  }, [getContentBounds, toast]);

  const runExportPDF = useCallback(async () => {
    toast('Rendering PDF…');
    try {
      const { exportPDF } = await loadExporters();
      await exportPDF(canvasRef.current, getContentBounds());
      toast('Saved');
    } catch (e) { toast('PDF export failed'); }
  }, [getContentBounds, toast]);

  const runSaveFile = useCallback(() => {
    projRef.current.exportProjectFile();
    toast('Project saved');
  }, [toast]);

  // Every route that produces a file goes through here: the details are asked
  // for once, stored on the project, and only then does the action run. Doing it
  // this way means the dialog cannot be bypassed by the keyboard shortcut.
  const RUNNERS = { save: runSaveFile, png: runExportPNG, pdf: runExportPDF, edit: () => {} };

  const requestSave = useCallback((intent) => setPendingIntent(intent), []);

  const confirmDetails = useCallback((details) => {
    const intent = pendingIntent;
    projRef.current.setTitle(details);
    setPendingIntent(null);
    // Let the new title land in state and render before the exporter reads the
    // DOM, or the capture would stamp the previous revision onto the sheet.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => RUNNERS[intent]?.());
    });
  }, [pendingIntent, runSaveFile, runExportPNG, runExportPDF]);

  const doCopyImage = useCallback(async () => {
    toast('Copying…');
    try {
      const { copyToClipboard } = await loadExporters();
      await copyToClipboard(canvasRef.current, getContentBounds());
      toast('Copied — paste it anywhere');
    } catch (e) {
      toast(e.message || 'Could not copy to clipboard');
    }
  }, [getContentBounds, toast]);

  // ---- clicking empty canvas clears selection / cancels connection ----
  const handleCanvasClick = useCallback((e) => {
    if (e.target === wrapRef.current || e.target === canvasRef.current) {
      const p = projRef.current;
      p.setSelectedNodeId(null);
      p.setSelectedWireId(null);
      p.setConnectFrom(null);
      setGhostPath(null);
      setHelpOpen(false);
    }
  }, []);

  // ---- keyboard shortcuts ----
  // The handler is kept in a ref and the document listener is attached once.
  // Binding it directly would re-run add/removeEventListener on every single
  // render, because both useProject() and useSnapshots() hand back a fresh
  // object literal each time -- so the dependency array never matched.
  const keyHandlerRef = useRef(null);
  keyHandlerRef.current = (e) => {
    const inInput = document.activeElement && document.activeElement.tagName === 'INPUT';
    if (e.key === 'Escape' && proj.connectFrom) {
      proj.setConnectFrom(null);
      setGhostPath(null);
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && proj.selectedWireId && !inInput) {
      proj.deleteWire(proj.selectedWireId);
    }
    // F2 and Ctrl+Shift+S both take a snapshot -- F2 because it is a single
    // key you can hit without letting go of the mouse mid-layout, and
    // Ctrl+Shift+S because it sits next to the save shortcut people already
    // know. Checked before plain Ctrl+S so the shifted form never falls
    // through to "save project file".
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      setCheckOpen((o) => !o);
      return;
    }
    if (e.key === 'F2' || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's')) {
      e.preventDefault();
      snaps.capture();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      setPendingIntent('save');
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault(); proj.undo(); toast('Undone');
    }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
      e.preventDefault(); proj.redo(); toast('Redone');
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && !inInput && proj.selectedNodeId) {
      e.preventDefault(); proj.duplicateNode(proj.selectedNodeId); toast('Device duplicated');
    }
    if (!inInput && proj.selectedNodeId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      const step = e.shiftKey ? 20 : 4;
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
      proj.nudgeNode(proj.selectedNodeId, dx, dy);
    }
  };

  useEffect(() => {
    const onKeyDown = (e) => keyHandlerRef.current?.(e);
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // The status bar alone is easy to miss, so the first failure also raises a
  // toast. Only the first: repeating it on every keystroke would be noise.
  const warnedRef = useRef(false);
  useEffect(() => {
    if (proj.saveError && !warnedRef.current) {
      warnedRef.current = true;
      toast(SAVE_ERROR_TEXT[proj.saveError]);
    }
    if (!proj.saveError) warnedRef.current = false;
  }, [proj.saveError, toast]);

  const handleLoadProjectFile = useCallback((text) => {
    try {
      projRef.current.importProjectFile(text);
      toast('Project loaded');
    } catch (e) {
      toast('Could not read that file');
    }
  }, [toast]);

  // One stable ref callback per node id. Passing a fresh arrow inline would
  // change DeviceNode's props on every render, defeating React.memo and also
  // making React detach/reattach the ref each time.
  const nodeRefCbs = useRef(new Map());
  const nodeRefFor = useCallback((id) => {
    let cb = nodeRefCbs.current.get(id);
    if (!cb) {
      cb = (el) => {
        if (el) {
          nodeRefs.current[id] = el;
          resizeObsRef.current?.observe(el);
        } else {
          const prev = nodeRefs.current[id];
          if (prev) resizeObsRef.current?.unobserve(prev);
          delete nodeRefs.current[id];
          nodeRefCbs.current.delete(id);
        }
      };
      nodeRefCbs.current.set(id, cb);
    }
    return cb;
  }, []);

  const handleDuplicate = useCallback((id) => { projRef.current.duplicateNode(id); toast('Device duplicated'); }, [toast]);
  const handleDelete = useCallback((id) => projRef.current.deleteNode(id), []);
  const handleFieldChange = useCallback((id, field, value) => projRef.current.updateNode(id, { [field]: value }), []);

  // The floating dock carries a few big, deliberate actions over the canvas.
  // Everything here also exists in the toolbar -- this is a shortcut for the
  // things reached most often mid-drawing, not a replacement for it.
  const dockItems = useMemo(() => [
    { key: 'undo', label: 'Undo', icon: <UndoIcon />, onClick: () => { proj.undo(); toast('Undone'); }, disabled: !proj.canUndo },
    { key: 'redo', label: 'Redo', icon: <RedoIcon />, onClick: () => { proj.redo(); toast('Redone'); }, disabled: !proj.canRedo },
    { key: 'fit', label: 'Fit to screen', icon: <FitIcon />, onClick: handleFit },
    { key: 'capture', label: 'Capture snapshot', icon: <CameraIcon />, onClick: snaps.capture, badge: snaps.shots.length },
    { key: 'check', label: 'Drawing check', icon: <ShieldIcon />, onClick: () => setCheckOpen((o) => !o), badge: check.counts.error },
    { key: 'png', label: 'Export PNG', icon: <DownloadIcon />, onClick: () => requestSave('png') },
  ], [proj, toast, handleFit, snaps.capture, snaps.shots.length, check.counts.error, requestSave]);

  // The colour of the workspace being entered, used by the arrival veil so the
  // editor appears to come out of the avatar that just flew at the screen.
  const enteringColor = (profiles || []).find((p) => p.id === profileId)?.color;

  return (
    <div id="app">
      {/* One-shot: it mounts with the editor, plays once and is gone. App is
          keyed by profile id, so this replays on every workspace switch. */}
      <div className="app-arrive" style={{ '--enter': enteringColor }} aria-hidden="true" />
      <Toolbar
        zoom={proj.zoom}
        onZoomIn={() => setZoomClamped(proj.zoom + 0.1)}
        onZoomOut={() => setZoomClamped(proj.zoom - 0.1)}
        onFit={handleFit}
        snapOn={proj.snapOn}
        onToggleSnap={() => { proj.setSnapOn((s) => !s); toast(!proj.snapOn ? 'Snap to grid on' : 'Snap to grid off'); }}
        canUndo={proj.canUndo}
        canRedo={proj.canRedo}
        onUndo={() => { proj.undo(); toast('Undone'); }}
        onRedo={() => { proj.redo(); toast('Redone'); }}
        onSave={() => requestSave('save')}
        onLoad={handleLoadProjectFile}
        onClear={() => {
          // eslint-disable-next-line no-alert
          if (window.confirm('Clear the whole canvas? This cannot be undone with Load.')) {
            proj.clearAll();
            toast('Canvas cleared');
          }
        }}
        onExportPNG={() => requestSave('png')}
        onExportPDF={() => requestSave('pdf')}
        onEditDetails={() => requestSave('edit')}
        onCopyImage={doCopyImage}
        onSnapshot={snaps.capture}
        snapshotCount={snaps.shots.length}
        checkOpen={checkOpen}
        onToggleCheck={() => setCheckOpen((o) => !o)}
        errorCount={check.counts.error}
        warningCount={check.counts.warning}
        theme={theme}
        onToggleTheme={toggleTheme}
        locked={locked}
        onToggleLock={() => { setLocked((l) => !l); toast(!locked ? 'Layout locked' : 'Layout unlocked'); }}
        helpOpen={helpOpen}
        onToggleHelp={() => setHelpOpen((h) => !h)}
        profileMenu={(
          <ProfileMenu
            profiles={profiles}
            activeId={profileId}
            onSwitch={onSwitchProfile}
            onCreate={onCreateProfile}
            onRename={onRenameProfile}
            onDelete={onDeleteProfile}
            onBackToProfiles={onBackToProfiles}
          />
        )}
      />
      <div id="main">
        <Palette
          presets={proj.presets}
          builtinKeys={proj.builtinPresetKeys}
          hiddenBuiltinKeys={proj.hiddenBuiltinKeys}
          customKeys={proj.customPresetKeys}
          onStartDrag={handlePaletteDragStart}
          onAddCustomDevice={proj.addCustomDevice}
          onRemoveCustomDevice={proj.removeCustomDevice}
          onHideBuiltin={proj.hideBuiltinDevice}
          onRestoreBuiltins={proj.restoreAllBuiltins}
          toast={toast}
        />
        <div
          id="canvasWrap"
          ref={wrapRef}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={() => setGhostPath(null)}
          onClick={handleCanvasClick}
        >
          <div id="canvas" ref={canvasRef} style={{ transform: `scale(${proj.zoom})` }}>
            <svg id="wires">
              {wirePaths.map((w) => {
                const isHovered = hoveredWireId === w.id;
                const isDimmed = hoveredWireId && !isHovered;
                return (
                  <g key={w.id}>
                    <path
                      className="wirehit"
                      d={w.d}
                      onClick={(e) => { e.stopPropagation(); proj.setSelectedWireId(w.id); }}
                      onDoubleClick={() => proj.toggleWireStyle(w.id)}
                      onMouseEnter={() => setHoveredWireId(w.id)}
                      onMouseLeave={() => setHoveredWireId(null)}
                    />
                    <path
                      className={`wire${w.style === 'amber' ? ' amber' : ''}${proj.selectedWireId === w.id ? ' sel' : ''}${isHovered ? ' hovered' : ''}${isDimmed ? ' dimmed' : ''}`}
                      d={w.d}
                    />
                  </g>
                );
              })}
              {ghostPath && <path className="ghostwire" d={ghostPath} />}
            </svg>

            {proj.nodes.map((node) => (
              <DeviceNode
                key={node.id}
                innerRef={nodeRefFor(node.id)}
                node={node}
                preset={proj.presets[node.key] || proj.presets.generic}
                zoom={proj.zoom}
                selected={proj.selectedNodeId === node.id}
                isConnectingFrom={proj.connectFrom?.nodeId === node.id}
                connectFromMatches={proj.connectFrom?.nodeId === node.id ? proj.connectFrom.port : null}
                wires={proj.wires}
                onSelect={proj.setSelectedNodeId}
                onMove={handleNodeMove}
                onMoveEnd={handleNodeMoveEnd}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                onPortRef={onPortRef}
                onPortClick={handlePortClick}
                onPortHover={handlePortHover}
                hoveredWireId={hoveredWireId}
                onPortCountChange={proj.changePortCount}
                onFieldChange={handleFieldChange}
                onResizeStart={proj.pushHistory}
                onResize={proj.resizeNodeLive}
                locked={locked}
              />
            ))}

            <TitleBlock title={proj.title} />

            {proj.nodes.length === 0 && (
              <div className="empty-state">
                <div className="empty-state-icon">&#9881;</div>
                <div className="empty-state-title">Nothing on the canvas yet</div>
                <div className="empty-state-sub">Drag a device from the library on the left to get started</div>
              </div>
            )}
          </div>
          <div id="dropOverlay" style={{ display: dropHover ? 'flex' : 'none' }}>Drop to place device</div>
        </div>
        <ValidationPanel
          issues={check.issues}
          counts={check.counts}
          open={checkOpen}
          onClose={() => setCheckOpen(false)}
          onFocusNode={focusNode}
        />
        <Suspense fallback={null}><Dock items={dockItems} /></Suspense>
        {snaps.flashing && <div id="snapFlash" aria-hidden="true" />}
        <SnapshotTray
          shots={snaps.shots}
          open={snaps.trayOpen}
          onToggle={snaps.toggleTray}
          onCopy={snaps.copy}
          onDownload={snaps.download}
          onDelete={snaps.remove}
          onClear={snaps.clear}
          onDownloadAll={snaps.downloadAll}
        />
      </div>
      <footer>
        {/* Moved down from the header, which it was forcing onto a second row.
            It belongs here anyway: it is orientation for a new user, not a
            control, and the footer is where the other ambient status lives. */}
        <span id="hint">
          <kbd>drag</kbd> a device in
          <em>&#8226;</em> <kbd>click</kbd> a card to move it
          <em>&#8226;</em> <kbd>port</kbd> &#8594; <kbd>port</kbd> to wire
          <em>&#8226;</em> <kbd>F2</kbd> to capture
        </span>
        <span className="statusbar">
          {proj.nodes.length} device{proj.nodes.length !== 1 ? 's' : ''} &#8226; {proj.wires.length} link{proj.wires.length !== 1 ? 's' : ''}
          &#8226; <SaveStatus lastSaved={proj.lastSaved} saveError={proj.saveError} />
        </span>
      </footer>
      <DrawingDetailsDialog
        open={pendingIntent !== null}
        intent={pendingIntent}
        value={proj.title}
        onCancel={() => setPendingIntent(null)}
        onConfirm={confirmDetails}
      />
      {toastHost}
    </div>
  );
}
