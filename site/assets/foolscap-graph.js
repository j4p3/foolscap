/* Foolscap graph helpers — geometry that SVG cannot take from CSS.
 *
 * Styling lives in foolscap.css (.fc-graph*); every number here is read from the
 * --fc-component-graph-* custom properties so figures follow the tokens.
 * Framework-free and side-effect-free at load: exposes window.fcGraph.
 *
 *   fcGraph.metrics(el?)            -> px geometry resolved from tokens
 *   fcGraph.shapePath(shape, r)     -> closed SVG path, equal-area to a circle of r
 *   fcGraph.extent(shape, r)        -> max distance from centre (label/edge clearance)
 *   fcGraph.ringRadius(r, prox, m)  -> centre-line radius of the proximity ring
 *   fcGraph.outerRadius(r, prox, m) -> outer edge incl. focus ring (layout collision)
 *   fcGraph.defs(m)                 -> <pattern>/<marker> markup for one <defs>
 *   fcGraph.node(opts, m)           -> <g class="fc-graph-node ..."> markup
 *   fcGraph.trimEdge(a, b, ra, rb)  -> edge endpoints clipped to node rings
 *   fcGraph.panZoom(svg, viewport, opts) -> pointer/wheel/keyboard pan+zoom+node drag
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
      grid: { size: px("grid-size"), major: px("grid-size-major") },
      glyph: px("legend-glyph-size"),
    };
  }

  const ringRadius = (r, prox, m) => r + m.haloGap + (m.ring[prox] || 0) / 2;
  const outerRadius = (r, prox, m) =>
    r + m.haloGap + (m.ring[prox] || 0) + m.focusOffset + m.focusWidth;

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

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* opts: { x, y, shape, size, series, texture, proximity, label, labelMuted,
             selected, dimmed, id, focusable, attrs } — all optional. */
  function node(o, m) {
    const shape = o.shape || "circle";
    const size = o.size || "md";
    const prox = o.proximity || "none";
    const r = m.radius[size];
    const ringR = ringRadius(r, prox, m);
    const focusR = r + m.haloGap + m.ring[prox] + m.focusOffset + m.focusWidth / 2;
    const labelY = f(bottom(shape, r + m.haloGap + m.ring[prox]) + m.labelGap);
    const cls = ["fc-graph-node", `fc-graph-size-${size}`, `fc-graph-proximity-${prox}`,
      `fc-graph-texture-${o.texture || "solid"}`];
    if (o.series) cls.push(`fc-graph-series-${o.series}`);
    if (o.selected) cls.push("fc-graph-node-selected");
    if (o.dimmed) cls.push("fc-graph-node-dimmed");
    const d = shapePath(shape, r);
    const extra = Object.entries(o.attrs || {}).map(([k, val]) => ` ${k}="${esc(val)}"`).join("");
    const focusable = o.focusable === false ? "" : ` tabindex="0" role="button"`;
    const aria = o.label ? ` aria-label="${esc(o.label)}"` : "";
    return (
      `<g class="${cls.join(" ")}" transform="translate(${f(o.x || 0)} ${f(o.y || 0)})"` +
      `${o.id ? ` data-id="${esc(o.id)}"` : ""}${focusable}${aria}${extra}>` +
      `<circle class="fc-graph-node-hit" r="${f(Math.max(m.hit, outerRadius(r, prox, m)))}"/>` +
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

  /* Minimal pan/zoom + node drag. Pan: drag empty canvas. Zoom: wheel / pinch-less
     buttons via returned api.zoomBy(k). Keyboard on canvas: arrows pan, +/- zoom,
     0 resets. Nodes (".fc-graph-node") drag; onMove(el, x, y) lets the caller
     re-route edges. No animation (instant state changes). */
  function panZoom(svg, viewport, opts = {}) {
    const min = opts.minScale ?? 0.25, max = opts.maxScale ?? 4, step = opts.step ?? 48;
    let k = 1, tx = 0, ty = 0, drag = null;
    const apply = () => viewport.setAttribute("transform", `translate(${f(tx)} ${f(ty)}) scale(${f(k)})`);
    const pt = (e) => { const b = svg.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
    const zoomAt = (factor, cx, cy) => {
      const nk = Math.min(max, Math.max(min, k * factor));
      tx = cx - ((cx - tx) * nk) / k; ty = cy - ((cy - ty) * nk) / k; k = nk; apply();
    };
    svg.addEventListener("wheel", (e) => {
      e.preventDefault();
      const p = pt(e); zoomAt(Math.exp(-e.deltaY * 0.0015), p.x, p.y);
    }, { passive: false });
    svg.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const n = e.target.closest(".fc-graph-node");
      const p = pt(e);
      if (n && viewport.contains(n)) {
        const m = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(n.getAttribute("transform") || "") || [0, 0, 0];
        drag = { kind: "node", el: n, ox: +m[1], oy: +m[2], sx: p.x, sy: p.y, id: e.pointerId, live: false };
      } else {
        drag = { kind: "pan", sx: p.x, sy: p.y, tx, ty, id: e.pointerId, live: false };
      }
    });
    svg.addEventListener("pointermove", (e) => {
      if (!drag) return;
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
      else {
        const x = drag.ox + (p.x - drag.sx) / k, y = drag.oy + (p.y - drag.sy) / k;
        drag.el.setAttribute("transform", `translate(${f(x)} ${f(y)})`);
        opts.onMove && opts.onMove(drag.el, x, y);
      }
    });
    let suppressClick = false;
    const end = () => {
      if (!drag) return;
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
    svg.addEventListener("keydown", (e) => {
      if (e.target !== svg) return;
      const b = svg.getBoundingClientRect();
      const keys = {
        ArrowLeft: () => { tx += step; apply(); }, ArrowRight: () => { tx -= step; apply(); },
        ArrowUp: () => { ty += step; apply(); }, ArrowDown: () => { ty -= step; apply(); },
        "+": () => zoomAt(1.25, b.width / 2, b.height / 2), "=": () => zoomAt(1.25, b.width / 2, b.height / 2),
        "-": () => zoomAt(0.8, b.width / 2, b.height / 2), "0": () => { k = 1; tx = 0; ty = 0; apply(); },
      };
      if (keys[e.key]) { e.preventDefault(); keys[e.key](); }
    });
    apply();
    return {
      zoomBy: (factor) => { const b = svg.getBoundingClientRect(); zoomAt(factor, b.width / 2, b.height / 2); },
      reset: () => { k = 1; tx = 0; ty = 0; apply(); },
      get state() { return { k, tx, ty }; },
    };
  }

  root.fcGraph = { SHAPES, TEXTURES, PROXIMITY, SIZES, SERIES, shapePath, extent, bottom, metrics, ringRadius, outerRadius, defs, node, trimEdge, panZoom };
})(typeof window !== "undefined" ? window : globalThis);
