import React, { useCallback, useEffect, useRef, useState } from 'react';

const LIFETIME = 2200;
const EXIT = 250;

function ToastList({ toasts }) {
  return (
    <div id="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast${t.show ? ' show' : ''}`}>{t.msg}</div>
      ))}
    </div>
  );
}

export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(1);
  const timers = useRef(new Set());

  // Timers are tracked and cleared on unmount: without this, a toast fired
  // just before the component goes away later calls setState on an unmounted
  // tree, and in a hot-reloading dev session those leaked timers accumulate.
  const later = useCallback((fn, ms) => {
    const id = setTimeout(() => { timers.current.delete(id); fn(); }, ms);
    timers.current.add(id);
  }, []);

  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current.clear(); }, []);

  const toast = useCallback((msg) => {
    const id = seq.current++;
    setToasts((t) => [...t, { id, msg, show: false }]);
    requestAnimationFrame(() => {
      setToasts((t) => t.map((x) => (x.id === id ? { ...x, show: true } : x)));
    });
    later(() => {
      setToasts((t) => t.map((x) => (x.id === id ? { ...x, show: false } : x)));
      later(() => setToasts((t) => t.filter((x) => x.id !== id)), EXIT);
    }, LIFETIME);
  }, [later]);

  // A plain element, not a component defined inline. The previous version
  // returned a new component *function* on every toast change, so React saw
  // a different component type each render and tore down and remounted the
  // whole toast subtree instead of updating it -- which also restarted every
  // in-flight CSS transition. Handing back an element keeps ToastList a
  // single stable component type.
  return { toast, toastHost: <ToastList toasts={toasts} /> };
}
