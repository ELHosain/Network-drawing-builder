import React, { useRef } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

// A device tile that magnifies as the pointer approaches, using the same
// mechanism as the dock: real width and height driven by a spring, so tiles
// genuinely grow and push their neighbours down the column rather than just
// scaling over them.
//
// The column is vertical, so distance is measured on Y. Everything else
// follows the dock -- including measuring from a CONSTANT base height rather
// than the tile's current height, so a tile's own magnification cannot feed
// back into the distance driving it.
export const TILE = { w: 112, h: 92, magW: 164, magH: 134, distance: 190 };
export const TILE_SPRING = { mass: 0.1, stiffness: 170, damping: 14 };
// Reduced motion stiffens the spring so sizes snap rather than glide. It does
// NOT switch magnification off: doing that left the palette completely inert
// for anyone with animation effects disabled in Windows, while the dock -- which
// only swaps the spring -- carried on magnifying. Same rule in both places now.
export const TILE_SPRING_REDUCED = { mass: 0.1, stiffness: 900, damping: 40 };

export default function PaletteTile({
  mouseY, reduced, className = '', children, onPointerDown, onClick, title,
}) {
  const ref = useRef(null);

  const distanceFromPointer = useTransform(mouseY, (val) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return Number.POSITIVE_INFINITY;
    return val - rect.top - TILE.h / 2;
  });

  const range = [-TILE.distance, 0, TILE.distance];
  const spring = reduced ? TILE_SPRING_REDUCED : TILE_SPRING;
  const width = useSpring(
    useTransform(distanceFromPointer, range, [TILE.w, TILE.magW, TILE.w]),
    spring,
  );
  const height = useSpring(
    useTransform(distanceFromPointer, range, [TILE.h, TILE.magH, TILE.h]),
    spring,
  );

  return (
    <motion.div
      ref={ref}
      className={`pitem ${className}`.trim()}
      style={{ width, height }}
      onPointerDown={onPointerDown}
      onClick={onClick}
      title={title}
    >
      {children}
    </motion.div>
  );
}
