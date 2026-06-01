import { C, bg, rect, rule, text, image, kicker, title, subtitle, footer, pill, metric, card, bar, step, notes, outputDir } from "./_helpers.mjs";

export async function slide11(presentation, ctx) {
  const slide = presentation.slides.add();

  bg(slide, ctx, C.dark);
  kicker(slide, ctx, "MOAT", { dark: true, color: C.green });
  title(slide, ctx, "Capture -> package -> buyer usage -> more capture.", 62, 86, 820, 104, { color: C.white });
  subtitle(slide, ctx, "Better world-model providers make proprietary site coverage, rights/provenance, and buyer workflow more valuable.", 64, 210, 780, 50, { color: "#FFFFFFC8" });
  const nodes = [
    [110, 342, "Capture supply", "More real indoor routes and device context."],
    [402, 270, "Package quality", "Better manifests, freshness, and proof labels."],
    [724, 342, "Buyer usage", "Hosted review creates observations and next-step demand."],
    [402, 490, "More capture", "Usage signals identify sites, recapture, and vertical expansion."]
  ];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    rect(slide, ctx, n[0], n[1], 230, 86, i === 0 ? C.blue : i === 1 ? C.green : i === 2 ? C.coral : C.paper, "#00000000", 0);
    text(slide, ctx, n[2], n[0] + 18, n[1] + 18, 190, 20, { size: 19, bold: true, color: i === 1 || i === 3 ? C.ink : C.white });
    text(slide, ctx, n[3], n[0] + 18, n[1] + 48, 190, 26, { size: 12, color: i === 1 || i === 3 ? C.ink : "#FFFFFFC8" });
  }
  rule(slide, ctx, 340, 382, 60, C.white, 2);
  rule(slide, ctx, 632, 312, 90, C.white, 2);
  rule(slide, ctx, 600, 382, 124, C.white, 2);
  rule(slide, ctx, 515, 428, 2, C.white, 62);
  card(slide, ctx, 930, 302, 238, 220, { fill: "#FFFFFF12", line: "#FFFFFF22" });
  text(slide, ctx, "Compounding assets", 958, 330, 190, 22, { size: 20, bold: true, color: C.white });
  text(slide, ctx, "- real-site coverage\n- provenance and rights\n- package contracts\n- hosted-review logs\n- buyer feedback loops", 958, 374, 174, 108, { size: 15, color: "#FFFFFFC8" });
  footer(slide, ctx, "Sources: R1 R2 R5. Does not claim rights are cleared for any specific external site.", { dark: true });
  notes(slide, "The flywheel is the economic argument. More buyer usage should guide more capture and better packages. More packages make hosted review and buyer workflows more useful. The moat is not a model checkpoint; it is real-site coverage plus rights, provenance, package contracts, and feedback.");

  return slide;
}
