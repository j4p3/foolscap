# Foolscap — Graph pattern (`.fc-graph*`)

A node-link figure: **labelled point marks on a graph-paper plate**. Nodes are
marks, not text boxes. The pattern is generic — it knows nothing of tasks,
projects or due dates. An app maps its own data onto five **channels**:

| Channel | Encodes (example) | Class family | Tokens |
|---|---|---|---|
| **series** — categorical fill | project / group | `.fc-graph-series-{1..6}` | `component.graph.series.{1..6}` → `color.chart.{1..6}` |
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
| `metrics(el?)` | px: `radius.{sm,md,lg}`, `hit`, `haloGap`, `ring.{past…none}`, `focusOffset`, `focusWidth`, `labelGap`, `labelSize`, `texture.{gap,stroke,dot}`, `grid.{size,major}`, `glyph` |
| `shapePath(shape, r)` | closed path, **equal area** to a circle of radius `r` so size reads the same across shapes |
| `extent(shape, r)` / `bottom(shape, r)` | circumradius / lowest point (label anchor) |
| `ringRadius(r, prox, m)` | proximity ring centre-line (parameter radius for `shapePath`) |
| `outerRadius(shape, r, prox, m)` | farthest point of the node from its centre for **this shape**: focus-ring centre-line extent plus half its stroke, including miter corners (a large overdue triangle is ≈42px, not 27px). Use for collision, hit area and edge trimming. Throws on an unknown shape. Labels hang below the same outline + `label.gap`. |
| `defs(m)` | `<pattern>` ids `fc-graph-texture-{hatch,crosshatch,dots}`, `fc-graph-grid`, `<marker id="fc-graph-arrow">` — include once per document |
| `node(opts, m)` | node markup; opts `{x,y,id,label,labelMuted,series,texture,size,shape,proximity,selected,dimmed,focusable,attrs}` |
| `trimEdge(a, b, ra, rb)` | `{x1,y1,x2,y2}` clipped to circles of `ra`/`rb` — pass `outerRadius(shape, …)` so arrowheads stop outside the full focus ring |
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

