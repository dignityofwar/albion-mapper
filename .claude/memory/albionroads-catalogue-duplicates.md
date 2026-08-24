---
name: albionroads-catalogue-duplicates
description: "The upstream feed lists some zones twice under one-letter spelling variants; the map screenshot's title bar is the tiebreaker"
metadata: 
  node_type: memory
  type: project
  originSessionId: 076e61b2-2462-4593-8399-165db8b1aa46
  modified: 2026-08-01T18:43:36.238Z
---

The upstream zone feed carries a handful of zones **twice**, under spellings that differ by a
single letter which is ambiguous in the game's font — capital `I` versus lowercase `l`, `F`
versus `H`. Found on 2026-08-01: `Secent-Al-Odetis`/`Secent-AI-Odetis`,
`Hiles-Izizaum`/`Files-Izizaum`, plus `Brecilien`/`Brecillien`. Found on 2026-08-24:
`Tonitos-Uxavrom`/`Tonitos-Uxavrtom` (an extra "t" before the "om" suffix).

**Why:** each duplicate splits rooms' history across two `zone_id`s, so a zone looks less
observed than it is. Worse, a wrong first letter silently produces a wrong **map shape**, because
`ZoneNameParser` derives the shape from it — `Files-Izizaum` rendered as an `f` when the zone is
an `h`. That reads as a shape bug and sends you looking in the wrong place entirely.

**How to apply:** the map screenshot's in-game title bar is the authority on spelling — it settled
all three. To find them, group roads zones by (name suffix, tier) and look for pairs within one
edit of each other; that sweep found no others after these. Fix by adding the losing spelling to
`EXCLUDED_MAP_NAMES`, carrying any `knownFeatures` the excluded entry held onto the survivor via
`MAP_OVERRIDES`, and writing a migration if the dead id appears in the database — delete-then-update
for `room_node_positions` and `room_node_memory`, whose primary key is `(room_id, zone_id)`.
See [[albionroads-gotchas]] and [[albionroads-docs]].
