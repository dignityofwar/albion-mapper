import type { Connection } from 'shared';

export function treeQuery(
  connectionId: string,
  connections: Connection[],
  queryType: 'ancestors' | 'descendants'
): Connection[] {
  const current = connections.find((c) => c.id === connectionId);
  if (!current) return [];

  const results: Connection[] = [];

  if (queryType === 'ancestors') {
    // Find all connections that end at the current connection's start
    const parents = connections.filter((c) => c.toZoneId === current.fromZoneId);

    for (const parent of parents) {
      results.push(parent);
      results.push(...treeQuery(parent.id, connections, 'ancestors'));
    }
  } else if (queryType === 'descendants') {
    // Find all connections that start at the current connection's end
    const children = connections.filter((c) => c.fromZoneId === current.toZoneId);

    for (const child of children) {
      results.push(child);
      results.push(...treeQuery(child.id, connections, 'descendants'));
    }
  }

  return results;
}
