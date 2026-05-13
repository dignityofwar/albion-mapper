/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.createTable('room_node_memory', {
    room_id: {
      type: 'text',
      notNull: true,
      references: '"rooms"',
      onDelete: 'CASCADE',
    },
    zone_id: { type: 'text', notNull: true },
    times_added: { type: 'timestamptz[]', notNull: true, default: '{}' },
    features: { type: 'jsonb' },
    custom_handles: { type: 'jsonb' },
    last_updated: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.addConstraint('room_node_memory', 'room_node_memory_pk', {
    primaryKey: ['room_id', 'zone_id'],
  });

  pgm.createIndex('room_node_memory', 'room_id', { name: 'idx_room_node_memory_room' });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable('room_node_memory');
};
