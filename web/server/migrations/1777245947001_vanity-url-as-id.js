export const up = (pgm) => {
  // Drop foreign key constraints referencing rooms.id
  pgm.dropConstraint('connections', 'connections_room_id_fkey');
  pgm.dropConstraint('room_node_positions', 'room_node_positions_room_id_fkey');

  // Drop the vanity_url unique index before renaming
  pgm.dropIndex('rooms', 'vanity_url', { name: 'idx_rooms_vanity_url' });

  // Update foreign key columns in child tables BEFORE changing rooms.id
  pgm.sql(`
    UPDATE connections c
    SET room_id = r.vanity_url
    FROM rooms r
    WHERE c.room_id = r.id AND r.vanity_url IS NOT NULL
  `);
  pgm.sql(`
    UPDATE room_node_positions n
    SET room_id = r.vanity_url
    FROM rooms r
    WHERE n.room_id = r.id AND r.vanity_url IS NOT NULL
  `);

  // Now copy vanity_url into id (child tables already point to the new value)
  pgm.sql('UPDATE rooms SET id = vanity_url WHERE vanity_url IS NOT NULL');

  // Drop the vanity_url column (it is now redundant — id holds the value)
  pgm.dropColumn('rooms', 'vanity_url');

  // Re-add foreign key constraints now that ids are consistent
  pgm.addConstraint('connections', 'connections_room_id_fkey', {
    foreignKeys: {
      columns: 'room_id',
      references: 'rooms(id)',
      onDelete: 'CASCADE',
    },
  });
  pgm.addConstraint('room_node_positions', 'room_node_positions_room_id_fkey', {
    foreignKeys: {
      columns: 'room_id',
      references: 'rooms(id)',
      onDelete: 'CASCADE',
    },
  });
};

export const down = (pgm) => {
  // Re-add vanity_url column
  pgm.addColumn('rooms', {
    vanity_url: {
      type: 'varchar(100)',
      notNull: false,
      unique: true,
    },
  });

  pgm.createIndex('rooms', 'vanity_url', {
    name: 'idx_rooms_vanity_url',
    unique: true,
    where: 'vanity_url IS NOT NULL',
  });
};
