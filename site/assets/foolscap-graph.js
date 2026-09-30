/* Foolscap graph helpers — geometry that SVG cannot take from CSS.
 *
 * Styling lives in foolscap.css (.fc-graph*); every number here is read from the
 * --fc-component-graph-* custom properties so figures follow the tokens.
 * Framework-free and side-effect-free at load: exposes window.fcGraph.
 *
 *   fcGraph.metrics(el?)            -> px geometry resolved from tokens
 *   fcGraph.shapePath(shape, r)     -> closed SVG path, equal-area to a circle of r
 *   fcGraph.extent(shape, r)        -> circumradius of the silhouette path
 *   fcGraph.ringRadius(r, prox, m)  -> centre-line radius of the proximity ring
 *   fcGraph.outerRadius(shape, r, prox, m) -> farthest point incl. full focus-ring
 *                                      stroke + miter corners (collision, hit, edge trim)
 *   fcGraph.defs(m)                 -> <pattern>/<marker> markup for one <defs>
 *   fcGraph.node(opts, m)           -> <g class="fc-graph-node ..."> markup; channel values
 *                                      are validated, attrs limited to aria-* data-* role tabindex
 *   fcGraph.trimEdge(a, b, ra, rb)  -> edge endpoints clipped to node rings
 *   fcGraph.hitRadius(shape, r, prox, m) -> hit disc radius: covers the focus ring and
 *                                      never exposes less than hit.touch-min across
 *   fcGraph.bracketPath(w, h, m)    -> four open corner brackets around a w x h title box
 *   fcGraph.minorGridVisible(k, m)  -> false below grid.minor-min-scale (hide minor lines)
 *   fcGraph.panZoom(svg, viewport, opts) -> pan/zoom, node drag + keyboard move,
 *                                      Enter/Space activation; {zoomBy, reset, panBy, moveBy, state}
 */
(function (root) {
  "use strict";

  const SHAPES = ["circle", "square", "diamond", "triangle", "hexagon"];
  const TEXTURES = ["solid", "hatch", "crosshatch", "dots", "open"];
  const PROXIMITY = ["past", "now", "near", "far", "none"];
  const SIZES = ["sm", "md", "lg"];
  const SERIES = [1, 2, 3, 4, 5, 6];

  const f = (n) => Math.round(n * 100) / 100;
  const SQRT_PI = Math.sqrt(Math.PI);

  // Equal-area silhouettes: weight (size) reads the same across shapes.
  // factor = circumradius / r for a regular polygon of area πr².
  const FACTOR = {
    circle: 1,
    square: SQRT_PI / 2 * Math.SQRT2,                       // half-diagonal
    diamond: Math.sqrt(Math.PI / 2),
    triangle: Math.sqrt((4 * Math.PI) / (3 * Math.sqrt(3))),
    hexagon: Math.sqrt((2 * Math.PI) / (3 * Math.sqrt(3))),
  };

  function polygon(n, R, startDeg) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = ((startDeg + (360 / n) * i) * Math.PI) / 180;
      pts.push(`${f(R * Math.cos(a))} ${f(R * Math.sin(a))}`);
    }
    return "M" + pts.join(" L") + " Z";
  }

  function shapePath(shape, r) {
    switch (shape) {
      case "square": {
        const h = f((SQRT_PI / 2) * r);
        return `M${-h} ${-h} H${h} V${h} H${-h} Z`;
      }
      case "diamond": return polygon(4, FACTOR.diamond * r, -90);
      case "triangle": return polygon(3, FACTOR.triangle * r, -90);
      case "hexagon": return polygon(6, FACTOR.hexagon * r, 0);
      case "circle":
      default: {
        const c = f(r);
        return `M${-c} 0 A${c} ${c} 0 1 0 ${c} 0 A${c} ${c} 0 1 0 ${-c} 0 Z`;
      }
    }
  }

  const extent = (shape, r) => (FACTOR[shape] || 1) * r;
  // Lowest point of the silhouette below centre (label anchor).
  const BOTTOM = { circle: 1, square: SQRT_PI / 2, diamond: FACTOR.diamond, triangle: FACTOR.triangle / 2, hexagon: FACTOR.hexagon * Math.sin(Math.PI / 3) };
  const bottom = (shape, r) => (BOTTOM[shape] || 1) * r;

  function metrics(el) {
    const doc = root.document;
    const node = el || doc.documentElement;
    const cs = root.getComputedStyle(node);
    const rootPx = parseFloat(root.getComputedStyle(doc.documentElement).fontSize) || 16;
    const v = (name) => cs.getPropertyValue(`--fc-component-graph-${name}`).trim();
    const px = (name) => {
      const s = v(name);
      const n = parseFloat(s);
      if (Number.isNaN(n)) return 0;
      return s.endsWith("rem") ? n * rootPx : n;
    };
    return {
      radius: { sm: px("node-radius-sm"), md: px("node-radius-md"), lg: px("node-radius-lg") },
      hit: px("node-hit-radius"),
      haloGap: px("halo-gap"),
      ring: Object.fromEntries(PROXIMITY.map((p) => [p, px(`proximity-${p}-width`)])),
      focusOffset: px("focus-offset"),
      focusWidth: px("focus-width"),
      labelGap: px("label-gap"),
      labelSize: px("label-font-size"),
      texture: { gap: px("texture-gap"), stroke: px("texture-stroke-width"), dot: px("texture-dot-radius") },
      grid: { size: px("grid-size"), major: px("grid-size-major"), minorMinScale: px("grid-minor-min-scale") },
      glyph: px("legend-glyph-size"),
      touchMin: px("hit-touch-min"),
      lineHeight: px("label-line-height"),
      linkHandle: px("link-handle-radius"),
      objective: {
        arm: px("objective-bracket-arm"),
        width: px("objective-bracket-width"),
        padX: px("objective-padding-x"),
        padY: px("objective-padding-y"),
      },
    };
  }

  const ringRadius = (r, prox, m) => r + m.haloGap + (m.ring[prox] || 0) / 2;
  // Parameter radius of the focus ring's centre line (the path is shapePath(shape, focusR)).
  const focusRadius = (r, prox, m) => r + m.haloGap + (m.ring[prox] || 0) + m.focusOffset + m.focusWidth / 2;
  // Miter joins push a stroke's outer corner out by (w/2)/sin(interior/2).
  const MITER = { circle: 1, square: Math.SQRT2, diamond: Math.SQRT2, triangle: 2, hexagon: 1 / Math.sin(Math.PI / 3) };
  const BOTTOM_MITER = { circle: 1, square: 1, diamond: Math.SQRT2, triangle: 1, hexagon: 1 }; // flat edge vs vertex
  /* Outermost point of the node (focus ring stroke incl. miter corners) from the
     centre, for this shape: use for collision, hit area and edge trimming. */
  function outerRadius(shape, r, prox, m) {
    if (!SHAPES.includes(shape)) throw new TypeError(`fcGraph.outerRadius(shape, r, prox, m): unknown shape "${shape}"`);
    return extent(shape, focusRadius(r, prox, m)) + (MITER[shape] * m.focusWidth) / 2;
  }
  // Lowest point of the focus ring stroke (labels hang below it).
  const outerBottom = (shape, r, prox, m) => bottom(shape, focusRadius(r, prox, m)) + (BOTTOM_MITER[shape] * m.focusWidth) / 2;

  const len = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };

  // Exposed hit disc: the whole focus ring, the legacy hit radius, and at least
  // half the touch minimum (44px across) whatever the drawn size.
  const hitRadius = (shape, r, prox, m) =>
    Math.max(len(m.hit), len(m.touchMin) / 2, outerRadius(shape, r, prox, m) + 0.01);

  /* Objective landmark: four open corners around a w x h title box, inset by the
     objective padding. Arms are clamped to half the box so short titles never
     cross; hostile sizes collapse to 0. Open subpaths only, never a closed card. */
  function bracketPath(w, h, m) {
    const o = (m && m.objective) || {};
    const arm = Number(o.arm);
    if (!Number.isFinite(arm) || arm <= 0) throw new RangeError("fcGraph.bracketPath: objective.arm must be a positive finite number");
    const X = len(w) / 2 + len(o.padX), Y = len(h) / 2 + len(o.padY);
    const ax = Math.min(arm, X), ay = Math.min(arm, Y);
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]]
      .map(([sx, sy]) => `M${f(sx * (X - ax)) || 0} ${f(sy * Y) || 0} H${f(sx * X) || 0} V${f(sy * (Y - ay)) || 0}`)
      .join(" ");
  }

  // Minor graph-paper lines turn to noise when zoomed out; hide them below the token scale.
  function minorGridVisible(k, m) {
    if (typeof k !== "number" || !Number.isFinite(k) || k <= 0) return false;
    const min = Number(m && m.grid && m.grid.minorMinScale);
    return k >= (Number.isFinite(min) ? min : 0);
  }

  function defs(m) {
    const t = m.texture;
    const g = f(t.gap + t.stroke); // hatch pitch
    const d = f(g * 1.5);          // dot pitch
    const mid = f(g / 2);
    const minor = m.grid.size, major = m.grid.major;
    let gridMinor = "";
    for (let x = minor; x < major - 0.01; x += minor) {
      gridMinor += `M${f(x)} 0 V${f(major)} M0 ${f(x)} H${f(major)} `;
    }
    return [
      `<pattern id="fc-graph-texture-hatch" patternUnits="userSpaceOnUse" width="${g}" height="${g}" patternTransform="rotate(45)">`,
      `<line class="fc-graph-texture-line" x1="${mid}" y1="0" x2="${mid}" y2="${g}"/></pattern>`,
      `<pattern id="fc-graph-texture-crosshatch" patternUnits="userSpaceOnUse" width="${g}" height="${g}" patternTransform="rotate(45)">`,
      `<line class="fc-graph-texture-line" x1="${mid}" y1="0" x2="${mid}" y2="${g}"/>`,
      `<line class="fc-graph-texture-line" x1="0" y1="${mid}" x2="${g}" y2="${mid}"/></pattern>`,
      `<pattern id="fc-graph-texture-dots" patternUnits="userSpaceOnUse" width="${d}" height="${d}">`,
      `<circle class="fc-graph-texture-dot" cx="${f(d / 2)}" cy="${f(d / 2)}" r="${f(t.dot)}"/></pattern>`,
      `<pattern id="fc-graph-grid" patternUnits="userSpaceOnUse" width="${f(major)}" height="${f(major)}">`,
      `<path class="fc-graph-grid-line" d="${gridMinor.trim()}"/>`,
      `<path class="fc-graph-grid-line-major" d="M0 0 V${f(major)} M0 0 H${f(major)}"/></pattern>`,
      `<marker id="fc-graph-arrow" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto-start-reverse">`,
      `<path class="fc-graph-edge-marker" d="M0 0 L8 4 L0 8 Z"/></marker>`,
    ].join("");
  }

  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

  // Channel values are interpolated into class names: only listed values pass.
  const pick = (list, v, dflt) => (list.includes(v) ? v : dflt);
  const pickSeries = (v) => { const n = Number(v); return v !== "" && v != null && SERIES.includes(n) ? n : null; };
  const coord = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  // Caller attrs land on an SVG <g>: semantics/data only. No on*, href, style,
  // class or presentation attributes — those are the helper's to own.
  const ATTR_NAME = /^(?:aria-[a-z]+(?:-[a-z]+)*|data-[a-z0-9]+(?:-[a-z0-9]+)*|role|tabindex)$/;

  /* opts: { x, y, shape, size, series, texture, proximity, label, labelMuted,
             selected, dimmed, id, focusable, attrs } — all optional.
     attrs: { "aria-*" | "data-*" | role | tabindex: value } — anything else throws. */
  function node(o, m) {
    const shape = pick(SHAPES, o.shape, "circle");
    const size = pick(SIZES, o.size, "md");
    const prox = pick(PROXIMITY, o.proximity, "none");
    const texture = pick(TEXTURES, o.texture, "solid");
    const series = pickSeries(o.series);
    const r = Number(m.radius[size]);
    if (!Number.isFinite(r) || r <= 0) throw new RangeError(`fcGraph.node: radius.${size} must be a positive finite number`);
    const g = { hit: m.hit, touchMin: m.touchMin, haloGap: len(m.haloGap), ring: { [prox]: len(m.ring[prox]) }, focusOffset: len(m.focusOffset), focusWidth: len(m.focusWidth) };
    const ringR = ringRadius(r, prox, g);
    const focusR = focusRadius(r, prox, g);
    const labelY = f(outerBottom(shape, r, prox, g) + len(m.labelGap));
    const cls = ["fc-graph-node", `fc-graph-size-${size}`, `fc-graph-proximity-${prox}`, `fc-graph-texture-${texture}`];
    if (series) cls.push(`fc-graph-series-${series}`);
    if (o.selected) cls.push("fc-graph-node-selected");
    if (o.dimmed) cls.push("fc-graph-node-dimmed");
    const d = shapePath(shape, r);
    const attrs = new Map();
    if (o.id != null && o.id !== "") attrs.set("data-id", o.id);
    if (o.focusable !== false) { attrs.set("tabindex", "0"); attrs.set("role", "button"); }
    if (o.label) attrs.set("aria-label", o.label);
    for (const [k, val] of Object.entries(o.attrs || {})) {
      if (!ATTR_NAME.test(k)) throw new TypeError(`fcGraph.node: attribute "${k}" not allowed (aria-*, data-*, role, tabindex only)`);
      if (k === "tabindex" && val != null && !/^-?\d+$/.test(String(val))) throw new TypeError("fcGraph.node: tabindex must be an integer");
      if (val == null) attrs.delete(k); else attrs.set(k, val);
    }
    const extra = [...attrs].map(([k, val]) => ` ${k}="${esc(val)}"`).join("");
    return (
      `<g class="${cls.join(" ")}" transform="translate(${f(coord(o.x))} ${f(coord(o.y))})"${extra}>` +
      `<circle class="fc-graph-node-hit" r="${f(hitRadius(shape, r, prox, g))}"/>` +
      `<path class="fc-graph-node-halo" d="${shapePath(shape, ringR)}"/>` +
      `<path class="fc-graph-node-shape" d="${d}"/>` +
      `<path class="fc-graph-node-texture" d="${d}"/>` +
      `<path class="fc-graph-node-focus" d="${shapePath(shape, focusR)}"/>` +
      (o.label ? `<text class="fc-graph-label${o.labelMuted ? " fc-graph-label-muted" : ""}" y="${labelY}">${esc(o.label)}</text>` : "") +
      `</g>`
    );
  }

  function trimEdge(a, b, ra, rb) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    return { x1: f(a.x + ux * ra), y1: f(a.y + uy * ra), x2: f(b.x - ux * rb), y2: f(b.y - uy * rb) };
  }

  /* Minimal pan/zoom + node drag/move/activate. No animation (instant state changes).
     Pointer (one pointer at a time; extra touches are ignored, no pinch):
       drag empty canvas = pan, drag a node = move (onMove(el, x, y)), wheel = zoom at cursor.
     Keyboard, canvas focused: arrows pan, + / - zoom, 0 resets.
     Keyboard, node focused: Enter / Space activate (onActivate(el, e), default: a
       synthetic click on the node), arrows move it by moveStep (Shift = x4) unless
       keyboardMove:false. Ctrl/Meta/Alt combos are never intercepted (browser zoom).
     Single-pointer alternatives to dragging: api.panBy(dx, dy), api.moveBy(el, dx, dy). */
  function panZoom(svg, viewport, opts = {}) {
    const min = opts.minScale ?? 0.25, max = opts.maxScale ?? 4, step = opts.step ?? 48;
    const moveStep = opts.moveStep ?? 8;
    let k = 1, tx = 0, ty = 0, drag = null, suppressClick = false;
    const apply = () => viewport.setAttribute("transform", `translate(${f(tx)} ${f(ty)}) scale(${f(k)})`);
    const pt = (e) => { const b = svg.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
    const zoomAt = (factor, cx, cy) => {
      const nk = Math.min(max, Math.max(min, k * factor));
      tx = cx - ((cx - tx) * nk) / k; ty = cy - ((cy - ty) * nk) / k; k = nk; apply();
    };
    const zoomCentre = (factor) => { const b = svg.getBoundingClientRect(); zoomAt(factor, b.width / 2, b.height / 2); };
    const reset = () => { k = 1; tx = 0; ty = 0; apply(); };
    const nodeOf = (t) => { const n = t && t.closest && t.closest(".fc-graph-node"); return n && viewport.contains(n) ? n : null; };
    const readXY = (n) => {
      const m = /translate\(([-\d.e]+)[ ,]+([-\d.e]+)\)/.exec(n.getAttribute("transform") || "");
      return m ? { x: +m[1], y: +m[2] } : { x: 0, y: 0 };
    };
    const place = (n, x, y) => {
      n.setAttribute("transform", `translate(${f(x)} ${f(y)})`);
      opts.onMove && opts.onMove(n, x, y);
    };
    const moveBy = (n, dx, dy) => { const p = readXY(n); place(n, p.x + dx, p.y + dy); };
    const panBy = (dx, dy) => { tx += dx; ty += dy; apply(); };
    const activate = (n, e) => {
      suppressClick = false; // never swallow a keyboard activation
      if (opts.onActivate) opts.onActivate(n, e);
      else n.dispatchEvent(new root.MouseEvent("click", { bubbles: true, cancelable: true }));
    };

    svg.addEventListener("wheel", (e) => {
      if (e.ctrlKey || e.metaKey) return; // browser / trackpad-pinch page zoom
      e.preventDefault();
      const p = pt(e); zoomAt(Math.exp(-e.deltaY * 0.0015), p.x, p.y);
    }, { passive: false });
    svg.addEventListener("pointerdown", (e) => {
      if (drag || e.button !== 0) return; // one pointer owns the gesture
      suppressClick = false;
      const n = nodeOf(e.target);
      const p = pt(e);
      if (n) { const o = readXY(n); drag = { kind: "node", el: n, ox: o.x, oy: o.y, sx: p.x, sy: p.y, id: e.pointerId, live: false }; }
      else drag = { kind: "pan", sx: p.x, sy: p.y, tx, ty, id: e.pointerId, live: false };
    });
    svg.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const p = pt(e);
      // Capture lazily past a small threshold so a plain click still targets the node.
      if (!drag.live) {
        if (Math.hypot(p.x - drag.sx, p.y - drag.sy) < 3) return;
        drag.live = true;
        svg.setPointerCapture(drag.id);
        if (drag.kind === "node") drag.el.classList.add("fc-graph-node-dragging");
        else svg.classList.add("fc-graph-panning");
      }
      if (drag.kind === "pan") { tx = drag.tx + p.x - drag.sx; ty = drag.ty + p.y - drag.sy; apply(); }
      else place(drag.el, drag.ox + (p.x - drag.sx) / k, drag.oy + (p.y - drag.sy) / k);
    });
    const end = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (drag.live) suppressClick = true;
      if (drag.kind === "node") drag.el.classList.remove("fc-graph-node-dragging");
      svg.classList.remove("fc-graph-panning");
      drag = null;
    };
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointercancel", end);
    // A drag is not a click: swallow the click that follows a real drag.
    svg.addEventListener("click", (e) => {
      if (suppressClick) { suppressClick = false; e.stopImmediatePropagation(); }
    }, true);

    const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    let spaceOn = null;
    svg.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return; // leave browser zoom/shortcuts alone
      const n = nodeOf(e.target);
      if (n && e.target === n) {
        if (e.key === "Enter") { e.preventDefault(); if (!e.repeat) activate(n, e); return; }
        if (e.key === " ") { e.preventDefault(); spaceOn = n; return; }
        if (ARROWS[e.key] && opts.keyboardMove !== false) {
          e.preventDefault();
          const s = moveStep * (e.shiftKey ? 4 : 1), [dx, dy] = ARROWS[e.key];
          moveBy(n, dx * s, dy * s);
        }
        return;
      }
      if (e.target !== svg) return;
      const keys = {
        ArrowLeft: () => panBy(step, 0), ArrowRight: () => panBy(-step, 0),
        ArrowUp: () => panBy(0, step), ArrowDown: () => panBy(0, -step),
        "+": () => zoomCentre(1.25), "=": () => zoomCentre(1.25), "-": () => zoomCentre(0.8), "0": reset,
      };
      if (keys[e.key]) { e.preventDefault(); keys[e.key](); }
    });
    svg.addEventListener("keyup", (e) => {
      if (e.key !== " " || !spaceOn) return;
      const n = spaceOn; spaceOn = null;
      if (e.target === n) { e.preventDefault && e.preventDefault(); activate(n, e); }
    });
    apply();
    return { zoomBy: zoomCentre, reset, panBy, moveBy, get state() { return { k, tx, ty }; } };
  }

  root.fcGraph = { SHAPES, TEXTURES, PROXIMITY, SIZES, SERIES, shapePath, extent, bottom, metrics, ringRadius, outerRadius, hitRadius, bracketPath, minorGridVisible, defs, node, trimEdge, panZoom };
})(typeof window !== "undefined" ? window : globalThis);
