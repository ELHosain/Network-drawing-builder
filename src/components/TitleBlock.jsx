import React, { memo } from 'react';

const ICONS = {
  project: <path d="M3 7l7-4 7 4-7 4-7-4zm0 0v7l7 4 7-4V7" />,
  machine: <path d="M4 16V9l6-4 6 4v7M8 16v-4h4v4" />,
  title: <path d="M4 5h12M4 9h12M4 13h8" />,
  by: <circle cx="10" cy="7" r="3" />,
  date: <rect x="3" y="4" width="14" height="13" rx="1.5" />,
  rev: <path d="M10 3v7l5 3" />,
};

function FieldIcon({ name }) {
  return (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}

// Formats an ISO date the way a drawing sheet should carry it, and leaves
// anything it does not recognise exactly as typed.
function displayDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
  if (!m) return value || '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

// Read-only, and hidden in the editor: it appears only while an export is
// rendering. The details are collected in a dialog at save time now, so there
// is no reason for a permanently-docked form to take up canvas space -- but the
// exported drawing still needs its title block, so this is where it comes from.
//
// Being absolutely positioned matters: showing it for the duration of a capture
// moves nothing else on the canvas, so the wire geometry measured before export
// stays valid.
function TitleBlock({ title }) {
  const field = (key, label, flex) => (
    <div className="tb-field" style={{ flex }}>
      <label><FieldIcon name={key} />{label}</label>
      <div className="tb-value">{(key === 'date' ? displayDate(title[key]) : title[key]) || '—'}</div>
    </div>
  );

  return (
    <div className="tblock" aria-hidden="true">
      <div className="tblock-accent" />
      <div className="tblock-inner">
        <div className="tblock-heading">Drawing Information</div>
        <div className="tblock-row">
          {field('project', 'Project', 2.2)}
          {field('machine', 'Machine', 1.8)}
          {field('title', 'Title', 1.8)}
          {field('by', 'Drawn by', 1.2)}
          {field('date', 'Date', 1.1)}
          {field('rev', 'Rev.', 0.5)}
        </div>
      </div>
    </div>
  );
}

export default memo(TitleBlock);
