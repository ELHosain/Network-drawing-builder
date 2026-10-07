import React, { memo, useRef } from 'react';
import {
  UndoIcon, RedoIcon, GridIcon, LockIcon, MinusIcon, PlusIcon, FitIcon,
  SaveIcon, LoadIcon, InfoIcon, ShieldIcon, CameraIcon, DownloadIcon,
  CopyIcon, HelpIcon, SunIcon, MoonIcon,
} from './icons.jsx';

// Keys are stored as combos ("Ctrl+Z") and split into individual caps at
// render time, so every modifier gets its own keycap instead of the whole
// string sitting in one grey chip.
const KEY_SHORTCUTS = [
  { combos: ['Ctrl+Z', 'Ctrl+Y'], desc: 'Undo and redo' },
  { combos: ['Ctrl+D'], desc: 'Duplicate the selected device' },
  { combos: ['Del'], desc: 'Delete the selected wire' },
  { combos: ['←↑↓→'], desc: 'Nudge the selected device — hold Shift for bigger steps' },
  { combos: ['Esc'], desc: 'Cancel a wire connection in progress' },
  { combos: ['Ctrl+S'], desc: 'Save the project file' },
  { combos: ['F2'], desc: 'Take a quick snapshot' },
  { combos: ['Ctrl+K'], desc: 'Open the drawing check' },
];

// Split out because these are gestures, not keys -- rendering "Double-click a
// wire" inside a keycap was what made the old list look broken.
const MOUSE_SHORTCUTS = [
  { action: 'Double-click', target: 'a wire', desc: 'Switch between petrol and violet link styles' },
  { action: 'Click', target: 'a wired port', desc: 'Disconnect that link' },
];

function Keys({ combo }) {
  return (
    <span className="kcombo">
      {combo.split('+').map((k, i) => (
        <React.Fragment key={k}>
          {i > 0 && <span className="kplus">+</span>}
          <kbd>{k}</kbd>
        </React.Fragment>
      ))}
    </span>
  );
}

// The toolbar is split into labelled groups rather than one long row of
// equal-weight buttons. With a dozen-plus controls, a flat row forces you to
// read every label to find anything; grouping by what the control acts on
// (history / layout / view / file / output) means you only scan one small
// cluster, which is what a drafting tool's chrome is expected to feel like.
function Group({ children, label }) {
  return <div className="tgroup" role="group" aria-label={label}>{children}</div>;
}

function Toolbar({
  zoom, onZoomIn, onZoomOut, onFit,
  snapOn, onToggleSnap,
  canUndo, canRedo, onUndo, onRedo,
  onSave, onLoad, onClear, onExportPNG, onExportPDF, onCopyImage, onEditDetails,
  onSnapshot, snapshotCount,
  checkOpen, onToggleCheck, errorCount, warningCount,
  theme, onToggleTheme,
  locked, onToggleLock,
  helpOpen, onToggleHelp,
  profileMenu,
}) {
  const fileRef = useRef(null);

  const handleLoadFile = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onLoad(reader.result);
    reader.readAsText(file);
  };

  return (
    <header>
      <div className="brand">
        <div className="brand-mark">
          {/* Served at 96px for a 30px box so it stays sharp on hi-dpi screens.
              alt is empty on purpose: the product name sits right beside it, so
              a screen reader announcing the logo too would just be noise. */}
          <img src="/logo-96.png" alt="" width="96" height="96" draggable="false" />
        </div>
        <h1>
          Network Drawing Builder
          <small>Industrial topology editor</small>
        </h1>
      </div>

      <div className="tools">
        <Group label="History">
          <button onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)"><UndoIcon /><span className="btn-label">Undo</span></button>
          <button onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)"><RedoIcon /><span className="btn-label">Redo</span></button>
        </Group>

        <Group label="Layout">
          <button className={snapOn ? 'toggled' : ''} onClick={onToggleSnap} title="Snap devices to the grid">
            <GridIcon /><span className="btn-label">Snap</span>
          </button>
          <button className={locked ? 'toggled' : ''} onClick={onToggleLock} title="Lock the layout so devices can't be dragged by accident">
            <LockIcon open={!locked} /><span className="btn-label">Lock</span>
          </button>
        </Group>

        <Group label="View">
          <button onClick={onZoomOut} title="Zoom out"><MinusIcon /></button>
          <span className="zoom-readout">{Math.round(zoom * 100)}%</span>
          <button onClick={onZoomIn} title="Zoom in"><PlusIcon /></button>
          <button onClick={onFit} title="Fit everything on screen"><FitIcon /><span className="btn-label">Fit</span></button>
        </Group>

        <Group label="Project file">
          <button onClick={onSave} title="Download a backup file"><SaveIcon /><span className="btn-label">Save</span></button>
          <button onClick={() => fileRef.current?.click()} title="Restore from a backup file"><LoadIcon /><span className="btn-label">Load</span></button>
          <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={handleLoadFile} />
          <button className="ghost" onClick={onEditDetails} title="Project, machine, title, date and revision for this drawing">
            <InfoIcon /><span className="btn-label">Details</span>
          </button>
          <button className="ghost danger" onClick={onClear} title="Remove everything from the canvas">Clear</button>
        </Group>

        <Group label="Check">
          <button
            className={`check-btn${checkOpen ? ' toggled' : ''}${errorCount ? ' has-errors' : ''}`}
            onClick={onToggleCheck}
            title="Check the drawing for duplicate addresses, unconnected devices and naming problems"
          >
            <ShieldIcon /><span className="btn-label">Check</span>
            {errorCount > 0 && <span className="check-badge error">{errorCount}</span>}
            {!errorCount && warningCount > 0 && <span className="check-badge warning">{warningCount}</span>}
            {!errorCount && !warningCount && <span className="check-badge ok">&#10003;</span>}
          </button>
        </Group>

        <Group label="Output">
          <button className="snap-btn" onClick={onSnapshot} title="Capture a quick snapshot of the layout (F2)">
            <CameraIcon /><span className="btn-label">Capture</span>
            {snapshotCount > 0 && <span className="snap-badge">{snapshotCount}</span>}
          </button>
          <button className="primary" onClick={onExportPNG} title="Export a full-resolution PNG"><DownloadIcon /><span className="btn-label">PNG</span></button>
          <button className="primary outline" onClick={onExportPDF} title="Export a PDF"><DownloadIcon /><span className="btn-label">PDF</span></button>
          <button className="ghost" onClick={onCopyImage} title="Copy the drawing as an image to paste elsewhere"><CopyIcon /></button>
        </Group>

        <button
          className="theme-toggle"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle dark mode"
        >
          <span className="knob">{theme === 'dark' ? <MoonIcon /> : <SunIcon />}</span>
        </button>

        {profileMenu}

        <div style={{ position: 'relative' }}>
          <button className="ghost icon-only" onClick={onToggleHelp} title="Keyboard shortcuts" aria-expanded={helpOpen}><HelpIcon /></button>
          {helpOpen && (
            <div className="help-popover">
              <h3>Shortcuts</h3>

              <h4>Keyboard</h4>
              <ul className="shortcut-list">
                {KEY_SHORTCUTS.map((s) => (
                  <li key={s.combos.join('/')}>
                    <span className="sc-keys">
                      {s.combos.map((c, i) => (
                        <React.Fragment key={c}>
                          {i > 0 && <span className="sc-or">or</span>}
                          <Keys combo={c} />
                        </React.Fragment>
                      ))}
                    </span>
                    <span className="sc-desc">{s.desc}</span>
                  </li>
                ))}
              </ul>

              <h4>Mouse</h4>
              <ul className="shortcut-list">
                {MOUSE_SHORTCUTS.map((s) => (
                  <li key={s.action + s.target}>
                    <span className="sc-keys">
                      <span className="sc-gesture">{s.action}</span>
                      <span className="sc-target">{s.target}</span>
                    </span>
                    <span className="sc-desc">{s.desc}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default memo(Toolbar);
