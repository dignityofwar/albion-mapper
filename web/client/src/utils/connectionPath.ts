import { getBezierPath, Position } from '@vue-flow/core';

export interface PathParams {
  sourceX: number;
  sourceY: number;
  sourcePosition: Position | string;
  targetX: number;
  targetY: number;
  targetPosition: Position | string;
  sourceHandleId?: string | null;
  targetHandleId?: string | null;
  forceStraight?: boolean;
}

/**
 * Maps Vue Flow Position (including custom strings) to the outward normal angle (in radians) of our diamond edges/points.
 */
const angleMap: Record<string, number> = {
  // Diagonals (Edges)
  'ne': -Math.PI / 4,
  'se': Math.PI / 4,
  'sw': (3 * Math.PI) / 4,
  'nw': (-3 * Math.PI) / 4,
  // Points
  'n': -Math.PI / 2,
  'e': 0,
  's': Math.PI / 2,
  'w': Math.PI,
  
  // Vue Flow standard positions (mapped to our diagonals)
  [Position.Top]: -Math.PI / 4,
  [Position.Right]: Math.PI / 4,
  [Position.Bottom]: (3 * Math.PI) / 4,
  [Position.Left]: (-3 * Math.PI) / 4,
};

/** Evaluate a cubic bezier at parameter t */
function cubicBezierAt(x0: number, y0: number, cx0: number, cy0: number, cx1: number, cy1: number, x1: number, y1: number, t: number): [number, number] {
  const mt = 1 - t;
  return [
    mt*mt*mt*x0 + 3*mt*mt*t*cx0 + 3*mt*t*t*cx1 + t*t*t*x1,
    mt*mt*mt*y0 + 3*mt*mt*t*cy0 + 3*mt*t*t*cy1 + t*t*t*y1,
  ];
}

/**
 * Find the t value on a cubic bezier that is approximately `targetDist` pixels
 * from the start (t=0). Uses a simple linear search with small steps.
 */
function tAtArcLength(
  x0: number, y0: number, cx0: number, cy0: number,
  cx1: number, cy1: number, x1: number, y1: number,
  targetDist: number
): number {
  const steps = 100;
  let accumulated = 0;
  let prevX = x0, prevY = y0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const [cx, cy] = cubicBezierAt(x0, y0, cx0, cy0, cx1, cy1, x1, y1, t);
    const segLen = Math.sqrt((cx - prevX) ** 2 + (cy - prevY) ** 2);
    accumulated += segLen;
    if (accumulated >= targetDist) return t;
    prevX = cx; prevY = cy;
  }
  return 1;
}

export function getConnectionPath(params: PathParams): [string, number, number, number, number] {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, sourceHandleId, targetHandleId, forceStraight } = params;

  const isCenter = (id?: string | null) => id === 'center' || id === 'center-overlay';

  // Prefer position string if it's already a known facing direction
  const knownFacings = new Set(['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']);
  const getFacing = (pos: string | Position, handleId?: string | null) => {
    // If pos is already a resolved facing direction, trust it directly
    if (knownFacings.has(pos as string)) return pos as string;

    if (pos === Position.Top) return 'n';
    if (pos === Position.Bottom) return 's';
    if (pos === Position.Left) return 'w';
    if (pos === Position.Right) return 'e';

    // Fall back to handle ID suffix
    if (handleId) {
      if (handleId === 'n' || handleId.endsWith('-n')) return 'n';
      if (handleId === 'e' || handleId.endsWith('-e')) return 'e';
      if (handleId === 's' || handleId.endsWith('-s')) return 's';
      if (handleId === 'w' || handleId.endsWith('-w')) return 'w';
      if (handleId.endsWith('-ne')) return 'ne';
      if (handleId.endsWith('-se')) return 'se';
      if (handleId.endsWith('-sw')) return 'sw';
      if (handleId.endsWith('-nw')) return 'nw';
      if (handleId.endsWith('-top')) return 'n';
      if (handleId.endsWith('-right')) return 'e';
      if (handleId.endsWith('-bottom')) return 's';
      if (handleId.endsWith('-left')) return 'w';
    }

    return pos as string;
  };

  const sourceFacing = getFacing(sourcePosition, sourceHandleId);
  const targetFacing = getFacing(targetPosition, targetHandleId);

  if (forceStraight) {
    const path = `M${sourceX},${sourceY} L${targetX},${targetY}`;
    return [
      path,
      (sourceX + targetX) / 2,
      (sourceY + targetY) / 2,
      0, 0
    ];
  }

  // For handle -> center connections, use a Bezier that exits the source naturally
  if (isCenter(targetHandleId) || isCenter(sourceHandleId)) {
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const curvature = 50;

    const sourceAngleForCenter = angleMap[sourceFacing];

    // For a center target, compute the exact angle from target toward source so the
    // curve always arrives from the current source direction as nodes are moved.
    let targetAngleForCenter: number;
    if (isCenter(targetHandleId)) {
      // Use the exact angle from target toward source (no snapping)
      targetAngleForCenter = Math.atan2(sourceY - targetY, sourceX - targetX);
    } else {
      targetAngleForCenter = angleMap[targetFacing];
    }

    let c0x: number, c0y: number, c1x: number, c1y: number;

    if (sourceAngleForCenter !== undefined) {
      c0x = sourceX + Math.cos(sourceAngleForCenter) * curvature;
      c0y = sourceY + Math.sin(sourceAngleForCenter) * curvature;
    } else {
      c0x = sourceX + dx * 0.25;
      c0y = sourceY + dy * 0.25;
    }

    if (targetAngleForCenter !== undefined) {
      c1x = targetX + Math.cos(targetAngleForCenter) * curvature;
      c1y = targetY + Math.sin(targetAngleForCenter) * curvature;
    } else {
      c1x = targetX - dx * 0.25;
      c1y = targetY - dy * 0.25;
    }

    const path = `M${sourceX},${sourceY} C${c0x},${c0y} ${c1x},${c1y} ${targetX},${targetY}`;

    // Place the pill at a fixed 60px offset from the source; if source is center or line is short, use midpoint.
    const labelPos = (isCenter(sourceHandleId) || distance < 120)
      ? cubicBezierAt(sourceX, sourceY, c0x, c0y, c1x, c1y, targetX, targetY, 0.5)
      : cubicBezierAt(sourceX, sourceY, c0x, c0y, c1x, c1y, targetX, targetY,
          tAtArcLength(sourceX, sourceY, c0x, c0y, c1x, c1y, targetX, targetY, 60));
    return [
      path,
      labelPos[0],
      labelPos[1],
      0, 0
    ];
  }

  const sourceAngle = angleMap[sourceFacing];
  const targetAngle = angleMap[targetFacing];

  // If both are recognized diagonal positions, use custom Bezier exit/entry angles
  if (sourceAngle !== undefined && targetAngle !== undefined) {
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;

    const distance = Math.sqrt(dx * dx + dy * dy);
    const curvature = 50;
    
    const c0x = sourceX + Math.cos(sourceAngle) * curvature;
    const c0y = sourceY + Math.sin(sourceAngle) * curvature;
    
    // Target control point pushes outward along the target's facing direction
    // (the curve arrives from outside the handle, approaching inward)
    const c1x = targetX + Math.cos(targetAngle) * curvature;
    const c1y = targetY + Math.sin(targetAngle) * curvature;
    
    const path = `M${sourceX},${sourceY} C${c0x},${c0y} ${c1x},${c1y} ${targetX},${targetY}`;

    // Place the pill at a fixed 40px offset from the source; if line is short, use midpoint.
    const [slx, sly] = distance < 120
      ? cubicBezierAt(sourceX, sourceY, c0x, c0y, c1x, c1y, targetX, targetY, 0.5)
      : cubicBezierAt(sourceX, sourceY, c0x, c0y, c1x, c1y, targetX, targetY,
          tAtArcLength(sourceX, sourceY, c0x, c0y, c1x, c1y, targetX, targetY, 60));
    return [
      path,
      slx,
      sly,
      0, 0
    ];
  }

  // Fallback to default Bezier for center handle or other positions
  const fallbackDistance = Math.sqrt((targetX - sourceX) ** 2 + (targetY - sourceY) ** 2);
  const [fallbackPath] = getBezierPath({
    ...params,
    sourcePosition: params.sourcePosition as Position,
    targetPosition: params.targetPosition as Position,
  });
  // Place pill at a fixed 60px offset from source along the straight line; if source is center or line is short, use midpoint
  const flt = (isCenter(sourceHandleId) || fallbackDistance < 120) ? 0.5 : Math.min(60 / fallbackDistance, 0.5);
  return [
    fallbackPath,
    sourceX + (params.targetX - sourceX) * flt,
    sourceY + (params.targetY - sourceY) * flt,
    0, 0,
  ];
}
