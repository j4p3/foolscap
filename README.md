# Foolscap

A minimal, reusable UI theme in the manner of an **aged newspaper** crossed with an
**antique engineering schematic**: dark blue-green and gray serif ink on creamy paper,
information-dense figures, and a single loud emphasis device — the offset highlighter
plate. No skeuomorphism.

Demo: a personal blog ("The Foolscap Folio") plus a full specimen sheet.

Live: **https://foolscap.castle.bonner.jp/** ·
[Styleguide](https://foolscap.castle.bonner.jp/styleguide.html)

## Castle deployment

The built `site/` directory is served from `/mnt/data/foolscap` on Castle by
its `foolscap` Compose service (read-only mount, no public container port).
The existing Caddy gateway provides HTTPS and compression. Infrastructure
configuration lives in the sibling `castle` repo under `stack/`.
Route 53 hosts the `foolscap.castle.bonner.jp` A record → `167.99.147.192`
(TTL 300 seconds).

To publish updates from this repo:

```bash
npm ci --include=dev
npm test && npm run build
rsync -a --chmod=D755,F644 site/ deploy@100.102.40.51:/mnt/data/foolscap/
curl --fail --head https://foolscap.castle.bonner.jp/
```

No container restart is needed for static content updates. Only `site/` is
published; repository files, dependencies, and credentials stay off the web root.

## Run the demo

```bash
npm install --include=dev     # note: this machine's npm config has omit=dev
npm run build                 # tokens → CSS, then Tailwind build
npm run serve                 # http://0.0.0.0:8000  → https://pouffe-meteor.exe.xyz:8000/
```

Pages: `index.html` (blog front page) · `posts/shrinking-atlantic.html`
(information-dense article: 3 Observable Plot figures + table + footnotes) ·
`styleguide.html` (tokens, type, color, components, figures). Every page has a
light "paper" mode and a dark "blueprint" mode (top-rail toggle, persisted,
honors `prefers-color-scheme`).

## What's here

| Path | Deliverable |
|---|---|
| `docs/principles.md` | 1 — Design principles |
| `docs/guidelines.md` | 2 — Design guidelines: sizes, fonts, rhythm, radii, weights, colors, element specs |
| `docs/tokens.md` + `tokens/foolscap.tokens.json` | 3 — Token taxonomy, W3C DTCG format, 3-tier (component → semantic → primitive) per Curtis/Eightshapes |
| `docs/graph.md` | Graph pattern: `.fc-graph*` classes, `component.graph.*` tokens, `foolscap-graph.js` geometry |
| `dist/foolscap.vars.css` + `dist/foolscap.theme.css` | 4 — Generated CSS custom properties + Tailwind v4 `@theme` |
| `site/` | 5 — Blog + styleguide demo webapp |

## Using the theme in another project

1. Copy `dist/foolscap.vars.css`, `dist/foolscap.theme.css`,
   `site/assets/foolscap.css` (component classes), `site/assets/fonts.css` + `site/assets/fonts/`.
2. In your Tailwind v4 entry CSS:
   ```css
   @import "tailwindcss";
   @import "./foolscap.vars.css";
   @import "./foolscap.theme.css";
   @import "./fonts.css";
   @import "./foolscap.css";
   ```
3. Dark mode: set `data-theme="dark"` on `<html>`.
4. Charts: include `foolscap-plot.js` and render with `fcChart(el, tokens => spec)`
   (Observable Plot; re-themes live on mode switch).
5. Node-link graphs: include `site/assets/foolscap-graph.js` (no dependencies) and
   compose `.fc-graph*` classes — see `docs/graph.md`.

Only edit `tokens/foolscap.tokens.json`; everything in `dist/` is generated.

## Scripts

```bash
npm run tokens     # rebuild dist/*.css from the DTCG source
npm run contrast   # WCAG audit of token pairs (both modes; CI-fail on AA / 3:1 graphics miss)
npm test           # token/class contract tests (node:test; rebuilds dist first)
npm run css        # Tailwind build for the site
npm run build      # tokens + contrast + css
npm run serve      # python http.server on :8000
npm run verify     # headless-Chrome console-error check + full-page screenshots (both modes)
```

`npm run verify` needs the pinned chrome-headless-shell
(`npx @puppeteer/browsers install chrome-headless-shell@stable`, gitignored).
