# Proposal: machine-derived map features, confirmed by humans

**Status:** proposed, not started. **Last updated:** 2026-08-01.

Today a room's map features are whatever a human typed while standing in the zone, usually under
time pressure in a lethal area. This proposes inverting that: publish a machine-derived baseline
for every zone we can, and use humans to *confirm or correct* it rather than to author it.

## Tasks

- Build the icon reader: locate the play area, mask overlay noise, identify each icon type, cluster
  icons into sites, classify each resource site as small or large from the clearing around it.
- Filter overlay noise from icon detection: the toolbar legend outside the play area, player dots
  and glow-backed icons, the hunt-tracking ring, red/black rings, the Brecilien portal icon, and
  power-core icons.
- Investigate the two under-counts (`Huritos-Oiaelos`, `Tebitos-Odoxlum`) — a missed icon is a
  different failure from an over-count and must be understood before the baseline is trusted.
- ~~Resolve the shape disagreements.~~ Done: all 23 weak or contested matches were checked against
  the game and 22 were already labelled correctly. There is no ninth layout. The one failure was a
  duplicate zone, not a wrong shape — see below.
- Produce the reviewed per-zone reference dataset and commit it; keep acquisition tooling and
  cached images out of the repo.
- Add feature counts to `GameMap`, `GameMapSchema`, the `Zone` interface and the shared adapter —
  all four, since the adapter currently drops everything the runtime does not already use.
- Design and build the confirmation/difference schema and its migration from `room_node_memory`.
- Rebuild the per-feature confirmation UI: greyed prefilled value, per-feature confirm control,
  correction path, and the ability to add features the baseline does not know about.
- Write the batch job that enumerates per-(zone, feature) records, compares them against the machine
  baseline, and reports corroborated disagreements for review. Reporting only — nothing acts on its
  output automatically in the first build.
- Implement the promotion rule and a review queue for corroborated corrections.
- *Later session, not now:* derive a corrected value from accumulated deviation data and present it
  as a suggestion. Needs a body of deviation data that does not exist yet.
- ~~Decide the `maps.json` drift question before any regeneration.~~ Done: hand-curated data the
  feed cannot supply now lives in `scripts/manualMaps.ts`, so the catalogue is regenerable again.
- Retire `parseGuaranteedContent`'s chest-suffix rule and the first-letter shape rule once each
  clears its bar.
- Stop `syncMaps.test.ts` duplicating the script's logic; its unit tests currently exercise a copy.
- Research how Avalonian and group dungeons spawn specifically in Roads zones.

## Why

Two zone properties are inferred from the zone's *name*: map shape from the first letter, and
treasure chest type from the last segment (`-los`/`-am`/`-un`). Both rules came from a community
wiki page now believed inaccurate. Measured against evidence:

- The chest-suffix rule disagrees with observed map icons on **21 of 93** roads zones.
- The first-letter shape rule was wrong on **2** zones (`Cieos-Atatlum`, `Cynitos-Atatlum`, both
  ring-shaped despite `C` names). Both are now hardcoded overrides — a rule needing a growing
  exception list is a rule that should be replaced by measurement.

Meanwhile, an image-derived reading of the same zones matches the committed catalogue on **99.6%**
of shapes and, on the 412 zone/feature pairs where two or more rooms independently agreed, matches
human observation **411 times**.

The shape rule survived its full audit: every zone whose layout the matcher could not place
confidently — 23 of them — was checked against the game, and 22 were already correct. So the rule
is not the weak part of the catalogue, and the remaining shape work is a matter of confidence
rather than correctness.

**Duplicate zones are the failure this uncovered instead.** Three zones were in the catalogue twice
under near-identical spellings, each pair differing by one letter that is ambiguous in the game's
font: `Secent-Al-Odetis`/`-AI-`, `Hiles-Izizaum`/`Files-`, and `Brecilien`/`Brecillien`. Each one
split rooms' history across two ids and, in the `Hiles` case, presented as a wrong map shape —
the `F` spelling inherits an `f` layout from its first letter. A sweep for same-suffix, same-tier
names within one edit of each other finds no others.

## Evidence

Human map history: 1,078 genuine observations (excluding app prefill) across 374 zones.

| check | result |
|---|---|
| baseline vs all human observations | 96.9% roads, 97.8% hideout |
| baseline vs zones where 2+ rooms agreed | **363/364 roads, 48/48 hideout** |
| observations where humans disagree with baseline | 5.3% |
| direction of those disagreements | overwhelmingly human **under**-counts |

One spot-check is worth recording because it splits the two candidate sources apart. On
`Secent-Al-Odetis` an in-game reading gives 5 green chests, 1 blue chest and 1 small rock. The
tabulated reference gives 5 green and 1 stone and **no blue chest at all**; the screenshot shows
the blue chest plainly. So the counts in the reference table are reliable but its chest *colours*
are not complete — the argument for reading the images rather than the table that describes them.

Where several humans disagreed with each other, the baseline matched the majority and the outlier
was almost always the low reading — e.g. one zone recorded as 1, 3, 4, 4 where the baseline says 4.
This is the counting-under-fire problem the proposal exists to solve.

### Coverage

| | hideout | non-hideout roads | all roads |
|---|---|---|---|
| zones | 102 | 304 | 406 |
| image baseline | 60 (59%) | 267 (88%) | 327 (81%) |
| human observations | 69 (68%) | 226 (74%) | 295 (73%) |
| **either** | **91 (89%)** | 293 (96%) | **385 (95%)** |
| neither | 11 | 10 | 21 |

Hideouts are not a special case: every hideout image that exists yields features, and the baseline
has never lost to a hideout consensus (48/48).

## Model

Everything below is per **(zone, feature)** — never per zone. A zone is not one fact but several
independent ones, and they are not equally reliable:

| counting | observations | error rate |
|---|---|---|
| 1 of something | 930 | **0.5%** |
| 2 | 244 | 4.9% |
| 3 | 87 | 13.8% |
| 6 | 41 | 12.2% |
| 8 | 17 | 11.8% |

Error rises roughly twentyfold once the count exceeds one. Per feature, green chests run 6.2% error
(they come in large groups) against 0.6% for wood. So in a zone with six green chests and one blue,
the blue is near-certain and the green is the doubtful part — and discarding the zone's data because
of the green would throw away the blue with it. Confirmations, differences and any later aggregate
are therefore all keyed by (zone, feature).

**Baseline** — per zone, the machine-derived permanent features with counts: chests by colour,
resources with small/large split, dungeon markers. Lives in the committed catalogue.

**Per room + zone, store only what a human said about the baseline:**

- a **confirmation** — this feature, in this zone, checked and correct
- a **difference** — the human's value *and* the baseline value it was recorded against

Recording both halves of a difference matters: once the baseline is corrected from aggregated
evidence, a difference that stored only "user said 2" would silently re-interpret against a
baseline it was never measured against.

**Zones with no baseline** (21 today) take absolute values, which become a candidate baseline once
corroborated.

Transient state — power cores, timed chests, reds, crystal creature — is not baseline-able and
stays exactly as it is today. The `room_node_memory` allowlist already draws roughly this line.

### Scope of the first build

**The value shown to users comes from machine data only.** Pull it out of the catalogue, present it,
collect confirmations and differences. That is the whole of the first build, and it is simple —
no inference, no aggregation on the read path.

Deriving a *corrected* value from accumulated user submissions — "based on reports we now think this
area has 5, please confirm" — is explicitly **out of scope for now** and belongs in a later session,
once enough deviation data exists to be worth reasoning over. Building it before there is data to
learn from would be inventing an answer to a question nobody has asked yet.

The bridge between the two is a batch job, not a read-path feature: a periodic script that
enumerates the per-(zone, feature) records, compares them against the machine baseline, and reports
where corroborated evidence disagrees. It is arithmetic over a table, cheap to run and easy to
verify, and it can exist long before anything acts on its output automatically.

### Promotion rule

Two independent rooms agreeing has never contradicted the image baseline across 412 checks. So:

- a **single** differing report does not move the baseline — most are undercounts
- **two or more independent rooms agreeing on the same different value** flags the zone for review,
  and is the trigger for reporting a correction upstream
- the same room re-confirming its own zone counts once

### Migrating the existing table

The current `room_node_memory` feature data converts cleanly and should be migrated, not dropped:

| existing rows | becomes |
|---|---|
| 1,418 values matching the baseline (237 zones) | confirmations |
| 80 values differing (53 zones) | differences — seeds the correction table |
| 297 values with no baseline | absolutes |
| 983 app prefills never touched by a human | discarded; these were never observations |

That is a year of user effort that cannot be regenerated, and it arrives as a populated correction
table on day one.

## UX

Per **feature**, not per zone. A global "is all of this correct?" invites a reflexive yes; a
checkbox beside each individual value asks a question the person can answer by looking at it. The
error table above is the argument: the doubtful part of a zone is one specific number, so that is
the granularity the question has to be asked at.

- prefilled values render greyed with an unconfirmed badge
- each has its own confirm control, and its own correction path if the value is wrong
- humans can still add features the baseline does not know about — including things the baseline
  can never know, such as whether a dungeon is currently open

The existing `upstreamFeatures` mechanism already marks a value unconfirmed and clears that mark
when a human edits it, so the concept exists; this extends it to carry counts and an explicit
confirm action.

## Risks and limits

- **Anchoring.** Some users will tick without checking. Structurally contained: a lazy tick can only
  agree with a baseline that is already 97–100% likely to be right, and confirmations never move a
  baseline — only corroborated corrections do. *Optional, not agreed:* withhold the prefill on a
  small random fraction of zone loads to measure blind-vs-prefilled disagreement rather than
  assuming it is small.
- **Icon detection is unproven** beyond a colour-matching spike (91% on green chests, all errors
  over-counts from visually similar icons). This is the step most likely to go wrong.
- **21 zones have no data of any kind** and stay blind-entry.
- **Acquisition is not reproducible in CI** by design — the reviewed reference dataset is committed,
  the tooling and cached images are not.
- Socket counts are currently written to `maps.json` but **read by nothing at runtime**; the shared
  adapter drops them. Verifying them is informational until something consumes them.

## Prior review

An adversarial review of the earlier version of this plan returned RETHINK. Three of its objections
are addressed here: the missing count-propagation path through `Zone` and the adapter is now called
out; the backfill problem disappears because rooms no longer hold a copy of baseline features; and
the reviewed-dataset-plus-deterministic-join structure replaces image processing inside the
generator. Its objection to the acceptance bar is superseded — a confirmation system discovers its
own errors in production rather than needing them proven absent beforehand — but that reasoning
does **not** extend to irreversible steps: retiring the name heuristics and regenerating the
catalogue still need the drift settled first.
