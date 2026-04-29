/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.addColumn('connections', {
    from_handle_id: { type: 'text' },
    to_handle_id: { type: 'text' },
  });
};

export const down = (pgm) => {
  pgm.dropColumn('connections', ['from_handle_id', 'to_handle_id']);
};
