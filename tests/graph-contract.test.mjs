/**
 * Contract tests for the Foolscap graph pattern (.fc-graph*) and its
 * component.graph.* tokens. Run: npm test  (rebuilds dist/ first).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
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

const V2_BG = "component.graph.background";
const V2_INSET = "component.graph.inset.background";
// [foreground, background, minimum] — the v2 graph contrast contract.
const V2_CONTRAST_PAIRS = [
  ...INKS.flatMap((i) => [
    [`component.graph.ink.${i}`, V2_BG, 3],
    ["component.graph.texture.ink", `component.graph.ink.${i}`, 3],
  ]),
  ["component.graph.ink.none", V2_BG, 3],
  ["component.graph.texture.ink", "component.graph.ink.none", 3],
  ["component.graph.objective.bracket", V2_BG, 3],
  ["component.graph.objective.caption", V2_BG, 4.5],
  ["component.graph.link.preview-line", V2_BG, 3],
  ["component.graph.link.target-valid", V2_BG, 3],
  ["component.graph.link.target-invalid", V2_BG, 3],
  ["component.graph.edge.line-emphasis", V2_BG, 3],
  ["component.graph.done.mark", V2_BG, 3],
  ["component.graph.focus.ring", V2_BG, 3],
  ["component.graph.label.text", V2_INSET, 4.5],
  ["component.graph.label.muted", V2_INSET, 4.5],
  ["component.graph.inset.border", "color.surface.page", 3],
  ["component.graph.inset.border", V2_BG, 3],
  ["component.graph.focus.ring", V2_INSET, 3],
];

test("v2: text >= 4.5:1 and important non-text >= 3:1 against the graph and inset planes, both themes", () => {
  const pairs = V2_CONTRAST_PAIRS;
  const failures = [];
  for (const mode of ["light", "dark"]) {
    for (const [fg, bg, min] of pairs) {
      const r = contrast(tokenValue(fg, mode), tokenValue(bg, mode));
      if (r < min) failures.push(`${mode}: ${fg} on ${bg} = ${r.toFixed(2)} < ${min}`);
    }
  }
  assert.deepEqual(failures, []);
});

// ---- the build gate (scripts/check-contrast.mjs, run by `npm run build`) must
// audit every v2 pair itself, not only this test file (TG-04 recovery A3). ----
// Parse the real script's report: per mode, one entry per audited pair.
function parseContrastReport(stdout) {
  const out = { light: [], dark: [] };
  let mode = null;
  for (const line of stdout.split("\n")) {
    const h = /^== (light|dark) ==$/.exec(line);
    if (h) { mode = h[1]; continue; }
    const m = /^(  ok |FAIL )\s*([\d.]+) >= ([\d.]+)\s+(.*?)\s+\[([^\]|]+?) \| ([^\]]+?)\]/.exec(line);
    if (m && mode) out[mode].push({ ok: m[1].trim() === "ok", ratio: +m[2], min: +m[3], note: m[4], fg: m[5], bg: m[6] });
  }
  return out;
}
const runContrast = (dir) => spawnSync(process.execPath, [join(dir, "scripts/check-contrast.mjs")], { encoding: "utf8" });

test("contrast script audits every v2 pair in both themes at the contract minimum", () => {
  const r = runContrast(root);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const report = parseContrastReport(r.stdout);
  const missing = [];
  for (const mode of ["light", "dark"]) {
    assert.ok(report[mode].length > 0, `${mode}: no parsable [fg | bg] audit lines`);
    for (const [fg, bg, min] of V2_CONTRAST_PAIRS) {
      const hit = report[mode].find((e) => e.fg === fg && e.bg === bg);
      if (!hit) missing.push(`${mode}: ${fg} on ${bg}`);
      else assert.ok(hit.min >= min, `${mode}: ${fg} on ${bg} audited at ${hit.min} < ${min}`);
    }
  }
  assert.deepEqual(missing, [], `check-contrast.mjs does not audit: ${missing.join("; ")}`);
  // Legacy thresholds are kept: text 4.5 (AAA 7 where it was), non-text 3.
  const legacy = report.light.find((e) => e.fg === "component.graph.label.text" && e.bg === "component.graph.background");
  assert.equal(legacy?.min, 4.5);
  // No duplicate audit entries.
  const keys = report.light.map((e) => `${e.fg}|${e.bg}`);
  assert.equal(new Set(keys).size, keys.length, "duplicate pairs in the contrast audit");
});

// Real script, real token document, disposable copies: each low-contrast v2
// mutation must make the gate exit non-zero with the intended pair/theme failing.
function withContrastFixture(mutate, fn) {
  const dir = mkdtempSync(join(tmpdir(), "fc-contrast-fixture-"));
  try {
    mkdirSync(join(dir, "scripts"));
    mkdirSync(join(dir, "tokens"));
    copyFileSync(join(root, "scripts/check-contrast.mjs"), join(dir, "scripts/check-contrast.mjs"));
    const doc = JSON.parse(read("tokens/foolscap.tokens.json"));
    mutate(doc);
    writeFileSync(join(dir, "tokens/foolscap.tokens.json"), JSON.stringify(doc, null, 2));
    return fn(runContrast(dir));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const tokenNode = (doc, path) => path.split(".").reduce((n, k) => n[k], doc);
const setLight = (path, hex) => (doc) => { tokenNode(doc, path).$value = hex; };
const setDarkOnly = (path, hex) => (doc) => {
  const n = tokenNode(doc, path);
  n.$extensions = { ...(n.$extensions || {}), "fc.modes": { ...(n.$extensions?.["fc.modes"] || {}), dark: hex } };
};

test("contrast fixture control: an unmutated copy of the real tokens passes", () => {
  withContrastFixture(() => {}, (r) => assert.equal(r.status, 0, r.stdout + r.stderr));
});

test("contrast script rejects low-contrast v2 tokens (light and dark-only mutations)", () => {
  const lightBg = tokenValue(V2_BG, "light");
  const darkBg = tokenValue(V2_BG, "dark");
  const cases = [
    { fg: "component.graph.ink.3", bg: V2_BG, mode: "light", mutate: setLight("component.graph.ink.3", lightBg) },
    { fg: "component.graph.ink.2", bg: V2_BG, mode: "dark", mutate: setDarkOnly("component.graph.ink.2", darkBg) },
    { fg: "component.graph.objective.caption", bg: V2_BG, mode: "dark", mutate: setDarkOnly("component.graph.objective.caption", darkBg) },
    { fg: "component.graph.objective.caption", bg: V2_BG, mode: "light", mutate: setLight("component.graph.objective.caption", lightBg) },
    { fg: "component.graph.link.target-valid", bg: V2_BG, mode: "light", mutate: setLight("component.graph.link.target-valid", lightBg) },
    { fg: "component.graph.link.target-invalid", bg: V2_BG, mode: "dark", mutate: setDarkOnly("component.graph.link.target-invalid", darkBg) },
  ];
  for (const c of cases) {
    withContrastFixture(c.mutate, (r) => {
      const label = `${c.mode} ${c.fg}`;
      assert.notEqual(r.status, 0, `${label}: gate must exit non-zero\n${r.stdout}`);
      const report = parseContrastReport(r.stdout);
      const hit = report[c.mode].find((e) => e.fg === c.fg && e.bg === c.bg);
      assert.ok(hit, `${label}: pair not audited`);
      assert.equal(hit.ok, false, `${label}: intended pair did not fail`);
      const other = c.mode === "dark" ? "light" : null;
      if (other) {
        const same = report[other].find((e) => e.fg === c.fg && e.bg === c.bg);
        assert.equal(same?.ok, true, `${label}: dark-only mutation must leave light passing`);
      }
    });
  }
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
  // Objective verdicts carry the same non-colour cue as glyph verdicts: valid is an
  // explicitly solid bracket (never an inherited dash), invalid the short dash.
  assert.equal(declared(rules, ".fc-graph-target-valid .fc-graph-objective-bracket", "stroke-dasharray"), "none", "valid objective target must reset to a solid bracket");
  assert.equal(declared(rules, ".fc-graph-target-invalid .fc-graph-objective-bracket", "stroke-dasharray"), "var(--fc-component-graph-dash)");
});

// Link-target verdicts while the target also holds keyboard focus (TG-04 recovery A1).
// The ordinary :focus-visible ring rules are more specific than a bare
// `.fc-graph-target-* ring` rule, so a focused target used to lose its verdict.
// Explicit graph-scoped focus+target selectors must restate the verdict, and a
// separate tokenized outline on the target group keeps focus visible.
const TARGET_KINDS = [
  { name: "glyph", host: ".fc-graph-node", ring: ".fc-graph-node-focus", focus: ".fc-graph-node:focus-visible .fc-graph-node-focus", selected: ".fc-graph-node-selected .fc-graph-node-focus" },
  { name: "objective", host: ".fc-graph-objective", ring: ".fc-graph-objective-bracket", focus: ".fc-graph-objective:focus-visible .fc-graph-objective-bracket", selected: ".fc-graph-objective.fc-graph-node-selected .fc-graph-objective-bracket" },
];
const VERDICTS = {
  valid: { stroke: "var(--fc-component-graph-link-target-valid)", dash: "none", width: "var(--fc-border-width-heavy)" },
  invalid: { stroke: "var(--fc-component-graph-link-target-invalid)", dash: "var(--fc-component-graph-dash)" },
};
const specificity = (sel) => (sel.match(/[.:][\w-]+/g) || []).length;

test("v2: link-target verdicts hold for focused and unfocused, selected and unselected glyphs and objectives", () => {
  const rules = rulesOf(graphCss());
  for (const k of TARGET_KINDS) {
    // Ordinary focus and selection treatments stay intact.
    assert.equal(declared(rules, k.focus, "stroke"), "var(--fc-component-graph-focus-ring)", `${k.name}: ordinary focus ring`);
    assert.equal(declared(rules, k.focus, "stroke-dasharray"), "var(--fc-component-graph-focus-dash)", `${k.name}: ordinary focus long dash`);
    for (const [v, want] of Object.entries(VERDICTS)) {
      const unfocused = `${k.host}.fc-graph-target-${v} ${k.ring}`;
      const focused = `${k.host}.fc-graph-target-${v}:focus-visible ${k.ring}`;
      for (const sel of [unfocused, focused]) {
        assert.equal(declared(rules, sel, "stroke"), want.stroke, `${sel}: verdict stroke`);
        assert.equal(declared(rules, sel, "stroke-dasharray"), want.dash, `${sel}: verdict dash`);
        if (want.width) assert.equal(declared(rules, sel, "stroke-width"), want.width, `${sel}: valid heavy width`);
      }
      // Precedence by specificity (or equal specificity declared later), not source order alone.
      const css = graphCss();
      const outranks = (a, b) => specificity(a) > specificity(b) || (specificity(a) === specificity(b) && css.indexOf(a) > css.indexOf(b));
      assert.ok(specificity(focused) > specificity(k.focus), `${focused} must outrank ${k.focus}`);
      assert.ok(outranks(unfocused, k.selected), `${unfocused} must outrank ${k.selected}`);
      assert.ok(outranks(focused, k.selected), `${focused} must outrank ${k.selected}`);
    }
    assert.notEqual(VERDICTS.valid.dash, VERDICTS.invalid.dash);
  }
  // Square caps extend each dash by half the stroke width at both ends, so a
  // heavy (selected/focused) invalid bracket would close its short dash gap
  // and read as solid. Invalid objective brackets use butt caps; every other
  // bracket keeps the square-cornered base.
  assert.equal(declared(rules, ".fc-graph-objective-bracket", "stroke-linecap"), "square", "base bracket cap");
  assert.equal(declared(rules, ".fc-graph-objective-bracket", "stroke-linejoin"), "miter", "base bracket join");
  for (const sel of [
    ".fc-graph-target-invalid .fc-graph-objective-bracket",
    ".fc-graph-objective.fc-graph-target-invalid .fc-graph-objective-bracket",
    ".fc-graph-objective.fc-graph-target-invalid:focus-visible .fc-graph-objective-bracket",
  ]) {
    assert.equal(declared(rules, sel, "stroke-linecap"), "butt", `${sel}: invalid dash keeps its gap (butt cap)`);
  }
  // Invalid keeps not-allowed even on a .fc-graph-hit node (pointer would otherwise win by order).
  assert.equal(declared(rules, ".fc-graph-target-invalid", "cursor"), "not-allowed");
  assert.equal(declared(rules, ".fc-graph-hit.fc-graph-target-invalid", "cursor"), "not-allowed");
});

test("v2: a focused link target keeps a separate tokenized focus outline; ordinary focus styling unchanged", () => {
  const rules = rulesOf(graphCss());
  for (const v of Object.keys(VERDICTS)) {
    const sel = `.fc-graph-target-${v}:focus-visible`;
    assert.equal(declared(rules, sel, "outline"), "var(--fc-component-graph-focus-width) solid var(--fc-component-graph-focus-ring)", `${sel}: outline`);
    assert.equal(declared(rules, sel, "outline-offset"), "var(--fc-component-graph-focus-offset)", `${sel}: outline offset`);
    assert.ok(specificity(sel) > specificity(".fc-graph-node") && specificity(sel) > specificity(".fc-graph-objective"), `${sel} must outrank the outline:none resets`);
  }
  // Neutral nodes and objectives still draw focus with their own ring, not an outline.
  assert.equal(declared(rules, ".fc-graph-node", "outline"), "none");
  assert.equal(declared(rules, ".fc-graph-objective", "outline"), "none");
  // The added outline is target-scoped only.
  const outlined = rules.filter((r) => /(?:^|[;\s])outline\s*:\s*var/.test(r.body)).flatMap((r) => r.sel.split(",").map((s) => s.trim()));
  for (const s of outlined) assert.match(s, /^\.fc-graph-(canvas|key-toggle|target-(valid|invalid)):focus-visible$/, `unexpected outline selector ${s}`);
  // No blanket overrides and no focus removal in the graph block.
  assert.doesNotMatch(graphCss(), /!important/);
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
