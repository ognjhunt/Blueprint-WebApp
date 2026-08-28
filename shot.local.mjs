import { chromium } from "@playwright/test";
const BASE = process.env.BASE ?? "http://localhost:64856";
const routes = (process.env.ROUTES ?? "/").split(",");
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: Number(process.env.VW ?? 1440), height: 1000 } });
for (const r of routes) {
  await p.goto(BASE + r, { waitUntil: "networkidle", timeout: 40000 });
  // Walk the page so scroll-triggered reveals actually fire before capture.
  await p.evaluate(async () => {
    const h = document.body.scrollHeight;
    for (let y = 0; y < h; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); }
    window.scrollTo(0, 0); await new Promise(r => setTimeout(r, 400));
  });
  await p.waitForTimeout(600);
  const name = (r === "/" ? "home" : r.replace(/\//g, "_").replace(/^_/, "")) + ".png";
  await p.screenshot({ path: process.env.OUT + "/" + name, fullPage: process.env.FULL === "1" });
  console.log("shot", name);
}
await b.close();
