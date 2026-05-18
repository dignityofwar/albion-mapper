import type { CustomHandle, ZoneType } from './types.js';

export interface HandleDefinition {
  id: string;
  left: string;
  top: string;
}

export function getDefaultHandles(type: ZoneType, shape?: string): CustomHandle[] {
  if (type === 'roadsHideout') {
    return [
      { id: 'n', left: '75%', top: '25%' },
      { id: 'e', left: '75%', top: '75%' },
      { id: 's', left: '25%', top: '75%' },
      { id: 'w', left: '25%', top: '25%' },
    ];
  }
  if (shape) {
    return getShapeHandlePositions(shape);
  }
  return [];
}

export const DEFAULT_INTERNAL_HANDLES: CustomHandle[] = [];

export function getHandleFacing(left: string, top: string): string {
  const l = parseFloat(left);
  const t = parseFloat(top);
  
  // Points
  if (Math.abs(l - 50) < 0.1 && Math.abs(t - 0) < 0.1) return 'n';
  if (Math.abs(l - 100) < 0.1 && Math.abs(t - 50) < 0.1) return 'e';
  if (Math.abs(l - 50) < 0.1 && Math.abs(t - 100) < 0.1) return 's';
  if (Math.abs(l - 0) < 0.1 && Math.abs(t - 50) < 0.1) return 'w';

  // Sides
  if (l >= 50 && t < 50) return 'ne';
  if (l > 50 && t >= 50) return 'se';
  if (l <= 50 && t > 50) return 'sw';
  return 'nw';
}

export function getOppositeHandleId(handleId: string | null | undefined): string | undefined {
  if (!handleId) return undefined;
  if (handleId === 'default-nw') return 'default-se';
  if (handleId === 'default-se') return 'default-nw';
  if (handleId === 'default-ne') return 'default-sw';
  if (handleId === 'default-sw') return 'default-ne';
  
  if (handleId === 'top') return 'default-se';
  if (handleId === 'bottom') return 'default-nw';
  if (handleId === 'left') return 'default-ne';
  if (handleId === 'right') return 'default-sw';
  
  if (handleId === 'n') return 's';
  if (handleId === 's') return 'n';
  if (handleId === 'e') return 'w';
  if (handleId === 'w') return 'e';
  
  return undefined;
}

export function getShapeHandlePositions(shape: string | undefined): HandleDefinition[] {
  if (shape === 'c') {
    return [
      { id: 'c-p1', left: '35.60%', top: '14.40%' },
      { id: 'c-p2', left: '11.40%', top: '38.60%' },
      { id: 'c-p3', left: '16.99%', top: '66.99%' },
      { id: 'c-p4', left: '32.00%', top: '82.00%' },
      { id: 'c-p5', left: '68.80%', top: '81.20%' },
      { id: 'c-p6', left: '85.60%', top: '64.40%' },
    ];
  }
  if (shape === 'f') {
    return [
      { id: 'f-p1', left: '21.20%', top: '28.80%' },
      { id: 'f-p2', left: '36.60%', top: '13.40%' },
      { id: 'f-p3', left: '76.40%', top: '26.40%' },
      { id: 'f-p4', left: '87.40%', top: '37.40%' },
      { id: 'f-p5', left: '70.80%', top: '79.20%' },
      { id: 'f-p6', left: '13.20%', top: '63.20%' },
    ];
  }

  if (shape === 'h') {
    return [
      { id: 'h-p1', left: '10.00%', top: '40.00%' },
      { id: 'h-p2', left: '35.40%', top: '14.60%' },
      { id: 'h-p3', left: '73.00%', top: '23.00%' },
      { id: 'h-p4', left: '85.20%', top: '64.80%' },
      { id: 'h-p5', left: '60.20%', top: '89.80%' },
      { id: 'h-p6', left: '23.00%', top: '73.00%' },
    ];
  }

  if (shape === 'o') {
    return [
      { id: 'o-p1', left: '44.34%', top: '5.66%' },
      { id: 'o-p2', left: '8.40%', top: '41.60%' },
      { id: 'o-p3', left: '17.38%', top: '67.38%' },
      { id: 'o-p4', left: '58.01%', top: '91.99%' },
      { id: 'o-p5', left: '91.21%', top: '58.79%' },
      { id: 'o-p6', left: '83.40%', top: '33.40%' },
    ];
  }

  if (shape === 'p') {
    return [
      { id: 'p-p1', left: '54.88%', top: '4.88%' },
      { id: 'p-p2', left: '73.63%', top: '23.63%' },
      { id: 'p-p3', left: '63.09%', top: '86.91%' },
      { id: 'p-p4', left: '27.15%', top: '77.15%' },
      { id: 'p-p5', left: '7.23%', top: '57.23%' },
      { id: 'p-p6', left: '25.98%', top: '24.02%' },
    ];
  }

  if (shape === 't') {
    return [
      { id: 't-p1', left: '27.93%', top: '77.93%' },
      { id: 't-p2', left: '6.84%', top: '56.84%' },
      { id: 't-p3', left: '53.71%', top: '96.29%' },
      { id: 't-p4', left: '21.68%', top: '28.32%' },
      { id: 't-p5', left: '88.87%', top: '61.13%' },
      { id: 't-p6', left: '79.88%', top: '29.88%' },
    ];
  }

  if (shape === 'x') {
    return [
      { id: 'x-p1', left: '26.56%', top: '23.44%' },
      { id: 'x-p2', left: '23.83%', top: '73.83%' },
      { id: 'x-p3', left: '36.33%', top: '86.33%' },
      { id: 'x-p4', left: '78.52%', top: '71.48%' },
      { id: 'x-p5', left: '78.13%', top: '28.13%' },
      { id: 'x-p6', left: '67.19%', top: '17.19%' },
    ];
  }

  return [];
}
