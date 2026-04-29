import { getBezierPath, Position } from '@vue-flow/core';

export interface PathParams {
  sourceX: number;
  sourceY: number;
  sourcePosition: Position;
  targetX: number;
  targetY: number;
  targetPosition: Position;
}

export function getConnectionPath(params: PathParams) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = params;

  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < 1) {
    return getBezierPath(params);
  }

  // Calculate the angle of the straight line in degrees (0 to 180)
  const absAngle = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);

  // Check if the positions are "opposite" (Top-Bottom or Left-Right)
  const isOpposite = 
    (sourcePosition === Position.Top && targetPosition === Position.Bottom) ||
    (sourcePosition === Position.Bottom && targetPosition === Position.Top) ||
    (sourcePosition === Position.Left && targetPosition === Position.Right) ||
    (sourcePosition === Position.Right && targetPosition === Position.Left);

  if (isOpposite) {
    // We want curvature to be 0 at diagonals (45°, 135°)
    // and 20 at orthogonal angles (0°, 90°, 180°)
    
    const diff45 = Math.abs(absAngle - 45);
    const diff135 = Math.abs(absAngle - 135);
    const minDiff = Math.min(diff45, diff135);
    
    // Smoothly transition curvature from 0 (at 45/135 deg) to 20 (at 0/90/180 deg)
    // We use a 22.5 degree range for the transition
    const curvature = Math.min(20, (minDiff / 22.5) * 20);
    
    return getBezierPath({
      ...params,
      curvature
    });
  }

  return getBezierPath(params);
}
