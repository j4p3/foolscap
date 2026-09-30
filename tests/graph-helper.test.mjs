/**
 * Behaviour tests for site/assets/foolscap-graph.js — run the real helper in a
 * vm context with metrics resolved from the built token CSS (dist/), and a
 * minimal fake DOM for panZoom. Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
spawnSync(process.execPath, [join(root, "scripts/build-tokens.mjs")], { encoding: "utf8" });
const src = read("site/assets/foolscap-graph.js");

// Light-mode custom properties from the generated vars (first :root block).
const lightVars = new Map(
  [...read("dist/foolscap.vars.css").split('[data-theme="dark"]')[0].matchAll(/(--fc-[\w-]+):\s*([^;]+);/g)]
    .map((m) => [m[1], m[2].trim()]),
);

function load(win = {}) {
  const documentElement = {};
  const ctx = {
    window: Object.assign({
      document: { documentElement },
      getComputedStyle: () => ({ fontSize: "16px", getPropertyValue: (n) => lightVars.get(n) || "" }),
      MouseEvent: class { constructor(type, init) { this.type = type; Object.assign(this, init); } },
    }, win),
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx.window.fcGraph;
}
const G = load();
const M = G.metrics();
const SHAPES = ["circle", "square", "diamond", "triangle", "hexagon"];
const PROX = ["past", "now", "near", "far", "none"];
const SIZES = ["sm", "md", "lg"];

// ---- tiny markup reader (enough to prove what the helper emitted) ----
const openTag = (html) => html.slice(0, html.indexOf(">") + 1);
function attrsOf(tag) {
  const body = tag.replace(/^<\w+/, "").replace(/\/?>$/, "");
  const out = {};
  const re = /\s+([^\s="'<>\/]+)="([^"]*)"/y;
  let i = 0, m;
  while ((re.lastIndex = i, m = re.exec(body))) { out[m[1]] = m[2]; i = re.lastIndex; }
  assert.equal(body.slice(i).trim(), "", `unparsed tail in ${tag}`);
  return out;
}
const numbersIn = (html) => [...html.matchAll(/\b(?:r|y|d)="([^"]*)"/g)].map((m) => m[1]).join(" ");

// ---------- (1) node() markup cannot be injected ----------
test("node(): hostile channel values fall back to defaults and cannot break the class attribute", () => {
  const evil = '" onmouseover="alert(1)';
  const html = G.node({ texture: evil, series: evil, size: evil, proximity: evil, shape: evil, label: "x" }, M);
  const a = attrsOf(openTag(html));
  assert.equal(Object.keys(a).some((k) => /^on/i.test(k)), false, "event attribute injected");
  const cls = a.class.split(" ");
  assert.ok(cls.includes("fc-graph-texture-solid"));
  assert.ok(cls.includes("fc-graph-size-md"));
  assert.ok(cls.includes("fc-graph-proximity-none"));
  assert.equal(cls.some((c) => /series/.test(c) && c !== "fc-graph-series-1"), false);
  for (const c of cls) assert.match(c, /^fc-graph-[a-z0-9-]+$/);
  assert.doesNotMatch(html, /onmouseover|alert/);
});

test("node(): numeric-string series is accepted, out-of-range series is not", () => {
  assert.match(openTag(G.node({ series: "3" }, M)), /fc-graph-series-3/);
  assert.doesNotMatch(openTag(G.node({ series: 7 }, M)), /fc-graph-series-7/);
});

test("node(): quotes in label and id are escaped (double and single)", () => {
  const html = G.node({ label: `a"b'c<d>`, id: `i"d' onclick='x` }, M);
  const a = attrsOf(openTag(html));
  assert.equal(a["aria-label"], "a&quot;b&#39;c&lt;d&gt;");
  assert.equal(a["data-id"], "i&quot;d&#39; onclick=&#39;x");
  assert.equal(Object.keys(a).some((k) => /^on/i.test(k)), false);
});

test("node(): attrs allow only aria-*, data-*, role, tabindex", () => {
  const ok = attrsOf(openTag(G.node({ attrs: { "aria-describedby": "d1", "data-kind": "k", role: "link", tabindex: "-1" } }, M)));
  assert.equal(ok["aria-describedby"], "d1");
  assert.equal(ok["data-kind"], "k");
  assert.equal(ok.role, "link", "attrs override built-in role, not duplicate it");
  assert.equal(ok.tabindex, "-1");
  for (const bad of ["onclick", "ONLOAD", "onfocus", "href", "xlink:href", "style", "class", "transform",
    'x" onload="y', "data-a b", "aria-", "on", "formaction", "src"]) {
    assert.throws(() => G.node({ attrs: { [bad]: "1" } }, M), { name: "TypeError" }, `accepted attr ${bad}`);
  }
});

test("node(): attr values are escaped and nullish values dropped", () => {
  const a = attrsOf(openTag(G.node({ attrs: { "data-x": `"><script>`, "data-y": null, "data-z": undefined } }, M)));
  assert.equal(a["data-x"], "&quot;&gt;&lt;script&gt;");
  assert.ok(!("data-y" in a) && !("data-z" in a));
});

test("node(): tag with duplicate attributes is never emitted", () => {
  const tag = openTag(G.node({ label: "L", id: "n", attrs: { "aria-label": "Full description", "data-id": "z" } }, M));
  const names = [...tag.matchAll(/\s([^\s=]+)="/g)].map((m) => m[1]);
  assert.equal(new Set(names).size, names.length, `duplicates in ${tag}`);
  assert.equal(attrsOf(tag)["aria-label"], "Full description");
});

test("node(): non-finite coordinates become 0 and never emit NaN/Infinity", () => {
  for (const v of [NaN, Infinity, -Infinity, "12px", {}, undefined, "1e999"]) {
    const html = G.node({ x: v, y: v, label: "n" }, M);
    assert.match(openTag(html), /transform="translate\(0 0\)"/, `x=${String(v)}`);
    assert.doesNotMatch(html, /NaN|Infinity|undefined/);
  }
  assert.match(openTag(G.node({ x: "40", y: -3.456 }, M)), /translate\(40 -3.46\)/);
});

test("node(): unknown size/shape/proximity never produce NaN geometry", () => {
  const html = G.node({ size: "xl", shape: "star", proximity: "soon", label: "n" }, M);
  assert.doesNotMatch(numbersIn(html), /NaN|undefined|Infinity/);
  assert.equal(html, G.node({ label: "n" }, M), "falls back to md/circle/none");
});

test("node(): non-finite or non-positive radius in metrics is rejected", () => {
  for (const r of [NaN, 0, -4, Infinity, undefined]) {
    const bad = Object.assign({}, M, { radius: Object.assign({}, M.radius, { md: r }) });
    assert.throws(() => G.node({}, bad), { name: "RangeError" }, `radius ${r}`);
  }
});

// ---------- (2) shape-aware outer radius, edge trim and label anchor ----------
// Independent geometry: parse the emitted focus path and build the true outer
// outline of its stroke (edges offset by w/2, adjacent offsets intersected =
// SVG miter joins; all shapes' joins are within the default miterlimit 4).
function outline(d, w) {
  const arc = /A([\d.]+) /.exec(d);
  if (arc) {
    const R = +arc[1] + w / 2, pts = [];
    for (let i = 0; i < 360; i++) pts.push([R * Math.cos((i * Math.PI) / 180), R * Math.sin((i * Math.PI) / 180)]);
    return pts;
  }
  const nums = d.replace(/[MLZHV]/g, (c) => ` ${c} `).trim().split(/\s+/);
  const v = []; let x = 0, y = 0;
  for (let i = 0; i < nums.length; i++) {
    const c = nums[i];
    if (c === "M" || c === "L") { x = +nums[++i]; y = +nums[++i]; v.push([x, y]); }
    else if (c === "H") { x = +nums[++i]; v.push([x, y]); }
    else if (c === "V") { y = +nums[++i]; v.push([x, y]); }
  }
  const n = v.length;
  // signed area → orientation, so "outward" normals point away from the centre
  let A = 0; for (let i = 0; i < n; i++) { const [a, b] = v[i], [c2, d2] = v[(i + 1) % n]; A += a * d2 - c2 * b; }
  const s = A > 0 ? 1 : -1;
  const lines = v.map((p, i) => {
    const q = v[(i + 1) % n], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy);
    const nx = (s * dy) / L, ny = (-s * dx) / L;
    return { p: [p[0] + nx * w / 2, p[1] + ny * w / 2], d: [dx, dy] };
  });
  return lines.map((l1, i) => {
    const l2 = lines[(i + 1) % n];
    const den = l1.d[0] * l2.d[1] - l1.d[1] * l2.d[0];
    const t = ((l2.p[0] - l1.p[0]) * l2.d[1] - (l2.p[1] - l1.p[1]) * l2.d[0]) / den;
    return [l1.p[0] + t * l1.d[0], l1.p[1] + t * l1.d[1]];
  });
}
const inside = (pts, [x, y]) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const focusPath = (html) => /class="fc-graph-node-focus" d="([^"]+)"/.exec(html)[1];
const cases = SHAPES.flatMap((shape) => SIZES.flatMap((size) => PROX.map((prox) => ({ shape, size, prox }))));

test("outerRadius(shape, r, prox, m) bounds the full focus-ring stroke for every shape/size/proximity", () => {
  for (const { shape, size, prox } of cases) {
    const r = M.radius[size];
    const pts = outline(focusPath(G.node({ shape, size, proximity: prox }, M)), M.focusWidth);
    const truth = Math.max(...pts.map(([x, y]) => Math.hypot(x, y)));
    const got = G.outerRadius(shape, r, prox, M);
    assert.ok(got >= truth - 0.05, `${shape}/${size}/${prox}: outerRadius ${got} < true extent ${truth.toFixed(2)}`);
    assert.ok(got <= truth + 0.5, `${shape}/${size}/${prox}: outerRadius ${got} too loose vs ${truth.toFixed(2)}`);
  }
});

test("reviewed case: overdue large triangle clears ~42px, not 27px", () => {
  const got = G.outerRadius("triangle", M.radius.lg, "past", M);
  assert.ok(got > 41, `got ${got}`);
});

test("outerRadius rejects the old (r, prox, m) call shape and unknown shapes", () => {
  assert.throws(() => G.outerRadius(M.radius.md, "none", M), { name: "TypeError" });
  assert.throws(() => G.outerRadius("star", M.radius.md, "none", M), { name: "TypeError" });
});

test("trimEdge with outerRadius ends every edge outside the focus-ring outline at any angle", () => {
  for (const { shape, size, prox } of cases) {
    const r = M.radius[size];
    // shrink by 0.02px: helper output is rounded to 0.01px (tangent contact is fine)
    const pts = outline(focusPath(G.node({ shape, size, proximity: prox }, M)), M.focusWidth)
      .map(([x, y]) => { const k = 1 - 0.02 / Math.hypot(x, y); return [x * k, y * k]; });
    const rb = G.outerRadius(shape, r, prox, M);
    for (let deg = 0; deg < 360; deg += 7.5) {
      const a = { x: 400 * Math.cos((deg * Math.PI) / 180), y: 400 * Math.sin((deg * Math.PI) / 180) };
      const t = G.trimEdge(a, { x: 0, y: 0 }, 0, rb);
      assert.equal(inside(pts, [t.x2, t.y2]), false, `${shape}/${size}/${prox} @${deg}°: arrow tip inside ring`);
    }
  }
});

test("hit disc covers the whole focus ring", () => {
  for (const { shape, size, prox } of cases) {
    const html = G.node({ shape, size, proximity: prox }, M);
    const hit = +/class="fc-graph-node-hit" r="([^"]+)"/.exec(html)[1];
    const truth = Math.max(...outline(focusPath(html), M.focusWidth).map(([x, y]) => Math.hypot(x, y)));
    assert.ok(hit >= truth - 0.05 && hit >= M.hit, `${shape}/${size}/${prox}: hit ${hit} < ${truth.toFixed(2)}`);
  }
});

test("label anchor sits below the full focus-ring stroke plus label gap", () => {
  for (const { shape, size, prox } of cases) {
    const html = G.node({ shape, size, proximity: prox, label: "L" }, M);
    const y = +/<text [^>]*y="([^"]+)"/.exec(html)[1];
    const bottom = Math.max(...outline(focusPath(html), M.focusWidth).map((p) => p[1]));
    assert.ok(y >= bottom + M.labelGap - 0.05, `${shape}/${size}/${prox}: label y ${y} < ${(bottom + M.labelGap).toFixed(2)}`);
    assert.ok(y <= bottom + M.labelGap + 0.5, `${shape}/${size}/${prox}: label y ${y} floats too far`);
  }
});

// ---------- (3)/(7) panZoom interaction, on a minimal fake DOM ----------
class FakeEl {
  constructor(cls = "", parent = null) {
    this.attrs = new Map(); this.parent = parent; this.listeners = {}; this.dispatched = [];
    this.cls = new Set(cls.split(" ").filter(Boolean)); this.captured = [];
    const self = this;
    this.classList = { add: (c) => self.cls.add(c), remove: (c) => self.cls.delete(c), contains: (c) => self.cls.has(c) };
  }
  setAttribute(k, v) { this.attrs.set(k, String(v)); }
  getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
  closest(sel) { for (let n = this; n; n = n.parent) if (n.cls.has(sel.slice(1))) return n; return null; }
  contains(n) { for (; n; n = n.parent) if (n === this) return true; return false; }
  addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); }
  getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 400 }; }
  setPointerCapture(id) { this.captured.push(id); }
  releasePointerCapture() {}
  hasPointerCapture(id) { return this.captured.includes(id); }
  dispatchEvent(ev) { this.dispatched.push(ev); return true; }
}
function rig(opts = {}) {
  const svg = new FakeEl("fc-graph-canvas");
  const viewport = new FakeEl("fc-graph-viewport", svg);
  const nodeEl = new FakeEl("fc-graph-node", viewport);
  nodeEl.setAttribute("transform", "translate(100 50)");
  const shape = new FakeEl("fc-graph-node-shape", nodeEl);
  const moves = [];
  const api = G.panZoom(svg, viewport, Object.assign({ onMove: (el, x, y) => moves.push([x, y]) }, opts));
  const fire = (type, init) => {
    const ev = Object.assign({ type, button: 0, pointerId: 1, isPrimary: true, clientX: 0, clientY: 0, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() { this.stopped = true; } }, init);
    for (const fn of svg.listeners[type] || []) fn(ev);
    return ev;
  };
  return { svg, viewport, nodeEl, shape, moves, api, fire };
}
const key = (r, target, k, extra = {}) => r.fire("keydown", Object.assign({ target, key: k }, extra));

test("Enter on a focused node activates it (synthetic click by default)", () => {
  const r = rig();
  const ev = key(r, r.nodeEl, "Enter");
  assert.equal(ev.defaultPrevented, true);
  assert.equal(r.nodeEl.dispatched.length, 1);
  assert.equal(r.nodeEl.dispatched[0].type, "click");
});

test("Space activates on keyup (like a native button) and never scrolls the page", () => {
  const r = rig();
  const down = key(r, r.nodeEl, " ");
  assert.equal(down.defaultPrevented, true);
  assert.equal(r.nodeEl.dispatched.length, 0, "activate on keyup, not keydown");
  r.fire("keyup", { target: r.nodeEl, key: " " });
  assert.equal(r.nodeEl.dispatched.length, 1);
});

test("onActivate option replaces the synthetic click", () => {
  const got = [];
  const r = rig({ onActivate: (el, e) => got.push([el, e.key]) });
  key(r, r.nodeEl, "Enter");
  assert.deepEqual(got, [[r.nodeEl, "Enter"]]);
  assert.equal(r.nodeEl.dispatched.length, 0);
});

test("a stale post-drag click suppression never swallows keyboard activation", () => {
  const r = rig();
  r.fire("pointerdown", { target: r.shape, clientX: 10, clientY: 10 });
  r.fire("pointermove", { target: r.shape, clientX: 40, clientY: 10 });
  r.fire("pointerup", { target: r.shape });
  // no click followed the drag (released off-canvas); now activate by key
  key(r, r.nodeEl, "Enter");
  const clickEv = r.fire("click", { target: r.nodeEl });
  assert.notEqual(clickEv.stopped, true, "keyboard click was swallowed");
});

test("Arrow keys on a focused node move it and report onMove; Shift moves further", () => {
  const r = rig();
  const ev = key(r, r.nodeEl, "ArrowRight");
  assert.equal(ev.defaultPrevented, true);
  assert.equal(r.nodeEl.getAttribute("transform"), "translate(108 50)");
  key(r, r.nodeEl, "ArrowUp", { shiftKey: true });
  assert.equal(r.nodeEl.getAttribute("transform"), "translate(108 18)");
  assert.deepEqual(r.moves, [[108, 50], [108, 18]]);
  assert.deepEqual({ ...r.api.state }, { k: 1, tx: 0, ty: 0 }, "node keys must not pan");
});

test("keyboardMove:false leaves node arrows alone", () => {
  const r = rig({ keyboardMove: false });
  const ev = key(r, r.nodeEl, "ArrowRight");
  assert.equal(ev.defaultPrevented, false);
  assert.equal(r.nodeEl.getAttribute("transform"), "translate(100 50)");
});

test("api.moveBy / api.panBy give single-pointer (button) alternatives to dragging", () => {
  const r = rig();
  r.api.moveBy(r.nodeEl, -10, 5);
  assert.equal(r.nodeEl.getAttribute("transform"), "translate(90 55)");
  assert.deepEqual(r.moves, [[90, 55]]);
  r.api.panBy(20, -30);
  assert.deepEqual({ ...r.api.state }, { k: 1, tx: 20, ty: -30 });
});

test("Ctrl/Meta/Alt + zoom keys are left to the browser", () => {
  for (const mod of ["ctrlKey", "metaKey", "altKey"]) {
    for (const k of ["+", "=", "-", "0", "ArrowLeft"]) {
      const r = rig();
      const ev = key(r, r.svg, k, { [mod]: true });
      assert.equal(ev.defaultPrevented, false, `${mod}+${k} prevented`);
      assert.deepEqual({ ...r.api.state }, { k: 1, tx: 0, ty: 0 }, `${mod}+${k} changed view`);
    }
  }
  const r = rig();
  assert.equal(key(r, r.svg, "+").defaultPrevented, true, "plain + still zooms the canvas");
  assert.equal(r.api.state.k, 1.25);
});

test("a second pointer cannot hijack or end an in-progress drag", () => {
  const r = rig();
  r.fire("pointerdown", { target: r.shape, pointerId: 1, clientX: 0, clientY: 0 });
  r.fire("pointermove", { target: r.shape, pointerId: 1, clientX: 10, clientY: 0 });
  assert.equal(r.nodeEl.getAttribute("transform"), "translate(110 50)");
  // second finger lands on the canvas and moves: must not pan, retarget or move the node
  r.fire("pointerdown", { target: r.svg, pointerId: 2, isPrimary: false, clientX: 300, clientY: 300 });
  r.fire("pointermove", { target: r.svg, pointerId: 2, isPrimary: false, clientX: 500, clientY: 100 });
  assert.equal(r.nodeEl.getAttribute("transform"), "translate(110 50)");
  assert.deepEqual({ ...r.api.state }, { k: 1, tx: 0, ty: 0 });
  // second finger lifts: first drag continues
  r.fire("pointerup", { target: r.svg, pointerId: 2, isPrimary: false });
  r.fire("pointermove", { target: r.shape, pointerId: 1, clientX: 20, clientY: 5 });
  assert.equal(r.nodeEl.getAttribute("transform"), "translate(120 55)");
  assert.deepEqual(r.svg.captured, [1], "only the owning pointer is captured");
  r.fire("pointerup", { target: r.shape, pointerId: 1 });
  assert.equal(r.nodeEl.cls.has("fc-graph-node-dragging"), false);
});

test("pointercancel of the owning pointer ends the drag", () => {
  const r = rig();
  r.fire("pointerdown", { target: r.svg, pointerId: 1, clientX: 0, clientY: 0 });
  r.fire("pointermove", { target: r.svg, pointerId: 1, clientX: 30, clientY: 0 });
  r.fire("pointercancel", { target: r.svg, pointerId: 1 });
  r.fire("pointermove", { target: r.svg, pointerId: 1, clientX: 90, clientY: 0 });
  assert.equal(r.api.state.tx, 30);
});

test("Ctrl/Meta + wheel (browser zoom, trackpad pinch) is not intercepted", () => {
  for (const mod of ["ctrlKey", "metaKey"]) {
    const r = rig();
    const ev = r.fire("wheel", { target: r.svg, deltaY: -100, [mod]: true });
    assert.equal(ev.defaultPrevented, false);
    assert.equal(r.api.state.k, 1);
  }
  const r = rig();
  assert.equal(r.fire("wheel", { target: r.svg, deltaY: -100 }).defaultPrevented, true);
  assert.ok(r.api.state.k > 1);
});

// ---------- (4) dimmed nodes keep readable labels; (5) unassigned fill is visible ----------
const allVars = read("dist/foolscap.vars.css");
const [lightCss, darkCss] = allVars.split('[data-theme="dark"]');
const varIn = (css, name) => (new RegExp(`${name}:\\s*([^;]+);`).exec(css) || [])[1];
const modeVar = (mode, name) => (mode === "dark" && varIn(darkCss, name)) || varIn(lightCss, name);
function lum(hex) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const graphBlock = (() => { const css = read("site/assets/foolscap.css"); const s = css.indexOf("/* ---------- graph"); return css.slice(s, css.indexOf("/* legend", s)); })();

test("dimmed state never lowers the node as a whole, its label, outline or focus ring", () => {
  const rules = [...graphBlock.matchAll(/([^{}]+)\{([^}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2] }));
  const dimRules = rules.filter((r) => /fc-graph-node-dimmed/.test(r.sel));
  assert.ok(dimRules.length > 0, "dimmed state must still have a visual treatment");
  for (const r of dimRules) {
    for (const sel of r.sel.split(",").map((s) => s.trim())) {
      if (/(^|[;\s])(fill-|stroke-)?opacity\s*:/.test(r.body)) {
        assert.doesNotMatch(sel, /fc-graph-node-dimmed\s*$/, `whole-node opacity: ${sel}`);
        assert.doesNotMatch(sel, /label|focus|hit/, `dims ${sel}`);
      }
    }
  }
  // The only things faded are decoration layers.
  const faded = dimRules.filter((r) => /(^|[;\s])(fill-|stroke-)?opacity\s*:/.test(r.body)).flatMap((r) => r.sel.split(",").map((s) => s.trim()));
  for (const sel of faded) assert.match(sel, /fc-graph-node-(shape|texture|halo)\b/, `unexpected dimmed target ${sel}`);
  // Where the shape is faded, its outline stroke must stay at full strength.
  for (const r of dimRules.filter((r) => /fc-graph-node-shape/.test(r.sel))) {
    const props = [...r.body.matchAll(/([\w-]+)\s*:/g)].map((m) => m[1]).filter((p) => !p.startsWith("--"));
    assert.deepEqual(props, ["fill-opacity"], "shape dims by fill-opacity only, so its outline keeps 3:1");
  }
});

test("unassigned node fill and its texture clear 3:1 in both modes", () => {
  for (const mode of ["light", "dark"]) {
    const fill = modeVar(mode, "--fc-component-graph-node-fill");
    const bg = modeVar(mode, "--fc-component-graph-background");
    const ink = modeVar(mode, "--fc-component-graph-texture-ink");
    assert.ok(ratio(fill, bg) >= 3, `${mode}: default fill ${fill} on ${bg} = ${ratio(fill, bg).toFixed(2)}`);
    assert.ok(ratio(ink, fill) >= 3, `${mode}: texture ${ink} on default fill ${fill} = ${ratio(ink, fill).toFixed(2)}`);
  }
});

test("contrast gate audits the unassigned fill and its texture", () => {
  const r = spawnSync(process.execPath, [join(root, "scripts/check-contrast.mjs")], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /graph node fill \(no series\)/);
  assert.match(r.stdout, /graph texture on default fill/);
});

// ---------- (6) documented semantics and client binding ----------
test("docs: accessible equivalents, keyboard binding, new outerRadius signature, dimming rule", () => {
  const doc = read("docs/graph.md");
  assert.match(doc, /outerRadius\(shape, r, prox, m\)/);
  assert.doesNotMatch(doc, /outerRadius\(r, prox, m\)/, "stale signature in docs");
  assert.match(doc, /## Accessibility/);
  assert.match(doc, /table/i);
  assert.match(doc, /edges?/i);
  assert.match(doc, /not (?:a )?complete|incomplete|not sufficient|isn't enough|is not enough/i, "must say helper semantics alone are incomplete");
  for (const k of ["Enter", "Space", "onActivate", "keyboardMove", "moveBy", "panBy", "Ctrl"]) assert.ok(doc.includes(k), `docs lack ${k}`);
  assert.match(doc, /aria-\*.*data-\*.*role.*tabindex/s, "docs state the attrs allowlist");
  assert.doesNotMatch(doc, /`dimmed` \(opacity `node\.opacity-dimmed`\)/, "stale whole-node dimming rule");
});

test("styleguide: specimen ships a table equivalent and single-pointer move controls", () => {
  const sg = read("site/styleguide.html");
  assert.match(sg, /id="sgGraphTable"/);
  assert.match(sg, /data-move=/, "no button-based move controls");
  assert.match(sg, /data-pan=/, "no button-based pan controls");
  assert.match(sg, /pz\.moveBy\(/);
  assert.doesNotMatch(sg, /G\.outerRadius\(m\.radius/, "stale outerRadius call");
});

// ---------- (8) graph v2 geometry: bracket primitive, grid, touch targets ----------
const rem = (name) => parseFloat(lightVars.get(name)) * 16;

test("metrics() resolves the v2 tokens (grid, touch target, bracket, label line height, link handle)", () => {
  assert.equal(M.grid.size, 48, "3rem minor cell");
  assert.equal(M.grid.major, 192, "12rem major cell");
  assert.equal(M.grid.minorMinScale, 0.6);
  assert.equal(M.touchMin, 44);
  assert.equal(M.lineHeight, rem("--fc-component-graph-label-line-height"));
  assert.equal(M.linkHandle, rem("--fc-component-graph-link-handle-radius"));
  assert.deepEqual({ ...M.objective }, {
    arm: rem("--fc-component-graph-objective-bracket-arm"),
    width: rem("--fc-component-graph-objective-bracket-width"),
    padX: rem("--fc-component-graph-objective-padding-x"),
    padY: rem("--fc-component-graph-objective-padding-y"),
  });
});

test("defs(): grid pattern tiles one 12rem major cell with 3 minor lines per axis", () => {
  const d = G.defs(M);
  assert.match(d, /<pattern id="fc-graph-grid" patternUnits="userSpaceOnUse" width="192" height="192">/);
  const minor = /class="fc-graph-grid-line" d="([^"]*)"/.exec(d)[1];
  assert.equal((minor.match(/M/g) || []).length, 6, "3 vertical + 3 horizontal minor lines");
});

test("minorGridVisible(k, m) hides minor lines below grid.minor-min-scale", () => {
  assert.equal(G.minorGridVisible(1, M), true);
  assert.equal(G.minorGridVisible(0.6, M), true, "threshold is inclusive");
  assert.equal(G.minorGridVisible(0.59, M), false);
  assert.equal(G.minorGridVisible(0.25, M), false);
  for (const bad of [NaN, -1, 0, Infinity, "1"]) assert.equal(G.minorGridVisible(bad, M), false, `k=${String(bad)}`);
});

// Parse "M x y H x V y ..." polylines into subpaths of points.
function subpaths(d) {
  const tok = d.replace(/([MHVL])/g, " $1 ").trim().split(/\s+/);
  const out = []; let cur = null, x = 0, y = 0;
  for (let i = 0; i < tok.length; i++) {
    const c = tok[i];
    if (c === "M") { x = +tok[++i]; y = +tok[++i]; cur = [[x, y]]; out.push(cur); }
    else if (c === "L") { x = +tok[++i]; y = +tok[++i]; cur.push([x, y]); }
    else if (c === "H") { x = +tok[++i]; cur.push([x, y]); }
    else if (c === "V") { y = +tok[++i]; cur.push([x, y]); }
    else throw new Error(`unexpected path token ${c} in ${d}`);
  }
  return out;
}

test("bracketPath(w, h, m) draws four open corner brackets around a padded title box", () => {
  const w = 120, h = 20;
  const d = G.bracketPath(w, h, M);
  assert.doesNotMatch(d, /Z/i, "brackets are open, never a closed card");
  const parts = subpaths(d);
  assert.equal(parts.length, 4, "one polyline per corner");
  const X = w / 2 + M.objective.padX, Y = h / 2 + M.objective.padY;
  const corners = parts.map((pts) => pts[1]);
  assert.deepEqual(corners.map(([cx, cy]) => [Math.sign(cx), Math.sign(cy)]).sort(), [[-1, -1], [-1, 1], [1, -1], [1, 1]]);
  for (const pts of parts) {
    assert.equal(pts.length, 3, "arm, corner, arm");
    const [a, c, b] = pts;
    assert.deepEqual(c.map(Math.abs), [X, Y], "corner sits at padded box edge");
    const arms = [Math.hypot(a[0] - c[0], a[1] - c[1]), Math.hypot(b[0] - c[0], b[1] - c[1])];
    for (const len of arms) assert.ok(Math.abs(len - M.objective.arm) < 0.011, `arm ${len} != ${M.objective.arm}`);
  }
});

test("bracketPath: arms never cross on short titles (clamped to half each side)", () => {
  const d = G.bracketPath(2, 2, M);
  for (const pts of subpaths(d)) {
    const [a, c, b] = pts;
    for (const p of [a, b]) {
      assert.ok(Math.sign(p[0]) === Math.sign(c[0]) || p[0] === 0, `arm crosses the vertical centre: ${p}`);
      assert.ok(Math.sign(p[1]) === Math.sign(c[1]) || p[1] === 0, `arm crosses the horizontal centre: ${p}`);
    }
  }
});

test("bracketPath: hostile sizes never emit NaN/Infinity and bad metrics throw", () => {
  for (const [w, h] of [[NaN, 10], [10, Infinity], [-5, -5], ["x", null]]) {
    const d = G.bracketPath(w, h, M);
    assert.doesNotMatch(d, /NaN|Infinity/);
    assert.equal(subpaths(d).length, 4);
  }
  const bad = Object.assign({}, M, { objective: Object.assign({}, M.objective, { arm: 0 }) });
  assert.throws(() => G.bracketPath(10, 10, bad), { name: "RangeError" });
});

test("hitRadius(): exposed touch target never below hit.touch-min / 2", () => {
  for (const { shape, size, prox } of cases) {
    const r = G.hitRadius(shape, M.radius[size], prox, M);
    assert.ok(r * 2 >= M.touchMin, `${shape}/${size}/${prox}: ${r * 2} < ${M.touchMin}`);
    assert.ok(r >= G.outerRadius(shape, M.radius[size], prox, M), "covers the full focus ring");
  }
});

// Controlling cases (TG-04 recovery A2): with the real token metrics every other
// bound already exceeds touch-min / 2, so the check above cannot tell whether the
// touch-min branch exists. These fresh metrics make each bound decide in turn.
const tinyMetrics = (extra = {}) => Object.assign({}, M, {
  hit: 1, touchMin: 44, radius: Object.assign({}, M.radius, { sm: 1 }), haloGap: 0,
  ring: Object.assign({}, M.ring, { none: 0 }), focusOffset: 0, focusWidth: 0,
}, extra);
const renderedHit = (html) => +/class="fc-graph-node-hit" r="([^"]+)"/.exec(html)[1];

test("hitRadius(): touch-min controls when legacy hit and outer geometry are both smaller", () => {
  const m = tinyMetrics();
  const outer = G.outerRadius("circle", 1, "none", m);
  assert.equal(outer, 1, "premise: zero-gap circle's outer radius is its radius");
  assert.ok(m.hit < m.touchMin / 2, "premise: legacy hit radius is below touch-min / 2");
  assert.ok(outer + 0.01 < m.touchMin / 2, "premise: outer geometry is below touch-min / 2");
  assert.equal(G.hitRadius("circle", 1, "none", m), 22);
  assert.equal(M.hit === 1, false, "fresh metrics: shared M untouched");
});

test("node(): rendered hit disc honours touch-min through the real caller", () => {
  const m = tinyMetrics();
  assert.equal(renderedHit(G.node({ shape: "circle", size: "sm", proximity: "none" }, m)), 22);
});

test("hitRadius(): without touch-min the legacy max(hit, outer + 0.01) rule decides", () => {
  const noTouch = tinyMetrics({ touchMin: undefined });
  assert.equal(G.hitRadius("circle", 1, "none", noTouch), 1.01, "outer geometry controls");
  assert.equal(renderedHit(G.node({ shape: "circle", size: "sm", proximity: "none" }, noTouch)), 1.01);
  const hitWins = tinyMetrics({ touchMin: undefined, hit: 9 });
  assert.equal(G.hitRadius("circle", 1, "none", hitWins), 9, "legacy hit controls");
  const outerWins = tinyMetrics({ touchMin: 44, radius: Object.assign({}, M.radius, { sm: 30 }) });
  assert.equal(G.hitRadius("circle", 30, "none", outerWins), 30.01, "outer geometry controls above touch-min / 2");
});
