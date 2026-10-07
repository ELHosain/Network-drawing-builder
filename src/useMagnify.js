import { useCallback, useEffect, useRef } from 'react';

// Dock-style magnification for ordinary DOM elements.
//
// Two decisions make this safe to put on the toolbar and the device palette,
// where the dock's approach would not be:
//
// 1. It scales with a TRANSFORM, never with width/height. A transform is not
//    laid out, so nothing around the magnified element moves: the toolbar
//    keeps its single row, the popovers stay anchored to their buttons, and
//    the palette does not reflow or jump its scroll position. Width-based
//    magnification would shove every neighbour sideways on each pointer move.
//
// 2. It writes to element.style directly on an animation frame instead of
//    going through React state. A pointer crossing the toolbar would otherwise
//    re-render the whole app on every mousemove.
//
// Scaling about the centre also means getBoundingClientRect stays usable as
// the distance source: a centred scale leaves the centre point exactly where
// it was, so an element's own magnification cannot feed back into the distance
// that drives it. (That feedback is what flattened the dock's effect when it
// measured from a changing width.)
export function useMagnify({
  axis = 'x',
  max = 1.14,
  distance = 130,
  selector = '[data-magnify]',
} = {}) {
  const containerRef = useRef(null);
  const frame = useRef(0);
  const pointer = useRef(null);

  const paint = useCallback(() => {
    frame.current = 0;
    const root = containerRef.current;
    if (!root) return;

    const items = root.querySelectorAll(selector);
    const p = pointer.current;

    items.forEach((el) => {
      if (p === null) { el.style.transform = ''; return; }
      const r = el.getBoundingClientRect();
      const centre = axis === 'x' ? r.left + r.width / 2 : r.top + r.height / 2;
      const d = Math.abs(p - centre);
      const t = Math.min(1, d / distance);
      // Cosine falloff rather than linear: the ramp eases out near the edge of
      // the range, so neighbours blend instead of ending on a visible corner.
      const strength = (Math.cos(t * Math.PI) + 1) / 2;
      const scale = 1 + (max - 1) * strength;
      el.style.transform = scale > 1.001 ? `scale(${scale.toFixed(4)})` : '';
    });
  }, [axis, max, distance, selector]);

  const schedule = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(paint);
  }, [paint]);

  const onPointerMove = useCallback((e) => {
    pointer.current = axis === 'x' ? e.clientX : e.clientY;
    schedule();
  }, [axis, schedule]);

  const onPointerLeave = useCallback(() => {
    pointer.current = null;
    schedule();
  }, [schedule]);

  // The effect is decoration, so it is switched off entirely when the system
  // asks for reduced motion -- unlike the dock, nothing here is an affordance
  // that would be lost.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!mq.matches) return undefined;
    const root = containerRef.current;
    root?.querySelectorAll(selector).forEach((el) => { el.style.transform = ''; });
    pointer.current = null;
    return undefined;
  }, [selector]);

  useEffect(() => () => { if (frame.current) cancelAnimationFrame(frame.current); }, []);

  const reduced = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return {
    containerRef,
    magnifyProps: reduced ? {} : { onMouseMove: onPointerMove, onMouseLeave: onPointerLeave },
  };
}
