/* Foolscap site runtime: theme toggle + token-driven Observable Plot defaults. */

(function () {
  const root = document.documentElement;
  const stored = localStorage.getItem("fc-theme");
  const preferred =
    stored || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  if (preferred === "dark") root.setAttribute("data-theme", "dark");

  window.fcToggleTheme = function () {
    const dark = root.getAttribute("data-theme") === "dark";
    if (dark) root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", "dark");
    localStorage.setItem("fc-theme", dark ? "light" : "dark");
    document.dispatchEvent(new CustomEvent("fc:theme"));
  };
})();

/* Read the current token values off the DOM so charts re-theme live. */
function fcTokens() {
  const s = getComputedStyle(document.documentElement);
  const v = (name) => s.getPropertyValue(name).trim();
  return {
    series: [1, 2, 3, 4, 5, 6].map((i) => v(`--fc-color-chart-${i}`)),
    ink: v("--fc-color-chart-ink"),
    grid: v("--fc-color-chart-grid"),
    axis: v("--fc-color-chart-axis"),
    mono: v("--fc-font-family-data"),
    highlight: v("--fc-color-emphasis-highlight"),
  };
}

/* Default Plot options for the Foolscap figure style. */
function fcPlotDefaults(overrides = {}) {
  const t = fcTokens();
  return Object.assign(
    {
      style: {
        background: "transparent",
        color: t.axis,
        fontFamily: t.mono,
        fontSize: "11px",
      },
      grid: true,
      color: { range: t.series },
      ...{},
    },
    overrides
  );
}

/* Render a chart into `el`, re-rendering on theme change.
   `build` is a function(tokens) -> Plot spec (the object passed to Plot.plot). */
function fcChart(el, build) {
  const render = () => {
    el.innerHTML = "";
    const t = fcTokens();
    const spec = build(t);
    if (!("width" in spec)) spec.width = Math.max(320, el.clientWidth || 640);
    // apply foolscap chart furniture unless the spec overrides it
    spec.style = Object.assign(
      { background: "transparent", color: t.axis, fontFamily: t.mono, fontSize: "11px" },
      spec.style || {}
    );
    if (!("color" in spec)) spec.color = { range: t.series };
    for (const ax of ["x", "y"]) {
      spec[ax] = Object.assign({ grid: true }, spec[ax] || {});
    }
    el.append(Plot.plot(spec));
    // paint grid lines in the graph-paper ink
    el.querySelectorAll("[aria-label$='grid'] line").forEach((l) => {
      l.setAttribute("stroke", t.grid);
      l.setAttribute("stroke-opacity", "1");
    });
  };
  render();
  document.addEventListener("fc:theme", render);
  addEventListener("resize", () => {
    clearTimeout(el._fcT);
    el._fcT = setTimeout(render, 150);
  });
}
