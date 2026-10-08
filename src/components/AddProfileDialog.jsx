import React, { useEffect, useRef, useState } from 'react';
import { initials, PROFILE_COLORS } from '../profiles.js';
import { processAvatar } from '../utils/imageTools.js';

// Name plus an optional photo, for creating a workspace or editing one that
// already exists. Editing used to be a window.prompt for the name alone, which
// gave no way to change a photo once it was set and looked nothing like the
// rest of the app.
//
// The photo is cropped and re-encoded before it is stored, because it goes into
// the profile index in localStorage -- a full-size camera photo pasted in raw
// would eat the whole origin budget that every workspace's drawings share.
export default function AddProfileDialog({ open, profile, onCancel, onSubmit }) {
  const editing = Boolean(profile);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const nameRef = useRef(null);
  const fileRef = useRef(null);
  const panelRef = useRef(null);

  // Re-seeded every time it opens, so an edit starts from what is stored now
  // and a cancelled one never leaks into the next.
  useEffect(() => {
    if (!open) return undefined;
    setName(profile?.name || '');
    setAvatar(profile?.avatar || null);
    setError('');
    const id = requestAnimationFrame(() => nameRef.current?.focus());
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel(); } };
    document.addEventListener('keydown', onKey, true);
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, profile, onCancel]);

  if (!open) return null;

  const pickFile = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please choose an image file.'); return; }
    setBusy(true);
    setError('');
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        setAvatar(await processAvatar(reader.result, 128));
      } catch (err) {
        setError('Could not read that image.');
      } finally {
        setBusy(false);
      }
    };
    reader.onerror = () => { setError('Could not read that file.'); setBusy(false); };
    reader.readAsDataURL(file);
  };

  const submit = () => {
    if (!name.trim()) { setError('A name is required.'); nameRef.current?.focus(); return; }
    onSubmit(name.trim(), avatar);
  };

  const face = profile?.color || PROFILE_COLORS[0];
  const preview = name.trim() ? initials(name) : '?';

  return (
    <div className="dd-backdrop" onMouseDown={(e) => { if (!panelRef.current?.contains(e.target)) onCancel(); }}>
      <div
        className="dd-panel ap-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={editing ? 'Edit workspace' : 'Add a workspace'}
      >
        <div className="dd-head">
          <h2>{editing ? 'Edit workspace' : 'Add a workspace'}</h2>
          <p>
            {editing
              ? 'Change its name or photo. The drawings inside are not touched.'
              : 'Its own canvas, device library and settings — separate from the others.'}
          </p>
        </div>

        <div className="ap-body">
          <div className="ap-avatar-col">
            <button
              type="button"
              className="ap-avatar-btn"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              title={avatar ? 'Choose a different photo' : 'Choose a photo'}
            >
              {avatar
                ? <span className="gate-avatar"><img src={avatar} alt="" /></span>
                : <span className="gate-avatar" style={{ '--face': face }}>{preview}</span>}
              <span className="ap-avatar-overlay">{busy ? '…' : 'Change'}</span>
            </button>

            <div className="ap-avatar-actions">
              <button className="ghost" onClick={() => fileRef.current?.click()} disabled={busy}>
                {busy ? 'Reading…' : avatar ? 'Replace photo' : 'Choose photo'}
              </button>
              {avatar && <button className="ghost danger" onClick={() => setAvatar(null)}>Remove photo</button>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pickFile} />
          </div>

          <label className="dd-field ap-name">
            <span className="dd-label">Name<i title="Required">*</i></span>
            <input
              ref={nameRef}
              value={name}
              placeholder="e.g. Hosain"
              maxLength={24}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            />
            <em className="ap-hint">Without a photo, the initials above are used.</em>
          </label>
        </div>

        {error && <p className="ap-error">{error}</p>}

        <div className="dd-foot">
          <button className="ghost" onClick={onCancel}>Cancel</button>
          <button className="primary" onClick={submit} disabled={busy}>
            {editing ? 'Save changes' : 'Create workspace'}
          </button>
        </div>
      </div>
    </div>
  );
}
