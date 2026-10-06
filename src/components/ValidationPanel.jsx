import React, { memo } from 'react';

const ICON = { error: '✕', warning: '!', info: 'i' };
const HEADING = { error: 'Errors', warning: 'Warnings', info: 'Suggestions' };
const ORDER = ['error', 'warning', 'info'];

// Lists what is wrong with the drawing and jumps to the device responsible.
// Grouped by severity so an engineer can deal with the things that will stop a
// network coming up before the things that are merely untidy.
function ValidationPanel({ issues, counts, open, onClose, onFocusNode }) {
  if (!open) return null;

  const groups = ORDER
    .map((severity) => ({ severity, items: issues.filter((i) => i.severity === severity) }))
    .filter((g) => g.items.length);

  return (
    <aside className="check-panel">
      <div className="check-head">
        <span className="check-title">
          Drawing check
          {counts.error > 0 && <span className="check-pill error">{counts.error}</span>}
          {counts.warning > 0 && <span className="check-pill warning">{counts.warning}</span>}
        </span>
        <button className="ghost" onClick={onClose} title="Close">&times;</button>
      </div>

      {!groups.length ? (
        <div className="check-clear">
          <span className="check-clear-mark">&#10003;</span>
          <b>No problems found</b>
          <em>Addresses, links and names all check out.</em>
        </div>
      ) : (
        <div className="check-list">
          {groups.map((g) => (
            <section key={g.severity}>
              <h4 className={g.severity}>{HEADING[g.severity]} <span>{g.items.length}</span></h4>
              <ul>
                {g.items.map((issue) => (
                  <li key={issue.id}>
                    <button
                      className={`check-row ${issue.severity}`}
                      onClick={() => issue.nodeIds.length && onFocusNode(issue.nodeIds[0])}
                      disabled={!issue.nodeIds.length}
                      title={issue.nodeIds.length ? 'Show this device' : undefined}
                    >
                      <span className={`check-dot ${issue.severity}`}>{ICON[issue.severity]}</span>
                      <span className="check-msg">{issue.message}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="check-foot">
        Checks run live as you draw. Duplicate addresses are the one that stops a
        network coming up.
      </p>
    </aside>
  );
}

export default memo(ValidationPanel);
