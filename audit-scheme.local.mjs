// Design-system audit: walks every route and reports where the instrument
// surface is not holding — contrast below AA, light surfaces left behind,
// non-square chrome, and the wrong typeface on display text.
import { chromium } from "@playwright/test";

const BASE = process.env.BASE ?? "http://localhost:64856";
const ROUTES = process.env.ROUTES
  ? process.env.ROUTES.split(",")
  : [
      "/", "/product", "/world-models", "/agents", "/pricing", "/proof", "/capture",
      "/contact", "/careers", "/faq", "/about", "/how-it-works", "/for-site-operators",
      "/for-robot-teams", "/governance", "/capture-visit", "/site-task", "/robot-intake",
      "/vision", "/updates", "/sites", "/privacy", "/terms", "/login", "/forgot-password",
      "/design-system", "/beta/buyer-guide", "/beta/capturer-guide", "/onboarding",
      "/capture-app", "/capture-launch-access", "/business-signup", "/capturer-signup",
      "/request-console", "/settings", "/admin/leads", "/admin/capturers",
      "/admin/company-metrics", "/admin/growth-studio", "/admin/growth-ops-scorecard",
      "/admin/austin-launch-scorecard", "/admin/task-evaluation-launches", "/nonexistent-404",
    ];

const AUDIT = () => {
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (c) => { const m = c.match(/[\d.]+/g); if (!m) return null; const [r, g, b] = m.slice(0, 3).map(Number); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
  const solidBg = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const s = getComputedStyle(n);
      if (s.backgroundImage && s.backgroundImage !== "none" && /url\(/.test(s.backgroundImage)) return null;
      const bg = s.backgroundColor; const m = bg && bg.match(/[\d.]+/g);
      if (m && (m.length < 4 || Number(m[3]) > 0.85)) return bg;
      n = n.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor;
  };
  const contrast = [], light = [], round = [], type = [];
  const seen = new Set();
  for (const el of document.querySelectorAll("body *")) {
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) < 0.15) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 3 || r.height < 3) continue;

    // A surface that stayed light is the loudest possible failure here.
    const bgm = s.backgroundColor.match(/[\d.]+/g);
    if (bgm && (bgm.length < 4 || Number(bgm[3]) > 0.85) && r.width * r.height > 12000) {
      const L = lum(s.backgroundColor);
      if (L !== null && L > 0.45) {
        const k = "L" + s.backgroundColor + el.className;
        if (!seen.has(k)) { seen.add(k); light.push({ bg: s.backgroundColor, tag: el.tagName, cls: String(el.className).slice(0, 80), area: Math.round(r.width * r.height) }); }
      }
    }

    // Square chrome: a stray radius reads as a different design language.
    const rad = parseFloat(s.borderTopLeftRadius) || 0;
    if (rad > 2 && rad < Math.min(r.width, r.height) / 2 - 1) {
      const k = "R" + rad + el.className;
      if (!seen.has(k)) { seen.add(k); round.push({ radius: s.borderTopLeftRadius, tag: el.tagName, cls: String(el.className).slice(0, 80) }); }
    }

    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const txt = el.textContent.trim();
    if (!txt) continue;
    const size = parseFloat(s.fontSize);

    // Display type must be the condensed face, not the body grotesque.
    if (size >= 30 && !/Barlow Condensed/.test(s.fontFamily)) {
      const k = "T" + el.className;
      if (!seen.has(k)) { seen.add(k); type.push({ t: txt.slice(0, 40), size: Math.round(size), font: s.fontFamily.split(",")[0], cls: String(el.className).slice(0, 70) }); }
    }

    const bg = solidBg(el);
    if (!bg) continue;
    const l1 = lum(s.color), l2 = lum(bg);
    if (l1 === null || l2 === null) continue;
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const need = size >= 24 || (size >= 18.66 && Number(s.fontWeight) >= 700) ? 3 : 4.5;
    if (ratio < need) {
      const k = "C" + s.color + bg + el.className;
      if (!seen.has(k)) { seen.add(k); contrast.push({ t: txt.slice(0, 44), fg: s.color, bg, ratio: +ratio.toFixed(2), need, size: Math.round(size), cls: String(el.className).slice(0, 80) }); }
    }
  }
  return { contrast, light, round, type };
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on("pageerror", () => {});
const totals = { contrast: 0, light: 0, round: 0, type: 0 };
const report = [];
for (const route of ROUTES) {
  try {
    await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(700);
    const r = await page.evaluate(AUDIT);
    for (const k of Object.keys(totals)) totals[k] += r[k].length;
    if (r.contrast.length || r.light.length || r.round.length || r.type.length) report.push({ route, ...r });
  } catch (e) {
    report.push({ route, error: String(e).split("\n")[0] });
  }
}
await browser.close();

for (const r of report) {
  if (r.error) { console.log(`\n### ${r.route}\n  ERROR ${r.error}`); continue; }
  console.log(`\n### ${r.route}`);
  for (const c of r.contrast.slice(0, 6)) console.log(`  CONTRAST ${c.ratio}:1 (need ${c.need}) ${c.size}px "${c.t}"\n      fg=${c.fg} bg=${c.bg}\n      ${c.cls}`);
  if (r.contrast.length > 6) console.log(`  … +${r.contrast.length - 6} more contrast`);
  for (const l of r.light.slice(0, 4)) console.log(`  LIGHT-SURFACE ${l.bg} <${l.tag}> ${l.cls}`);
  for (const x of r.round.slice(0, 4)) console.log(`  RADIUS ${x.radius} <${x.tag}> ${x.cls}`);
  for (const t of r.type.slice(0, 4)) console.log(`  DISPLAY-FONT ${t.font} ${t.size}px "${t.t}"\n      ${t.cls}`);
}
console.log("\n==== TOTALS ====", JSON.stringify(totals));
