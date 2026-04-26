/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.createTable('rooms', {
    id: { type: 'text', primaryKey: true },
    password_hash: { type: 'text', notNull: true },
    admin_password_hash: { type: 'text', notNull: true },
    home_zone_id: { type: 'text', notNull: true },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    updated_at: { type: 'timestamptz' },
  });

  pgm.createTable('connections', {
    id: { type: 'text', primaryKey: true },
    room_id: {
      type: 'text',
      notNull: true,
      references: '"rooms"',
      onDelete: 'CASCADE',
    },
    from_zone_id: { type: 'text', notNull: true },
    to_zone_id: { type: 'text', notNull: true },
    expires_at: { type: 'timestamptz', notNull: true },
    reported_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    reported_by: { type: 'text' },
  });

  pgm.createTable('room_node_positions', {
    room_id: {
      type: 'text',
      notNull: true,
      references: '"rooms"',
      onDelete: 'CASCADE',
    },
    zone_id: { type: 'text', notNull: true },
    x: { type: 'real', notNull: true },
    y: { type: 'real', notNull: true },
  });
  pgm.addConstraint('room_node_positions', 'room_node_positions_pk', {
    primaryKey: ['room_id', 'zone_id'],
  });

  pgm.createIndex('connections', 'room_id', { name: 'idx_conn_room' });
  pgm.createIndex('room_node_positions', 'room_id', {
    name: 'idx_node_positions_room',
  });
};

export const down = (pgm) => {
  pgm.dropTable('room_node_positions');
  pgm.dropTable('connections');
  pgm.dropTable('rooms');
};
