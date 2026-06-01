import { C, bg, rect, rule, text, image, kicker, title, subtitle, footer, pill, metric, card, bar, step, notes, outputDir } from "./_helpers.mjs";

export async function slide04(presentation, ctx) {
  const slide = presentation.slides.add();

  bg(slide, ctx, C.dark);
  kicker(slide, ctx, "INSIGHT", { dark: true, color: C.green });
  title(slide, ctx, "Model backends can swap; site truth compounds.", 62, 86, 770, 112, { color: C.white });
  subtitle(slide, ctx, "The durable asset is the capture-backed contract around a real place, not permanent ownership of one frontier model.", 64, 198, 760, 50, { color: "#FFFFFFBF" });
  card(slide, ctx, 74, 302, 500, 240, { fill: "#FFFFFF10", line: "#FFFFFF20" });
  text(slide, ctx, "Swappable engines", 106, 330, 360, 28, { size: 25, bold: true, color: C.white });
  text(slide, ctx, "- world-model checkpoints\n- inference providers\n- retrieval and refinement strategies\n- training/export adapters", 106, 388, 360, 120, { size: 19, color: "#FFFFFFBA" });
  card(slide, ctx, 642, 302, 500, 240, { fill: C.paper, line: "#00000000" });
  text(slide, ctx, "Stable contracts", 674, 330, 360, 28, { size: 25, bold: true, color: C.ink });
  text(slide, ctx, "- raw capture, timestamps, poses, intrinsics\n- rights, privacy, consent, provenance\n- package manifests and hosted sessions\n- buyer licensing and export boundaries", 674, 388, 400, 120, { size: 18, color: C.slate });
  rect(slide, ctx, 576, 404, 64, 24, C.green, C.green, 0);
  text(slide, ctx, "moat", 586, 409, 44, 12, { size: 11, bold: true, color: C.ink, align: "center" });
  footer(slide, ctx, "Sources: R2 R5 W10. No claim that Blueprint owns a frontier model backend.", { dark: true });
  notes(slide, "This is the core strategic argument. If world models improve rapidly, Blueprint benefits by owning better real-site inputs, rights and provenance, package contracts, and buyer workflows. Better backends increase the value of exact-site packages instead of commoditizing the company.");

  return slide;
}
