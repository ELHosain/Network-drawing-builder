import React, { useEffect, useMemo, useState } from 'react';
import { initials, profileStats, formatBytes, profileBytes } from '../profiles.js';
import AddProfileDialog from './AddProfileDialog.jsx';

function Avatar({ profile, size = 'lg' }) {
  return profile.avatar ? (
    <span className={`gate-avatar ${size}`}>
      <img src={profile.avatar} alt="" draggable={false} />
    </span>
  ) : (
    <span className={`gate-avatar ${size}`} style={{ background: profile.color }}>
      {initials(profile.name)}
    </span>
  );
}

// The screen shown before the editor. Deliberately not a social-media picker:
// each card leads with what the workspace CONTAINS -- devices, links, how much
// of the library is custom -- because four engineers sharing a machine tell
// their workspaces apart by the drawing in them, not by a face.
export default function ProfileGate({
  profiles, lastUsedId, onSelect, onCreate, onRename, onDelete,
}) {
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState(null);

  // Read once per mount rather than per render: each call walks localStorage,
  // and nothing here changes while the screen is up.
  const stats = useMemo(
    () => Object.fromEntries(profiles.map((p) => [p.id, { ...profileStats(p.id), bytes: profileBytes(p.id) }])),
    [profiles],
  );

  // A brief hold on the chosen card before handing over, so the selection
  // registers visually instead of the editor appearing to flash into place.
  const choose = (id) => {
    setBusyId(id);
    setTimeout(() => onSelect(id), 180);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (adding) return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= Math.min(9, profiles.length)) choose(profiles[n - 1].id);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles, adding]);

  return (
    <div className="gate">
      <div className="gate-inner">
        <header className="gate-head">
          <img className="gate-logo" src="/logo-96.png" alt="" width="96" height="96" draggable={false} />
          <h1>Network Drawing Builder</h1>
          <p className="gate-sub">Industrial topology editor</p>
        </header>

        <h2 className="gate-title">Choose your workspace</h2>
        <p className="gate-note">
          Each workspace keeps its own drawings, device library and settings on this computer.
        </p>

        <ul className="gate-grid">
          {profiles.map((p, i) => {
            const s = stats[p.id] || { devices: 0, links: 0, custom: 0, bytes: 0 };
            return (
              <li key={p.id}>
                <button
                  className={`gate-card${busyId === p.id ? ' chosen' : ''}${p.id === lastUsedId ? ' last' : ''}`}
                  onClick={() => choose(p.id)}
                  disabled={busyId !== null}
                >
                  {i < 9 && <span className="gate-key">{i + 1}</span>}
                  {p.id === lastUsedId && <span className="gate-last">Last used</span>}

                  <Avatar profile={p} />

                  <span className="gate-name">{p.name}</span>

                  <span className="gate-stats">
                    <span><b>{s.devices}</b> device{s.devices !== 1 ? 's' : ''}</span>
                    <i />
                    <span><b>{s.links}</b> link{s.links !== 1 ? 's' : ''}</span>
                  </span>
                  <span className="gate-meta">
                    {s.custom > 0 ? `${s.custom} custom device${s.custom !== 1 ? 's' : ''} · ` : ''}
                    {formatBytes(s.bytes)}
                  </span>
                </button>

                <span className="gate-actions">
                  <button
                    title="Rename this workspace"
                    onClick={() => {
                      // eslint-disable-next-line no-alert
                      const name = window.prompt('Rename this workspace', p.name);
                      if (name && name.trim()) onRename(p.id, name.trim());
                    }}
                  >
                    &#9998;
                  </button>
                  <button
                    className="danger"
                    disabled={profiles.length <= 1}
                    title={profiles.length <= 1
                      ? 'You cannot delete your only workspace'
                      : `Delete "${p.name}" and everything in it`}
                    onClick={() => {
                      // eslint-disable-next-line no-alert
                      if (window.confirm(`Delete "${p.name}" and everything saved in it?\n\nThis cannot be undone.`)) {
                        onDelete(p.id);
                      }
                    }}
                  >
                    &times;
                  </button>
                </span>
              </li>
            );
          })}

          <li>
            <button className="gate-card add" onClick={() => setAdding(true)} disabled={busyId !== null}>
              <span className="gate-avatar lg add-mark">+</span>
              <span className="gate-name">Add workspace</span>
              <span className="gate-meta">A fresh canvas and library</span>
            </button>
          </li>
        </ul>

        <p className="gate-foot">
          Stored in this browser on this PC — not an account. Use <b>Save</b> inside the
          editor to keep a backup file of anything important.
        </p>
      </div>

      <AddProfileDialog
        open={adding}
        onCancel={() => setAdding(false)}
        onCreate={(name, avatar) => { setAdding(false); onCreate(name, avatar); }}
      />
    </div>
  );
}
