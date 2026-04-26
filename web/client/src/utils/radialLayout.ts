import type { Connection } from 'shared';

export interface NodePosition {
  id: string;
  x: number;
  y: number;
}

/**
 * Computes radial node positions for the graph.
 */
export function radialLayout(homeZoneId: string, connections: Connection[]): NodePosition[] {
  const positions = new Map<string, NodePosition>();
  positions.set(homeZoneId, { id: homeZoneId, x: 0, y: 0 });

  // 1. Build adjacency
  const adj = new Map<string, Set<string>>();
  for (const conn of connections) {
    if (!adj.has(conn.fromZoneId)) adj.set(conn.fromZoneId, new Set());
    if (!adj.has(conn.toZoneId)) adj.set(conn.toZoneId, new Set());
    adj.get(conn.fromZoneId)!.add(conn.toZoneId);
    adj.get(conn.toZoneId)!.add(conn.fromZoneId);
  }

  // 2. Traversal/Placement
  const neighbours = [...(adj.get(homeZoneId) ?? [])];
  
  const neighboursWithSizes = neighbours.map((zoneId) => ({
    zoneId,
    branchSize: getBranchSize(zoneId, homeZoneId, adj, new Set([homeZoneId])),
  }));
  neighboursWithSizes.sort((a, b) => b.branchSize - a.branchSize);
  
  const sortedNeighbours = neighboursWithSizes.map((n) => n.zoneId);
  const branchSizes = neighboursWithSizes.map((n) => n.branchSize);
  const totalDescendants = branchSizes.reduce((sum, size) => sum + size, 0);

  let currentAngle = 0;
  sortedNeighbours.forEach((zoneId, i) => {
    const branchSize = branchSizes[i];
    const angleRange = (branchSize / totalDescendants) * 2 * Math.PI;
    const angle = currentAngle + angleRange / 2;
    currentAngle += angleRange;

    const radius = 300;
    positions.set(zoneId, {
      id: zoneId,
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
    });
    
    // Recurse for children
    placeChildren(zoneId, angle, angleRange, radius, adj, positions);
  });
  
  return [...positions.values()];
}

function getBranchSize(nodeId: string, parentId: string | null, adj: Map<string, Set<string>>, visited: Set<string>): number {
  if (visited.has(nodeId)) return 0;
  const newVisited = new Set(visited);
  newVisited.add(nodeId);

  const neighbors = [...(adj.get(nodeId) ?? [])];
  const children = neighbors.filter(id => id !== parentId);
  return 1 + children.reduce((sum, childId) => sum + getBranchSize(childId, nodeId, adj, newVisited), 0);
}

function placeChildren(parentId: string, parentAngle: number, angularRange: number, parentRadius: number, adj: Map<string, Set<string>>, positions: Map<string, NodePosition>) {
  const children = [...(adj.get(parentId) ?? [])].filter(id => !positions.has(id));
  if (children.length === 0) return;
  
  const childrenWithSizes = children.map(childId => ({
    childId,
    branchSize: getBranchSize(childId, parentId, adj, new Set([parentId])),
  }));
  childrenWithSizes.sort((a, b) => b.branchSize - a.branchSize);
  
  const sortedChildren = childrenWithSizes.map(c => c.childId);
  const sortedBranchSizes = childrenWithSizes.map(c => c.branchSize);
  const totalBranchSize = sortedBranchSizes.reduce((sum, size) => sum + size, 0);
  
  const parentPos = positions.get(parentId)!;
  // Try to constrain the range if children <= 3
  const effectiveAngularRange = children.length <= 3 ? Math.PI / 2 : angularRange;
  
  const radius = parentRadius + 300;
  
  // Shift children above if they are 3 or less
  const offsetShift = children.length <= 3 ? -Math.PI / 2 : 0;
  let currentOffset = -effectiveAngularRange / 2 + offsetShift;
  
  sortedChildren.forEach((childId, i) => {
    const branchSize = sortedBranchSizes[i];
    const childAngularRange = (branchSize / totalBranchSize) * effectiveAngularRange;
    const offset = currentOffset + childAngularRange / 2;
    currentOffset += childAngularRange;

    const angle = parentAngle + offset;
    
    positions.set(childId, {
      id: childId,
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
    });
    
    placeChildren(childId, angle, childAngularRange, radius, adj, positions);
  });
}
