import { C, bg, rect, rule, text, image, kicker, title, subtitle, footer, pill, metric, card, bar, step, notes, outputDir } from "./_helpers.mjs";

export async function slide06(presentation, ctx) {
  const slide = presentation.slides.add();

  bg(slide, ctx, C.paper2);
  kicker(slide, ctx, "PLATFORM SYSTEM");
  title(slide, ctx, "Blueprint is already shaped as a multi-repo product system.", 62, 86, 780, 104);
  subtitle(slide, ctx, "Each layer owns a different truth boundary, which is why the investor story can stay precise.", 64, 190, 700, 46);
  const layers = [
    ["BlueprintCapture", "Evidence layer", "Real-site capture bundles, timestamps, poses, device metadata, access boundaries."],
    ["BlueprintCapturePipeline", "Packaging layer", "Site-specific world-model packages, hosted artifacts, optional trust outputs."],
    ["Blueprint-WebApp", "Buyer and ops layer", "Product routes, pricing, entitlements, hosted access, GTM and control surfaces."],
    ["Paperclip autonomous org", "Operating layer", "Product/proof, demand/sales, and reliability loops with human gates."]
  ];
  for (let i = 0; i < layers.length; i++) {
    const y = 278 + i * 92;
    rect(slide, ctx, 82, y, 266, 62, i === 0 ? C.blue : i === 1 ? C.ink : i === 2 ? C.coral : C.green, "#00000000", 0);
    text(slide, ctx, layers[i][0], 104, y + 13, 220, 18, { size: 18, bold: true, color: i === 3 ? C.ink : C.white });
    text(slide, ctx, layers[i][1], 104, y + 36, 220, 12, { size: 11, color: i === 3 ? C.ink : "#FFFFFFB8" });
    rect(slide, ctx, 392, y, 610, 62, "#FFFFFF", "#D8D0C2", 1);
    text(slide, ctx, layers[i][2], 420, y + 17, 540, 28, { size: 15, color: C.slate });
    if (i < layers.length - 1) rule(slide, ctx, 216, y + 66, 2, C.ink, 26);
  }
  await image(slide, ctx, "client/public/generated/public-capture-2026-04-23/capture-app-hero.png", 1040, 278, 116, 340, { alt: "Illustrative capture app visual" });
  footer(slide, ctx, "Sources: R1 R2 R8. Visual asset is repo-generated and illustrative.");
  notes(slide, "Explain the company as a system, not a monolith. Capture collects evidence. Pipeline creates site-specific products. WebApp sells, gates, and operates access. Paperclip turns the wedge into accountable operating loops. This keeps product truth separate from live operational readiness.");

  return slide;
}
