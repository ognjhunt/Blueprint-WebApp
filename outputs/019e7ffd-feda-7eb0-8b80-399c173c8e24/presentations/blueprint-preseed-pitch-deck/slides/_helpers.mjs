export const repoRoot = "/Users/nijelhunt_1/workspace/Blueprint-WebApp";
export const outputDir = "/Users/nijelhunt_1/workspace/Blueprint-WebApp/outputs/019e7ffd-feda-7eb0-8b80-399c173c8e24/presentations/blueprint-preseed-pitch-deck/output";

export const C = {
  ink: "#15130F",
  paper: "#F5F1E8",
  paper2: "#FFFDF7",
  blue: "#2456D6",
  blue2: "#6E8DFF",
  green: "#B9F24A",
  coral: "#FF6B4A",
  clay: "#B56A42",
  slate: "#505864",
  mute: "#7A776F",
  line: "#D8D0C2",
  dark: "#0D0D0B",
  white: "#FFFFFF",
};

export function bg(slide, ctx, fill = C.paper) {
  ctx.addShape(slide, { x: 0, y: 0, w: ctx.W, h: ctx.H, fill, line: ctx.line("#00000000", 0) });
}

export function rect(slide, ctx, x, y, w, h, fill, line = "#00000000", width = 0, name) {
  return ctx.addShape(slide, { x, y, w, h, fill, line: ctx.line(line, width), name });
}

export function rule(slide, ctx, x, y, w, color = C.ink, height = 1, name) {
  return rect(slide, ctx, x, y, w, height, color, color, 0, name);
}

export function text(slide, ctx, value, x, y, w, h, opts = {}) {
  return ctx.addText(slide, {
    text: value,
    x,
    y,
    w,
    h,
    fontSize: opts.size ?? 22,
    color: opts.color ?? C.ink,
    bold: opts.bold ?? false,
    typeface: opts.face ?? (opts.display ? ctx.fonts.title : ctx.fonts.body),
    align: opts.align ?? "left",
    valign: opts.valign ?? "top",
    fill: opts.fill ?? "#00000000",
    line: ctx.line(opts.line ?? "#00000000", opts.lineWidth ?? 0),
    insets: opts.insets ?? { left: 0, right: 0, top: 0, bottom: 0 },
    name: opts.name,
  });
}

export async function image(slide, ctx, rel, x, y, w, h, opts = {}) {
  return ctx.addImage(slide, {
    path: rel.startsWith("/") ? rel : repoRoot + "/" + rel,
    x,
    y,
    w,
    h,
    fit: opts.fit ?? "cover",
    alt: opts.alt ?? "",
    name: opts.name,
  });
}

export function kicker(slide, ctx, label, opts = {}) {
  const dark = opts.dark ?? false;
  const x = opts.x ?? 62;
  const y = opts.y ?? 44;
  const markerColor = opts.color ?? C.blue;
  const labelColor = dark ? C.white : C.ink;
  const id = String(ctx.slideNumber || "x").padStart(2, "0");
  rect(slide, ctx, x, y + 6, 36, 8, markerColor, markerColor, 0, "kicker-" + id + "-marker");
  text(slide, ctx, label, x + 50, y, 420, 22, {
    size: 11,
    bold: true,
    color: labelColor,
    valign: "mid",
    name: "kicker-" + id + "-label",
  });
}

export function title(slide, ctx, value, x = 62, y = 86, w = 790, h = 112, opts = {}) {
  return text(slide, ctx, value, x, y, w, h, {
    size: opts.size ?? 46,
    display: true,
    bold: true,
    color: opts.color ?? C.ink,
    valign: "top",
    line: "#00000000",
  });
}

export function subtitle(slide, ctx, value, x, y, w, h, opts = {}) {
  return text(slide, ctx, value, x, y, w, h, {
    size: opts.size ?? 21,
    color: opts.color ?? C.slate,
    valign: "top",
    line: "#00000000",
  });
}

export function footer(slide, ctx, sources, opts = {}) {
  const dark = opts.dark ?? false;
  rule(slide, ctx, 62, 670, 1080, dark ? "#FFFFFF22" : "#15130F20", 1);
  text(slide, ctx, sources, 62, 682, 900, 16, {
    size: 9,
    color: dark ? "#FFFFFF88" : "#5C564C",
  });
  const id = String(ctx.slideNumber || 0).padStart(2, "0");
  text(slide, ctx, id, 1160, 676, 44, 22, {
    size: 11,
    bold: true,
    color: dark ? "#FFFFFFAA" : C.ink,
    align: "right",
    valign: "mid",
  });
}

export function pill(slide, ctx, value, x, y, w, opts = {}) {
  rect(slide, ctx, x, y, w, 32, opts.fill ?? C.ink, opts.line ?? "#00000000", 0);
  text(slide, ctx, value, x + 12, y + 7, w - 24, 16, {
    size: opts.size ?? 11,
    bold: true,
    color: opts.color ?? C.white,
    valign: "mid",
  });
}

export function metric(slide, ctx, value, label, x, y, w, opts = {}) {
  text(slide, ctx, value, x, y, w, 46, {
    size: opts.valueSize ?? 38,
    bold: true,
    display: true,
    color: opts.color ?? C.ink,
  });
  text(slide, ctx, label, x, y + 50, w, 42, {
    size: opts.labelSize ?? 13,
    color: opts.labelColor ?? C.slate,
  });
}

export function card(slide, ctx, x, y, w, h, opts = {}) {
  rect(slide, ctx, x, y, w, h, opts.fill ?? C.paper2, opts.line ?? C.line, opts.lineWidth ?? 1);
}

export function bar(slide, ctx, label, value, max, x, y, w, color, opts = {}) {
  text(slide, ctx, label, x, y - 2, 190, 26, { size: opts.size ?? 14, bold: opts.bold ?? false });
  rect(slide, ctx, x + 205, y + 3, w, 10, "#E4DDD1", "#00000000", 0);
  rect(slide, ctx, x + 205, y + 3, Math.max(2, w * value / max), 10, color, color, 0);
  text(slide, ctx, opts.valueLabel ?? String(value), x + 220 + w, y - 2, 90, 24, {
    size: 13,
    bold: true,
    color: C.ink,
  });
}

export function step(slide, ctx, n, heading, body, x, y, w, opts = {}) {
  rect(slide, ctx, x, y, 38, 38, opts.color ?? C.blue, opts.color ?? C.blue, 0);
  text(slide, ctx, n, x + 8, y + 8, 22, 16, { size: 13, bold: true, color: C.white, align: "center" });
  text(slide, ctx, heading, x + 50, y - 2, w - 50, 28, { size: 20, bold: true });
  text(slide, ctx, body, x + 50, y + 31, w - 50, 60, { size: 14, color: C.slate });
}

export function notes(slide, body) {
  slide.speakerNotes.setText(body.trim());
}
