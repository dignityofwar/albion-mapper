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

export function getConnectionPath(params: PathParams): [string, number, number, number, number] {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, sourceHandleId, targetHandleId, forceStraight } = params;

  // Prefer handle ID for fine-grained facing if available
  const getFacing = (pos: string | Position, handleId?: string | null) => {
    if (handleId) {
      if (handleId === 'n' || handleId.endsWith('-n')) return 'n';
      if (handleId === 'e' || handleId.endsWith('-e')) return 'e';
      if (handleId === 's' || handleId.endsWith('-s')) return 's';
      if (handleId === 'w' || handleId.endsWith('-w')) return 'w';
      if (handleId.endsWith('-ne')) return 'ne';
      if (handleId.endsWith('-se')) return 'se';
      if (handleId.endsWith('-sw')) return 'sw';
      if (handleId.endsWith('-nw')) return 'nw';
      
      // Points for default shapes
      if (handleId.endsWith('-top')) return 'n';
      if (handleId.endsWith('-right')) return 'e';
      if (handleId.endsWith('-bottom')) return 's';
      if (handleId.endsWith('-left')) return 'w';
    }

    if (pos === Position.Top) return 'n';
    if (pos === Position.Bottom) return 's';
    if (pos === Position.Left) return 'w';
    if (pos === Position.Right) return 'e';

    return pos as string;
  };

  const sourceFacing = getFacing(sourcePosition, sourceHandleId);
  const targetFacing = getFacing(targetPosition, targetHandleId);

  if (forceStraight || targetHandleId === 'center' || sourceHandleId === 'center') {
    const path = `M${sourceX},${sourceY} L${targetX},${targetY}`;
    return [
      path,
      (sourceX + targetX) / 2,
      (sourceY + targetY) / 2,
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
    
    // Curvature scales slightly with distance, but capped
    const curvature = Math.min(distance * 0.25, 50);
    
    const c0x = sourceX + Math.cos(sourceAngle) * curvature;
    const c0y = sourceY + Math.sin(sourceAngle) * curvature;
    
    const c1x = targetX + Math.cos(targetAngle) * curvature;
    const c1y = targetY + Math.sin(targetAngle) * curvature;
    
    const path = `M${sourceX},${sourceY} C${c0x},${c0y} ${c1x},${c1y} ${targetX},${targetY}`;
    
    return [
      path,
      (sourceX + targetX) / 2,
      (sourceY + targetY) / 2,
      0, 0
    ];
  }

  // Fallback to default Bezier for center handle or other positions
  return getBezierPath({
    ...params,
    sourcePosition: params.sourcePosition as Position,
    targetPosition: params.targetPosition as Position,
  });
}
