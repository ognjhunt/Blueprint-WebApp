import { C, bg, rect, rule, text, image, kicker, title, subtitle, footer, pill, metric, card, bar, step, notes, outputDir } from "./_helpers.mjs";

export async function slide08(presentation, ctx) {
  const slide = presentation.slides.add();

  bg(slide, ctx, C.paper2);
  kicker(slide, ctx, "MARKET MODEL");
  title(slide, ctx, "The market is exact-site deployment infrastructure.", 62, 86, 900, 108);
  subtitle(slide, ctx, "TAM/SAM/SOM are modeled from filtered robotics, warehouse automation, digital twin, simulation, pricing, account, site, and refresh assumptions.", 64, 214, 880, 54);
  const rows = [
    ["2026", "$1.6B-$11.8B", "$0.12B-$5.08B", "$0.23M-$7.32M"],
    ["2030", "$9.3B-$50.6B", "$0.63B-$19.48B", "$10.62M-$280.45M"],
    ["2035", "$19.4B-$215.6B", "$3.09B-$85.14B", "$111.38M-$2.55B"]
  ];
  const cols = [74, 242, 508, 784];
  const widths = [130, 220, 220, 252];
  text(slide, ctx, "Year", cols[0], 310, widths[0], 20, { size: 13, bold: true, color: C.mute });
  text(slide, ctx, "Broad strategic TAM", cols[1], 310, widths[1], 20, { size: 13, bold: true, color: C.mute });
  text(slide, ctx, "Serviceable SAM", cols[2], 310, widths[2], 20, { size: 13, bold: true, color: C.mute });
  text(slide, ctx, "Modeled SOM", cols[3], 310, widths[3], 20, { size: 13, bold: true, color: C.mute });
  for (let i = 0; i < rows.length; i++) {
    const y = 350 + i * 74;
    rect(slide, ctx, 62, y - 12, 1060, 58, i === 1 ? "#E8F2C7" : "#FFFFFF", "#D8D0C2", 1);
    for (let j = 0; j < rows[i].length; j++) {
      text(slide, ctx, rows[i][j], cols[j], y, widths[j], 28, {
        size: j === 0 ? 18 : 20,
        bold: j === 0 || i === 1,
        color: j === 1 ? C.blue : j === 2 ? C.coral : C.ink,
      });
    }
  }
  rect(slide, ctx, 76, 585, 1000, 38, C.ink, C.ink, 0);
  text(slide, ctx, "Deck uses base-case 2030 as the narrative anchor: $24.3B TAM, $7.49B SAM, $87.66M SOM. Refresh the model before external fundraising distribution.", 98, 596, 930, 16, { size: 13, color: C.white, valign: "mid" });
  footer(slide, ctx, "Sources: M1 W3 W4 W12 W13 W14 W15. Modeled estimates, not direct report claims.");
  notes(slide, "This is intentionally conservative in language. The broad source pool includes robotics, warehouse automation, digital twin, and simulation markets, then filters to exact-site indoor deployment infrastructure. The SAM is bottom-up from Blueprint pricing and modeled account/site activity. Treat as a fundraise model that needs refresh before external circulation.");

  return slide;
}
