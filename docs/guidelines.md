# Foolscap — Design Guidelines

Concrete specifications. Every value here is a token from `tokens/foolscap.tokens.json`
(CSS custom property namespace `--fc-*`; Tailwind utilities from `dist/foolscap.theme.css`).
Token paths are given in DTCG dot notation.

---

## 1. Color

### 1.1 Primitive ramps

| Ramp | Role | Steps |
|---|---|---|
| `cream` | Paper | 50–500 (50 brightest stock → 500 deep foxing) |
| `spruce` | Primary ink (dark blue-green) | 50–950 |
| `gray` | Secondary ink (cool slate) | 50–900 |
| `prussian` | Engineering blue; dark-mode ground | 100–950 |
| `ochre` | Highlighter / gilt | 100–700 |
| `rust` | Stamp red; danger | 100–800 |
| `olive` | Drafting green; success | 100–700 |

Primitives are for building semantic tokens and charts. UI code should not reference
them directly.

### 1.2 Semantic assignments (light / "paper" mode)

| Token | Value | Use |
|---|---|---|
| `color.surface.page` | cream-100 | Page ground |
| `color.surface.raised` | cream-50 | Panes, cards |
| `color.surface.sunken` | cream-200 | Wells, table stripes |
| `color.surface.aged` | cream-300 | Colophons, folio edges |
| `color.surface.inverse` | spruce-900 | Ink plates |
| `color.text.primary` | spruce-800 | Body ink (11.5:1 on page — AAA) |
| `color.text.secondary` | gray-600 | Decks, supporting prose |
| `color.text.muted` | gray-500 | Captions, footnotes (AA) |
| `color.text.faint` | gray-400 | Disabled/watermark only — sub-AA, never for content |
| `color.text.link` | spruce-600 | Links (underlined, always) |
| `color.action.primary` | spruce-700 | Filled buttons |
| `color.border.hairline` | #C9BEA6 | Default rules |
| `color.border.strong` | spruce-800 | Frames, emphatic rules |
| `color.border.focus` | ochre-500 | Focus ring |
| `color.emphasis.highlight` | ochre-300 | Highlighter swipe |
| `color.emphasis.plate` | ochre-400 | Offset plate |

Dark ("blueprint") mode swaps grounds to `prussian-950/900/800` and inks to
`cream-100`/`gray-200/300`; every override lives in the token file under
`$extensions["fc.modes"].dark` and is emitted under `[data-theme="dark"]`.

### 1.3 Rules of use

- Warm surfaces, cool inks — never a warm text color on the cream ground except
  feedback/emphasis inks.
- `feedback.*` pairs (`info`, `success`, `warning`, `danger` on their `-surface`
  tints) are for notices and status only, never decoration.
- Charts draw from `color.chart.1–6` in order; single-series figures use `chart.ink`.
- All shipping text pairs must pass WCAG AA (verify: `node scripts/check-contrast.mjs`);
  body-on-page pairs pass AAA.

## 2. Typography

### 2.1 Faces

| Token | Face | Fallback | Role |
|---|---|---|---|
| `font.family.display` | Playfair Display | Georgia, serif | Mastheads, h1–h2, pull quotes |
| `font.family.text` | Lora | Georgia, serif | Prose, UI copy, h3–h4 |
| `font.family.data` | IBM Plex Mono | ui-monospace | Labels, chips, buttons, captions, axes, tables of figures, code |

No other faces. Weights loaded: Lora 400/500/600/700 (+italics), Playfair 400–800
(+italics), Plex Mono 400/500/600.

### 2.2 Scale

Root 16px. Ratio ≈1.2 through text sizes with editorial jumps at display sizes.
Line heights are exact multiples of the 4px baseline unit.

| Token (`font.size.*`) | Size | Line height | Face / weight | Use |
|---|---|---|---|---|
| `masthead` | 68px | 68px | Display 800, tracking −1% | Site title only |
| `display` | 52px | 56px | Display 700 | Landing headlines |
| `h1` | 38px | 44px | Display 700 | Article headline |
| `h2` | 30px | 36px | Display 700 | Section heads |
| `h3` | 24px | 32px | Text 600 | Subsections |
| `h4` | 21px | 28px | Text 600 | Minor heads |
| `lede` | 19px | 28px | Text 400 italic | Decks, ledes |
| `prose` | 17px | 28px | Text 400 | Article body |
| `body` | 16px | 24px | Text 400 | UI copy, dense panes |
| `small` | 14px | 20px | Text or Data 400 | Secondary UI, table cells |
| `caption` | 12px | 16px | Data 500–600, tracking +14%, uppercase | Labels, captions, chips, buttons, axes |

### 2.3 Rhythm

- **Baseline unit 4px; prose baseline 28px** (`space.6`). Vertical margins in prose
  are whole baselines: paragraphs 1 baseline apart, h2 sits 2 baselines above / 1
  below, figures get 2 baselines above and below.
- Paragraphs are separated by space, not indents, in UI; long-form articles may use
  first-line indents (1.5em) with no paragraph gap for a denser newspaper feel —
  choose per surface, never mix within one article.
- Justify long-form prose only when hyphenation is on (`hyphens: auto`); UI copy is
  always ragged-right.

### 2.4 Case & tracking

- Mono caps (`tracking.label`, +14%) for all apparatus: buttons, chips, labels, tab
  names, column headers, figure numbers, axis titles.
- Small-caps-style letterspaced runs in Lora (`tracking.caps`, +8%) for bylines and
  datelines.
- Never letterspace lowercase serif text.

## 3. Space & layout

- **Spatial scale** (`space.1–12`): 4, 8, 12, 16, 24, 28, 32, 48, 56, 64, 96, 128 px.
  Component-internal padding uses 1–5; section rhythm uses 6–12.
- **Measures** (`size.*`): prose 672px; wide (figures/tables) 1024px; page shell
  1216px. Figures may break out of the prose measure to the wide measure.
- **Grid**: 12-column, 24px gutters, ruled — column dividers may be drawn as
  hairlines (newspaper style) on index/dashboard surfaces.
- **Control height** 40px (`size.control-height`); with surrounding whitespace the
  effective tap target is ≥44px.

## 4. Rules, radii, depth

### 4.1 Rules (borders)

| Weight token | Width | Use |
|---|---|---|
| `border.width.hairline` | 1px | Default: dividers, table rules, pane frames |
| `border.width.rule` | 1.5px | Buttons, inputs, chips |
| `border.width.heavy` | 3px | Masthead bar, section openers, plate frames |

Styles: `solid` default; `double` for newspaper section rules (3px total);
`dashed` for schematic annotation (leader lines, chart grids, "cut here" affordances);
`dotted` for footnote separators and index leaders.

### 4.2 Radii

| Token | Value | Use |
|---|---|---|
| `radius.none` | 0 | Panes, buttons, figures, tables — the default |
| `radius.tick` | 2px | Chips, inputs, kbd |
| `radius.soft` | 4px | Images |
| `radius.full` | pill | Status dots, index counters only |

### 4.3 Depth

No blur shadows anywhere. Depth = plate offset only:

| Token | Offset | Use |
|---|---|---|
| `shadow.plate` | 6px/6px ochre-400 | THE emphasis device, block level |
| `shadow.plate-ink` | 6px/6px action ink | Emphasized CTA panes |
| `shadow.plate-sm` | 3px/3px ochre-400 | Buttons/chips (e.g. active state) |

Max one plated element per view.

## 5. Elements

Class names as implemented in `site/assets/foolscap.css` (all consume component tokens):

| Element | Class | Spec |
|---|---|---|
| Button, primary | `.fc-btn.fc-btn-primary` | Mono caps 12px/+14%, 40px height, px 20px, rule border, ink fill, hover deepens to `action.primary-hover`, active nudges 1px down-right |
| Button, secondary | `.fc-btn.fc-btn-secondary` | Same box; transparent fill, `action.secondary` ink+border; hover fills ink |
| Button, ghost | `.fc-btn.fc-btn-ghost` | No border; link ink; hover underlines |
| Button, destructive | `.fc-btn.fc-btn-destructive` | Rust fill |
| Chip | `.fc-chip` (`.fc-chip-selected`) | Mono caps 12px, 24px height, px 10px, 1.5px rule, radius-tick; selected = highlight fill + strong border |
| Label / eyebrow | `.fc-label` | Mono caps 12px/+14%, muted ink |
| Pane | `.fc-pane` (+`.fc-pane-header`, `.fc-pane-body`) | Raised surface, hairline frame, radius-none; header = label voice + hairline underneath, 12px/16px padding |
| Inverse pane | `.fc-pane-inverse` | Ink ground, cream text |
| Plated pane | `.fc-plate` / `.fc-plate-ink` | Adds the offset plate; use once per view |
| Input / select / textarea | `.fc-input` | 40px, rule border, radius-tick, raised surface; focus = strong border + 2px ochre ring offset 2px |
| Table | `.fc-table` | Heavy rule above, hairline row rules, double rule below header; header = label voice; numeric cells mono, right-aligned, `tabular-nums` |
| Figure | `.fc-figure` (+`.fc-figcaption`, `.fc-figno`) | Hairline frame optional; caption = "Fig. N —" mono number + small text serif |
| Note | `.fc-note` + `.fc-note-{info,success,warning,danger}` | Feedback surface tint, heavy left rule in feedback ink, body text |
| Inline mark | `mark` | Highlight swipe: ochre-300 ground, 2px x-padding, ink `emphasis.highlight-ink` |
| Kbd | `kbd` | Mono 12px, hairline border, radius-tick, sunken surface |
| Byline / dateline | `.fc-byline` | Caps-tracked Lora 14px, muted |
| Rule between sections | `.fc-rule`, `.fc-rule-double`, `.fc-rule-dotted` | Full-measure hr variants |
| Footnote | `.fc-footnote` | Small text, dotted top rule, mono superscript markers |

### States (all interactive elements)

- **Hover**: ink deepens (or fills); 120ms `ease-out`. No scaling, no glow.
- **Focus-visible**: 2px `border.focus` ring, 2px offset. Always visible, never removed.
- **Active**: translate 1px/1px (press into paper); plated elements collapse the plate to 3px.
- **Disabled**: `text.faint` ink, hairline border, no fill, `cursor: not-allowed`.

## 6. Charts & figures (Observable Plot)

Configured via `site/assets/foolscap-plot.js` (`fcPlotDefaults()` reads tokens off
the DOM at render time, so charts re-theme with mode switches):

- Ground transparent (paper shows through); plot area may draw the graph-paper grid
  (`chart.grid` hairlines, both axes).
- Axis/tick labels: Plex Mono 11–12px, `chart.axis` ink; axis titles mono caps.
- Series colors `chart.1–6` in order; single series uses `chart.ink`.
- Lines 1.5px; points ≤3px radius; bars hairline-stroked in ink, filled with series
  color at full opacity — no gradients, no rounded bars, no blur.
- Direct-label series when ≤4 series; legend (mono caps) only above that.
- Every chart sits in a `.fc-figure` with a numbered `.fc-figcaption`.
- Dense small-multiples are encouraged; 3D, donuts > 1 ring, and glossy effects are banned.

## 7. Dark mode — "blueprint"

Trigger: `data-theme="dark"` on `<html>` (respect `prefers-color-scheme` as default).
Grounds go deep Prussian; inks go cream/pale-gray; the highlighter deepens to
ochre-500 so it reads as drafting-gilt on blueprint. All conventions (rules, plates,
mono apparatus) are identical — the sheet changes, the drawing does not.

## 8. Motion

- Durations: 120ms (`motion.duration.fast`) for state changes; 240ms (`gentle`) for
  reveals. Easings: `motion.easing.out` / `inout`.
- Nothing moves that isn't responding to the user. No parallax, no auto-playing
  loops, no scroll-jacking.
- Honor `prefers-reduced-motion: reduce` — transitions collapse to 0ms.
