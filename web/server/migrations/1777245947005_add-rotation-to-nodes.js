/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.addColumn('room_node_positions', {
    rotation: { type: 'integer', default: 0 },
  });
  pgm.addColumn('room_node_memory', {
    rotation: { type: 'integer', default: 0 },
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropColumn('room_node_positions', 'rotation');
  pgm.dropColumn('room_node_memory', 'rotation');
};
