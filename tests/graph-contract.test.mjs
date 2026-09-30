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

// ======================================================================
// Graph v2 vocabulary (intent TG-04; interfaces §5). Five fixed ink slots,
// objective bracket, hit/cursor/link states, focus/dim, inset/key panels,
// 3rem / 12rem grid. Token names are frozen by the consumer contract.
// ======================================================================
const INKS = [1, 2, 3, 4, 5];
const INK_NAMES = ["forest", "blue", "oxblood", "umber", "graphite"];
const V2_TOKENS = [
  ...INKS.map((i) => `component.graph.ink.${i}`),
  "component.graph.ink.none",
  "component.graph.objective.bracket",
  "component.graph.objective.bracket-width",
  "component.graph.objective.bracket-arm",
  "component.graph.objective.padding-x",
  "component.graph.objective.padding-y",
  "component.graph.objective.font-size-root",
  "component.graph.objective.font-size-nested",
  "component.graph.objective.font-weight-root",
  "component.graph.objective.font-weight-nested",
  "component.graph.objective.caption",
  "component.graph.label.line-height",
  "component.graph.hit.touch-min",
  "component.graph.link.handle-radius",
  "component.graph.link.preview-line",
  "component.graph.link.preview-dash",
  "component.graph.link.target-valid",
  "component.graph.link.target-invalid",
  "component.graph.stream.edge-width",
  "component.graph.edge.opacity-dimmed",
  "component.graph.aggregate.dash",
  "component.graph.done.mark",
  "component.graph.inset.width",
  "component.graph.inset.max-height",
  "component.graph.inset.offset",
  "component.graph.inset.background",
  "component.graph.inset.border",
  "component.graph.inset.shadow",
  "component.graph.key.width",
  "component.graph.key.max-height",
  "component.graph.grid.minor-min-scale",
];
const V2_CLASSES = [
  ...INKS.map((i) => `fc-graph-ink-${i}`), "fc-graph-ink-none",
  "fc-graph-objective", "fc-graph-objective-root", "fc-graph-objective-nested", "fc-graph-objective-bracket",
  "fc-graph-hit", "is-grabbing", "fc-graph-link-handle", "fc-graph-target-valid", "fc-graph-target-invalid",
  "fc-graph-dimmed", "fc-graph-stream", "fc-graph-edge-aggregate", "fc-graph-done",
  "fc-graph-inset", "fc-graph-sheet", "fc-graph-key", "fc-graph-key-toggle", "fc-graph-toolbar",
];

// Resolve a token path to its final literal in a mode (own dark override first).
function tokenValue(path, mode) {
  const node = flat.get(path);
  assert.ok(node, `missing token ${path}`);
  const pick = (n) => (mode === "dark" && n.$extensions?.["fc.modes"]?.dark) || n.$value;
  let v = pick(node);
  const seen = new Set();
  while (typeof v === "string" && /^\{[^}]+\}$/.test(v)) {
    const ref = v.slice(1, -1);
    assert.ok(!seen.has(ref), `alias cycle at ${ref}`);
    seen.add(ref);
    v = pick(flat.get(ref));
  }
  return v;
}
function luminance(hex) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
}
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const graphCss = () => {
  const css = read("site/assets/foolscap.css");
  const start = css.indexOf("/* ---------- graph");
  return css.slice(start, css.indexOf("/* Reduced motion", start));
};
const rulesOf = (block) => [...block.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map((m) => ({ sel: m[1].replace(/\/\*[\s\S]*?\*\//g, "").trim(), body: m[2] }));
const declared = (rules, selector, prop) => rules
  .filter((r) => r.sel.split(",").map((s) => s.trim()).includes(selector))
  .map((r) => new RegExp(`(?:^|[;\\s])${prop}\\s*:\\s*([^;]+);`).exec(r.body)?.[1]?.trim())
  .filter(Boolean).pop();

test("v2: every frozen component.graph token exists", () => {
  const missing = V2_TOKENS.filter((p) => !flat.has(p));
  assert.deepEqual(missing, [], `missing v2 tokens: ${missing.join(", ")}`);
});

test("v2: ink palette is versioned and slots follow the fixed order forest, blue, oxblood, umber, graphite", () => {
  const group = tokens.component.graph.ink;
  assert.equal(group.$extensions?.["fc.palette"]?.version, 1, "ink group must carry fc.palette.version = 1");
  INKS.forEach((i, idx) => {
    const d = flat.get(`component.graph.ink.${i}`).$description || "";
    assert.match(d.toLowerCase(), new RegExp(INK_NAMES[idx]), `ink.${i} must be ${INK_NAMES[idx]}`);
  });
  assert.match((flat.get("component.graph.ink.none").$description || "").toLowerCase(), /no texture/);
});

test("v2: each ink has an explicit dark counterpart and all six treatments differ in each theme", () => {
  for (const p of [...INKS.map((i) => `component.graph.ink.${i}`), "component.graph.ink.none"]) {
    assert.ok(flat.get(p).$extensions?.["fc.modes"]?.dark, `${p} lacks fc.modes.dark`);
  }
  for (const mode of ["light", "dark"]) {
    const values = [...INKS.map((i) => `component.graph.ink.${i}`), "component.graph.ink.none"].map((p) => tokenValue(p, mode).toUpperCase());
    assert.equal(new Set(values).size, 6, `${mode}: ink values collide ${values.join(" ")}`);
  }
  // The five inks re-theme (dark ink on dark plate would fail); the neutral
  // "No texture" treatment may keep the same mid-grey in both themes.
  const vars = read("dist/foolscap.vars.css");
  const dark = vars.split('[data-theme="dark"]')[1];
  for (const p of INKS.map((i) => `component.graph.ink.${i}`)) {
    assert.ok(dark.includes(`${cssVar(p)}:`), `no dark override emitted for ${p}`);
  }
});

test("v2: text >= 4.5:1 and important non-text >= 3:1 against the graph and inset planes, both themes", () => {
  const BG = "component.graph.background";
  const INSET = "component.graph.inset.background";
  const pairs = [
    ...INKS.flatMap((i) => [
      [`component.graph.ink.${i}`, BG, 3],
      ["component.graph.texture.ink", `component.graph.ink.${i}`, 3],
    ]),
    ["component.graph.ink.none", BG, 3],
    ["component.graph.texture.ink", "component.graph.ink.none", 3],
    ["component.graph.objective.bracket", BG, 3],
    ["component.graph.objective.caption", BG, 4.5],
    ["component.graph.link.preview-line", BG, 3],
    ["component.graph.link.target-valid", BG, 3],
    ["component.graph.link.target-invalid", BG, 3],
    ["component.graph.edge.line-emphasis", BG, 3],
    ["component.graph.done.mark", BG, 3],
    ["component.graph.focus.ring", BG, 3],
    ["component.graph.label.text", INSET, 4.5],
    ["component.graph.label.muted", INSET, 4.5],
    ["component.graph.inset.border", "color.surface.page", 3],
    ["component.graph.inset.border", BG, 3],
    ["component.graph.focus.ring", INSET, 3],
  ];
  const failures = [];
  for (const mode of ["light", "dark"]) {
    for (const [fg, bg, min] of pairs) {
      const r = contrast(tokenValue(fg, mode), tokenValue(bg, mode));
      if (r < min) failures.push(`${mode}: ${fg} on ${bg} = ${r.toFixed(2)} < ${min}`);
    }
  }
  assert.deepEqual(failures, []);
});

test("v2: graph grid is 3rem / 12rem and minor lines hide below scale 0.6", () => {
  assert.equal(tokenValue("component.graph.grid.size", "light"), "3rem");
  assert.equal(tokenValue("component.graph.grid.size-major", "light"), "12rem");
  assert.equal(tokenValue("component.graph.grid.minor-min-scale", "light"), 0.6);
  const vars = read("dist/foolscap.vars.css");
  assert.match(vars, /--fc-component-graph-grid-size: 3rem;/);
  assert.match(vars, /--fc-component-graph-grid-size-major: 12rem;/);
  assert.match(vars, /--fc-component-graph-grid-minor-min-scale: 0\.6;/);
});

test("v2: touch target, label line height and structural objective type", () => {
  assert.equal(tokenValue("component.graph.hit.touch-min", "light"), "2.75rem");
  assert.match(String(tokenValue("component.graph.label.line-height", "light")), /^\d*\.?\d+rem$/);
  const rem = (p) => parseFloat(tokenValue(p, "light"));
  assert.ok(rem("component.graph.objective.font-size-root") > rem("component.graph.objective.font-size-nested"), "root heading larger than nested");
  assert.ok(rem("component.graph.objective.font-size-nested") > rem("component.graph.label.font-size"), "nested objective larger than task labels");
  assert.ok(tokenValue("component.graph.objective.font-weight-root", "light") >= tokenValue("component.graph.objective.font-weight-nested", "light"));
  for (const p of V2_TOKENS.filter((t) => (flat.get(t).$type ?? "") === "dimension")) {
    assert.match(String(tokenValue(p, "light")), /^-?\d*\.?\d+rem$/, `${p} must resolve to rem`);
  }
});

test("v2: inset shadow is an unblurred offset plate", () => {
  const s = tokenValue("component.graph.inset.shadow", "light");
  assert.equal(typeof s, "object");
  assert.equal(parseFloat(s.blur), 0, "no blur anywhere");
  assert.equal(parseFloat(s.spread), 0);
});

test("v2: dist emits every v2 token", () => {
  const light = read("dist/foolscap.vars.css").split('[data-theme="dark"]')[0];
  const missing = V2_TOKENS.filter((p) => !light.includes(`${cssVar(p)}:`));
  assert.deepEqual(missing, [], `not emitted: ${missing.join(", ")}`);
});

test("v2: foolscap.css defines every v2 class", () => {
  const css = graphCss();
  const missing = V2_CLASSES.filter((c) => !new RegExp(`\\.${c}(?![\\w-])`).test(css));
  assert.deepEqual(missing, [], `missing v2 classes: ${missing.join(", ")}`);
});

test("v2: graph block is graph-scoped (no generic element, button or cursor reset)", () => {
  const offenders = rulesOf(graphCss())
    .flatMap((r) => r.sel.split(",").map((s) => s.trim()))
    .filter((sel) => sel && !/\.fc-graph/.test(sel));
  assert.deepEqual(offenders, [], `unscoped selectors in graph block: ${offenders.join(" | ")}`);
});

test("v2: cursor vocabulary — pointer on hit, grab/grabbing on canvas, crosshair handle, not-allowed invalid", () => {
  const rules = rulesOf(graphCss());
  assert.equal(declared(rules, ".fc-graph-hit", "cursor"), "pointer");
  assert.equal(declared(rules, ".fc-graph-canvas", "cursor"), "grab");
  assert.equal(declared(rules, ".fc-graph-canvas.is-grabbing", "cursor"), "grabbing");
  assert.equal(declared(rules, ".fc-graph-link-handle", "cursor"), "crosshair");
  assert.equal(declared(rules, ".fc-graph-target-invalid", "cursor"), "not-allowed");
  // Moving a hit node still reads as grabbing, not pointer.
  const grabbingSel = rules.filter((r) => /cursor\s*:\s*grabbing/.test(r.body)).flatMap((r) => r.sel.split(",").map((s) => s.trim()));
  assert.ok(grabbingSel.some((s) => /is-grabbing/.test(s) && /fc-graph-hit/.test(s)), "grabbing must override pointer on a hit node while moving");
});

test("v2: title participates in hit testing only under .fc-graph-hit; legend glyphs are never interactive", () => {
  const rules = rulesOf(graphCss());
  const labelPe = declared(rules, ".fc-graph-hit .fc-graph-label", "pointer-events");
  assert.ok(labelPe && labelPe !== "none", "hit title must receive pointer events");
  assert.equal(declared(rules, ".fc-graph-label", "pointer-events"), "none", "plain labels stay inert");
  assert.equal(declared(rules, ".fc-graph-glyph", "pointer-events"), "none", "legend glyphs ignore the pointer");
  const glyphHit = rules.filter((r) => /\.fc-graph-glyph[^,]*\.fc-graph-hit/.test(r.sel));
  for (const r of glyphHit) assert.doesNotMatch(r.body, /cursor\s*:\s*pointer/, "legend glyph cannot look clickable");
  assert.equal(declared(rules, ".fc-graph-glyph .fc-graph-hit", "cursor"), "default");
});

test("v2: ink classes set the node fill channel and win over legacy series", () => {
  const css = graphCss();
  for (const i of INKS) {
    const m = new RegExp(`\\.fc-graph-ink-${i}\\s*\\{([^}]*)\\}`).exec(css);
    assert.ok(m, `no rule for .fc-graph-ink-${i}`);
    assert.match(m[1], new RegExp(`--fc-graph-fill:\\s*var\\(--fc-component-graph-ink-${i}\\)`));
  }
  assert.match(css, /\.fc-graph-ink-none\s*\{[^}]*--fc-graph-fill:\s*var\(--fc-component-graph-ink-none\)/);
  assert.ok(css.indexOf(".fc-graph-ink-1") > css.indexOf(".fc-graph-series-6"), "ink rules must follow series rules");
});

test("v2: link targets, selection, aggregate and stream differ without colour", () => {
  const rules = rulesOf(graphCss());
  const validDash = declared(rules, ".fc-graph-target-valid .fc-graph-node-focus", "stroke-dasharray");
  const invalidDash = declared(rules, ".fc-graph-target-invalid .fc-graph-node-focus", "stroke-dasharray");
  assert.ok(validDash && invalidDash && validDash !== invalidDash, "valid/invalid targets need different dash patterns");
  assert.equal(validDash, "none", "valid target is a solid ring, like selection");
  assert.equal(declared(rules, ".fc-graph-edge-aggregate", "stroke-dasharray"), "var(--fc-component-graph-aggregate-dash)");
  assert.equal(declared(rules, ".fc-graph-edge.fc-graph-stream", "stroke-width"), "var(--fc-component-graph-stream-edge-width)");
  assert.notEqual(tokenValue("component.graph.aggregate.dash", "light").dashArray?.join(" "), tokenValue("component.graph.dash", "light").dashArray?.join(" "), "aggregate dash must differ from tentative dash");
  // No texture: its own non-colour cue (dashed mark outline), distinct from open (waiting) and selection.
  const noneDash = declared(rules, ".fc-graph-ink-none .fc-graph-node-shape", "stroke-dasharray");
  assert.ok(noneDash && noneDash !== "none", "no-texture marks need a dashed outline");
  assert.notEqual(noneDash, declared(rules, ".fc-graph-node:focus-visible .fc-graph-node-focus", "stroke-dasharray"), "no-texture outline must not mimic keyboard focus");
  // Objective: bracket outline drawn from the bracket tokens, no fill (open corners, not a card).
  assert.equal(declared(rules, ".fc-graph-objective-bracket", "fill"), "none");
  assert.equal(declared(rules, ".fc-graph-objective-bracket", "stroke"), "var(--fc-component-graph-objective-bracket)");
  assert.equal(declared(rules, ".fc-graph-objective-root .fc-graph-label", "font-size"), "var(--fc-component-graph-objective-font-size-root)");
  assert.equal(declared(rules, ".fc-graph-objective-nested .fc-graph-label", "font-size"), "var(--fc-component-graph-objective-font-size-nested)");
});

test("v2: generic dim fades only decoration (edges, marks, brackets), never labels or focus", () => {
  const rules = rulesOf(graphCss()).filter((r) => /fc-graph-dimmed(?![\w-])/.test(r.sel));
  assert.ok(rules.length > 0, "fc-graph-dimmed must have a treatment");
  for (const r of rules) {
    if (!/(^|[;\s])(fill-|stroke-)?opacity\s*:/.test(r.body)) continue;
    for (const sel of r.sel.split(",").map((s) => s.trim())) {
      assert.doesNotMatch(sel, /label|focus|hit|inset|key/, `dims ${sel}`);
      assert.match(sel, /fc-graph-(edge|node-shape|node-texture|node-halo|objective-bracket)\b/, `unexpected dimmed target ${sel}`);
    }
  }
});

test("v2: panels and the only box-shadow use tokens; no blur or drop shadows", () => {
  const css = graphCss();
  const shadows = [...css.matchAll(/box-shadow\s*:\s*([^;]+);/g)].map((m) => m[1].trim());
  for (const s of shadows) assert.equal(s, "var(--fc-component-graph-inset-shadow)");
  assert.doesNotMatch(css, /drop-shadow|blur\(/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, "raw colour in graph or graph-panel CSS");
  const rules = rulesOf(css);
  assert.equal(declared(rules, ".fc-graph-inset", "width"), "min(var(--fc-component-graph-inset-width), calc(100% - 2 * var(--fc-component-graph-inset-offset)))");
  assert.equal(declared(rules, ".fc-graph-key", "width"), "min(var(--fc-component-graph-key-width), calc(100% - 2 * var(--fc-component-graph-inset-offset)))");
  assert.match(declared(rules, ".fc-graph-key-toggle", "min-height") || "", /--fc-component-graph-hit-touch-min/);
});

test("v2: docs describe inks, non-colour cues, objective, cursors, panels and the app-owned mapping", () => {
  const doc = read("docs/graph.md");
  for (const s of [
    ...V2_CLASSES.filter((c) => c !== "is-grabbing"), "is-grabbing",
    "component.graph.ink", "fc.palette", "forest", "oxblood", "umber", "graphite", "No texture",
    "3rem", "12rem", "minor-min-scale", "touch-min", "bracketPath", "minorGridVisible",
  ]) assert.ok(doc.includes(s), `docs lack ${s}`);
  assert.match(doc, /without colou?r/i);
  assert.match(doc, /not (?:an? )?upstream|app(?:lication)?[- ]owned|belongs to the app/i, "texture→ink mapping stays in the consuming app");
});
