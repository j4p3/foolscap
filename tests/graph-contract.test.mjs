/**
 * Contract tests for the Foolscap graph pattern (.fc-graph*) and its
 * component.graph.* tokens. Run: npm test  (rebuilds dist/ first).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const tokens = JSON.parse(read("tokens/foolscap.tokens.json"));

const flat = new Map();
(function walk(node, path) {
  for (const [k, v] of Object.entries(node)) {
    if (k.startsWith("$")) continue;
    if (v && typeof v === "object" && "$value" in v) flat.set([...path, k].join("."), v);
    else if (v && typeof v === "object") walk(v, [...path, k]);
  }
})(tokens, []);

const SERIES = [1, 2, 3, 4, 5, 6];
const PROXIMITY = ["past", "now", "near", "far", "none"];
const TEXTURES = ["solid", "hatch", "crosshatch", "dots", "open"];
const SIZES = ["sm", "md", "lg"];

// ---- the exported token interface ----
const REQUIRED_TOKENS = [
  "component.graph.background",
  "component.graph.border",
  "component.graph.canvas.min-height",
  "component.graph.node.hit-radius",
  "component.graph.focus.dash",
  "component.graph.legend.glyph-size",
  "component.graph.legend.swatch-size",
  "component.graph.legend.gap",
  "component.graph.controls.gap",
  "component.graph.grid.line",
  "component.graph.grid.line-major",
  "component.graph.grid.size",
  "component.graph.grid.size-major",
  "component.graph.node.fill",
  "component.graph.node.fill-open",
  "component.graph.node.outline",
  "component.graph.node.outline-width",
  "component.graph.node.outline-width-active",
  "component.graph.node.opacity-dimmed",
  ...SIZES.map((s) => `component.graph.node.radius-${s}`),
  "component.graph.focus.ring",
  "component.graph.focus.width",
  "component.graph.focus.offset",
  "component.graph.label.text",
  "component.graph.label.muted",
  "component.graph.label.halo",
  "component.graph.label.halo-width",
  "component.graph.label.gap",
  "component.graph.label.font-family",
  "component.graph.label.font-size",
  "component.graph.label.font-weight",
  "component.graph.label.font-weight-active",
  "component.graph.edge.line",
  "component.graph.edge.line-emphasis",
  "component.graph.edge.width",
  "component.graph.edge.width-emphasis",
  "component.graph.dash",
  ...SERIES.map((i) => `component.graph.series.${i}`),
  "component.graph.texture.ink",
  "component.graph.texture.gap",
  "component.graph.texture.stroke-width",
  "component.graph.texture.dot-radius",
  "component.graph.halo.gap",
  ...PROXIMITY.flatMap((p) => ["color", "width", "dash"].map((k) => `component.graph.proximity.${p}.${k}`)),
];

// ---- the exported class interface ----
const REQUIRED_CLASSES = [
  "fc-graph", "fc-graph-canvas", "fc-graph-panning", "fc-graph-viewport", "fc-graph-controls",
  "fc-graph-edge", "fc-graph-edge-dashed", "fc-graph-edge-emphasis", "fc-graph-edge-marker",
  "fc-graph-grid", "fc-graph-grid-line", "fc-graph-grid-line-major",
  "fc-graph-node", "fc-graph-node-shape", "fc-graph-node-texture", "fc-graph-node-halo", "fc-graph-node-hit", "fc-graph-node-focus",
  "fc-graph-node-selected", "fc-graph-node-dimmed", "fc-graph-node-dragging",
  "fc-graph-label", "fc-graph-label-muted",
  "fc-graph-texture-line", "fc-graph-texture-dot",
  "fc-graph-legend", "fc-graph-legend-item", "fc-graph-glyph", "fc-graph-swatch",
  ...SERIES.map((i) => `fc-graph-series-${i}`),
  ...TEXTURES.map((t) => `fc-graph-texture-${t}`),
  ...PROXIMITY.map((p) => `fc-graph-proximity-${p}`),
  ...SIZES.map((s) => `fc-graph-size-${s}`),
];

const cssVar = (path) => "--fc-" + path.replaceAll(".", "-");

// Build dist once so every test sees the current token source.
const build = spawnSync(process.execPath, [join(root, "scripts/build-tokens.mjs")], { encoding: "utf8" });

test("token build succeeds", () => {
  assert.equal(build.status, 0, build.stderr);
});

test("component.graph tokens exist in the DTCG source", () => {
  const missing = REQUIRED_TOKENS.filter((p) => !flat.has(p));
  assert.deepEqual(missing, [], `missing tokens: ${missing.join(", ")}`);
});

test("component.graph tokens alias lower tiers (no raw colors except transparent)", () => {
  const raw = [...flat]
    .filter(([p]) => p.startsWith("component.graph."))
    .filter(([, n]) => typeof n.$value === "string" && /^#/.test(n.$value) && !/^#[0-9a-f]{6}00$/i.test(n.$value))
    .map(([p]) => p);
  assert.deepEqual(raw, [], `raw colors in component tier: ${raw.join(", ")}`);
});

test("graph series palette reuses the chart ramp", () => {
  for (const i of SERIES) assert.equal(flat.get(`component.graph.series.${i}`).$value, `{color.chart.${i}}`);
});

test("proximity dash tokens serialize to valid stroke-dasharray values", () => {
  const vars = read("dist/foolscap.vars.css");
  for (const p of PROXIMITY) {
    const m = vars.match(new RegExp(`${cssVar(`component.graph.proximity.${p}.dash`)}: ([^;]+);`));
    assert.ok(m, `dash for ${p} not emitted`);
    assert.match(m[1], /^(none|\d*\.?\d+rem( \d*\.?\d+rem)*)$/, `${p} dash "${m[1]}" is not none or a rem list`);
  }
  const past = vars.match(/--fc-component-graph-proximity-past-dash: ([^;]+);/)[1];
  const far = vars.match(/--fc-component-graph-proximity-far-dash: ([^;]+);/)[1];
  assert.notEqual(past, far, "overdue and later must differ by pattern, not only color");
});

test("existing border.style keywords still serialize unchanged", () => {
  const vars = read("dist/foolscap.vars.css");
  assert.match(vars, /--fc-border-style-dashed: dashed;/);
});

test("dist vars emit every graph token, with dark overrides for mode-sensitive colors", () => {
  const vars = read("dist/foolscap.vars.css");
  const [light, dark] = vars.split('[data-theme="dark"]');
  const missing = REQUIRED_TOKENS.filter((p) => !light.includes(`${cssVar(p)}:`));
  assert.deepEqual(missing, [], `not emitted: ${missing.join(", ")}`);
  for (const p of ["component.graph.background", "component.graph.label.text", "component.graph.series.1", "component.graph.proximity.past.color"]) {
    assert.ok(dark.includes(`${cssVar(p)}:`), `no dark override for ${p}`);
  }
});

test("foolscap.css defines the .fc-graph class interface", () => {
  const css = read("site/assets/foolscap.css");
  const missing = REQUIRED_CLASSES.filter((c) => !new RegExp(`\\.${c}(?![\\w-])`).test(css));
  assert.deepEqual(missing, [], `missing classes: ${missing.join(", ")}`);
});

test("every var(--fc-*) consumed by foolscap.css is emitted", () => {
  const css = read("site/assets/foolscap.css");
  const vars = read("dist/foolscap.vars.css");
  const used = [...new Set([...css.matchAll(/var\((--fc-[\w-]+)/g)].map((m) => m[1]))];
  // Local channel properties (e.g. --fc-graph-fill) are declared in the CSS itself.
  const local = new Set([...css.matchAll(/(--fc-[\w-]+)\s*:/g)].map((m) => m[1]));
  const dangling = used.filter((v) => !vars.includes(`${v}:`) && !local.has(v));
  assert.deepEqual(dangling, [], `dangling vars: ${dangling.join(", ")}`);
});

test("graph block uses tokens only: no raw colors, no blurred shadows or filters", () => {
  const css = read("site/assets/foolscap.css");
  const start = css.indexOf("/* ---------- graph");
  assert.ok(start >= 0, "graph section marker missing");
  const end = css.indexOf("/* ---------- ", start + 10);
  const block = css.slice(start, end < 0 ? undefined : end);
  assert.doesNotMatch(block, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, "raw color in graph block");
  assert.doesNotMatch(block, /drop-shadow|blur\(|box-shadow/i, "shadow/filter in graph block");
});

test("contrast gate covers graph pairs and passes", () => {
  const r = spawnSync(process.execPath, [join(root, "scripts/check-contrast.mjs")], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout);
  for (const note of ["graph label", "graph node outline", "graph edge", "graph focus ring", ...PROXIMITY.filter((p) => p !== "none").map((p) => `graph proximity ${p}`), ...SERIES.map((i) => `graph series ${i}`)]) {
    assert.ok(r.stdout.includes(note), `contrast audit lacks "${note}"`);
  }
});

test("foolscap-graph.js exposes shape geometry and pattern defs helpers", () => {
  const src = read("site/assets/foolscap-graph.js");
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  const g = ctx.window.fcGraph;
  assert.ok(g, "window.fcGraph missing");
  for (const shape of ["circle", "square", "diamond", "triangle", "hexagon"]) {
    const d = g.shapePath(shape, 10);
    assert.match(d, /^M/, `${shape} path`);
    assert.match(d, /Z$/i, `${shape} closed`);
  }
  assert.deepEqual([...g.TEXTURES], TEXTURES);
  assert.deepEqual([...g.PROXIMITY], PROXIMITY);
  assert.equal(typeof g.defs, "function");
  assert.equal(typeof g.metrics, "function");
});

test("styleguide ships a graph specimen and docs describe the pattern", () => {
  const sg = read("site/styleguide.html");
  assert.match(sg, /<section id="graph">/);
  assert.match(sg, /foolscap-graph\.js/);
  assert.ok(existsSync(join(root, "docs/graph.md")), "docs/graph.md missing");
  const doc = read("docs/graph.md");
  for (const c of ["fc-graph-node", "fc-graph-proximity-", "fc-graph-texture-", "component.graph.series"]) assert.ok(doc.includes(c), `docs lack ${c}`);
});
