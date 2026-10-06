// Orthogonal wire routing with rounded corners.
//
// Real wiring diagrams run cables in straight horizontal and vertical lanes
// with swept corners, never as free-floating curves: right angles are
// unambiguous to trace by eye when a dozen links cross near each other, and
// the sweep stops the corners from looking like a pixel-art staircase.
//
// Every wire leaves its port along a short "stub" pointing away from the edge
// the port sits on, so a link into a right-hand port always arrives from the
// right rather than cutting back across the device. That stub is what makes a
// dense drawing readable -- without it, the line meets the port at whatever
// angle the midpoint maths happened to produce.

const STUB = 14;        // how far a wire runs straight out of its port
const RADIUS = 12;      // corner sweep
const EPS = 0.5;

function stubPoint(p, side) {
  switch (side) {
    case 'left': return { x: p.x - STUB, y: p.y };
    case 'right': return { x: p.x + STUB, y: p.y };
    case 'top': return { x: p.x, y: p.y - STUB };
    case 'bottom': return { x: p.x, y: p.y + STUB };
    default: return { x: p.x, y: p.y };
  }
}

const isVertical = (side) => side === 'top' || side === 'bottom';

// +1 means the stub travels in the increasing direction of its axis.
const outward = (side) => (side === 'bottom' || side === 'right' ? 1 : -1);

// Drops duplicate and collinear points. Without this, a wire between two
// ports that happen to line up emits zero-length segments, and a zero-length
// segment next to a corner makes the rounding maths produce a visible kink.
function clean(points) {
  const out = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - p.x) < EPS && Math.abs(last.y - p.y) < EPS) continue;
    out.push(p);
  }
  for (let i = 1; i < out.length - 1; ) {
    const a = out[i - 1], b = out[i], c = out[i + 1];
    const collinear = (Math.abs(a.x - b.x) < EPS && Math.abs(b.x - c.x) < EPS)
      || (Math.abs(a.y - b.y) < EPS && Math.abs(b.y - c.y) < EPS);
    if (collinear) out.splice(i, 1); else i += 1;
  }
  return out;
}

// Emits the path, replacing each interior corner with a quadratic sweep. The
// radius is clamped to half of the shorter of the two segments meeting at
// that corner, so short runs degrade to a tighter curve instead of
// overshooting past the next waypoint.
function toPath(points, radius = RADIUS) {
  if (points.length < 2) return '';
  let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;

  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1], cur = points[i], next = points[i + 1];
    const inLen = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const outLen = Math.hypot(next.x - cur.x, next.y - cur.y);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    if (r < 1) { d += ` L${cur.x.toFixed(1)},${cur.y.toFixed(1)}`; continue; }

    const t1 = { x: cur.x + ((prev.x - cur.x) / inLen) * r, y: cur.y + ((prev.y - cur.y) / inLen) * r };
    const t2 = { x: cur.x + ((next.x - cur.x) / outLen) * r, y: cur.y + ((next.y - cur.y) / outLen) * r };
    d += ` L${t1.x.toFixed(1)},${t1.y.toFixed(1)}`;
    d += ` Q${cur.x.toFixed(1)},${cur.y.toFixed(1)} ${t2.x.toFixed(1)},${t2.y.toFixed(1)}`;
  }

  const last = points[points.length - 1];
  d += ` L${last.x.toFixed(1)},${last.y.toFixed(1)}`;
  return d;
}

// The waypoints between the two stub ends.
//
// The subtlety here is that a stub is a DIRECTION, not just a point. Picking
// the waypoints by midpoint alone produces a path whose first segment runs
// back along the stub -- and because that doubled-back segment is collinear
// with the stub, the cleanup pass then deletes the stub entirely and the wire
// leaves the port heading the wrong way, straight back across its own device.
// That was the odd long detour on the canvas. So each case checks whether the
// natural shape actually continues in the stub's direction, and picks the
// other shape when it does not.
function elbow(pOut, sOut, pIn, sIn) {
  // Shape A turns once: straight out along the vertical stub, then across
  // into the port. It is the shorter, cleaner path -- but it is only correct
  // when it leaves pOut in the stub's direction AND reaches pIn from the
  // side that port actually faces.
  const leavesCorrectly = (pIn.y - pOut.y) * outward(sOut) >= 0;
  const arrivesCorrectly = (pOut.x - pIn.x) * outward(sIn) >= 0;
  if (leavesCorrectly && arrivesCorrectly) return [{ x: pOut.x, y: pIn.y }];
  // Shape B runs out along the stub's lane, crosses, and comes back into the
  // port along its own stub. Both stubs survive as real segments, so the wire
  // always enters and leaves on the correct face of each device.
  return [{ x: pIn.x, y: pOut.y }];
}

function between(p1, s1, p2, s2) {
  const v1 = isVertical(s1), v2 = isVertical(s2);

  if (!v1 && !v2) {
    // Both horizontal. A shared mid-column works when the two stubs face each
    // other; when they point away from each other, that column would sit
    // behind both ports, so drop into a shared row instead and go around.
    const facing = (p2.x - p1.x) * outward(s1) >= 0 && (p1.x - p2.x) * outward(s2) >= 0;
    if (facing) {
      const midX = (p1.x + p2.x) / 2;
      return [{ x: midX, y: p1.y }, { x: midX, y: p2.y }];
    }
    const midY = (p1.y + p2.y) / 2;
    return [{ x: p1.x, y: midY }, { x: p2.x, y: midY }];
  }

  if (v1 && v2) {
    const facing = (p2.y - p1.y) * outward(s1) >= 0 && (p1.y - p2.y) * outward(s2) >= 0;
    if (facing) {
      const midY = (p1.y + p2.y) / 2;
      return [{ x: p1.x, y: midY }, { x: p2.x, y: midY }];
    }
    const midX = (p1.x + p2.x) / 2;
    return [{ x: midX, y: p1.y }, { x: midX, y: p2.y }];
  }

  if (v1) return elbow(p1, s1, p2, s2);
  // Mirror image: solve it from p2's end and read the waypoints backwards.
  return elbow(p2, s2, p1, s1).reverse();
}

export function routeWire(a, aSide, b, bSide) {
  const s1 = aSide || 'bottom';
  const s2 = bSide || 'bottom';
  const p1 = stubPoint(a, s1);
  const p2 = stubPoint(b, s2);
  return toPath(clean([a, p1, ...between(p1, s1, p2, s2), p2, b]));
}

// The preview line that follows the cursor while a connection is in progress.
// It only knows where the wire starts, so it gets the source stub and then
// heads straight for the pointer.
export function routeGhost(a, aSide, cursor) {
  const s1 = aSide || 'bottom';
  const p1 = stubPoint(a, s1);
  const mid = isVertical(s1)
    ? [{ x: p1.x, y: cursor.y }]
    : [{ x: p1.x + (cursor.x - p1.x) / 2, y: p1.y }, { x: p1.x + (cursor.x - p1.x) / 2, y: cursor.y }];
  return toPath(clean([a, p1, ...mid, cursor]), 10);
}
