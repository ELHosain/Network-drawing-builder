import React, { memo } from 'react';

function stamp(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

// A roll of quick captures taken while the layout is being built. Each entry
// keeps the full-resolution blob (downloadable / copyable later) but only
// ever renders the small JPEG thumbnail, so a long session's worth of
// snapshots stays cheap to display.
function SnapshotTray({ shots, open, onToggle, onCopy, onDownload, onDelete, onClear, onDownloadAll }) {
  if (!shots.length) return null;

  return (
    <aside className={`snap-tray${open ? ' open' : ''}`}>
      <button className="snap-tray-head" onClick={onToggle} title={open ? 'Hide snapshots' : 'Show snapshots'}>
        <span className="snap-tray-title">
          <span className="snap-dot" />
          Snapshots
          <span className="snap-count">{shots.length}</span>
        </span>
        <span className={`snap-chev${open ? ' up' : ''}`}>&#9662;</span>
      </button>

      {open && (
        <>
          <div className="snap-list">
            {shots.map((s, i) => (
              <figure key={s.id} className="snap-item">
                <img src={s.thumb} alt={`Snapshot ${shots.length - i} at ${stamp(s.ts)}`} loading="lazy" />
                <figcaption>
                  <span className="snap-meta">
                    <b>#{s.seq}</b> {stamp(s.ts)}
                    <em>{s.devices}d &#183; {s.links}l</em>
                  </span>
                  <span className="snap-actions">
                    <button title="Copy to clipboard" onClick={() => onCopy(s)}>&#128203;</button>
                    <button title="Download PNG" onClick={() => onDownload(s)}>&#11015;</button>
                    <button title="Discard" className="danger" onClick={() => onDelete(s.id)}>&#10005;</button>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
          <div className="snap-foot">
            <button className="ghost" onClick={onDownloadAll}>Download all</button>
            <button className="ghost" onClick={onClear}>Clear</button>
          </div>
        </>
      )}
    </aside>
  );
}

export default memo(SnapshotTray);
