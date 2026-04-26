import type { Connection } from 'shared';

export interface NodePosition {
  id: string;
  x: number;
  y: number;
}

const RADIUS_1 = 220; // direct neighbours
const RADIUS_2 = 440; // second-degree neighbours

/**
 * Computes radial node positions for the graph.
 * Home zone is at (0,0). Direct neighbours at radius 220,
 * second-degree at radius 440.
 */
export function radialLayout(homeZoneId: string, connections: Connection[]): NodePosition[] {
  const positions = new Map<string, NodePosition>();
  positions.set(homeZoneId, { id: homeZoneId, x: 0, y: 0 });

  // Gather direct neighbours of home zone
  const directNeighbours = new Set<string>();
  for (const conn of connections) {
    if (conn.fromZoneId === homeZoneId) directNeighbours.add(conn.toZoneId);
    else if (conn.toZoneId === homeZoneId) directNeighbours.add(conn.fromZoneId);
  }

  const directArr = [...directNeighbours];
  directArr.forEach((zoneId, i) => {
    const angle = (2 * Math.PI * i) / directArr.length;
    positions.set(zoneId, {
      id: zoneId,
      x: RADIUS_1 * Math.cos(angle),
      y: RADIUS_1 * Math.sin(angle),
    });
  });

  // Gather second-degree neighbours (connected to direct neighbours, not yet placed)
  const secondDegree = new Map<string, string>(); // zoneId → parent (direct neighbour)
  for (const conn of connections) {
    const { fromZoneId, toZoneId } = conn;
    if (directNeighbours.has(fromZoneId) && !positions.has(toZoneId) && toZoneId !== homeZoneId) {
      secondDegree.set(toZoneId, fromZoneId);
    }
    if (directNeighbours.has(toZoneId) && !positions.has(fromZoneId) && fromZoneId !== homeZoneId) {
      secondDegree.set(fromZoneId, toZoneId);
    }
  }

  // Group second-degree nodes by parent
  const byParent = new Map<string, string[]>();
  for (const [zoneId, parent] of secondDegree) {
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent)!.push(zoneId);
  }

  for (const [parent, children] of byParent) {
    const parentPos = positions.get(parent)!;
    const parentAngle = Math.atan2(parentPos.y, parentPos.x);

    // Spread children around the parent's radial direction
    const spread = Math.PI / 4;
    children.forEach((childId, i) => {
      const offset = children.length === 1 ? 0 : -spread / 2 + (spread * i) / (children.length - 1);
      const angle = parentAngle + offset;
      positions.set(childId, {
        id: childId,
        x: RADIUS_2 * Math.cos(angle),
        y: RADIUS_2 * Math.sin(angle),
      });
    });
  }

  return [...positions.values()];
}
