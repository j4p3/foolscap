#!/usr/bin/env node
/**
 * WCAG contrast audit for Foolscap token pairs (both modes).
 * Run: node scripts/check-contrast.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tokens = JSON.parse(readFileSync(join(root, "tokens/foolscap.tokens.json"), "utf8"));

const flat = new Map();
(function walk(node, path) {
  for (const [k, v] of Object.entries(node)) {
    if (k.startsWith("$")) continue;
    if (v && typeof v === "object" && "$value" in v) flat.set([...path, k].join("."), v);
    else if (v && typeof v === "object") walk(v, [...path, k]);
  }
})(tokens, []);

const resolve = (v, mode) => {
  if (typeof v !== "string") return v;
  const m = v.match(/^\{([^}]+)\}$/);
  if (!m) return v;
  const t = flat.get(m[1]);
  const dark = mode === "dark" && t.$extensions?.["fc.modes"]?.dark;
  return resolve(dark || t.$value, mode);
};
const get = (path, mode) => {
  const t = flat.get(path);
  if (!t) throw new Error("missing " + path);
  const dark = mode === "dark" && t.$extensions?.["fc.modes"]?.dark;
  return resolve(dark || t.$value, mode);
};

function lum(hex) {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a, b) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

// [foreground, background, minimum, note]
const pairs = [
  ["color.text.primary", "color.surface.page", 7, "body on page (AAA)"],
  ["color.text.primary", "color.surface.raised", 7, "body on pane (AAA)"],
  ["color.text.primary", "color.surface.sunken", 4.5, "body on well"],
  ["color.text.secondary", "color.surface.page", 4.5, "secondary on page"],
  ["color.text.muted", "color.surface.page", 4.5, "captions on page"],
  ["color.text.muted", "color.surface.raised", 4.5, "captions on pane"],
  ["color.text.link", "color.surface.page", 4.5, "links on page"],
  ["color.text.inverse", "color.surface.inverse", 7, "inverse pane text"],
  ["color.action.on-primary", "color.action.primary", 4.5, "button primary"],
  ["color.action.on-destructive", "color.action.destructive", 4.5, "button destructive"],
  ["color.action.secondary", "color.surface.page", 4.5, "outline button ink"],
  ["color.emphasis.highlight-ink", "color.emphasis.highlight", 4.5, "ink on highlighter"],
  ["color.feedback.info", "color.feedback.info-surface", 4.5, "info note"],
  ["color.feedback.success", "color.feedback.success-surface", 4.5, "success note"],
  ["color.feedback.warning", "color.feedback.warning-surface", 4.5, "warning note"],
  ["color.feedback.danger", "color.feedback.danger-surface", 4.5, "danger note"],
  ["color.chart.axis", "color.surface.page", 4.5, "axis labels"],
  // Graph pattern: label text is text (4.5); marks/rings/edges are non-text
  // graphics (WCAG 1.4.11, 3:1) against the graph plate.
  ["component.graph.label.text", "component.graph.background", 4.5, "graph label"],
  ["component.graph.label.muted", "component.graph.background", 4.5, "graph label muted"],
  ["component.graph.node.outline", "component.graph.background", 3, "graph node outline"],
  ["component.graph.edge.line", "component.graph.background", 3, "graph edge"],
  ["component.graph.focus.ring", "component.graph.background", 3, "graph focus ring"],
  ...["past", "now", "near", "far"].map((p) => [`component.graph.proximity.${p}.color`, "component.graph.background", 3, `graph proximity ${p}`]),
  ...[1, 2, 3, 4, 5, 6].flatMap((i) => [
    [`component.graph.series.${i}`, "component.graph.background", 3, `graph series ${i}`],
    ["component.graph.texture.ink", `component.graph.series.${i}`, 3, `graph texture on series ${i}`],
  ]),
];

let fail = 0;
for (const mode of ["light", "dark"]) {
  console.log(`\n== ${mode} ==`);
  for (const [fg, bg, min, note] of pairs) {
    const [f, b] = [get(fg, mode), get(bg, mode)];
    if (f.length === 9 && f.endsWith("00")) continue; // transparent
    const r = ratio(f, b);
    const ok = r >= min;
    if (!ok) fail++;
    console.log(`${ok ? "  ok " : "FAIL "} ${r.toFixed(2).padStart(5)} >= ${min}  ${note}  (${f} on ${b})`);
  }
}
process.exit(fail ? 1 : 0);
