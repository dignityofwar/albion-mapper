import { Connection } from './types';

export function wouldCreateCycle(
  connections: Connection[],
  fromZoneId: string,
  toZoneId: string
): boolean {
    const queue = [toZoneId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentZoneId = queue.shift()!;
      if (currentZoneId === fromZoneId) return true;

      if (visited.has(currentZoneId)) continue;
      visited.add(currentZoneId);

      const nextConnections = connections.filter(c => c.fromZoneId === currentZoneId);
      for (const c of nextConnections) {
        queue.push(c.toZoneId);
      }
    }

    return false;
}
