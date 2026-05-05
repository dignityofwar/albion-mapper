export const up = (pgm) => {
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

export const down = (pgm) => {
  pgm.dropIndex('rooms', 'vanity_url', { name: 'idx_rooms_vanity_url' });
  pgm.dropColumn('rooms', 'vanity_url');
};
