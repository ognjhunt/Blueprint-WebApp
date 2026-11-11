import type { Page } from "@playwright/test";

/**
 * The bare-bones rhythm (client/src/components/bare/bare.css, at its top), measured rather than judged by eye: the
 * vertical gap between consecutive visible blocks of different kinds inside `root`, and any text centred other than
 * a filled button's or a file picker's own label. Deterministic: it reads boxes and computed styles only.
 */
export async function bareRhythmFindings(page: Page, root = ".bare-screen") {
  return page.evaluate((rootSelector) => {
    const KINDS = [".bare-label", ".bare-big", ".bare-sub", ".bare-lead", ".bare-job", ".bare-tick", ".bare-sure-line", ".bare-helper", ".bare-notice",
      ".bare-done", ".bare-button", ".bare-quiet-button", ".bare-links", ".bare-fine", ".bare-back", ".bare-rows-title", ".bare-row", ".bare-menu",
      ".bare-field", ".bare-check", ".bare-inline-link", ".bare-link", ".ms-field-hint", ".auth-description", ".auth-primary", ".auth-google",
      "details", "h1", "h2", "p"];
    const OWN_LABEL = ".bare-button, .bare-file, .auth-primary, .auth-google, .ms-button";
    const container = [...document.querySelectorAll<HTMLElement>(rootSelector)].find(node => node.getBoundingClientRect().height > 0);
    if (!container) return { tight: ["no visible root"], centred: [], blocks: 0 };
    const visible = (node: HTMLElement) => node.getBoundingClientRect().height > 0 && getComputedStyle(node).visibility !== "hidden";
    const blocks = [...container.querySelectorAll<HTMLElement>(KINDS.join(","))]
      .filter(visible)
      .filter((node, _, all) => !all.some(other => other !== node && other.contains(node)))
      .map(node => ({ kind: KINDS.find(kind => node.matches(kind))!, text: (node.textContent ?? "").trim().slice(0, 40), box: node.getBoundingClientRect() }));
    const tight: string[] = [];
    for (let i = 1; i < blocks.length; i++) {
      const [before, after] = [blocks[i - 1], blocks[i]];
      // Side by side, or the same kind of block (rows of one list), is not a gap between different blocks.
      if (before.kind === after.kind || after.box.top < before.box.bottom - 1) continue;
      const gap = after.box.top - before.box.bottom;
      if (gap < 7.5) tight.push(`${before.kind} "${before.text}" → ${after.kind} "${after.text}": ${gap.toFixed(1)} px`);
    }
    const centred = [...container.querySelectorAll<HTMLElement>("*")].filter(node => visible(node)
      && [...node.childNodes].some(child => child.nodeType === Node.TEXT_NODE && child.textContent!.trim())
      && getComputedStyle(node).textAlign === "center" && !node.closest(OWN_LABEL))
      .map(node => `${node.tagName.toLowerCase()}.${node.className} "${(node.textContent ?? "").trim().slice(0, 40)}"`);
    return { tight, centred, blocks: blocks.length };
  }, root);
}
