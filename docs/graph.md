# Foolscap — Graph pattern (`.fc-graph*`)

A node-link figure: **labelled point marks on a graph-paper plate**. Nodes are
marks, not text boxes. The pattern is generic — it knows nothing of tasks,
projects or due dates. An app maps its own data onto five **channels**:

| Channel | Encodes (example) | Class family | Tokens |
|---|---|---|---|
| **series** — categorical fill | project / group | `.fc-graph-series-{1..6}` | `component.graph.series.{1..6}` → `color.chart.{1..6}` |
| **ink** — categorical fill (v2) | any category the app maps to five fixed slots | `.fc-graph-ink-{1..5}`, `.fc-graph-ink-none` | `component.graph.ink.{1..5,none}` — see [Graph v2](#graph-v2-vocabulary) |
| **texture** — fill pattern | state / type facet | `.fc-graph-texture-{solid,hatch,crosshatch,dots,open}` | `component.graph.texture.*` |
| **size** — radius | weight / effort | `.fc-graph-size-{sm,md,lg}` | `component.graph.node.radius-{sm,md,lg}` |
| **shape** — silhouette | kind | path `d` from `fcGraph.shapePath(circle\|square\|diamond\|triangle\|hexagon)` | radii above (equal-area) |
| **proximity** — outer ring | time to deadline | `.fc-graph-proximity-{past,now,near,far,none}` | `component.graph.proximity.*.{color,width,dash}` |

No state is colour-only: proximity steps colour **and** ring width **and** dash
together (past = heavy solid, now = bold solid, near = rule short-dash, far =
hairline dotted, none = no ring); series is always paired with a label, and
textures/shapes are independent of hue. All marks — including the unassigned
(no-series) fill, `node.fill` = chart ink — clear **3:1** against the plate,
textures clear 3:1 on every fill, and labels clear **4.5:1**, in both modes
(`npm run contrast`).

## Markup

```html
<figure class="fc-graph">
  <svg class="fc-graph-canvas" tabindex="0" role="group" aria-label="…">
    <defs><!-- fcGraph.defs(metrics): texture patterns, grid, arrow marker --></defs>
    <g class="fc-graph-viewport" transform="translate(tx ty) scale(k)">
      <rect class="fc-graph-grid" x="-4000" y="-4000" width="8000" height="8000"/>
      <line class="fc-graph-edge [fc-graph-edge-emphasis] [fc-graph-edge-dashed]"
            marker-end="url(#fc-graph-arrow)" …/>
      <g class="fc-graph-node fc-graph-series-2 fc-graph-texture-hatch fc-graph-size-lg
                fc-graph-proximity-now [fc-graph-node-selected] [fc-graph-node-dimmed]"
         transform="translate(x y)" tabindex="0" role="button" aria-label="…">
        <circle class="fc-graph-node-hit" r="…"/>   <!-- r = max(node.hit-radius, outerRadius(shape,…)); ≥48px target -->
        <path class="fc-graph-node-halo"    d="…"/> <!-- proximity ring -->
        <path class="fc-graph-node-shape"   d="…"/> <!-- silhouette + series fill -->
        <path class="fc-graph-node-texture" d="…"/> <!-- same d; pattern overlay -->
        <path class="fc-graph-node-focus"   d="…"/> <!-- selection / focus ring -->
        <text class="fc-graph-label [fc-graph-label-muted]" y="…">Label</text>
      </g>
    </g>
  </svg>
  <div class="fc-graph-controls"><button class="fc-btn fc-btn-secondary">+</button>…</div>
</figure>

<div class="fc-graph-legend">
  <span class="fc-graph-legend-title">Series</span>
  <span class="fc-graph-legend-item"><span class="fc-graph-swatch fc-graph-series-1"></span>Name</span>
  <span class="fc-graph-legend-item"><svg class="fc-graph-glyph">…node…</svg>hatch</span>
</div>
```

`fcGraph.node(opts, metrics)` emits the node `<g>` above; it is optional —
frameworks may render the same structure themselves.

`node()` treats every option as untrusted: `shape`, `size`, `texture`,
`proximity` and `series` must be one of the listed constants (anything else
falls back to `circle` / `md` / `solid` / `none` / no series), `x`/`y` must be
finite (else 0), `label`/`id` are escaped, and a non-positive or non-finite
radius in `m` throws `RangeError`. `attrs` accepts only `aria-*`, `data-*`,
`role` and `tabindex` (integer) and throws `TypeError` for anything else —
no `on*`, `href`, `style`, `class` or presentation attributes. `attrs` values
override the built-ins (e.g. a fuller `aria-label`); `null` removes one.

## Geometry — `site/assets/foolscap-graph.js`

SVG cannot take path data or pattern tiles from CSS, so a dependency-free helper
reads the `--fc-component-graph-*` properties at render time (re-run on the
`fc:theme` event or when the root font size changes):

| Function | Returns |
|---|---|
| `metrics(el?)` | px: `radius.{sm,md,lg}`, `hit`, `haloGap`, `ring.{past…none}`, `focusOffset`, `focusWidth`, `labelGap`, `labelSize`, `texture.{gap,stroke,dot}`, `grid.{size,major,minorMinScale}` (scale is unitless), `glyph`, `touchMin`, `lineHeight`, `linkHandle`, `objective.{arm,width,padX,padY}` |
| `shapePath(shape, r)` | closed path, **equal area** to a circle of radius `r` so size reads the same across shapes |
| `extent(shape, r)` / `bottom(shape, r)` | circumradius / lowest point (label anchor) |
| `ringRadius(r, prox, m)` | proximity ring centre-line (parameter radius for `shapePath`) |
| `outerRadius(shape, r, prox, m)` | farthest point of the node from its centre for **this shape**: focus-ring centre-line extent plus half its stroke, including miter corners (a large overdue triangle is ≈42px, not 27px). Use for collision, hit area and edge trimming. Throws on an unknown shape. Labels hang below the same outline + `label.gap`. |
| `defs(m)` | `<pattern>` ids `fc-graph-texture-{hatch,crosshatch,dots}`, `fc-graph-grid`, `<marker id="fc-graph-arrow">` — include once per document |
| `node(opts, m)` | node markup; opts `{x,y,id,label,labelMuted,series,texture,size,shape,proximity,selected,dimmed,focusable,attrs}` |
| `trimEdge(a, b, ra, rb)` | `{x1,y1,x2,y2}` clipped to circles of `ra`/`rb` — pass `outerRadius(shape, …)` so arrowheads stop outside the full focus ring |
| `hitRadius(shape, r, prox, m)` | hit disc radius `node()` uses: covers the whole focus ring and never exposes less than `hit.touch-min` (44px) across |
| `bracketPath(w, h, m)` | four **open** corner brackets (no `Z`) around a `w × h` title box inset by `objective.padding-{x,y}`; arms `objective.bracket-arm`, clamped to half the box; hostile sizes collapse to 0; non-positive arm throws `RangeError` |
| `minorGridVisible(k, m)` | `false` when view scale `k` is below `grid.minor-min-scale` (0.6) or not a positive finite number — hide `.fc-graph-grid-line` then |
| `panZoom(svg, viewport, opts)` | see **Interaction** below. Returns `{zoomBy(k), reset(), panBy(dx,dy), moveBy(el,dx,dy), state}` |

Constants: `SHAPES`, `TEXTURES`, `PROXIMITY`, `SIZES`, `SERIES`.

## Rules

- Labels sit **below** the mark, mono caption voice, with a paper knockout
  (`paint-order: stroke`) instead of a box. Never put text inside a mark.
- Textures are drawn over the fill in `texture.ink` (the plate colour), so a hatch
  reads as paper showing through ink. `open` = hollow mark outlined in its series
  colour.
- Selection = solid `focus.ring` around the proximity ring plus bold outline and
  label; keyboard focus adds the long dash. No glow, no blur, no drop shadows.
- `dimmed` is for filter/search context only. It fades **decoration only** —
  shape fill (`fill-opacity`), texture and proximity ring at
  `node.opacity-dimmed`; the label, outline and focus ring stay at full
  contrast because a dimmed node is still focusable and readable. The faded
  fill/ring are below 3:1 by design, so a dimmed node's channel values must be
  in its accessible name or the table equivalent.
- Edges are hairlines (`edge.line`); `-emphasis` = rule weight in strong ink;
  `-dashed` = tentative. Strokes don't scale with zoom (`vector-effect`).
- The canvas never collapses below `canvas.min-height` (`size.figure-min-height`).
- Series 1–6 are the chart ramp: a graph and a chart of the same data agree.
  More than six groups → reuse colours but vary texture, and always label.

## Interaction — `panZoom(svg, viewport, opts)`

| Input | Canvas (`svg`) focused | Node focused |
|---|---|---|
| Pointer drag | pan (paper) | move node → `onMove(el, x, y)` |
| Wheel | zoom at cursor | — |
| ←↑→↓ | pan by `step` (48) | move node by `moveStep` (8; Shift ×4) → `onMove`; disable with `keyboardMove: false` |
| `+` / `=` / `-` / `0` | zoom in / out / reset | — |
| Enter / Space | — | activate: `onActivate(el, event)`, default dispatches a `click` on the node (Space fires on keyup, like a native button) |

Options: `{ onMove, onActivate, keyboardMove = true, moveStep = 8, step = 48, minScale, maxScale }`.

- **Client binding.** Nodes carry `role="button"`, so they must do something on
  Enter/Space. Either handle `click` on the canvas (delegated, as the
  styleguide does — the default activation dispatches one) or pass
  `onActivate`. If a node has no action, render it with `focusable: false` or
  override `attrs: { role: "img" }` rather than leaving a dead button.
- **Single-pointer alternatives (WCAG 2.5.7).** Dragging must not be the only
  way to pan or move. Provide buttons wired to `api.panBy(dx, dy)` and
  `api.moveBy(selectedEl, dx, dy)` (the styleguide specimen does both) next to
  the zoom buttons.
- **Modifiers.** Keys with Ctrl / Meta / Alt and Ctrl/Meta + wheel are never
  intercepted, so browser zoom (Ctrl +/−/0, trackpad pinch) keeps working.
- **One pointer at a time.** The first pointer owns the gesture; further
  touches are ignored until it lifts or cancels. There is no pinch-zoom — use
  the zoom buttons.

## Accessibility — the figure is not enough on its own

`role="button"` + `aria-label` on each node, as `node()` emits them, is **not a
complete accessible representation**: it names the marks but conveys none of
the edges, none of the channel encodings (series, texture, size, shape,
proximity) and no reading order. Any graph built on this pattern must also
ship:

1. **A table (or list) equivalent** of the nodes with one column per encoded
   channel, in words (e.g. "Project: Hull · State: in progress · Due:
   overdue"), and **of the edges** (from → to, and what emphasis/dashed means).
   It may sit in a `<details>` under the figure, but it must be in the DOM, not
   generated only on demand.
2. **A legend** in HTML text (`.fc-graph-legend`), never only glyphs.
3. **Accessible names that carry the data**, not only the label — pass a
   fuller name via `attrs: { "aria-label": "…" }` or point at the table row
   with `aria-describedby`.
4. **A figure name** on the `<svg>` (`role="group"` + `aria-label`) that states
   the keyboard model, plus a caption.

The styleguide specimen (`#graph`) shows all four.

## Graph v2 vocabulary

Added for dependency-graph explorers (first consumer: intent task graph v2).
Everything below is additive; the v1 classes and helpers above are unchanged
except the grid spacing values.

### Ink palette — `component.graph.ink.*` (`fc.palette` version 1)

Five fixed ink slots plus a neutral treatment. **Slot order is part of the
visual contract** and is versioned in the ink group's
`$extensions["fc.palette"]` (`version: 1`, `slots`). A change of order or
count bumps the version.

| Slot | Paper (light) | Blueprint (dark) | Class |
|---|---|---|---|
| `ink.1` forest green | `color.ink.forest` | `color.ink.forest-pale` | `.fc-graph-ink-1` |
| `ink.2` deep blue | `color.ink.blue` | `color.ink.blue-pale` | `.fc-graph-ink-2` |
| `ink.3` oxblood | `color.ink.oxblood` | `color.ink.oxblood-pale` | `.fc-graph-ink-3` |
| `ink.4` umber | `color.ink.umber` | `color.ink.umber-pale` | `.fc-graph-ink-4` |
| `ink.5` graphite | `color.gray.700` | `color.gray.200` | `.fc-graph-ink-5` |
| `ink.none` No texture | `color.gray.400` | `color.gray.400` | `.fc-graph-ink-none` |

Dark inks sit on paper; the blueprint theme uses pale counterparts rather
than dark ink on a dark plate. Every ink clears **3:1** against the graph
plate and under the texture pattern ink, in both themes (contract tests).
Ink classes set the same `--fc-graph-fill` channel as series and are declared
after them, so an ink class wins when both are present.

**Mapping categories to slots belongs to the app**, not upstream: Foolscap
ships the slots and classes only. The consuming app chooses a stable,
versioned assignment (e.g. a hash of a category's identity) and must list
colliding categories together in its key — five inks cannot uniquely encode
an open vocabulary.

### Distinguishable without colour

| Treatment | Non-colour cue |
|---|---|
| No texture (`.fc-graph-ink-none`) | dashed mark outline (`component.graph.dash`, the short dash) plus the words “No texture” in key and accessible names; never the long focus dash |
| Waiting / open (`.fc-graph-texture-open`) | hollow mark with a bold ink outline (unchanged) |
| Objective (`.fc-graph-objective`) | bracketed title, no task glyph, larger type |
| Selection (`.fc-graph-node-selected`) | solid focus ring + bold outline + bold label; keyboard focus adds the long dash |
| Completed context (`.fc-graph-done`) | check-mark path (`.fc-graph-done-mark`) + muted title |
| Link target valid / invalid | valid: heavy **solid** ring/bracket; invalid: short-**dashed** ring/bracket + `not-allowed` cursor. Holds while focused or selected — see [Focused link targets](#focused-link-targets) |
| Aggregate edge (`.fc-graph-edge-aggregate`) | dash-dot (`component.graph.aggregate.dash`), distinct from the tentative short dash |
| Focused stream (`.fc-graph-stream`) | heavier edge (`stream.edge-width`); others dim via `.fc-graph-dimmed` |

### Objective bracket

```html
<g class="fc-graph-node fc-graph-objective fc-graph-objective-root fc-graph-hit"
   transform="translate(x y)" tabindex="0" role="button" aria-label="Objective: …, 3 of 5 complete">
  <path class="fc-graph-objective-bracket" d="fcGraph.bracketPath(textW, textH, m)"/>
  <text class="fc-graph-label">Launch the hull</text>
  <text class="fc-graph-objective-caption" y="…">OBJECTIVE · 3 OF 5</text>
</g>
```

Root vs nested (`.fc-graph-objective-root` / `.fc-graph-objective-nested`) changes only type
size/weight (`objective.font-size-*`, `objective.font-weight-*`); it is
structure within the shown graph, never priority. Brackets are open corners
(`objective.bracket`, `bracket-width`, `bracket-arm`, `padding-x/y`), never a
filled card; selection/focus step the bracket to heavy weight, focus adds the
long dash. The caption uses `objective.caption` (≥ 4.5:1).

### Hit, cursor and link states

All graph-scoped — no generic `button`, element or cursor reset.

| Class | Effect |
|---|---|
| `.fc-graph-hit` (on the node `<g>`) | `cursor: pointer`; the title (`.fc-graph-label`) joins hit testing so glyph and title share one region. Plain labels stay `pointer-events: none`. |
| `.fc-graph-canvas` / `.fc-graph-canvas.is-grabbing` | `grab` / `grabbing` (legacy `.fc-graph-panning` still works); a hit node shows `grabbing` while moved |
| `.fc-graph-link-handle` | `crosshair`; drawn radius `link.handle-radius`, expose ≥ `hit.touch-min` via `hitRadius` or an invisible disc |
| `.fc-graph-link-preview` | provisional line: `link.preview-line`, `link.preview-dash` |
| `.fc-graph-target-valid` / `.fc-graph-target-invalid` | see table above; invalid adds `not-allowed` |
| `.fc-graph-dimmed` | fades decoration only — edge stroke (`edge.opacity-dimmed`), mark fill, texture, ring and objective bracket (`node.opacity-dimmed`); labels and focus rings stay at full contrast |

**Legend glyphs are never `.fc-graph-hit`.** `.fc-graph-glyph` and everything
inside it get `pointer-events: none`, and a stray `.fc-graph-hit` inside a
glyph keeps `cursor: default`.

### Focused link targets

A link target shows its verdict and keyboard focus **at the same time**, on
glyphs (`.fc-graph-node-focus` ring) and on root/nested objectives
(`.fc-graph-objective-bracket`), selected or not:

- **Verdict stays on the ring/bracket.** `.fc-graph-target-valid` is the heavy
  **solid** stroke in `link.target-valid`; `.fc-graph-target-invalid` is the
  visibly **short-dashed** stroke (`component.graph.dash`) in
  `link.target-invalid`. Graph-scoped `…target-*:focus-visible` selectors
  outrank the ordinary focus and selection rules, so the long focus dash never
  replaces a verdict.
- **Focus moves to a separate outline.** `.fc-graph-target-valid:focus-visible`
  and `.fc-graph-target-invalid:focus-visible` draw an outline on the target
  group (`focus.width` solid `focus.ring`, offset `focus.offset`), so focus
  remains visible without restyling the verdict stroke. Nothing else gets the
  outline.
- **Invalid objective brackets use butt caps.** The base bracket keeps square
  caps and miter joins for crisp open corners. Square caps extend each dash by
  half the stroke width at both ends, so on a heavy (selected or focused)
  bracket they would close the short dash's gap and read as solid. Only the
  invalid bracket switches to `stroke-linecap: butt`; the path, fill, width
  and corners are unchanged.
- **Ordinary focus and selection are unchanged.** Without a verdict class a
  focused node or objective still draws the `focus.ring` long dash on its ring
  or bracket and no outline; selection keeps its solid treatment (focus-ring
  glyph ring, heavy objective bracket).
  Removing a verdict while focused restores that ordinary focus styling.

`npm run contrast` audits the link-target, focus-ring and other v2 pairs in
both themes against the plate (text ≥ 4.5:1, marks ≥ 3:1) and fails the build
on a miss.

`component.graph.hit.touch-min` = 2.75rem (44px): `node()` now emits a hit disc
of at least that diameter (`hitRadius`), and `.fc-graph-key-toggle` is at least
that size.

### Panels: toolbar, key, inset, sheet

HTML floated over `.fc-graph` (`position: relative`); they never reserve
layout space.

| Class | Placement / size tokens |
|---|---|
| `.fc-graph-toolbar` | top-left, `inset.offset`; wraps |
| `.fc-graph-key` + `.fc-graph-key-toggle` | bottom-left; `key.width` × `key.max-height`, scrolls; toggle ≥ `hit.touch-min` |
| `.fc-graph-inset` | desktop detail, top-right; `inset.width`, `inset.max-height`, `inset.offset`, `inset.background`, `inset.border`, `inset.shadow` (unblurred offset plate) |
| `.fc-graph-sheet` | phone detail, bottom edge, at most half the figure |

Widths clamp to the figure (`min(token, 100% − 2 × offset)`). The app chooses
inset vs sheet; Foolscap supplies no breakpoint.

### Grid and label metrics

`component.graph.grid.size` / `.size-major` are now **3rem / 12rem** (were
1.5rem / 6rem); names unchanged. The grid is background paper, not a
placement lattice. `grid.minor-min-scale` (0.6, unitless) is the zoom below
which minor lines should be hidden — `minorGridVisible(k, m)`.
`component.graph.label.line-height` gives apps a token for wrapped-label
pitch instead of a hard-coded constant.
