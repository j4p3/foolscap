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
textures/shapes are independent of hue. All marks clear **3:1** against the plate
and labels clear **4.5:1**, in both modes (`npm run contrast`).

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
        <circle class="fc-graph-node-hit" r="…"/>   <!-- r = max(node.hit-radius, outerRadius); ≥48px target -->
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

## Geometry — `site/assets/foolscap-graph.js`

SVG cannot take path data or pattern tiles from CSS, so a dependency-free helper
reads the `--fc-component-graph-*` properties at render time (re-run on the
`fc:theme` event or when the root font size changes):

| Function | Returns |
|---|---|
| `metrics(el?)` | px: `radius.{sm,md,lg}`, `hit`, `haloGap`, `ring.{past…none}`, `focusOffset`, `focusWidth`, `labelGap`, `labelSize`, `texture.{gap,stroke,dot}`, `grid.{size,major}`, `glyph` |
| `shapePath(shape, r)` | closed path, **equal area** to a circle of radius `r` so size reads the same across shapes |
| `extent(shape, r)` / `bottom(shape, r)` | circumradius / lowest point (label anchor) |
| `ringRadius(r, prox, m)` / `outerRadius(r, prox, m)` | ring centre-line / outermost edge incl. focus ring (use for collision + edge trimming) |
| `defs(m)` | `<pattern>` ids `fc-graph-texture-{hatch,crosshatch,dots}`, `fc-graph-grid`, `<marker id="fc-graph-arrow">` — include once per document |
| `node(opts, m)` | node markup; opts `{x,y,id,label,labelMuted,series,texture,size,shape,proximity,selected,dimmed,focusable,attrs}` |
| `trimEdge(a, b, ra, rb)` | `{x1,y1,x2,y2}` clipped to both nodes' outer radius |
| `panZoom(svg, viewport, {onMove,minScale,maxScale,step})` | drag paper = pan, drag node = move (`onMove(el,x,y)`), wheel = zoom at cursor, keys ←↑→↓ / + − / 0 on the focused canvas. No animation. Returns `{zoomBy, reset, state}` |

Constants: `SHAPES`, `TEXTURES`, `PROXIMITY`, `SIZES`, `SERIES`.

## Rules

- Labels sit **below** the mark, mono caption voice, with a paper knockout
  (`paint-order: stroke`) instead of a box. Never put text inside a mark.
- Textures are drawn over the fill in `texture.ink` (the plate colour), so a hatch
  reads as paper showing through ink. `open` = hollow mark outlined in its series
  colour.
- Selection = solid `focus.ring` around the proximity ring plus bold outline and
  label; keyboard focus adds the long dash. No glow, no blur, no drop shadows.
- `dimmed` (opacity `node.opacity-dimmed`) is for filter/search context only.
- Edges are hairlines (`edge.line`); `-emphasis` = rule weight in strong ink;
  `-dashed` = tentative. Strokes don't scale with zoom (`vector-effect`).
- The canvas never collapses below `canvas.min-height` (`size.figure-min-height`).
- Series 1–6 are the chart ramp: a graph and a chart of the same data agree.
  More than six groups → reuse colours but vary texture, and always label.
