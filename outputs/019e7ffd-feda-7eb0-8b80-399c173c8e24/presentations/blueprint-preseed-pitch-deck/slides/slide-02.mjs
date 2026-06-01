import { C, bg, rect, rule, text, image, kicker, title, subtitle, footer, pill, metric, card, bar, step, notes, outputDir } from "./_helpers.mjs";

export async function slide02(presentation, ctx) {
  const slide = presentation.slides.add();

  bg(slide, ctx, C.paper);
  kicker(slide, ctx, "WHY NOW");
  title(slide, ctx, "Robots are moving into places that need site-specific proof.", 62, 86, 780, 112);
  subtitle(slide, ctx, "World models made real-place simulation legible. Robotics adoption makes indoor site data urgent.", 64, 210, 780, 52);
  metric(slide, ctx, "542K", "industrial robots installed in 2024", 70, 292, 220, { color: C.blue });
  metric(slide, ctx, "4.664M", "industrial robots in operation worldwide", 318, 292, 270, { color: C.ink });
  metric(slide, ctx, ">199K", "professional service robots sold in 2024", 620, 292, 270, { color: C.coral });
  metric(slide, ctx, "50%", "new developed-market warehouses expected robot-centric by 2030", 924, 292, 260, { color: C.clay, labelSize: 12 });
  rule(slide, ctx, 64, 425, 820, "#15130F22", 1);
  card(slide, ctx, 64, 458, 350, 136, { fill: "#FFFFFFB0" });
  text(slide, ctx, "Real-place world models", 88, 480, 280, 24, { size: 19, bold: true });
  text(slide, ctx, "Google connected Genie with Street View so virtual environments can be anchored in reality for agents or robots.", 88, 514, 286, 56, { size: 13, color: C.slate });
  card(slide, ctx, 450, 458, 350, 136, { fill: "#FFFFFFB0" });
  text(slide, ctx, "Counterfactual simulation", 474, 480, 280, 24, { size: 19, bold: true });
  text(slide, ctx, "Waymo adapted a world model for driving-domain simulation, including rare events that are hard to capture at scale.", 474, 514, 286, 56, { size: 13, color: C.slate });
  card(slide, ctx, 836, 458, 350, 136, { fill: "#FFFFFFB0" });
  text(slide, ctx, "Physical AI tooling", 860, 480, 280, 24, { size: 19, bold: true });
  text(slide, ctx, "NVIDIA Cosmos frames world foundation models around robots, AVs, synthetic data, and physical-AI evaluation.", 860, 514, 286, 56, { size: 13, color: C.slate });
  footer(slide, ctx, "Sources: W1 W2 W3 W8 W9 W10 W11.");
  notes(slide, "This slide establishes category timing. The key point is not that these sources prove Blueprint execution. They show demand shifting toward robot-centric facilities and world-model/simulation infrastructure. The Blueprint wedge is the indoor rights and provenance layer missing from public outdoor maps and generic simulations.");

  return slide;
}
