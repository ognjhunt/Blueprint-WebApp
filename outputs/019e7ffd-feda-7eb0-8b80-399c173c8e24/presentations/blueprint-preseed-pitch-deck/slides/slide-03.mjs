import { C, bg, rect, rule, text, image, kicker, title, subtitle, footer, pill, metric, card, bar, step, notes, outputDir } from "./_helpers.mjs";

export async function slide03(presentation, ctx) {
  const slide = presentation.slides.add();

  bg(slide, ctx, C.paper2);
  kicker(slide, ctx, "PROBLEM");
  title(slide, ctx, "The missing layer is not another demo; it is exact-site decision evidence.", 62, 86, 860, 112);
  subtitle(slide, ctx, "Robot teams need to know whether a workflow can survive one real facility before travel, pilots, or file handoff.", 64, 198, 750, 48);
  rect(slide, ctx, 72, 306, 210, 86, C.ink, C.ink, 0);
  text(slide, ctx, "Robot team", 96, 326, 150, 20, { size: 19, bold: true, color: C.white });
  text(slide, ctx, "One deployment question", 96, 356, 150, 20, { size: 13, color: "#FFFFFFAA" });
  rect(slide, ctx, 355, 306, 246, 86, "#E7DFD3", "#CFC4B5", 1);
  text(slide, ctx, "Generic demo", 384, 326, 190, 22, { size: 19, bold: true });
  text(slide, ctx, "No exact route, rights, freshness, or provenance", 384, 354, 170, 36, { size: 12, color: C.slate });
  rect(slide, ctx, 674, 306, 246, 86, "#E7DFD3", "#CFC4B5", 1);
  text(slide, ctx, "Field pilot", 704, 326, 190, 22, { size: 19, bold: true });
  text(slide, ctx, "Too late to learn the site is wrong", 704, 354, 170, 36, { size: 12, color: C.slate });
  rect(slide, ctx, 982, 306, 170, 86, C.coral, C.coral, 0);
  text(slide, ctx, "Cost and delay", 1008, 326, 120, 22, { size: 18, bold: true, color: C.white });
  rule(slide, ctx, 282, 349, 73, C.ink, 2);
  rule(slide, ctx, 601, 349, 73, C.ink, 2);
  rule(slide, ctx, 920, 349, 62, C.ink, 2);
  rect(slide, ctx, 348, 470, 330, 88, C.blue, C.blue, 0);
  text(slide, ctx, "Exact-site package", 378, 492, 220, 22, { size: 21, bold: true, color: C.white });
  text(slide, ctx, "Capture manifest, route notes, proof labels, rights boundaries, hosted review.", 378, 522, 252, 32, { size: 12, color: "#FFFFFFCC" });
  rect(slide, ctx, 720, 470, 330, 88, C.green, C.green, 0);
  text(slide, ctx, "Pre-field decision", 750, 492, 250, 22, { size: 21, bold: true, color: C.ink });
  text(slide, ctx, "Approve export, request recapture, scope custom work, or hold.", 750, 522, 252, 32, { size: 12, color: C.ink });
  footer(slide, ctx, "Sources: R1 R4 R7 W7 W8 W9.");
  notes(slide, "Frame the pain around deployment uncertainty. The customer does not need another impressive demo; they need a package that keeps the exact site, route, rights, freshness, and hosted-review evidence together. Keep this slide grounded in buyer workflow rather than readiness theater.");

  return slide;
}
