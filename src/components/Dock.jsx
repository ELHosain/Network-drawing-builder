import React, { useRef, useState, useEffect, memo } from 'react';
import {
  motion, useMotionValue, useSpring, useTransform, AnimatePresence,
} from 'framer-motion';

// A macOS-style magnifying dock, ported from the Tailwind/TypeScript original
// to this project's plain CSS and design tokens.
//
// Differences from the source, each for a reason:
//
// 1. Tracks clientX, not pageX. The original compared pageX against
//    getBoundingClientRect(), which is viewport-relative, so items magnified
//    at the wrong offset once the page scrolled.
//
// 2. Reduced motion removes the spring but keeps the magnification. Disabling
//    the size change outright left the dock looking inert; a snap to size
//    carries the same affordance without anything bouncing.
const SPRING = { mass: 0.1, stiffness: 170, damping: 14 };
const SPRING_REDUCED = { mass: 0.1, stiffness: 900, damping: 40 };

function DockItem({
  children, label, onClick, badge, disabled,
  mouseX, distance, magnification, baseItemSize, reduced,
}) {
  const ref = useRef(null);
  const [hovered, setHovered] = useState(false);

  // The item's centre is measured from its LEFT edge plus half the BASE size,
  // never half its current width. Using the live width feeds the item's own
  // magnification back into the distance that drives it: as it grows, its
  // measured centre drifts away from the cursor, which shrinks it again. The
  // result is an item that barely moves. The base size is a constant, so the
  // distance depends only on the pointer.
  const mouseDistance = useTransform(mouseX, (val) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return Number.POSITIVE_INFINITY;
    return val - rect.left - baseItemSize / 2;
  });

  const targetSize = useTransform(
    mouseDistance,
    [-distance, 0, distance],
    [baseItemSize, magnification, baseItemSize],
    { clamp: true },
  );
  const size = useSpring(targetSize, reduced ? SPRING_REDUCED : SPRING);

  return (
    <motion.button
      ref={ref}
      type="button"
      style={{ width: size, height: size }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onClick={onClick}
      disabled={disabled}
      className="dock-item"
      aria-label={typeof label === 'string' ? label : undefined}
    >
      <span className="dock-icon">{children}</span>
      {badge > 0 && <span className="dock-badge">{badge}</span>}

      <AnimatePresence>
        {hovered && !disabled && (
          <motion.span
            className="dock-label"
            role="tooltip"
            // The centring offset must be a motion value, not CSS: animating y
            // makes framer-motion write an inline transform, which replaces any
            // transform from the stylesheet.
            style={{ x: '-50%' }}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: -6 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.16 }}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

function Dock({
  items,
  magnification = 70,
  distance = 170,
  panelHeight = 58,
  baseItemSize = 42,
}) {
  const mouseX = useMotionValue(Number.POSITIVE_INFINITY);
  const isHovered = useMotionValue(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // A magnified icon stands taller than the panel, exactly as it does on
  // macOS. The shell grows to reserve that room so the icons rise into empty
  // space instead of colliding with whatever sits above the dock.
  const shellHeight = useSpring(
    useTransform(isHovered, [0, 1], [panelHeight, magnification + 26]),
    reduced ? SPRING_REDUCED : SPRING,
  );

  return (
    <motion.div className="dock-shell" style={{ height: shellHeight }}>
      <div
        className="dock"
        style={{ height: panelHeight }}
        role="toolbar"
        aria-label="Quick actions"
        onMouseMove={(e) => { isHovered.set(1); mouseX.set(e.clientX); }}
        onMouseLeave={() => { isHovered.set(0); mouseX.set(Number.POSITIVE_INFINITY); }}
      >
        {items.map((item) => (
          <DockItem
            key={item.key}
            label={item.label}
            onClick={item.onClick}
            badge={item.badge}
            disabled={item.disabled}
            mouseX={mouseX}
            distance={distance}
            magnification={magnification}
            baseItemSize={baseItemSize}
            reduced={reduced}
          >
            {item.icon}
          </DockItem>
        ))}
      </div>
    </motion.div>
  );
}

export default memo(Dock);
