import React, { memo, useRef, useState, useCallback } from 'react';

const BASE_DIMS = {
  row: { w: 124, h: 92 },
  col2: { w: 118, h: 150 },
};

function PortBox({ n, nodeId, side, wired, amberEnd, active, isWireHovered, onPortRef, onPortClick, onPortHover }) {
  return (
    <div
      ref={(el) => onPortRef(nodeId, n, el)}
      data-side={side}
      className={`portbox${wired ? ' wired' : ''}${amberEnd ? ' amber-end' : ''}${active ? ' active' : ''}${isWireHovered ? ' wire-hovered' : ''}`}
      onClick={(e) => { e.stopPropagation(); onPortClick(nodeId, n); }}
      onMouseEnter={() => onPortHover(nodeId, n, true)}
      onMouseLeave={() => onPortHover(nodeId, n, false)}
    >
      {n}
    </div>
  );
}

function DeviceNode({
  node, preset, zoom, selected, isConnectingFrom, connectFromMatches,
  wires, onSelect, onMove, onMoveEnd, onDelete, onDuplicate,
  onPortRef, onPortClick, onPortHover, onPortCountChange, onFieldChange, innerRef,
  onResizeStart, onResize, locked, hoveredWireId,
}) {
  const dragRef = useRef({ dragging: false, offX: 0, offY: 0, moved: false, pid: null });
  // Mirrored into state purely so the card can be styled while it is moving
  // (raised, no blur). The drag maths itself still runs entirely off the ref,
  // so this never re-renders mid-gesture -- it flips exactly twice.
  const [dragging, setDragging] = useState(false);
  const resizeRef = useRef({ resizing: false, startSize: 1, startX: 0, pid: null });
  const elRef = useRef(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const setRefs = useCallback((el) => {
    elRef.current = el;
    if (typeof innerRef === 'function') innerRef(el);
  }, [innerRef]);

  const isInteractive = useCallback((target) => (
    !!(target && target.closest && target.closest('input, button, .portbox, .del, .dup, .portbtn'))
  ), []);

  // Stable across renders: reads the element's current on-screen position
  // directly from the DOM rather than from React state, so this handler
  // never needs to be recreated mid-drag (that churn was the likely cause
  // of drags occasionally breaking and crashing the page).
  const onPointerDown = useCallback((e) => {
    if (locked || isInteractive(e.target) || !elRef.current) return;
    const d = dragRef.current;
    const z = zoomRef.current || 1;
    d.dragging = true;
    d.moved = false;
    d.pid = e.pointerId;
    d.offX = e.clientX / z - elRef.current.offsetLeft;
    d.offY = e.clientY / z - elRef.current.offsetTop;
    setDragging(true);
    onSelect(node.id);

    const onMoveDoc = (ev) => {
      if (!d.dragging || ev.pointerId !== d.pid) return;
      d.moved = true;
      const zz = zoomRef.current || 1;
      const x = Math.max(0, ev.clientX / zz - d.offX);
      const y = Math.max(0, ev.clientY / zz - d.offY);
      onMove(node.id, x, y);
    };
    const onUpDoc = (ev) => {
      if (!d.dragging || ev.pointerId !== d.pid) return;
      d.dragging = false;
      setDragging(false);
      document.removeEventListener('pointermove', onMoveDoc);
      document.removeEventListener('pointerup', onUpDoc);
      if (d.moved) onMoveEnd(node.id);
    };
    document.addEventListener('pointermove', onMoveDoc);
    document.addEventListener('pointerup', onUpDoc);
    if (e.cancelable) e.preventDefault();
  }, [node.id, onMove, onMoveEnd, onSelect, isInteractive, locked]);

  // Resizes the WHOLE card -- frame, labels, photo and ports together --
  // rather than just the photo inside it. Dragging diagonally and taking the
  // larger of the two deltas means the gesture works whether you pull mostly
  // sideways or mostly down, which is what a corner handle implies.
  const onResizeDown = useCallback((e) => {
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    onResizeStart(node.id);
    const r = resizeRef.current;
    r.resizing = true;
    setDragging(true);
    r.pid = e.pointerId;
    r.startSize = node.size || 1;
    r.startX = e.clientX;
    r.startY = e.clientY;

    const onMoveDoc = (ev) => {
      if (!r.resizing || ev.pointerId !== r.pid) return;
      const z = zoomRef.current || 1;
      const dx = (ev.clientX - r.startX) / z;
      const dy = (ev.clientY - r.startY) / z;
      const delta = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
      onResize(node.id, r.startSize + delta / 170);
    };
    const onUpDoc = (ev) => {
      if (!r.resizing || ev.pointerId !== r.pid) return;
      r.resizing = false;
      setDragging(false);
      document.removeEventListener('pointermove', onMoveDoc);
      document.removeEventListener('pointerup', onUpDoc);
    };
    document.addEventListener('pointermove', onMoveDoc);
    document.addEventListener('pointerup', onUpDoc);
  }, [node.id, node.size, onResizeStart, onResize]);

  // The scale lives on the card's own transform rather than on each child's
  // dimensions. Every position the app reads -- port centres, node bounds --
  // goes through getBoundingClientRect, which already reports post-transform
  // geometry, so wires stay nailed to their ports at any size with no extra
  // bookkeeping. transform-origin is top-left so the card grows away from its
  // stored x/y instead of drifting off its anchor.
  const size = node.size || 1;
  const dims = BASE_DIMS[node.layout] || BASE_DIMS.row;
  const imgBoxStyle = { width: dims.w, height: dims.h };

  const wiredPorts = new Set();
  const amberPorts = new Set();
  const hoveredPorts = new Set();
  wires.forEach((w) => {
    const isHoveredWire = hoveredWireId && w.id === hoveredWireId;
    if (w.fromId === node.id) {
      wiredPorts.add(String(w.fromPort));
      if (w.style === 'amber') amberPorts.add(String(w.fromPort));
      if (isHoveredWire) hoveredPorts.add(String(w.fromPort));
    }
    if (w.toId === node.id) {
      wiredPorts.add(String(w.toPort));
      if (w.style === 'amber') amberPorts.add(String(w.toPort));
      if (isHoveredWire) hoveredPorts.add(String(w.toPort));
    }
  });

  const portNums = Array.from({ length: node.ports }, (_, i) => i + 1);
  const half = Math.ceil(node.ports / 2);
  const leftCol = portNums.slice(0, half);
  const rightCol = portNums.slice(half);

  // "side" tells the wire-routing logic in App.jsx which edge of this card
  // the port physically sits on, so a wire into a right-column switch port
  // (5-8) can approach from the right instead of cutting across the
  // left-column ports (1-4) to get there.
  const renderPort = (n, side) => (
    <PortBox
      key={n}
      n={n}
      nodeId={node.id}
      side={side}
      wired={wiredPorts.has(String(n))}
      amberEnd={amberPorts.has(String(n))}
      active={isConnectingFrom && String(connectFromMatches) === String(n)}
      isWireHovered={hoveredPorts.has(String(n))}
      onPortRef={onPortRef}
      onPortClick={onPortClick}
      onPortHover={onPortHover}
    />
  );

  const imgSrc = preset.img;

  return (
    <div
      ref={setRefs}
      className={`device-node${selected ? ' selected' : ''}${locked ? ' locked' : ''}${dragging ? ' dragging' : ''}`}
      data-size={size}
      style={{ left: node.x, top: node.y, transform: size === 1 ? undefined : `scale(${size})` }}
      onPointerDown={onPointerDown}
      onClick={() => onSelect(node.id)}
    >
      <div className="node-header">
        <input
          className="title"
          value={node.name}
          onChange={(e) => onFieldChange(node.id, 'name', e.target.value)}
        />
        <button
          type="button"
          className="icobtn dup"
          data-editor-only
          title="duplicate"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onDuplicate(node.id); }}
        >
          &#10697;
        </button>
        <button
          type="button"
          className="icobtn del"
          data-editor-only
          title="delete"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
        >
          &times;
        </button>
      </div>
      <div className="node-body">
        {/* A two-column device (a switch) puts its port columns on the OUTSIDE
            edges of the card, flanking the photo -- not stacked on top of it.
            Overlaying both columns on the picture meant the two columns sat
            side by side in the middle, so every wire bound for a right-hand
            port had to cut straight across the left-hand ports to reach it,
            and at small sizes the boxes collided with each other outright.
            Flanking the photo makes each port's "side" physically true: a
            right-column wire approaches from the right and touches nothing. */}
        {node.layout === 'col2' ? (
          <div className="col2-row">
            <div className="pcol">{leftCol.map((n) => renderPort(n, 'left'))}</div>
            {imgSrc ? (
              <div className="imgwrap col2" style={imgBoxStyle}>
                <img src={imgSrc} alt={node.name} draggable={false} />
              </div>
            ) : (
              <div className="placeholder-img" style={imgBoxStyle} />
            )}
            <div className="pcol">{rightCol.map((n) => renderPort(n, 'right'))}</div>
          </div>
        ) : imgSrc ? (
          <div className="imgwrap row" style={imgBoxStyle}>
            <img src={imgSrc} alt={node.name} draggable={false} />
          </div>
        ) : (
          <div className="placeholder-img" style={imgBoxStyle} />
        )}

        <input
          className="model"
          value={node.model}
          onChange={(e) => onFieldChange(node.id, 'model', e.target.value)}
        />
        <input
          className="ip"
          value={node.ip}
          onChange={(e) => onFieldChange(node.id, 'ip', e.target.value)}
        />

        {/* Below the labels, not above them. These ports face downwards, so a
            wire leaving one runs straight down -- and from the old position,
            directly on top of the model and IP text on its way out. */}
        {node.layout !== 'col2' && (
          <div className="ports-row-flow">{portNums.map((n) => renderPort(n, 'bottom'))}</div>
        )}

        <div className="portctl" data-editor-only>
          <button className="portbtn" onClick={() => onPortCountChange(node.id, -1)} title="remove a port">&#8722;</button>
          <span className="pcount">{node.ports} port{node.ports !== 1 ? 's' : ''}</span>
          <button className="portbtn" onClick={() => onPortCountChange(node.id, 1)} title="add a port">+</button>
        </div>
      </div>
      <div
        className="resize-handle"
        data-editor-only
        title={`Drag to resize this device (${Math.round(size * 100)}%)`}
        onPointerDown={onResizeDown}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => { e.stopPropagation(); onResizeStart(node.id); onResize(node.id, 1); }}
      >
        <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
          <path d="M10 2.5L2.5 10M10 6.5L6.5 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

export default memo(DeviceNode);
