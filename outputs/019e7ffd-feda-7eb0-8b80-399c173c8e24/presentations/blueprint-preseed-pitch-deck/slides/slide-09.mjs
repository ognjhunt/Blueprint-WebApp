import { C, bg, rect, rule, text, image, kicker, title, subtitle, footer, pill, metric, card, bar, step, notes, outputDir } from "./_helpers.mjs";

export async function slide09(presentation, ctx) {
  const slide = presentation.slides.add();

  bg(slide, ctx, C.paper);
  kicker(slide, ctx, "CUSTOMER FOCUS");
  title(slide, ctx, "Start where site specificity is already expensive.", 62, 86, 780, 100);
  subtitle(slide, ctx, "The first ICPs are teams that need exact facilities before hardware travel, pilot scoping, simulation, or export decisions.", 64, 188, 760, 48);
  const icps = [
    ["Robot teams", "AMR, manipulation, cleaning, inspection, service, humanoid, lab automation."],
    ["Systems integrators", "Teams scoping deployments for customers before discovery and pilot costs."],
    ["Large operators", "3PLs, retailers, grocers, manufacturers, hospitals, labs, campuses."],
    ["Physical AI teams", "Simulation, evaluation, synthetic-data, and site-adaptation workflows."],
    ["Site operators", "Optional lane when access, rights, privacy, or commercialization requires it."]
  ];
  for (let i = 0; i < icps.length; i++) {
    const y = 286 + i * 56;
    rect(slide, ctx, 70, y, 28, 28, i < 2 ? C.blue : i === 2 ? C.coral : i === 3 ? C.green : C.clay, "#00000000", 0);
    text(slide, ctx, icps[i][0], 116, y - 2, 170, 20, { size: 18, bold: true });
    text(slide, ctx, icps[i][1], 300, y - 2, 480, 34, { size: 13, color: C.slate });
  }
  card(slide, ctx, 860, 286, 290, 282, { fill: C.dark, line: C.dark });
  text(slide, ctx, "First verticals", 888, 314, 220, 24, { size: 22, bold: true, color: C.white });
  text(slide, ctx, "1. Warehousing, 3PL, fulfillment\n2. Manufacturing and intralogistics\n3. Retail, grocery, back rooms\n4. Healthcare, labs, hospital routes\n5. Hospitality, airports, campuses", 888, 362, 226, 142, { size: 16, color: "#FFFFFFCC" });
  text(slide, ctx, "Evidence converges around logistics/mobile robots, robot-centric warehouses, and broadening automation demand.", 888, 520, 226, 32, { size: 12, color: "#FFFFFF99" });
  footer(slide, ctx, "Sources: M1 W2 W3 W4 W5 W11.");
  notes(slide, "Make the customer wedge concrete. The buyer does not have to be the site operator. Site operators matter when access, privacy, rights, or commercialization require them. The first verticals are logistics and manufacturing because the evidence base is strongest there.");

  return slide;
}
