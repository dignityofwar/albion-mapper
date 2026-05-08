import { getDefaultHandles, type ZoneType } from 'shared';

export const isCenter = (id?: string | null) => id === 'center' || id === 'center-overlay';

// Rotation degrees for each facing direction (matches CSS .facing-* classes)
const facingRotationDeg: Record<string, number> = {
  n: 0, ne: 45, e: 90, se: 135, s: 180, sw: 225, w: 270, nw: 315,
};

export function getHandleFacingFromId(handleId: string, node: any): string | null {
  const customHandles: Array<{ id: string; top: string; left: string }> | undefined =
    node.data?.customHandles ?? node.data?.handles;
  if (customHandles) {
    const ch = customHandles.find((h: any) => h.id === handleId);
    if (ch) {
      const l = parseFloat(ch.left);
      const t = parseFloat(ch.top);
      if (Math.abs(l - 50) < 0.1 && Math.abs(t - 0) < 0.1) return 'n';
      if (Math.abs(l - 100) < 0.1 && Math.abs(t - 50) < 0.1) return 'e';
      if (Math.abs(l - 50) < 0.1 && Math.abs(t - 100) < 0.1) return 's';
      if (Math.abs(l - 0) < 0.1 && Math.abs(t - 50) < 0.1) return 'w';
      if (l >= 50 && t < 50) return 'ne';
      if (l > 50 && t >= 50) return 'se';
      if (l <= 50 && t > 50) return 'sw';
      return 'nw';
    }
  }
  const defaultHandles = getDefaultHandles(node.data?.type as ZoneType, node.data?.mapShape);
  const dh = defaultHandles.find((h: any) => h.id === handleId);
  if (dh) {
    const l = parseFloat(dh.left);
    const t = parseFloat(dh.top);
    if (Math.abs(l - 50) < 0.1 && Math.abs(t - 0) < 0.1) return 'n';
    if (Math.abs(l - 100) < 0.1 && Math.abs(t - 50) < 0.1) return 'e';
    if (Math.abs(l - 50) < 0.1 && Math.abs(t - 100) < 0.1) return 's';
    if (Math.abs(l - 0) < 0.1 && Math.abs(t - 50) < 0.1) return 'w';
    if (l >= 50 && t < 50) return 'ne';
    if (l > 50 && t >= 50) return 'se';
    if (l <= 50 && t > 50) return 'sw';
    return 'nw';
  }
  for (const dir of ['ne', 'nw', 'se', 'sw', 'n', 'e', 's', 'w']) {
    if (handleId === dir || handleId.endsWith('-' + dir)) return dir;
  }
  return null;
}

export function getTrueHandleCenter(node: any, handleId: string | null | undefined): { x: number; y: number } | null {
  if (!node) return null;
  if (isCenter(handleId)) {
    const w = node.dimensions?.width ?? 0;
    const h = node.dimensions?.height ?? 0;
    if (w === 0 || h === 0) return null;
    return {
      x: node.computedPosition.x + w / 2,
      y: node.computedPosition.y + h / 2,
    };
  }
  const customHandles = node.data?.customHandles ?? node.data?.handles;
  const defaultHandles = getDefaultHandles(node.data?.type as ZoneType, node.data?.mapShape);
  const allHandleDefs = [...(customHandles ?? []), ...defaultHandles];
  const handleDef = handleId ? allHandleDefs.find((h: any) => h.id === handleId) : null;

  const nodeW = node.dimensions?.width ?? 0;
  const nodeH = node.dimensions?.height ?? 0;

  let cx: number, cy: number;
  if (handleDef) {
    const leftPct = parseFloat(handleDef.left) / 100;
    const topPct = parseFloat(handleDef.top) / 100;
    cx = node.computedPosition.x + leftPct * nodeW;
    cy = node.computedPosition.y + topPct * nodeH;
  } else {
    const allBounds = [...(node.handleBounds?.source ?? []), ...(node.handleBounds?.target ?? [])];
    const handle = handleId ? allBounds.find((h: any) => h.id === handleId) : allBounds[0];
    if (!handle) return null;
    cx = node.computedPosition.x + handle.x + handle.width / 2;
    cy = node.computedPosition.y + handle.y + handle.height / 2;
  }

  const facing = handleId ? getHandleFacingFromId(handleId, node) : null;
  if (facing && facingRotationDeg[facing] !== undefined) {
    const theta = facingRotationDeg[facing] * (Math.PI / 180);
    const r = 20;
    return {
      x: cx + Math.sin(theta) * r,
      y: cy - Math.cos(theta) * r,
    };
  }

  return { x: cx, y: cy };
}
