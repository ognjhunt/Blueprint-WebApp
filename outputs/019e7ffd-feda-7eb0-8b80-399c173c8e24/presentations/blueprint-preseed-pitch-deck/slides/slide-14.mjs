import { C, bg, rect, rule, text, image, kicker, title, subtitle, footer, pill, metric, card, bar, step, notes, outputDir } from "./_helpers.mjs";

export async function slide14(presentation, ctx) {
  const slide = presentation.slides.add();

  bg(slide, ctx, C.dark);
  kicker(slide, ctx, "EVIDENCE BOUNDARY", { dark: true, color: C.green });
  title(slide, ctx, "Evidence is explicit before this deck leaves the repo.", 62, 86, 760, 96, { color: C.white });
  subtitle(slide, ctx, "The deck is investor-showcase ready. It does not claim operational launch readiness where owner-system proof is missing.", 64, 184, 760, 48, { color: "#FFFFFFC8" });
  card(slide, ctx, 82, 286, 500, 254, { fill: "#FFFFFF10", line: "#FFFFFF22" });
  text(slide, ctx, "Blocked claims", 112, 316, 220, 24, { size: 23, bold: true, color: C.white });
  text(slide, ctx, "- real customer logos, revenue, or traction\n- live payments, payouts, or entitlements\n- rights-cleared commercial use for any specific external site\n- guaranteed hosted-session fulfillment\n- active city coverage or capturer availability\n- final raise amount, terms, runway, hiring plan", 112, 364, 410, 132, { size: 14, color: "#FFFFFFC8" });
  card(slide, ctx, 646, 286, 500, 260, { fill: C.paper, line: "#00000000" });
  text(slide, ctx, "Source ledger", 676, 316, 220, 24, { size: 23, bold: true, color: C.ink });
  text(slide, ctx, "Every source ID in the footer maps to a repo file, source URL, evidence use, slide list, confidence level, and claim boundary.", 676, 360, 400, 56, { size: 16, color: C.slate });
  text(slide, ctx, outputDir + "/blueprint-preseed-source-ledger.md", 676, 448, 390, 46, { size: 12, color: C.blue });
  rect(slide, ctx, 676, 512, 330, 28, C.green, C.green, 0);
  text(slide, ctx, "Pitch-ready means polished plus proof-labeled.", 690, 519, 300, 12, { size: 12, bold: true, color: C.ink, valign: "mid" });
  footer(slide, ctx, "Sources: R7 plus source ledger.", { dark: true });
  notes(slide, "Close by making the proof boundary credible. This is a polished investor deck, but it does not upgrade public surface readiness into operational readiness. If the deck is sent externally, confirm the raise amount and refresh the market memo first.");

  return slide;
}
