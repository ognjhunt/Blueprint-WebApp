import { C, bg, rect, rule, text, image, kicker, title, subtitle, footer, pill, metric, card, bar, step, notes, outputDir } from "./_helpers.mjs";

export async function slide12(presentation, ctx) {
  const slide = presentation.slides.add();

  bg(slide, ctx, C.paper);
  kicker(slide, ctx, "OPERATING SYSTEM");
  title(slide, ctx, "The operating system turns the wedge into repeatable proof.", 62, 86, 820, 104);
  subtitle(slide, ctx, "Paperclip is the execution record. The active wedge is judged through three loops that move buyer evidence, not commentary.", 64, 190, 800, 48);
  const loops = [
    ["Product / proof", "Keep artifacts honest, buyer-inspectable, and attached to rights/provenance boundaries.", C.blue],
    ["Demand / sales", "Add targets, find recipient-backed contacts, draft, approve, send, follow up.", C.coral],
    ["Reliability", "Keep reply resume, send ledgers, audits, blocker state, and closeout proof truthful.", C.ink]
  ];
  for (let i = 0; i < loops.length; i++) {
    const x = 90 + i * 360;
    card(slide, ctx, x, 306, 302, 190, { fill: C.paper2, line: "#BDB3A3" });
    rect(slide, ctx, x, 306, 302, 12, loops[i][2], loops[i][2], 0);
    text(slide, ctx, loops[i][0], x + 24, 344, 242, 24, { size: 22, bold: true });
    text(slide, ctx, loops[i][1], x + 24, 392, 238, 64, { size: 14, color: C.slate });
  }
  rect(slide, ctx, 200, 550, 760, 48, C.green, C.green, 0);
  text(slide, ctx, "Founder gates remain for live sends, pricing commitments, rights/privacy, legal, paid spend, and other irreversible actions.", 226, 565, 708, 18, { size: 14, bold: true, color: C.ink, valign: "mid" });
  footer(slide, ctx, "Sources: R6 R8. Does not prove current live Paperclip/API health.");
  notes(slide, "Use this slide to explain operational leverage without overstating autonomy. The repo doctrine says the wedge should be judged by movement in product proof, demand/sales, and reliability. High-risk actions are still gated.");

  return slide;
}
