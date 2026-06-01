import { C, bg, rect, rule, text, image, kicker, title, subtitle, footer, pill, metric, card, bar, step, notes, outputDir } from "./_helpers.mjs";

export async function slide05(presentation, ctx) {
  const slide = presentation.slides.add();

  bg(slide, ctx, C.paper);
  await image(slide, ctx, "client/public/generated/editorial/hosted-hero.png", 804, 74, 360, 512, { alt: "Illustrative hosted review workspace visual" });
  rect(slide, ctx, 804, 74, 360, 512, "#00000000", "#15130F", 1);
  kicker(slide, ctx, "PRODUCT WEDGE");
  title(slide, ctx, "Exact-Site Hosted Review turns one place into a buyer decision.", 62, 86, 720, 110);
  subtitle(slide, ctx, "A narrow first product: one real site, one robot workflow, one package, one hosted review path.", 64, 198, 690, 48);
  step(slide, ctx, "01", "Indoor site capture", "Record route, timestamps, device context, capture notes, and access boundaries.", 80, 298, 620, { color: C.blue });
  step(slide, ctx, "02", "World model package", "Package the site with manifest, media, model artifacts, restrictions, and review evidence.", 80, 394, 620, { color: C.ink });
  step(slide, ctx, "03", "Hosted evaluation", "Open a buyer room for task runs, observations, result notes, and export framing.", 80, 490, 620, { color: C.coral });
  step(slide, ctx, "04", "Export or recapture decision", "Approve export, request recapture, scope the next workflow, or hold for rights review.", 80, 586, 620, { color: C.clay });
  footer(slide, ctx, "Sources: R4 R5. Visual asset is illustrative, not hosted-session proof.");
  notes(slide, "Walk through the product as a decision path, not as a broad platform promise. The deck should make the wedge feel concrete: exact-site capture becomes a package, the hosted review creates decision evidence, and the buyer either exports, reruns, recaptures, or holds.");

  return slide;
}
