#!/usr/bin/env python3
"""Derive a Roads zone's layout shape and rotation from a screenshot of its map.

Every Roads zone is one of a handful of layouts (c/f/h/o/p/s/t/x) drawn at one of
four rotations, so a screenshot is enough to identify both. The steps:

  1. The road overlay is a flat (255,176,88); nothing else in the frame matches it
     exactly, so a tight colour match isolates the road network on its own.
  2. Maps are drawn as a diamond. The stone frame is a clean closed tan ring whose
     four extreme points are the in-game N/W/S/E corners, so warping those onto a
     square removes the isometric skew and normalises position and scale. (The
     floor is not usable for this: the background behind the frame is a similar
     purple and camps punch holes in it.)
  3. Two maps of the same layout then differ only by whole 90 degree rotations, so
     matching against a per-shape baseline at 4 rotations gives shape + rotation.

Baselines are built from the medoid of each input group rather than hardcoded, so
this needs a set of already-labelled screenshots to learn from before it can
classify unknown ones.

Usage:
    python3 road_shapes.py --maps ./screenshots --labels ./labels.json

    labels.json: {"Zone-Name": "s", ...}   # the shape letter per known zone
    Screenshots are named <Zone-Name>.png.

Outputs shape, rotation (90 degree clockwise steps from the baseline), a match
score in 0..1, and the runner-up, so weak or ambiguous calls can be reviewed by
eye rather than trusted blindly.
"""
import argparse, collections, json, os
import numpy as np
from PIL import Image

ROAD = np.array([255, 176, 88])
ROAD_TOL = 40
FRAME_WORK = 320
SIDE = 256
GRID = 64
MIN_ROAD_PX = 60          # below this there is no road network (a Rest zone)
WEAK_MATCH = 0.75
CLOSE_CALL = 0.08


# ── mask helpers ──────────────────────────────────────────────────────────────

def _components(mask, min_px=0):
    """8-connected components; returns a list of (ys, xs) arrays."""
    h, w = mask.shape
    seen = np.zeros((h, w), bool)
    out = []
    for sy, sx in zip(*np.nonzero(mask)):
        if seen[sy, sx]:
            continue
        stack, comp = [(sy, sx)], []
        seen[sy, sx] = True
        while stack:
            y, x = stack.pop()
            comp.append((y, x))
            y0, y1 = max(0, y - 1), min(h, y + 2)
            x0, x1 = max(0, x - 1), min(w, x + 2)
            sub = mask[y0:y1, x0:x1] & ~seen[y0:y1, x0:x1]
            for dy, dx in zip(*np.nonzero(sub)):
                seen[y0 + dy, x0 + dx] = True
                stack.append((y0 + dy, x0 + dx))
        if len(comp) >= min_px:
            out.append(np.array(comp))
    return out


def denoise(mask, min_px):
    out = np.zeros_like(mask)
    for comp in _components(mask, min_px):
        out[comp[:, 0], comp[:, 1]] = True
    return out


def dilate(m, n=1):
    out = m.copy()
    for _ in range(n):
        p = np.pad(out, 1)
        out = p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:] | out
    return out


# ── locating the map ──────────────────────────────────────────────────────────

def frame_corners(path, work=FRAME_WORK):
    """Return (N, W, S, E) corners of the map frame, plus a quality dict.

    `ok` being False means the ring wasn't found cleanly - warping anyway would
    silently produce a garbage mask, so callers should skip or fall back.
    """
    im = Image.open(path).convert('RGB')
    W, H = im.size
    small = im.resize((work, max(1, int(H * work / W))), Image.BILINEAR)
    a = np.asarray(small).astype(np.int16)
    h, w = a.shape[:2]
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    tan = (r > 150) & (g > 110) & (g < 215) & (b < 180) & ((r - b) > 50)

    ring = None
    for comp in _components(tan):
        ys, xs = comp[:, 0], comp[:, 1]
        cw, ch = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
        if cw > 0.9 * w and ch < 0.15 * h:
            continue  # title / action bar, not the ring
        if ring is None or cw * ch > ring[0]:
            ring = (cw * ch, ys, xs)
    if ring is None:
        return None, {'ok': False, 'reason': 'no frame found'}

    _, ys, xs = ring
    scale = W / work

    def edge(vals, others, want_max):
        target = vals.max() if want_max else vals.min()
        band = np.abs(vals - target) <= 1
        return float(others[band].mean()), float(target)

    nx, ny = edge(ys, xs, False)
    sx, sy = edge(ys, xs, True)
    wy, wx = edge(xs, ys, False)
    ey, ex = edge(xs, ys, True)
    half_w, half_h = (ex - wx) / 2, (sy - ny) / 2
    q = {
        'aspect': half_w / half_h if half_h else 0,
        'xSkew': abs(nx - sx) / max(1e-6, half_w),
        'ySkew': abs(wy - ey) / max(1e-6, half_h),
        'widthFrac': 2 * half_w / w,
    }
    q['ok'] = (1.30 <= q['aspect'] <= 1.60 and q['xSkew'] < 0.06
               and q['ySkew'] < 0.06 and q['widthFrac'] > 0.4)
    corners = tuple((x * scale, y * scale)
                    for x, y in ((nx, ny), (wx, wy), (sx, sy), (ex, ey)))
    return corners, q


def canonical_mask(path, side=SIDE):
    """Road network warped to a square with N at top-left, W bottom-left."""
    corners, q = frame_corners(path)
    if corners is None or not q['ok']:
        return None, q
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.int16)
    mask = np.abs(a - ROAD).sum(2) < ROAD_TOL
    img = Image.fromarray((mask * 255).astype('uint8'))
    quad = [c for pt in corners for c in pt]
    out = np.asarray(img.transform((side, side), Image.QUAD, quad, Image.BILINEAR)) > 60
    return denoise(out, 25), q


def downsample(mask, grid=GRID):
    s = mask.shape[0] // grid
    return mask.reshape(grid, s, grid, s).any(3).any(1)


# ── matching ──────────────────────────────────────────────────────────────────

def score(a, b):
    """Symmetric dilated overlap, tolerant of line-width and marker differences."""
    if a.sum() == 0 or b.sum() == 0:
        return 0.0
    return 0.5 * ((a & dilate(b, 2)).sum() / a.sum() + (b & dilate(a, 2)).sum() / b.sum())


def best_rotation(a, template):
    """(score, clockwise 90-degree steps applied to template to reach a)."""
    best = (0.0, 0)
    for k in range(4):
        s = score(a, np.rot90(template, k))
        if s > best[0]:
            best = (s, (4 - k) % 4)
    return best


def build_baselines(masks, labels):
    """One baseline per shape, from the medoid of that shape's members."""
    groups = collections.defaultdict(list)
    for name, letter in labels.items():
        if name in masks and letter not in ('rest', None):
            groups[letter].append(name)
    baselines = {}
    for letter, members in sorted(groups.items()):
        sims = {a: np.median([best_rotation(masks[a], masks[b])[0]
                              for b in members if b != a] or [0]) for a in members}
        medoid = max(members, key=lambda n: sims[n])
        stack = [np.rot90(masks[n], (4 - best_rotation(masks[medoid], masks[n])[1]) % 4)
                 for n in members]
        baselines[letter] = np.mean(stack, 0) >= 0.5
    return baselines


def classify(mask, baselines):
    ranked = sorted(((*best_rotation(mask, t), letter) for letter, t in baselines.items()),
                    key=lambda r: -r[0])
    (top_score, steps, letter), (second_score, _, second) = ranked[0], ranked[1]
    reasons = []
    if top_score < WEAK_MATCH:
        reasons.append(f'weak match {top_score:.2f}')
    if top_score - second_score < CLOSE_CALL:
        reasons.append(f'close call vs {second} ({second_score:.2f})')
    return {'shape': letter, 'rotationSteps': steps, 'score': round(top_score, 4),
            'runnerUp': second, 'runnerUpScore': round(second_score, 4),
            'needsReview': reasons or None}


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--maps', required=True, help='directory of <Zone-Name>.png screenshots')
    ap.add_argument('--labels', required=True, help='JSON of {"Zone-Name": "shape letter"}')
    ap.add_argument('--out', default='shape-results.json')
    args = ap.parse_args()

    labels = json.load(open(args.labels))
    masks, skipped = {}, {}
    for f in sorted(os.listdir(args.maps)):
        if not f.endswith('.png'):
            continue
        name = f[:-4]
        m, q = canonical_mask(os.path.join(args.maps, f))
        if m is None:
            skipped[name] = q
            continue
        masks[name] = downsample(m)
    print(f'{len(masks)} located, {len(skipped)} could not be located')

    roads = {n: m for n, m in masks.items() if m.sum() >= MIN_ROAD_PX}
    baselines = build_baselines(roads, labels)
    print('baselines:', ', '.join(f'{k} ({sum(1 for v in labels.values() if v == k)})'
                                  for k in sorted(baselines)))

    results = {}
    for name, mask in sorted(masks.items()):
        if mask.sum() < MIN_ROAD_PX:
            results[name] = {'shape': 'rest', 'rotationSteps': None, 'score': None,
                             'note': 'no road network'}
            continue
        r = classify(mask, baselines)
        if labels.get(name) and labels[name] != r['shape']:
            r['needsReview'] = (r.get('needsReview') or []) + \
                               [f"labelled {labels[name]}, matches {r['shape']}"]
        results[name] = r

    json.dump(results, open(args.out, 'w'), indent=1)
    flagged = {k: v for k, v in results.items() if v.get('needsReview')}
    print(f'wrote {args.out}; {len(flagged)} need review')
    for k, v in flagged.items():
        print(f"  {k:24s} {'; '.join(v['needsReview'])}")


if __name__ == '__main__':
    main()
