import { C, bg, rect, rule, text, image, kicker, title, subtitle, footer, pill, metric, card, bar, step, notes, outputDir } from "./_helpers.mjs";

export async function slide10(presentation, ctx) {
  const slide = presentation.slides.add();

  bg(slide, ctx, C.paper2);
  await image(slide, ctx, "client/public/generated/editorial/sample-evaluation-proof-board.png", 804, 90, 330, 220, { alt: "Illustrative sample evaluation proof board" });
  kicker(slide, ctx, "GO-TO-MARKET");
  title(slide, ctx, "GTM is one site, one workflow, one proof artifact, one next step.", 62, 86, 720, 100);
  subtitle(slide, ctx, "The pilot doctrine keeps demand generation proof-led and prevents generic AI/software outreach.", 64, 188, 700, 44);
  rect(slide, ctx, 84, 314, 390, 130, C.blue, C.blue, 0);
  text(slide, ctx, "proof_ready_outreach", 112, 344, 300, 24, { size: 23, bold: true, color: C.white });
  text(slide, ctx, "Use when an exact-site world is already captured, packaged, and reviewable.", 112, 386, 300, 34, { size: 14, color: "#FFFFFFCC" });
  rect(slide, ctx, 540, 314, 390, 130, C.ink, C.ink, 0);
  text(slide, ctx, "demand_sourced_capture", 568, 344, 320, 24, { size: 23, bold: true, color: C.white });
  text(slide, ctx, "Use when the buyer conversation identifies which site or workflow Blueprint should capture next.", 568, 386, 320, 34, { size: 14, color: "#FFFFFFCC" });
  rule(slide, ctx, 474, 378, 66, C.ink, 2);
  card(slide, ctx, 84, 504, 846, 88, { fill: "#FFFFFF", line: C.line });
  text(slide, ctx, "Scale gate", 112, 526, 120, 20, { size: 18, bold: true });
  text(slide, ctx, "A qualified organic signal: reply, hosted-review start, qualified call, exact-site request, or capture request tied to a buyer workflow.", 242, 522, 628, 28, { size: 14, color: C.slate });
  text(slide, ctx, "The repo blocks live sends, public posts, paid spend, rights commitments, and commercialization commitments without explicit approval.", 242, 552, 638, 16, { size: 11, color: C.coral });
  footer(slide, ctx, "Sources: R6. Visual asset is illustrative, not customer proof.");
  notes(slide, "This slide should reassure investors that GTM is focused and proof-led. It also preserves the hard boundary: the pilot can generate target ledgers, drafts, and review packets, but live sends or commitments need explicit approval and evidence.");

  return slide;
}
