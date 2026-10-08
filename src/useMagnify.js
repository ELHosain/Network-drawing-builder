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
// Writes the factor as a CUSTOM PROPERTY, not as a transform.
//
// Writing el.style.transform directly wins over every stylesheet rule, so any
// element that also has a hover transform -- the palette tiles' lift, the
// chooser cards' tilt -- silently lost it the moment the pointer entered. A
// variable lets the stylesheet decide how the magnification composes with
// whatever else that element is already doing:
//
//   .thing        { transform: scale(var(--mag, 1)); }
//   .thing:hover  { transform: translateY(-6px) scale(calc(var(--mag, 1) * 1.02)); }
function clear(el) {
  el.style.removeProperty('--mag');
  el.style.zIndex = '';
}

export function useMagnify({
  axis = 'x',
  max = 1.14,
  distance = 130,
  selector = '[data-magnify]',
} = {}) {
  const containerRef = useRef(null);
  const frame = useRef(0);
  const pointer = useRef(null);
  // Measured element centres, cached. See measure() below.
  const cache = useRef(null);

  // The centres are measured ONCE per pointer entry instead of every frame.
  //
  // This was the single most expensive thing in the app's hover path: a
  // getBoundingClientRect per control per frame, which is a forced synchronous
  // layout each time -- around eighteen of them per frame just to sweep the
  // toolbar.
  //
  // It is safe to cache precisely because this magnifier scales about the
  // centre: a centred scale leaves the centre point exactly where it was, so
  // magnifying an element cannot move its own centre or anybody else's. The
  // cache is dropped whenever something could genuinely move them -- the
  // pointer leaving, a resize, or a scroll.
  const measure = useCallback(() => {
    const root = containerRef.current;
    if (!root) { cache.current = null; return; }
    cache.current = [...root.querySelectorAll(selector)].map((el) => {
      const r = el.getBoundingClientRect();
      return { el, centre: axis === 'x' ? r.left + r.width / 2 : r.top + r.height / 2 };
    });
  }, [axis, selector]);

  const paint = useCallback(() => {
    frame.current = 0;
    const p = pointer.current;

    if (p === null) {
      cache.current?.forEach(({ el }) => clear(el));
      cache.current = null;
      return;
    }

    if (!cache.current) measure();

    (cache.current || []).forEach(({ el, centre }) => {
      const d = Math.abs(p - centre);
      const t = Math.min(1, d / distance);
      // Cosine falloff rather than linear: the ramp eases out near the edge of
      // the range, so neighbours blend instead of ending on a visible corner.
      const strength = (Math.cos(t * Math.PI) + 1) / 2;
      const scale = 1 + (max - 1) * strength;
      if (scale > 1.001) {
        el.style.setProperty('--mag', scale.toFixed(4));
        // The nearest item has to paint over its neighbours, or the one after
        // it in DOM order overlaps the part that just grew.
        el.style.zIndex = String(Math.round(scale * 100));
      } else {
        clear(el);
      }
    });
  }, [max, distance, measure]);

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

  // Anything that can actually move the controls invalidates the cache: the
  // window resizing (the toolbar wraps), or the container scrolling.
  useEffect(() => {
    const drop = () => { cache.current = null; };
    window.addEventListener('resize', drop);
    const root = containerRef.current;
    root?.addEventListener('scroll', drop, { passive: true });
    return () => {
      window.removeEventListener('resize', drop);
      root?.removeEventListener('scroll', drop);
    };
  }, []);

  useEffect(() => () => { if (frame.current) cancelAnimationFrame(frame.current); }, []);

  // The pointer is always tracked. A reduced-motion preference shortens the
  // transition in CSS instead of removing the effect: switching it off here
  // left the toolbar completely inert for anyone with animation effects
  // disabled in Windows, with no indication why.
  return {
    containerRef,
    magnifyProps: { onMouseMove: onPointerMove, onMouseLeave: onPointerLeave },
  };
}
