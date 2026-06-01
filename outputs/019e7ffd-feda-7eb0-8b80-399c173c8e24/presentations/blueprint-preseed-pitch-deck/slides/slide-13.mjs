import { C, bg, rect, rule, text, image, kicker, title, subtitle, footer, pill, metric, card, bar, step, notes, outputDir } from "./_helpers.mjs";

export async function slide13(presentation, ctx) {
  const slide = presentation.slides.add();

  bg(slide, ctx, C.paper2);
  kicker(slide, ctx, "PRE-SEED PLAN");
  title(slide, ctx, "The raise should fund wedge proof into repeatability.", 62, 86, 820, 104);
  subtitle(slide, ctx, "The exact dollar ask, valuation, and runway require founder confirmation; the use-of-funds story is already grounded.", 64, 190, 820, 48);
  const stages = [
    ["0-6 months", "Prove the wedge", "First repeatable exact-site hosted-review package workflow and qualified organic signal."],
    ["6-12 months", "Repeat by vertical", "Logistics and manufacturing target batches with recipient-backed GTM, proof ledgers, and capture asks."],
    ["12-18 months", "Expand accounts", "Multi-site package management, hosted-review logs, refresh/recapture cadence, enterprise controls."]
  ];
  for (let i = 0; i < stages.length; i++) {
    const x = 74 + i * 374;
    rect(slide, ctx, x, 296, 326, 178, i === 0 ? C.blue : i === 1 ? C.ink : C.coral, "#00000000", 0);
    text(slide, ctx, stages[i][0], x + 24, 322, 180, 18, { size: 14, bold: true, color: "#FFFFFFB8" });
    text(slide, ctx, stages[i][1], x + 24, 356, 260, 26, { size: 24, bold: true, color: C.white });
    text(slide, ctx, stages[i][2], x + 24, 402, 258, 46, { size: 13, color: "#FFFFFFCC" });
  }
  card(slide, ctx, 74, 520, 1030, 88, { fill: "#FFFFFF", line: C.line });
  text(slide, ctx, "Use of funds", 100, 544, 120, 20, { size: 18, bold: true });
  text(slide, ctx, "Capture supply, package/runtime quality, buyer GTM, rights/provenance, autonomous-loop reliability.", 244, 544, 800, 20, { size: 14, color: C.slate });
  text(slide, ctx, "Blocked before send: exact raise amount, runway, hiring plan, committed investor/customer logos.", 244, 578, 770, 14, { size: 11, color: C.coral });
  footer(slide, ctx, "Sources: R2 R6. Ask amount and terms are not claimed.");
  notes(slide, "This is the fundraise framing slide without inventing a dollar ask. Before sending to investors, replace the founder-confirmation language with the actual target raise, runway, valuation strategy, hiring plan, and milestones.");

  return slide;
}
