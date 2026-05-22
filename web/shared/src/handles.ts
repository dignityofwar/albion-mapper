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

export function getHandleFacing(left: string, top: string): string {
  const l = Number.parseFloat(left);
  const t = Number.parseFloat(top);
  
  // Points
  if (Math.abs(l - 50) < 0.1 && Math.abs(t) < 0.1) return 'n';
  if (Math.abs(l - 100) < 0.1 && Math.abs(t - 50) < 0.1) return 'e';
  if (Math.abs(l - 50) < 0.1 && Math.abs(t - 100) < 0.1) return 's';
  if (Math.abs(l) < 0.1 && Math.abs(t - 50) < 0.1) return 'w';

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
      { id: 'c-p1', left: '36.40%', top: '13.60%' },
      { id: 'c-p2', left: '11.80%', top: '38.20%' },
      { id: 'c-p3', left: '17.80%', top: '67.80%' },
      { id: 'c-p4', left: '32.00%', top: '82.00%' },
      { id: 'c-p5', left: '68.60%', top: '81.40%' },
      { id: 'c-p6', left: '86.00%', top: '64.00%' },
    ];
  }
  if (shape === 'f') {
    return [
      { id: 'f-p1', left: '21.60%', top: '28.40%' },
      { id: 'f-p2', left: '37.00%', top: '13.00%' },
      { id: 'f-p3', left: '77.20%', top: '27.20%' },
      { id: 'f-p4', left: '87.40%', top: '37.40%' },
      { id: 'f-p5', left: '70.80%', top: '79.20%' },
      { id: 'f-p6', left: '13.60%', top: '63.60%' },
    ];
  }

  if (shape === 'h') {
    return [
      { id: 'h-p1', left: '11.00%', top: '39.00%' },
      { id: 'h-p2', left: '35.40%', top: '14.60%' },
      { id: 'h-p3', left: '73.00%', top: '23.00%' },
      { id: 'h-p4', left: '85.20%', top: '64.80%' },
      { id: 'h-p5', left: '59.60%', top: '90.40%' },
      { id: 'h-p6', left: '23.00%', top: '73.00%' },
    ];
  }

  if (shape === 'o') {
    return [
      { id: 'o-p1', left: '62.00%', top: '12.00%' },
      { id: 'o-p2', left: '88.80%', top: '61.20%' },
      { id: 'o-p3', left: '68.60%', top: '81.40%' },
      { id: 'o-p4', left: '38.80%', top: '88.80%' },
      { id: 'o-p5', left: '12.00%', top: '62.00%' },
      { id: 'o-p6', left: '31.20%', top: '18.80%' },
    ];
  }

  if (shape === 'p') {
    return [
      { id: 'p-p1', left: '61.20%', top: '11.20%' },
      { id: 'p-p2', left: '76.00%', top: '26.00%' },
      { id: 'p-p3', left: '64.80%', top: '85.20%' },
      { id: 'p-p4', left: '25.20%', top: '75.20%' },
      { id: 'p-p5', left: '11.20%', top: '61.20%' },
      { id: 'p-p6', left: '26.00%', top: '24.00%' },
    ];
  }

  if (shape === 's') {
    return [
      { id: 's-p1', left: '73.20%', top: '23.20%' },
      { id: 's-p2', left: '87.80%', top: '62.20%' },
      { id: 's-p3', left: '70.80%', top: '79.20%' },
      { id: 's-p4', left: '22.20%', top: '72.20%' },
      { id: 's-p5', left: '10.20%', top: '39.80%' },
      { id: 's-p6', left: '32.20%', top: '17.80%' },
    ];
  }

  if (shape === 't') {
    return [
      { id: 't-p1', left: '73.20%', top: '23.20%' },
      { id: 't-p2', left: '88.20%', top: '61.80%' },
      { id: 't-p3', left: '77.00%', top: '73.00%' },
      { id: 't-p4', left: '23.80%', top: '73.80%' },
      { id: 't-p5', left: '10.20%', top: '39.80%' },
      { id: 't-p6', left: '38.40%', top: '11.60%' },
    ];
  }

  if (shape === 'x') {
    return [
      { id: 'x-p1', left: '25.60%', top: '24.40%' },
      { id: 'x-p2', left: '24.60%', top: '74.60%' },
      { id: 'x-p3', left: '34.60%', top: '84.60%' },
      { id: 'x-p4', left: '74.60%', top: '75.40%' },
      { id: 'x-p5', left: '75.20%', top: '25.20%' },
      { id: 'x-p6', left: '65.80%', top: '15.80%' },
    ];
  }

  return [];
}
