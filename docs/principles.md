# Foolscap — Design Principles

*Foolscap* is a design system for reading-heavy, information-dense interfaces. Its voice
is the aged newspaper and the antique engineering schematic: dark blue-green and gray
serif ink on creamy paper, set with the confidence of a broadsheet and annotated with
the precision of a drafting table.

The name comes from foolscap folio — the standard paper size of clerks, engineers, and
newspapermen for two centuries.

---

## 1. The page is paper, the pixels are ink

Every surface is a sheet of creamy stock; everything on it is ink. This one metaphor
decides most questions:

- **Ink sits *on* paper — it does not float above it.** No drop shadows for depth, no
  blur, no glass, no gradients-as-lighting. Apparent depth comes only from *plate
  offset* (see principle 5), which reads as misregistered printing, not as elevation.
- **Structure is drawn with rules, not with boxes of tint.** Hairlines, double rules,
  and dashed strokes divide space the way a newspaper divides columns. A background
  tint change is the *second* resort; a rule is the first.
- **The paper is warm, the ink is cool.** Cream grounds against blue-green and slate
  inks give the system its temperature contrast. Nothing else may compete with it.

## 2. Typography does the work

This is a serif system in an age of grotesques. Type carries hierarchy before color,
before weight of decoration, before iconography:

- **Three voices, strictly cast.** A soft heavy slab display face (Cooper BT Medium) speaks in
  headlines like a masthead. A workhorse text serif (Lora) carries prose and UI copy.
  A monospaced face (IBM Plex Mono) is the *schematic voice* — it annotates: labels,
  chips, buttons, captions, axes, dimensions. If it would be stenciled on a drawing,
  it is set in mono caps.
- **Hierarchy by size and case, not by boldness alone.** The scale takes editorial
  jumps at the top (headline sizes leap; body sizes step). Uppercase letterspaced mono
  marks the difference between *content* and *apparatus*.
- **Reading measure is sacred.** Prose is never wider than ~66 characters. Density is
  achieved by columns and figures, never by long lines.

## 3. Dense is a feature, cluttered is a failure

The system is built to hold a lot of information — charts, tables, figures, marginalia —
the way a broadsheet front page or a schematic sheet does:

- **Every figure earns a number and a caption.** "Fig. 3 — Boiler pressure over time."
  Captions are apparatus (mono voice), figures are content. Uncaptioned decoration is
  banned.
- **Align to the grid, and density organizes itself.** A 4px baseline grid and ruled
  column structure let many elements coexist. When a layout feels cluttered, the cure
  is alignment and rules, not whitespace inflation.
- **Data ink over chart junk.** Charts use hairline grids (graph-paper, not gridlines),
  serif-adjacent mono axes, and a muted engineering-ink palette. No 3D, no glossy bars,
  no legend when direct labeling will do.

## 4. Quiet interface, loud content

UI affordances — buttons, chips, inputs, tabs — are typographic conventions, not
physical objects:

- **No skeuomorphism.** Nothing is embossed, brushed, or lit. A button is a ruled box
  of mono caps; a chip is a small ruled capsule of the same; an input is a ruled well
  on the paper.
- **Affordance through convention, not simulation.** Interactivity is signaled by the
  mono voice, the rule, and the cursor — the way a coupon's dashed border says "cut
  here" without pretending to be scissors.
- **States are ink states.** Hover deepens ink or fills; focus draws the ochre ring;
  disabled fades to the faint ink. Nothing glows.

## 5. One emphasis device: the offset highlight

When something must shout, Foolscap has exactly one loud voice — the **offset
highlighter plate**: a flat swipe of ochre (or solid ink) displaced down-right behind
the element, like a misregistered spot color on a press:

- Inline: `mark` — a highlighter swipe behind text.
- Block: the plate — a flat, unblurred offset block behind a pane, button, or figure.
- **Scarcity is the mechanism.** At most one plated element per view. If two things
  are plated, neither is emphasized.
- Everything below "shout" uses the quiet ladder: size → case → rule weight → tint.

## 6. Aged, not antiqued

The system evokes age through *composition* — rules, folios, small caps, figure
numbering, justified blocks — never through effects:

- No paper textures, coffee stains, torn edges, or fake fold marks in UI surfaces.
- No distressed type. The type is crisp; the *conventions* are old.
- The dark mode is not "dark cream": it inverts into a **blueprint** — the same rules
  and conventions drawn in pale ink on deep Prussian ground, schematic rather than
  nostalgic.

## 7. Tokens are the single source of truth

Every color, size, weight, and rhythm in any Foolscap implementation resolves to a
token in `foolscap.tokens.json` (W3C DTCG). Three tiers, per the Eightshapes model:

- **Primitive** tokens hold values (`color.spruce.600`).
- **Semantic** tokens hold intent (`color.action.primary` → spruce-700).
- **Component** tokens hold placement (`component.button.primary.background` →
  `color.action.primary`).

Application code may reference semantic and component tokens only. If a design needs a
value that has no token, the token is added first — the value is never hard-coded.
