import React, { memo, useRef } from 'react';

const SHORTCUTS = [
  ['Ctrl+Z / Ctrl+Y', 'Undo / Redo'],
  ['Ctrl+D', 'Duplicate selected device'],
  ['Delete', 'Delete selected wire'],
  ['Arrow keys', 'Nudge selected device (Shift = bigger step)'],
  ['Esc', 'Cancel an in-progress wire connection'],
  ['Ctrl+S', 'Save project file'],
  ['F2 / Ctrl+Shift+S', 'Take a quick snapshot of the layout'],
  ['Ctrl+K', 'Open the drawing check'],
  ['Double-click a wire', 'Toggle green / amber remote-link style'],
  ['Click a wired port', 'Disconnect that link'],
];

function CameraIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.8l1-1.8A1.5 1.5 0 0 1 9.6 3.4h4.8a1.5 1.5 0 0 1 1.3.8l1 1.8h1.8A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-9Z"
        stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="12" cy="12.8" r="3.4" stroke="currentColor" strokeWidth="1.7" />
    </svg>
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

function ShieldIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3l7 3v5.5c0 4.3-2.9 7.9-7 9.5-4.1-1.6-7-5.2-7-9.5V6l7-3Z"
        stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M9 12l2.2 2.2L15.5 10" stroke="currentColor" strokeWidth="1.7"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="5" cy="5" r="2.4" fill="#fff" />
            <circle cx="19" cy="5" r="2.4" fill="#fff" />
            <circle cx="12" cy="19" r="2.4" fill="#fff" />
            <path d="M5 7.4V12a2 2 0 0 0 2 2h3M19 7.4V12a2 2 0 0 1-2 2h-3M12 14v2.6"
              stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>
        <h1>
          Network Drawing Builder
          <small>Industrial topology editor</small>
        </h1>
      </div>

      <div id="hint">
        <kbd>drag</kbd> a device in &#8226; <kbd>click</kbd> a card to move &#8226; <kbd>port &#8594; port</kbd> to wire
        &#8226; <kbd>F2</kbd> snapshot
      </div>

      <div className="tools">
        <Group label="History">
          <button onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">&#8630;<span className="btn-label">Undo</span></button>
          <button onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">&#8631;<span className="btn-label">Redo</span></button>
        </Group>

        <Group label="Layout">
          <button className={snapOn ? 'toggled' : ''} onClick={onToggleSnap} title="Snap devices to the grid">
            &#9638;<span className="btn-label">Snap</span>
          </button>
          <button className={locked ? 'toggled' : ''} onClick={onToggleLock} title="Lock the layout so devices can't be dragged by accident">
            {locked ? '\u{1F512}' : '\u{1F513}'}<span className="btn-label">Lock</span>
          </button>
        </Group>

        <Group label="View">
          <button onClick={onZoomOut} title="Zoom out">&#8722;</button>
          <span className="zoom-readout">{Math.round(zoom * 100)}%</span>
          <button onClick={onZoomIn} title="Zoom in">+</button>
          <button onClick={onFit} title="Fit everything on screen">&#9974;<span className="btn-label">Fit</span></button>
        </Group>

        <Group label="Project file">
          <button onClick={onSave} title="Download a backup file">&#128190;<span className="btn-label">Save</span></button>
          <button onClick={() => fileRef.current?.click()} title="Restore from a backup file">&#128194;<span className="btn-label">Load</span></button>
          <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={handleLoadFile} />
          <button className="ghost" onClick={onEditDetails} title="Project, machine, title, date and revision for this drawing">
            &#9432;<span className="btn-label">Details</span>
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
          <button className="snap-btn" onClick={onSnapshot} title="Quick snapshot of the current layout (F2)">
            <CameraIcon /><span className="btn-label">Snap</span>
            {snapshotCount > 0 && <span className="snap-badge">{snapshotCount}</span>}
          </button>
          <button className="primary" onClick={onExportPNG} title="Export a full-resolution PNG">&#11015;<span className="btn-label">PNG</span></button>
          <button className="primary outline" onClick={onExportPDF} title="Export a PDF">&#11015;<span className="btn-label">PDF</span></button>
          <button className="ghost" onClick={onCopyImage} title="Copy the drawing as an image to paste elsewhere">&#128203;</button>
        </Group>

        <button
          className="theme-toggle"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle dark mode"
        >
          <span className="knob">{theme === 'dark' ? '\u{1F319}' : '\u2600\uFE0F'}</span>
        </button>

        {profileMenu}

        <div style={{ position: 'relative' }}>
          <button className="ghost" onClick={onToggleHelp} title="Keyboard shortcuts" aria-expanded={helpOpen}>?</button>
          {helpOpen && (
            <div className="help-popover">
              <h3>Keyboard shortcuts</h3>
              <table>
                <tbody>
                  {SHORTCUTS.map(([key, desc]) => (
                    <tr key={key}>
                      <td className="key">{key}</td>
                      <td>{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default memo(Toolbar);
