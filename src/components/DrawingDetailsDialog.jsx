import React, { useEffect, useRef, useState } from 'react';

const todayIso = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// What the action button says, so the dialog explains what is about to happen
// rather than just saying "OK".
const ACTION_LABEL = {
  save: 'Save project file',
  png: 'Export PNG',
  pdf: 'Export PDF',
  edit: 'Save details',
};

const REQUIRED = ['project', 'machine', 'title'];

// Collected at save time rather than from a permanent block on the canvas.
// These details belong to the document, not to the drawing surface, and asking
// for them at the moment of saving is also the moment the engineer actually
// knows them -- which is why the old always-present block sat half empty.
export default function DrawingDetailsDialog({ open, intent, value, onCancel, onConfirm }) {
  const [draft, setDraft] = useState(value);
  const [touched, setTouched] = useState(false);
  const firstRef = useRef(null);
  const panelRef = useRef(null);

  // Re-seed every time it opens, so it always reflects what is stored now and
  // a cancelled edit never leaks into the next open.
  useEffect(() => {
    if (!open) return;
    setDraft({ ...value, date: value.date || todayIso() });
    setTouched(false);
    const id = requestAnimationFrame(() => firstRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open, value]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onCancel(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, onCancel]);

  if (!open) return null;

  const missing = REQUIRED.filter((k) => !String(draft[k] || '').trim());
  const set = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }));

  const submit = () => {
    setTouched(true);
    if (missing.length) return;
    onConfirm({ ...draft, date: draft.date || todayIso() });
  };

  const field = (key, label, hint, type = 'text') => (
    <label className={`dd-field${touched && missing.includes(key) ? ' invalid' : ''}`}>
      <span className="dd-label">
        {label}
        {REQUIRED.includes(key) && <i title="Required">*</i>}
      </span>
      <input
        ref={key === 'project' ? firstRef : null}
        type={type}
        value={draft[key] || ''}
        onChange={set(key)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        placeholder={hint}
      />
      {touched && missing.includes(key) && <em className="dd-error">Required</em>}
    </label>
  );

  return (
    <div className="dd-backdrop" onMouseDown={(e) => { if (!panelRef.current?.contains(e.target)) onCancel(); }}>
      <div className="dd-panel" ref={panelRef} role="dialog" aria-modal="true" aria-label="Drawing details">
        <div className="dd-head">
          <h2>Drawing details</h2>
          <p>Stamped onto the exported drawing and stored with the project.</p>
        </div>

        <div className="dd-grid">
          {field('project', 'Project', 'e.g. Line 4 Retrofit')}
          {field('machine', 'Machine', 'Which machine this network belongs to')}
          {field('title', 'Drawing title', 'e.g. Profinet Topology')}
          {field('by', 'Drawn by', 'Your name')}
          {field('date', 'Date', '', 'date')}
          {field('rev', 'Revision', 'A')}
        </div>

        <div className="dd-foot">
          <button className="ghost" onClick={onCancel}>Cancel</button>
          <button className="primary" onClick={submit} disabled={touched && missing.length > 0}>
            {ACTION_LABEL[intent] || 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
