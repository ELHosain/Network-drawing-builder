# Network Drawing Builder (React)

A drag-and-drop editor for building industrial network topology drawings —
drag devices onto a canvas, wire their numbered ports together, and export
a clean PNG or PDF. Built with React + Vite.

## Getting started

You need [Node.js](https://nodejs.org) installed (version 18 or newer is safest).

```bash
npm install
npm run dev
```

Then open the URL it prints (usually `http://localhost:5173`) in your browser.
Vite will hot-reload as you edit files.

To build a static, deployable version:

```bash
npm run build
npm run preview   # serves the built files locally so you can check them
```

The built site ends up in `dist/` — you can host that folder anywhere
(Netlify, GitHub Pages, a plain web server, etc.) since it's just static
HTML/JS/CSS with no backend.

## What's inside

```
src/
  App.jsx              -- main layout, canvas, wiring logic, keyboard shortcuts
  App.css              -- all visual styling
  useProject.js         -- state management: nodes, wires, undo/redo, persistence
  data/presets.js        -- built-in device library (images embedded as base64)
  utils/
    imageTools.js         -- resize + white-background removal for photos
    exportProject.js       -- PNG/PDF export (via html2canvas + jsPDF)
  components/
    DeviceNode.jsx          -- a single draggable device card with ports
    Palette.jsx              -- sidebar device library + photo upload
    Toolbar.jsx               -- top bar: undo/redo, zoom, save/load, export
    TitleBlock.jsx             -- drawing title block (project/title/date/rev)
    Toasts.jsx                  -- small notification popups
```

## Features

- **Drag devices in** from the library sidebar, or drag your own photo in
  via "+ Add photo" (it's automatically resized and has its white background
  stripped so it sits cleanly on the canvas).
- **Click a port, then another port** to wire two devices together. Click a
  wire and press Delete to remove it, or click an already-wired port by
  itself to disconnect it instantly.
- **Double-click a wire** to toggle it between the normal green link style
  and a dashed amber "remote link" style (handy for marking a VPN/remote
  access connection, like a Secomea unit).
- **Drag a whole card** to move it; it snaps to a grid on release (toggle
  snapping off in the toolbar if you want free placement).
- **Undo/redo** (Ctrl+Z / Ctrl+Y), **duplicate** a selected device (Ctrl+D),
  and **nudge** a selected device with the arrow keys.
- **Autosaves** to your browser's local storage as you work. Use
  "Save project" / "Load project" in the toolbar for an explicit backup
  file you can keep or move to another computer.
- **Export PNG or PDF** — renders exactly what's on the canvas, with all the
  editing-only UI (delete/duplicate icons, +/- port buttons) stripped out,
  so the exported drawing looks like a clean technical diagram.

## Known limitations

- Wires are simple curved connectors — they don't automatically route around
  other devices sitting in between. For diagrams with a lot of devices you
  may need to nudge things apart to avoid overlap.
- The white-background removal is a brightness-threshold trick, not true
  AI segmentation — it works well for typical white studio product photos,
  but very light-colored device housings can occasionally fade a little
  at the edges.
- Everything is stored per-browser (via `localStorage`) — it isn't synced
  anywhere, so switching browsers or clearing site data will lose your
  autosave unless you've downloaded a project backup.
