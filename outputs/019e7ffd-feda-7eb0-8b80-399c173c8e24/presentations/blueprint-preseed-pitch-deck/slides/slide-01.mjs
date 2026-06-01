import { C, bg, rect, rule, text, image, kicker, title, subtitle, footer, pill, metric, card, bar, step, notes, outputDir } from "./_helpers.mjs";

export async function slide01(presentation, ctx) {
  const slide = presentation.slides.add();

  bg(slide, ctx, C.dark);
  await image(slide, ctx, "client/public/generated/public-capture-2026-04-23/everyday-places-collage.png", 742, 0, 538, 720, { alt: "Illustrative collage of everyday public-facing indoor sites" });
  rect(slide, ctx, 0, 0, 1280, 720, "#00000000", "#00000000", 0);
  rect(slide, ctx, 690, 0, 230, 720, "#0D0D0BB0", "#00000000", 0);
  kicker(slide, ctx, "PRE-SEED DECK", { dark: true, color: C.green });
  text(slide, ctx, "BLUEPRINT", 62, 92, 380, 34, { size: 24, bold: true, color: C.white });
  title(slide, ctx, "Exact sites become world-model products.", 62, 154, 640, 196, { color: C.white, size: 52 });
  subtitle(slide, ctx, "Capture-backed indoor site packages and hosted review for robot teams deciding before field time.", 64, 374, 570, 70, { color: "#FFFFFFCC", size: 22 });
  pill(slide, ctx, "Wedge: Exact-Site Hosted Review", 64, 456, 266, { fill: C.green, color: C.ink });
  pill(slide, ctx, "Product: site package + hosted evaluation", 344, 456, 326, { fill: C.white, color: C.ink });
  pill(slide, ctx, "Boundary: live proof confirmed per request", 64, 502, 346, { fill: "#FFFFFF22", color: C.white });
  rule(slide, ctx, 62, 670, 610, "#FFFFFF22", 1);
  text(slide, ctx, "Sources: R1 R2 R7. Visual asset is repo-generated and illustrative, not capture proof.", 62, 682, 520, 16, { size: 8, color: "#FFFFFF88" });
  text(slide, ctx, "01", 628, 676, 44, 22, { size: 11, bold: true, color: "#FFFFFFAA", align: "right", valign: "mid" });
  notes(slide, "Open with the product category and the proof boundary. Blueprint is not being pitched as a generic model checkpoint company. The wedge is Exact-Site Hosted Review: one real indoor site, one workflow, one package, one hosted review path. Do not imply live fulfillment for a specific buyer; the deck keeps that per-request.");

  return slide;
}
