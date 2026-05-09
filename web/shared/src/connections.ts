import { Connection } from './types.js';

export function wouldCreateCycle(
  connections: Connection[],
  fromZoneId: string,
  toZoneId: string
): boolean {
    // Only block direct 2-zone cycles (A→B when B→A already exists)
    return connections.some(c => c.fromZoneId === toZoneId && c.toZoneId === fromZoneId);
}

export function wouldCreateLongerLoop(
  connections: Connection[],
  fromZoneId: string,
  toZoneId: string
): boolean {
    // Detect 3+ zone loops (e.g. A→B→C→A), treating connections as bidirectional
    function canReach(startId: string, targetId: string): boolean {
      const queue = [startId];
      const visited = new Set<string>();

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (current === targetId) return true;
        if (visited.has(current)) continue;
        visited.add(current);

        for (const c of connections) {
          if (c.fromZoneId === current) queue.push(c.toZoneId);
          else if (c.toZoneId === current) queue.push(c.fromZoneId);
        }
      }
      return false;
    }

    // A loop exists if toZoneId can already reach fromZoneId (adding this edge closes the loop)
    return canReach(toZoneId, fromZoneId);
}
