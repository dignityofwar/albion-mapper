/**
 * The feed carried Tonitos-Uxavrom twice, once with an extra "t" before the
 * "om" suffix, so the catalogue had two ids for one zone and rooms split
 * their history across both. The misspelled id is gone; its rows move to
 * the real one.
 *
 * Rows are deleted rather than moved where the room already holds the real id —
 * room_node_positions and room_node_memory are keyed on (room_id, zone_id), so
 * the move would otherwise violate the primary key.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  const OLD = 'tonitos-uxavrtom';
  const NEW = 'tonitos-uxavrom';

  for (const table of ['room_node_positions', 'room_node_memory']) {
    pgm.sql(`
      DELETE FROM ${table} old
      WHERE old.zone_id = '${OLD}'
        AND EXISTS (SELECT 1 FROM ${table} cur
                    WHERE cur.room_id = old.room_id AND cur.zone_id = '${NEW}')
    `);
    pgm.sql(`UPDATE ${table} SET zone_id = '${NEW}' WHERE zone_id = '${OLD}'`);
  }

  pgm.sql(`UPDATE rooms SET home_zone_id = '${NEW}' WHERE home_zone_id = '${OLD}'`);
  pgm.sql(`UPDATE rooms SET plotted_route_from_zone_id = '${NEW}' WHERE plotted_route_from_zone_id = '${OLD}'`);
  pgm.sql(`UPDATE rooms SET plotted_route_to_zone_id = '${NEW}' WHERE plotted_route_to_zone_id = '${OLD}'`);
  pgm.sql(`UPDATE connections SET from_zone_id = '${NEW}' WHERE from_zone_id = '${OLD}'`);
  pgm.sql(`UPDATE connections SET to_zone_id = '${NEW}' WHERE to_zone_id = '${OLD}'`);
  pgm.sql(`UPDATE room_chains SET source_zone_id = '${NEW}' WHERE source_zone_id = '${OLD}'`);
};

/**
 * The two zones are indistinguishable once merged.
 *
 * @returns {Promise<void> | void}
 */
export const down = () => {};
