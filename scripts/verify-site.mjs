/* Screenshot + console-error check for the Foolscap site. */
import puppeteer from "puppeteer-core";

const shell = "/home/exedev/workspace/projects/theme/chrome-headless-shell/linux-154.0.8037.57/chrome-headless-shell-linux64/chrome-headless-shell";
const outDir = "/home/exedev/.hermes/cache/scratch/theme-shots";
import { mkdirSync } from "node:fs";
mkdirSync(outDir, { recursive: true });

const pages = [
  ["index", "http://localhost:8000/index.html"],
  ["styleguide", "http://localhost:8000/styleguide.html"],
  ["post", "http://localhost:8000/posts/shrinking-atlantic.html"],
];

const browser = await puppeteer.launch({ executablePath: shell, headless: true, args: ["--no-sandbox"] });
let failures = 0;
for (const [name, url] of pages) {
  for (const mode of ["light", "dark"]) {
    const page = await browser.newPage();
    const errors = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
    page.on("requestfailed", (r) => errors.push("REQFAIL: " + r.url()));
    await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument((m) => localStorage.setItem("fc-theme", m), mode);
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: `${outDir}/${name}-${mode}.png`, fullPage: true });
    if (errors.length) { failures++; console.log(`ERRORS ${name}-${mode}:`); errors.forEach((e) => console.log("  " + e)); }
    else console.log(`ok ${name}-${mode}`);
    await page.close();
  }
}
await browser.close();
console.log(failures ? `FAILURES: ${failures}` : "ALL CLEAN");
process.exit(failures ? 1 : 0);
