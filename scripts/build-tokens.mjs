#!/usr/bin/env node
/**
 * Foolscap token build.
 * Reads tokens/foolscap.tokens.json (W3C DTCG), resolves {alias} references,
 * and emits:
 *   dist/foolscap.vars.css   — CSS custom properties (:root light + [data-theme=dark])
 *   dist/foolscap.theme.css  — Tailwind v4 @theme mapping onto those vars
 * Run: node scripts/build-tokens.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tokens = JSON.parse(readFileSync(join(root, "tokens/foolscap.tokens.json"), "utf8"));

// ---------- DTCG walk ----------
const flat = new Map(); // "color.spruce.600" -> node
(function walk(node, path) {
  for (const [k, v] of Object.entries(node)) {
    if (k.startsWith("$")) continue;
    if (v && typeof v === "object" && "$value" in v) flat.set([...path, k].join("."), v);
    else if (v && typeof v === "object") walk(v, [...path, k]);
  }
})(tokens, []);

const ALIAS = /^\{([^}]+)\}$/;
function resolve(value, seen = new Set(), mode = "light") {
  if (typeof value === "string") {
    const m = value.match(ALIAS);
    if (!m) return value;
    const ref = m[1];
    if (seen.has(ref)) throw new Error(`Circular alias: ${ref}`);
    const t = flat.get(ref);
    if (!t) throw new Error(`Unresolved alias: {${ref}}`);
    const dark = mode === "dark" ? t.$extensions?.["fc.modes"]?.dark : undefined;
    return resolve(dark ?? t.$value, new Set([...seen, ref]), mode);
  }
  if (Array.isArray(value)) return value.map((v) => resolve(v, seen, mode));
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v, seen, mode)]));
  return value;
}

// Mode-aware dark value: a token needs a dark override if its own $extensions
// declare one OR any alias in its resolution chain re-themes in dark mode.
function darkValue(node) {
  const own = node.$extensions?.["fc.modes"]?.dark;
  return resolve(own ?? node.$value, new Set(), "dark");
}

// ---------- serialize ----------
const cssName = (path) => "--fc-" + path.replaceAll(".", "-");

function serialize(path, value) {
  const t = flat.get(path);
  const type = t.$type ?? inferType(path);
  switch (type) {
    case "fontFamily":
      return value.map((f) => (/[ ]/.test(f) ? `"${f}"` : f)).join(", ");
    case "shadow": {
      const v = value;
      return `${v.offsetX} ${v.offsetY} ${v.blur} ${v.spread} ${v.color}`;
    }
    case "cubicBezier":
      return `cubic-bezier(${value.join(", ")})`;
    case "strokeStyle":
      return serializeStroke(value);
    case "typography":
      return null; // composites are exploded, not emitted directly
    default:
      return String(value);
  }
}
function inferType(path) {
  // DTCG $type inherits from ancestors; walk up.
  const parts = path.split(".");
  let node = tokens;
  let type;
  for (const p of parts) {
    node = node[p];
    if (node?.$type) type = node.$type;
  }
  return type;
}

const lightVars = [];
const darkVars = [];
for (const [path, node] of flat) {
  const type = node.$type ?? inferType(path);
  if (type === "typography") {
    // explode composite
    const v = resolve(node.$value);
    const base = cssName(path);
    lightVars.push([`${base}-font-family`, serializeRaw("fontFamily", v.fontFamily)]);
    lightVars.push([`${base}-font-size`, v.fontSize]);
    lightVars.push([`${base}-font-weight`, String(v.fontWeight)]);
    lightVars.push([`${base}-line-height`, v.lineHeight]);
    lightVars.push([`${base}-letter-spacing`, v.letterSpacing]);
    continue;
  }
  const value = serialize(path, resolve(node.$value));
  if (value === null) continue;
  lightVars.push([cssName(path), value]);
  const d = serializeRaw(type, darkValue(node));
  if (d !== value) darkVars.push([cssName(path), d]);
}
function serializeRaw(type, value) {
  if (type === "fontFamily") return value.map((f) => (/[ ]/.test(f) ? `"${f}"` : f)).join(", ");
  if (type === "shadow") return `${value.offsetX} ${value.offsetY} ${value.blur} ${value.spread} ${value.color}`;
  if (type === "cubicBezier") return `cubic-bezier(${value.join(", ")})`;
  if (type === "strokeStyle") return serializeStroke(value);
  return String(value);
}
// DTCG strokeStyle: keyword strings pass through (border-style); object form
// { dashArray, lineCap } emits an SVG stroke-dasharray list ("none" when empty).
function serializeStroke(value) {
  if (typeof value === "string") return value;
  const dashes = value?.dashArray ?? [];
  return dashes.length ? dashes.join(" ") : "none";
}

const banner = `/* Foolscap design tokens — generated from tokens/foolscap.tokens.json. Do not edit by hand. */\n`;
const varsCss =
  banner +
  `:root {\n` +
  lightVars.map(([k, v]) => `  ${k}: ${v};`).join("\n") +
  `\n  color-scheme: light;\n}\n\n` +
  `[data-theme="dark"] {\n` +
  darkVars.map(([k, v]) => `  ${k}: ${v};`).join("\n") +
  `\n  color-scheme: dark;\n}\n`;

mkdirSync(join(root, "dist"), { recursive: true });
writeFileSync(join(root, "dist/foolscap.vars.css"), varsCss);

// ---------- Tailwind v4 @theme ----------
// Maps Tailwind utility namespaces onto the fc custom properties so that
// utilities like bg-surface-page, text-ink, font-display, shadow-plate work.
const twColor = (name, path) => `  --color-${name}: var(${cssName(path)});`;

const colorEntries = [];
// primitives: full ramps (color-spruce-600 etc.)
for (const ramp of ["cream", "spruce", "gray", "prussian", "ochre", "rust", "olive"]) {
  for (const step of Object.keys(tokens.color[ramp]).filter((k) => !k.startsWith("$"))) {
    colorEntries.push(twColor(`${ramp}-${step}`, `color.${ramp}.${step}`));
  }
}
// semantic groups
const semantic = {
  surface: "surface", text: "text", action: "action", border: "border",
  emphasis: "emphasis", feedback: "feedback", chart: "chart",
};
for (const [prefix, group] of Object.entries(semantic)) {
  for (const key of Object.keys(tokens.color[group]).filter((k) => !k.startsWith("$"))) {
    colorEntries.push(twColor(`${prefix}-${key}`, `color.${group}.${key}`));
  }
}

const themeCss = `${banner}@theme {
  --color-*: initial;
${colorEntries.join("\n")}

  --font-*: initial;
  --font-display: var(--fc-font-family-display);
  --font-text: var(--fc-font-family-text);
  --font-data: var(--fc-font-family-data);

  --text-*: initial;
${["caption","small","body","prose","lede","h4","h3","h2","h1","display","masthead"]
  .map((s) => `  --text-${s}: var(--fc-font-size-${s});\n  --text-${s}--line-height: var(--fc-font-line-height-${s});`)
  .join("\n")}

  --tracking-*: initial;
  --tracking-tight: var(--fc-font-tracking-tight);
  --tracking-normal: var(--fc-font-tracking-normal);
  --tracking-caps: var(--fc-font-tracking-caps);
  --tracking-label: var(--fc-font-tracking-label);

  --spacing: 0.25rem;

  --radius-*: initial;
  --radius-none: var(--fc-radius-none);
  --radius-tick: var(--fc-radius-tick);
  --radius-soft: var(--fc-radius-soft);
  --radius-full: var(--fc-radius-full);

  --shadow-*: initial;
  --shadow-plate: var(--fc-shadow-plate);
  --shadow-plate-ink: var(--fc-shadow-plate-ink);
  --shadow-plate-sm: var(--fc-shadow-plate-sm);

  --container-prose: var(--fc-size-measure-prose);
  --container-wide: var(--fc-size-measure-wide);
  --container-page: var(--fc-size-measure-page);

  --ease-*: initial;
  --ease-out: var(--fc-motion-easing-out);
  --ease-inout: var(--fc-motion-easing-inout);
  --default-transition-duration: var(--fc-motion-duration-fast);
}
`;
writeFileSync(join(root, "dist/foolscap.theme.css"), themeCss);

console.log(`tokens: ${flat.size} | light vars: ${lightVars.length} | dark overrides: ${darkVars.length}`);
console.log("wrote dist/foolscap.vars.css, dist/foolscap.theme.css");
