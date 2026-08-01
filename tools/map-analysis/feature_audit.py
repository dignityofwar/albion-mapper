#!/usr/bin/env python3
"""Audit human-entered map history against a reference set of feature counts.

Reports two different things per feature, and the second is the more useful one:

  agreement   - how often a human count equals the reference count
  humanSpread - how much humans disagree with EACH OTHER about the same zone

Spread needs no reference data to be meaningful. A zone whose chest counts are
stable across rooms but whose dungeon counts scatter is a sign that the feature
is dynamic rather than a property of the zone - so the two columns together
separate "our data is wrong" from "the thing genuinely changes".

Values flagged in a row's `upstreamFeatures` are prefill, not observations, and
are skipped: counting them would compare the prefill against its own source.

Usage:
    # export from the database first
    psql "$DATABASE_URL" -At -c "SELECT json_agg(t) FROM (
        SELECT rnm.zone_id, rnm.features, r.server
        FROM room_node_memory rnm JOIN rooms r ON r.id = rnm.room_id
        WHERE rnm.features IS NOT NULL) t;" > history.json

    python3 feature_audit.py --history history.json --reference reference.json

    reference.json: {"zone-id": {"chests": {"treasuresGreenCount": 6},
                                 "resources": {"leather": 2},
                                 "dungeonCount": 0}, ...}
"""
import argparse, collections, json, statistics

CHEST_KEYS = ['treasuresGreenCount', 'treasuresBlueCount', 'treasuresYellowCount']


def observation(features):
    """One human observation flattened to comparable counts."""
    prefilled = set(features.get('upstreamFeatures') or [])
    out = {k: features[k] for k in CHEST_KEYS
           if isinstance(features.get(k), int) and k not in prefilled}

    dungeon, seen = 0, False
    for count_key, flag_key in (('dungeonStaticCount', 'dungeonStatic'),
                                ('dungeonGroupCount', 'dungeonGroup')):
        if isinstance(features.get(count_key), int):
            dungeon += features[count_key]
            seen = True
        elif features.get(flag_key):
            dungeon += 1
            seen = True
    if seen:
        out['dungeonCount'] = dungeon

    for entry in features.get('resources') or []:
        t = entry.get('type')
        if t and t not in prefilled:
            out['res:' + t] = (entry.get('small') or 0) + (entry.get('large') or 0)
    return out


def reference_counts(entry):
    if not entry:
        return {}
    out = dict(entry.get('chests') or {})
    if 'dungeonCount' in entry:
        out['dungeonCount'] = entry['dungeonCount']
    for t, n in (entry.get('resources') or {}).items():
        out['res:' + t] = n
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--history', required=True, help='JSON export of room_node_memory')
    ap.add_argument('--reference', help='JSON of reference counts per zone id')
    ap.add_argument('--out', default='feature-audit.json')
    args = ap.parse_args()

    raw = json.load(open(args.history))
    reference = json.load(open(args.reference)) if args.reference else {}

    by_zone = collections.defaultdict(list)
    for row in raw:
        f = row.get('features')
        if isinstance(f, str):
            f = json.loads(f)
        if f:
            by_zone[row['zone_id']].append(observation(f))
    total = sum(len(v) for v in by_zone.values())
    print(f'{total} observations across {len(by_zone)} zones\n')

    agree = collections.defaultdict(lambda: [0, 0])
    errors = collections.defaultdict(list)
    spread = collections.defaultdict(list)
    consensus = collections.defaultdict(lambda: [0, 0])   # unanimous zones vs reference
    conflicts, detail = [], {}

    for zone, observations in by_zone.items():
        expected = reference_counts(reference.get(zone))
        keys = {k for o in observations for k in o}
        detail[zone] = {'observations': len(observations), 'features': {}}
        for k in keys:
            values = [o[k] for o in observations if k in o]
            detail[zone]['features'][k] = {
                'values': collections.Counter(values).most_common(),
                'reference': expected.get(k),
            }
            if len(values) > 1:
                spread[k].append(statistics.pstdev(values))
            if k not in expected:
                continue
            for v in values:
                agree[k][1] += 1
                agree[k][0] += (v == expected[k])
                errors[k].append(v - expected[k])
            # a zone several humans agree on is the strongest test of the reference
            if len(values) > 1 and len(set(values)) == 1:
                consensus[k][1] += 1
                if values[0] == expected[k]:
                    consensus[k][0] += 1
                else:
                    conflicts.append((zone, k, values[0], expected[k], len(values)))

    print(f"{'feature':22s} {'n':>6s} {'agree':>7s} {'meanErr':>8s} {'humanSpread':>12s} {'lower/higher':>13s}")
    for k in sorted(set(list(agree) + list(spread))):
        hits, n = agree.get(k, [0, 0])
        sp = statistics.mean(spread[k]) if spread.get(k) else float('nan')
        err = statistics.mean(abs(e) for e in errors[k]) if errors.get(k) else float('nan')
        lo = sum(1 for e in errors.get(k, []) if e < 0)
        hi = sum(1 for e in errors.get(k, []) if e > 0)
        pct = f'{hits / n:.1%}' if n else '-'
        print(f'{k:22s} {n:6d} {pct:>7s} {err:8.2f} {sp:12.2f} {f"{lo}/{hi}":>13s}')

    if consensus:
        print('\nagainst zones where 2+ humans agreed unanimously:')
        for k, (hits, n) in sorted(consensus.items()):
            print(f'  {k:22s} reference matches {hits}/{n}' + (f' ({hits/n:.0%})' if n else ''))
    if conflicts:
        print('\nreference disagrees with a unanimous human consensus:')
        for zone, k, human, ref, n in conflicts:
            print(f'  {zone:26s} {k:22s} {n} humans said {human}, reference says {ref}')

    json.dump(detail, open(args.out, 'w'), indent=1)
    print(f'\nwrote {args.out}')


if __name__ == '__main__':
    main()
