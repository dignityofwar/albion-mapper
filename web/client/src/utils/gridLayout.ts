import type { Connection } from 'shared';

export interface NodePosition {
  id: string;
  x: number;
  y: number;
}

/**
 * Computes grid node positions for the graph.
 */
export function gridLayout(homeZoneId: string, connections: Connection[]): NodePosition[] {
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

  // 2. BFS for placement
  const queue: { id: string; x: number; y: number }[] = [];
  queue.push({ id: homeZoneId, x: 0, y: 0 });

  const visited = new Set<string>();
  visited.add(homeZoneId);

  while (queue.length > 0) {
    const { id, x, y } = queue.shift()!;
    const neighbors = [...(adj.get(id) ?? [])];
    const unvisited = neighbors.filter(n => !visited.has(n));

    // Arrange unvisited neighbors
    unvisited.forEach((neighborId, i) => {
      visited.add(neighborId);
      
      // Simple grid placement logic
      // In a real grid, we'd need to be smarter about collisions.
      let newX = x + (id === homeZoneId ? (i % 2 === 0 ? 300 : -300) : (x > 0 ? 300 : -300));
      let newY = y + (id === homeZoneId ? 0 : -(i + 1) * 150); // Just spreading
      
      // Check for collisions and shift
      while (Array.from(positions.values()).some(p => p.x === newX && p.y === newY)) {
        newY -= 150;
      }
      
      positions.set(neighborId, { id: neighborId, x: newX, y: newY });
      queue.push({ id: neighborId, x: newX, y: newY });
    });
  }

  return [...positions.values()];
}
