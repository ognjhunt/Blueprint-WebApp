import { C, bg, rect, rule, text, image, kicker, title, subtitle, footer, pill, metric, card, bar, step, notes, outputDir } from "./_helpers.mjs";

export async function slide07(presentation, ctx) {
  const slide = presentation.slides.add();

  bg(slide, ctx, C.paper);
  kicker(slide, ctx, "BUSINESS MODEL");
  title(slide, ctx, "The first monetization path is package access plus hosted review.", 62, 86, 820, 104);
  subtitle(slide, ctx, "Pricing is public, but availability, rights, payment, and fulfillment stay confirmed per site/request.", 64, 190, 760, 46);
  const cards = [
    ["Site Package Access", "$2,100-$3,400", "Files, manifest, route notes, rights sheet, provenance summary, export scope.", C.blue],
    ["Hosted Review", "$16-$29/session-hour", "Managed buyer room, scoped run notes, observations, and output decisions.", C.coral],
    ["Custom Scope", "$50,000+ scoped", "Private or multi-site work with capture plan, operator boundary review, and delivery estimate.", C.ink]
  ];
  for (let i = 0; i < cards.length; i++) {
    const x = 76 + i * 374;
    card(slide, ctx, x, 294, 326, 232, { fill: C.paper2, line: "#BDB3A3" });
    rect(slide, ctx, x, 294, 326, 12, cards[i][3], cards[i][3], 0);
    text(slide, ctx, cards[i][0], x + 26, 332, 260, 28, { size: 22, bold: true });
    text(slide, ctx, cards[i][1], x + 26, 378, 274, 40, { size: i === 1 ? 24 : 30, display: true, bold: true, color: cards[i][3] });
    text(slide, ctx, cards[i][2], x + 26, 438, 256, 62, { size: 14, color: C.slate });
  }
  rect(slide, ctx, 78, 560, 1020, 48, C.ink, C.ink, 0);
  text(slide, ctx, "Investor read: wedge revenue starts with one exact site, then expands through hosted hours, refresh/recapture, multi-site scope, and enterprise access controls.", 102, 575, 946, 20, { size: 15, color: C.white, valign: "mid" });
  footer(slide, ctx, "Sources: R3 R7. Does not claim completed payments or entitlements.");
  notes(slide, "Use this as the monetization bridge. The numbers come from the current repo pricing surface. Be explicit that these are public planning ranges and request paths, not evidence of settled payments, payouts, or fulfilled entitlements.");

  return slide;
}
