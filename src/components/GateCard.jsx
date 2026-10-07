import React, { useRef } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

// A workspace card that magnifies with real width and height, the way the dock
// does -- NOT with transform: scale().
//
// That distinction is the whole point here. A scale() transform rasterises the
// element once at its natural size and then stretches that bitmap, so every
// label inside goes soft the moment the card grows. Animating the box itself
// makes the browser lay the card out again at the new size, so the text is
// re-rendered sharp at whatever size it lands on.
//
// For the same reason there is no rotateX tilt any more: a 3D transform
// resamples its subtree too. The lift is a pure translate, which does not.
export const CARD = { w: 198, h: 208, magW: 246, magH: 258, distance: 300 };
const SPRING = { mass: 0.12, stiffness: 160, damping: 16 };
const SPRING_REDUCED = { mass: 0.1, stiffness: 900, damping: 40 };

export default function GateCard({
  mouseX, reduced, className = '', children, onClick, disabled,
}) {
  const ref = useRef(null);

  // Measured from the constant base width, never the live width: using the
  // current width would feed the card's own growth back into the distance
  // driving it, and the effect flattens out.
  const distanceFromPointer = useTransform(mouseX, (val) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return Number.POSITIVE_INFINITY;
    return val - rect.left - CARD.w / 2;
  });

  const range = [-CARD.distance, 0, CARD.distance];
  const spring = reduced ? SPRING_REDUCED : SPRING;
  const width = useSpring(useTransform(distanceFromPointer, range, [CARD.w, CARD.magW, CARD.w]), spring);
  const height = useSpring(useTransform(distanceFromPointer, range, [CARD.h, CARD.magH, CARD.h]), spring);

  return (
    <motion.button
      ref={ref}
      type="button"
      className={`gate-card ${className}`.trim()}
      style={{ width, height }}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </motion.button>
  );
}
