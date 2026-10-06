import React, { memo, useEffect, useRef, useState } from 'react';
import { initials, profileBytes, formatBytes } from '../profiles.js';

function ProfileMenu({ profiles, activeId, onSwitch, onCreate, onRename, onDelete }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const active = profiles.find((p) => p.id === activeId) || profiles[0];

  // Close on an outside click or Escape. A menu that can only be dismissed by
  // clicking its own button is a small thing that makes a tool feel unfinished.
  useEffect(() => {
    if (!open) return undefined;
    const onDocDown = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); setAdding(false); } };
    document.addEventListener('pointerdown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => { if (adding) inputRef.current?.focus(); }, [adding]);

  const submit = () => {
    const name = draft.trim();
    if (!name) { setAdding(false); setDraft(''); return; }
    onCreate(name);
    setDraft('');
    setAdding(false);
    setOpen(false);
  };

  return (
    <div className="profile-wrap" ref={wrapRef}>
      <button
        className="profile-chip"
        onClick={() => setOpen((o) => !o)}
        title={`Working as ${active?.name} — click to switch`}
        aria-expanded={open}
      >
        <span className="avatar" style={{ background: active?.color }}>{initials(active?.name || '')}</span>
        <span className="profile-name">{active?.name}</span>
        <span className="profile-caret">&#9662;</span>
      </button>

      {open && (
        <div className="profile-pop">
          <div className="profile-pop-head">
            Workspaces
            <span className="profile-hint">Each person gets their own canvas and device library</span>
          </div>

          <ul className="profile-list">
            {profiles.map((p) => (
              <li key={p.id} className={p.id === activeId ? 'current' : ''}>
                <button className="profile-row" onClick={() => { onSwitch(p.id); setOpen(false); }}>
                  <span className="avatar" style={{ background: p.color }}>{initials(p.name)}</span>
                  <span className="profile-row-text">
                    <b>{p.name}</b>
                    <em>{formatBytes(profileBytes(p.id))} stored</em>
                  </span>
                  {p.id === activeId && <span className="profile-tick">&#10003;</span>}
                </button>
                <span className="profile-row-actions">
                  <button
                    title="Rename"
                    onClick={() => {
                      // eslint-disable-next-line no-alert
                      const name = window.prompt('Rename this workspace', p.name);
                      if (name && name.trim()) onRename(p.id, name.trim());
                    }}
                  >
                    &#9998;
                  </button>
                  {profiles.length > 1 && (
                    <button
                      className="danger"
                      title="Delete this workspace and everything in it"
                      onClick={() => {
                        // eslint-disable-next-line no-alert
                        if (window.confirm(`Delete "${p.name}" and everything saved in it?\n\nThis cannot be undone. Export the project file first if you need a copy.`)) {
                          onDelete(p.id);
                        }
                      }}
                    >
                      &times;
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>

          {adding ? (
            <div className="profile-add-row">
              <input
                ref={inputRef}
                value={draft}
                placeholder="Name"
                maxLength={24}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit();
                  if (e.key === 'Escape') { setAdding(false); setDraft(''); }
                }}
              />
              <button className="primary" onClick={submit}>Add</button>
            </div>
          ) : (
            <button className="profile-add" onClick={() => setAdding(true)}>+ Add a workspace</button>
          )}

          <p className="profile-foot">
            Stored only in this browser on this PC. Not a login — anyone here can switch.
            Use <b>Save</b> to keep a real backup.
          </p>
        </div>
      )}
    </div>
  );
}

export default memo(ProfileMenu);
