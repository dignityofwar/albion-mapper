/**
 * The city is spelled "Brecilien" in game; the catalogue carried "Brecillien",
 * so its zone id changes. Existing rows reference the old id and would orphan —
 * including at least one room's home zone — so they are rewritten here.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  rewrite(pgm, 'brecillien', 'brecilien');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  rewrite(pgm, 'brecilien', 'brecillien');
};

function rewrite(pgm, from, to) {
  pgm.sql(`UPDATE rooms SET home_zone_id = '${to}' WHERE home_zone_id = '${from}'`);
  pgm.sql(`UPDATE rooms SET plotted_route_from_zone_id = '${to}' WHERE plotted_route_from_zone_id = '${from}'`);
  pgm.sql(`UPDATE rooms SET plotted_route_to_zone_id = '${to}' WHERE plotted_route_to_zone_id = '${from}'`);
  pgm.sql(`UPDATE connections SET from_zone_id = '${to}' WHERE from_zone_id = '${from}'`);
  pgm.sql(`UPDATE connections SET to_zone_id = '${to}' WHERE to_zone_id = '${from}'`);
  pgm.sql(`UPDATE room_chains SET source_zone_id = '${to}' WHERE source_zone_id = '${from}'`);
  pgm.sql(`UPDATE room_node_positions SET zone_id = '${to}' WHERE zone_id = '${from}'`);
  pgm.sql(`UPDATE room_node_memory SET zone_id = '${to}' WHERE zone_id = '${from}'`);
}
