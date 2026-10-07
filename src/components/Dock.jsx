import React, { useRef, useState, useEffect, memo } from 'react';
import {
  motion, useMotionValue, useSpring, useTransform, AnimatePresence,
} from 'framer-motion';

// A macOS-style magnifying dock, ported from the Tailwind/TypeScript original
// to this project's plain CSS and design tokens.
//
// Two deliberate changes from the source:
//
// 1. It tracks clientX, not pageX. The original compared pageX against
//    getBoundingClientRect(), which is viewport-relative -- so every item
//    magnified at the wrong offset the moment the page was scrolled. Mixing
//    the two coordinate spaces is a latent bug even where it happens to look
//    right.
//
// 2. Magnification is disabled under prefers-reduced-motion. The whole effect
//    is motion for its own sake, which is exactly what that setting asks us
//    not to do.
const DEFAULT_SPRING = { mass: 0.1, stiffness: 150, damping: 12 };

function DockItem({
  children, label, onClick, badge, disabled,
  mouseX, spring, distance, magnification, baseItemSize, reduced,
}) {
  const ref = useRef(null);
  const [hovered, setHovered] = useState(false);

  const mouseDistance = useTransform(mouseX, (val) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return Number.POSITIVE_INFINITY;
    return val - rect.x - rect.width / 2;
  });

  const targetSize = useTransform(
    mouseDistance,
    [-distance, 0, distance],
    [baseItemSize, magnification, baseItemSize],
  );
  const size = useSpring(targetSize, spring);

  return (
    <motion.button
      ref={ref}
      type="button"
      style={reduced ? { width: baseItemSize, height: baseItemSize } : { width: size, height: size }}
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
  spring = DEFAULT_SPRING,
  magnification = 62,
  distance = 150,
  panelHeight = 56,
  baseItemSize = 40,
}) {
  const mouseX = useMotionValue(Number.POSITIVE_INFINITY);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  return (
    <div
      className="dock"
      style={{ height: panelHeight }}
      role="toolbar"
      aria-label="Quick actions"
      onMouseMove={(e) => mouseX.set(e.clientX)}
      onMouseLeave={() => mouseX.set(Number.POSITIVE_INFINITY)}
    >
      {items.map((item) => (
        <DockItem
          key={item.key}
          label={item.label}
          onClick={item.onClick}
          badge={item.badge}
          disabled={item.disabled}
          mouseX={mouseX}
          spring={spring}
          distance={distance}
          magnification={magnification}
          baseItemSize={baseItemSize}
          reduced={reduced}
        >
          {item.icon}
        </DockItem>
      ))}
    </div>
  );
}

export default memo(Dock);
