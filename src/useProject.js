import { useState, useRef, useCallback, useEffect } from 'react';
import { BUILTIN_PRESETS } from './data/presets.js';
import { profileKey } from './profiles.js';

const SAVE_BASE = 'netbuilder-react-save';
const CUSTOM_BASE = 'netbuilder-react-custom-devices';
const HIDDEN_BASE = 'netbuilder-react-hidden-builtins';
const GRID = 20;

let idSeq = 1;
const nextId = () => 'n' + idSeq++;

function defaultTitle() {
  return {
    project: '',
    machine: '',
    title: '',
    by: '',
    date: '',
    rev: 'A',
  };
}

// Every workspace stores its state under keys suffixed with its profile id, so
// four people sharing one browser get four genuinely separate canvases and
// device libraries rather than overwriting a single shared one.
export function useProject(profileId) {
  const STORAGE_KEY = profileKey(SAVE_BASE, profileId);
  const CUSTOM_KEY = profileKey(CUSTOM_BASE, profileId);
  const HIDDEN_KEY = profileKey(HIDDEN_BASE, profileId);

  const [presets, setPresets] = useState(BUILTIN_PRESETS);
  const [customPresets, setCustomPresets] = useState({});
  const [hiddenBuiltins, setHiddenBuiltins] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [wires, setWires] = useState([]);
  const [title, setTitle] = useState(defaultTitle());
  const [zoom, setZoom] = useState(1);
  const [snapOn, setSnapOn] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedWireId, setSelectedWireId] = useState(null);
  const [connectFrom, setConnectFrom] = useState(null); // {nodeId, port}
  const [lastSaved, setLastSaved] = useState(null);
  // Null while saving works. Set to a reason string the moment a write fails,
  // so the UI can say so instead of quietly stopping.
  const [saveError, setSaveError] = useState(null);

  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const suspendHistory = useRef(false);
  // False until the load-on-mount effect has run. The autosave effect must not
  // fire before then: on mount nodes/wires start empty, and because that effect
  // is declared first React runs it before the load, so an unguarded autosave
  // would write the empty board over the saved drawing and the load would then
  // read back nothing. This flag is what makes a refresh restore the work
  // instead of erasing it.
  const loaded = useRef(false);
  const [historyTick, setHistoryTick] = useState(0); // forces undo/redo button re-render

  const allPresets = { ...presets, ...customPresets };

  // ---------- persistence ----------
  const serialize = useCallback(() => ({
    nodes, wires, title,
  }), [nodes, wires, title]);

  // A failed autosave used to be swallowed. That is the worst possible way for
  // this to break: the browser's storage budget is a few megabytes shared by
  // every workspace, custom device photos are base64 data URLs, and once the
  // budget is gone every subsequent save throws. The app kept running
  // perfectly, the drawing kept changing on screen, and none of it was being
  // written -- discovered only on the next reload, when the work was gone.
  // Now the failure is surfaced and the UI turns it into a visible warning.
  const autosave = useCallback((snapshot) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot || serialize()));
      setLastSaved(new Date());
      setSaveError(null);
    } catch (e) {
      setSaveError(e && e.name === 'QuotaExceededError' ? 'full' : 'blocked');
    }
  }, [serialize, STORAGE_KEY]);

  const pushHistory = useCallback(() => {
    if (suspendHistory.current) return;
    undoStack.current.push(JSON.stringify(serialize()));
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
    setHistoryTick((t) => t + 1);
  }, [serialize]);

  const applySnapshot = useCallback((snap) => {
    suspendHistory.current = true;
    setNodes(snap.nodes || []);
    setWires(snap.wires || []);
    setTitle(snap.title || defaultTitle());
    setSelectedNodeId(null);
    setSelectedWireId(null);
    setConnectFrom(null);
    suspendHistory.current = false;
  }, []);

  const undo = useCallback(() => {
    if (!undoStack.current.length) return;
    redoStack.current.push(JSON.stringify(serialize()));
    const prev = JSON.parse(undoStack.current.pop());
    applySnapshot(prev);
    autosave(prev);
    setHistoryTick((t) => t + 1);
  }, [serialize, applySnapshot, autosave]);

  const redo = useCallback(() => {
    if (!redoStack.current.length) return;
    undoStack.current.push(JSON.stringify(serialize()));
    const next = JSON.parse(redoStack.current.pop());
    applySnapshot(next);
    autosave(next);
    setHistoryTick((t) => t + 1);
  }, [serialize, applySnapshot, autosave]);

  // autosave on every meaningful change -- but never before the initial load
  // has restored the saved drawing (see the `loaded` ref above).
  useEffect(() => {
    if (!loaded.current) return;
    autosave();
  }, [nodes, wires, title, autosave]);

  // ---------- load on mount ----------
  useEffect(() => {
    try {
      const rawCustom = localStorage.getItem(CUSTOM_KEY);
      if (rawCustom) setCustomPresets(JSON.parse(rawCustom));
    } catch (e) { /* ignore */ }
    try {
      const rawHidden = localStorage.getItem(HIDDEN_KEY);
      if (rawHidden) setHiddenBuiltins(JSON.parse(rawHidden));
    } catch (e) { /* ignore */ }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        setNodes(data.nodes || []);
        setWires(data.wires || []);
        setTitle(data.title || defaultTitle());
        const maxN = (data.nodes || []).reduce((m, n) => {
          const num = parseInt(String(n.id).replace(/\D/g, ''), 10);
          return Number.isFinite(num) ? Math.max(m, num) : m;
        }, 0);
        idSeq = maxN + 1;
        loaded.current = true;
        return;
      }
    } catch (e) { /* ignore */ }
    // nothing saved yet -- seed with one example device
    setNodes([makeNodeData('switch', 60, 60, BUILTIN_PRESETS.switch)]);
    loaded.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function makeNodeData(key, x, y, preset) {
    return {
      id: nextId(),
      key,
      x, y,
      ports: preset.ports,
      layout: preset.layout,
      name: preset.name,
      model: preset.model,
      ip: preset.ip,
      size: 1,
    };
  }

  // ---------- node actions ----------
  const addNode = useCallback((key, x, y) => {
    const preset = allPresets[key] || allPresets.generic;
    pushHistory();
    const snapped = snapOn ? { x: Math.round(x / GRID) * GRID, y: Math.round(y / GRID) * GRID } : { x, y };
    const node = makeNodeData(key, snapped.x, snapped.y, preset);
    setNodes((ns) => [...ns, node]);
    return node.id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPresets, snapOn, pushHistory]);

  const updateNode = useCallback((id, patch) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }, []);

  const moveNodeLive = useCallback((id, x, y) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, x, y } : n)));
  }, []);

  const finishMove = useCallback((id) => {
    if (!snapOn) return;
    setNodes((ns) => ns.map((n) => (n.id === id
      ? { ...n, x: Math.round(n.x / GRID) * GRID, y: Math.round(n.y / GRID) * GRID }
      : n)));
  }, [snapOn]);

  const deleteNode = useCallback((id) => {
    pushHistory();
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setWires((ws) => ws.filter((w) => w.fromId !== id && w.toId !== id));
    setSelectedNodeId((sel) => (sel === id ? null : sel));
    setConnectFrom((cf) => (cf && cf.nodeId === id ? null : cf));
  }, [pushHistory]);

  const duplicateNode = useCallback((id) => {
    const n = nodes.find((x) => x.id === id);
    if (!n) return;
    pushHistory();
    const copy = { ...n, id: nextId(), x: n.x + 24, y: n.y + 24, name: n.name + ' copy' };
    setNodes((ns) => [...ns, copy]);
    setSelectedNodeId(copy.id);
  }, [nodes, pushHistory]);

  const changePortCount = useCallback((id, delta) => {
    const n = nodes.find((x) => x.id === id);
    if (!n) return;
    const newCount = n.ports + delta;
    if (newCount < 1) return;
    if (delta < 0) {
      const wireOnRemovedPort = wires.find((w) => (
        (w.fromId === id && Number(w.fromPort) === n.ports) ||
        (w.toId === id && Number(w.toPort) === n.ports)
      ));
      if (wireOnRemovedPort) {
        // eslint-disable-next-line no-alert
        const ok = window.confirm(`Port ${n.ports} has a link connected. Remove it and delete that link?`);
        if (!ok) return;
      }
    }
    pushHistory();
    setNodes((ns) => ns.map((x) => (x.id === id ? { ...x, ports: newCount } : x)));
    setWires((ws) => ws.filter((w) => !(
      (w.fromId === id && Number(w.fromPort) > newCount) ||
      (w.toId === id && Number(w.toPort) > newCount)
    )));
  }, [nodes, wires, pushHistory]);

  const resizeNodeLive = useCallback((id, size) => {
    const clamped = Math.min(2.4, Math.max(0.5, size));
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, size: clamped } : n)));
  }, []);

  const nudgeNode = useCallback((id, dx, dy) => {
    setNodes((ns) => ns.map((n) => (n.id === id
      ? { ...n, x: Math.max(0, n.x + dx), y: Math.max(0, n.y + dy) }
      : n)));
    autosave();
  }, [autosave]);

  // ---------- wire actions ----------
  const wireOnPort = useCallback((nodeId, port) => wires.find((w) => (
    (w.fromId === nodeId && String(w.fromPort) === String(port)) ||
    (w.toId === nodeId && String(w.toPort) === String(port))
  )), [wires]);

  const addWire = useCallback((fromId, fromPort, toId, toPort) => {
    pushHistory();
    const wire = { id: 'w' + nextId(), fromId, fromPort, toId, toPort, style: 'green' };
    setWires((ws) => [...ws, wire]);
  }, [pushHistory]);

  const deleteWire = useCallback((id) => {
    pushHistory();
    setWires((ws) => ws.filter((w) => w.id !== id));
    setSelectedWireId((sel) => (sel === id ? null : sel));
  }, [pushHistory]);

  const toggleWireStyle = useCallback((id) => {
    pushHistory();
    setWires((ws) => ws.map((w) => (w.id === id ? { ...w, style: w.style === 'amber' ? 'green' : 'amber' } : w)));
  }, [pushHistory]);

  // click on a port: either start a connection, finish one, or disconnect
  const clickPort = useCallback((nodeId, port) => {
    const existing = wireOnPort(nodeId, port);
    if (!connectFrom) {
      if (existing) {
        deleteWire(existing.id);
        return { toast: 'Disconnected port ' + port };
      }
      setConnectFrom({ nodeId, port });
      return null;
    }
    if (connectFrom.nodeId === nodeId && String(connectFrom.port) === String(port)) {
      setConnectFrom(null);
      return null;
    }
    if (existing) {
      setConnectFrom(null);
      return { toast: `Port ${port} is already connected — click it by itself to disconnect first` };
    }
    addWire(connectFrom.nodeId, connectFrom.port, nodeId, port);
    setConnectFrom(null);
    return { toast: 'Link created' };
  }, [connectFrom, wireOnPort, deleteWire, addWire]);

  // ---------- custom device library ----------
  const addCustomDevice = useCallback((imgDataUrl, name) => {
    const key = 'custom_' + nextId();
    const preset = { img: imgDataUrl, name, model: '', ip: '192.168.0.x', ports: 2, layout: 'row' };
    setCustomPresets((c) => {
      const next = { ...c, [key]: preset };
      try {
        localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
      } catch (e) {
        // The device still appears in the library for this session, but it will
        // not survive a reload -- say so rather than pretending it saved.
        setSaveError(e && e.name === 'QuotaExceededError' ? 'full' : 'blocked');
      }
      return next;
    });
    return key;
  }, []);

  const removeCustomDevice = useCallback((key) => {
    setCustomPresets((c) => {
      const next = { ...c };
      delete next[key];
      try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(next)); } catch (e) { /* ignore */ }
      return next;
    });
  }, []);

  // Built-in devices can't be deleted outright (they're part of the app),
  // but they can be hidden from the library -- with a one-click way back.
  const hideBuiltinDevice = useCallback((key) => {
    setHiddenBuiltins((h) => {
      const next = h.includes(key) ? h : [...h, key];
      try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(next)); } catch (e) { /* ignore */ }
      return next;
    });
  }, []);

  const restoreAllBuiltins = useCallback(() => {
    setHiddenBuiltins([]);
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([])); } catch (e) { /* ignore */ }
  }, []);

  // ---------- project save/load as file ----------
  // The saved file carries the custom devices the drawing actually uses, so it
  // is portable. Without this the file held only node/wire data, and a custom
  // device opened on another machine -- or in another workspace, or after
  // clearing site data -- resolved to nothing and fell back to the generic
  // placeholder, losing its photo, port count and layout.
  //
  // Deliberately NOT folded into serialize(): that is also what feeds autosave
  // and the 50-entry undo stack, and embedding base64 photos there would put 50
  // copies of every image in memory and blow the localStorage budget.
  const exportProjectFile = useCallback(() => {
    const used = {};
    nodes.forEach((n) => {
      if (customPresets[n.key]) used[n.key] = customPresets[n.key];
    });
    const payload = { version: 2, ...serialize(), presets: used };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'network-drawing-project.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, [serialize, nodes, customPresets]);

  const importProjectFile = useCallback((jsonText) => {
    const data = JSON.parse(jsonText);
    pushHistory();

    // Merge in any custom devices the file brought with it. A device id that
    // already exists locally but describes a DIFFERENT device gets a fresh id
    // and the nodes referencing it are remapped, so importing someone else's
    // drawing can never overwrite a device in your own library.
    const incoming = data.presets || {};
    const keyMap = {};
    const additions = {};
    Object.keys(incoming).forEach((key) => {
      const mine = customPresets[key];
      if (!mine) {
        additions[key] = incoming[key];
        keyMap[key] = key;
      } else if (JSON.stringify(mine) === JSON.stringify(incoming[key])) {
        keyMap[key] = key; // identical device, reuse it
      } else {
        const fresh = 'custom_' + nextId();
        additions[fresh] = incoming[key];
        keyMap[key] = fresh;
      }
    });

    if (Object.keys(additions).length) {
      setCustomPresets((c) => {
        const next = { ...c, ...additions };
        try {
          localStorage.setItem(CUSTOM_KEY, JSON.stringify(next));
        } catch (e) {
          setSaveError(e && e.name === 'QuotaExceededError' ? 'full' : 'blocked');
        }
        return next;
      });
    }

    const importedNodes = (data.nodes || []).map((n) => (
      keyMap[n.key] && keyMap[n.key] !== n.key ? { ...n, key: keyMap[n.key] } : n
    ));

    // Advance the id counter past anything the file brought in. Without this a
    // freshly-loaded project whose nodes are n1..n20 would hand the same ids out
    // again for the next device added, producing duplicate keys and wires that
    // attach to the wrong card.
    const maxN = importedNodes.reduce((m, n) => {
      const num = parseInt(String(n.id).replace(/\D/g, ''), 10);
      return Number.isFinite(num) ? Math.max(m, num) : m;
    }, 0);
    if (maxN >= idSeq) idSeq = maxN + 1;

    applySnapshot({ ...data, nodes: importedNodes });
  }, [pushHistory, applySnapshot, customPresets, CUSTOM_KEY]);

  const clearAll = useCallback(() => {
    pushHistory();
    setNodes([]);
    setWires([]);
    setSelectedNodeId(null);
    setSelectedWireId(null);
    setConnectFrom(null);
  }, [pushHistory]);

  // one-time: strip white backgrounds off the built-in presets after mount
  const builtinProcessed = useRef(false);

  return {
    presets: allPresets,
    builtinPresetKeys: Object.keys(presets).filter((k) => k !== 'generic' && !hiddenBuiltins.includes(k)),
    hiddenBuiltinKeys: hiddenBuiltins,
    customPresetKeys: Object.keys(customPresets),
    setPresets,
    hideBuiltinDevice,
    restoreAllBuiltins,
    builtinProcessed,
    nodes, wires, title, setTitle,
    zoom, setZoom, snapOn, setSnapOn,
    selectedNodeId, setSelectedNodeId,
    selectedWireId, setSelectedWireId,
    connectFrom, setConnectFrom,
    addNode, updateNode, moveNodeLive, finishMove, deleteNode, duplicateNode,
    changePortCount, nudgeNode, resizeNodeLive,
    wireOnPort, addWire, deleteWire, toggleWireStyle, clickPort,
    addCustomDevice, removeCustomDevice,
    exportProjectFile, importProjectFile, clearAll,
    undo, redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
    historyTick,
    pushHistory,
    lastSaved,
    saveError,
  };
}
