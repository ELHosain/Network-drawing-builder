import React, { useEffect, useRef, useState } from 'react';
import { initials, PROFILE_COLORS } from '../profiles.js';
import { processAvatar } from '../utils/imageTools.js';

// Name plus an optional avatar. The avatar is cropped and re-encoded before it
// is stored, because it goes into the profile index in localStorage -- a
// full-size camera photo pasted in raw would eat the whole origin budget that
// every workspace's drawings share.
export default function AddProfileDialog({ open, onCancel, onCreate }) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const nameRef = useRef(null);
  const fileRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setName('');
    setAvatar(null);
    setError('');
    const id = requestAnimationFrame(() => nameRef.current?.focus());
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel(); } };
    document.addEventListener('keydown', onKey, true);
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, onCancel]);

  if (!open) return null;

  const pickFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please choose an image file.'); return; }
    setBusy(true);
    setError('');
    try {
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
    } catch (err) {
      setError('Could not read that image.');
      setBusy(false);
    }
  };

  const submit = () => {
    if (!name.trim()) { setError('A name is required.'); nameRef.current?.focus(); return; }
    onCreate(name.trim(), avatar);
  };

  const preview = name.trim() ? initials(name) : '?';

  return (
    <div className="dd-backdrop" onMouseDown={(e) => { if (!panelRef.current?.contains(e.target)) onCancel(); }}>
      <div className="dd-panel ap-panel" ref={panelRef} role="dialog" aria-modal="true" aria-label="Add a workspace">
        <div className="dd-head">
          <h2>Add a workspace</h2>
          <p>Its own canvas, device library and settings — separate from the others.</p>
        </div>

        <div className="ap-body">
          <div className="ap-avatar-col">
            {avatar
              ? <span className="gate-avatar lg"><img src={avatar} alt="" /></span>
              : <span className="gate-avatar lg" style={{ background: PROFILE_COLORS[0] }}>{preview}</span>}

            <div className="ap-avatar-actions">
              <button className="ghost" onClick={() => fileRef.current?.click()} disabled={busy}>
                {busy ? 'Reading…' : avatar ? 'Change' : 'Choose photo'}
              </button>
              {avatar && <button className="ghost danger" onClick={() => setAvatar(null)}>Remove</button>}
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
            <em className="ap-hint">
              Without a photo, the initials above are used.
            </em>
          </label>
        </div>

        {error && <p className="ap-error">{error}</p>}

        <div className="dd-foot">
          <button className="ghost" onClick={onCancel}>Cancel</button>
          <button className="primary" onClick={submit} disabled={busy}>Create workspace</button>
        </div>
      </div>
    </div>
  );
}
