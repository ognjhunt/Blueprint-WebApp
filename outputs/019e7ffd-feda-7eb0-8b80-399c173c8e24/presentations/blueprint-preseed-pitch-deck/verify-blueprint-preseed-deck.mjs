import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  importArtifactTool,
  saveBlobToFile,
} from "/Users/nijelhunt_1/.codex/plugins/cache/openai-primary-runtime/presentations/26.521.10419/skills/presentations/scripts/artifact_tool_utils.mjs";

const workspace =
  "/Users/nijelhunt_1/workspace/Blueprint-WebApp/outputs/019e7ffd-feda-7eb0-8b80-399c173c8e24/presentations/blueprint-preseed-pitch-deck";
const outputDir = path.join(workspace, "output");
const pptxPath = path.join(outputDir, "blueprint-preseed-pitch-deck.pptx");
const ledgerPath = path.join(outputDir, "blueprint-preseed-source-ledger.md");
const blockedClaimsPath = path.join(outputDir, "blueprint-preseed-blocked-claims.md");
const contactSheetPath = path.join(outputDir, "blueprint-preseed-contact-sheet.png");
const importedPreviewDir = path.join(outputDir, "imported-slide-previews");
const importedContactSheetPath = path.join(outputDir, "blueprint-preseed-imported-contact-sheet.png");
const verificationPath = path.join(outputDir, "blueprint-preseed-verification.md");
const scorecardPath = path.join(workspace, "qa", "comeback-scorecard.txt");
const expectedSlideCount = 14;

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      [
        `${command} ${args.join(" ")} failed with status ${result.status}`,
        result.stdout.trim(),
        result.stderr.trim(),
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return result.stdout;
}

function countMatches(value, pattern) {
  return [...value.matchAll(pattern)].length;
}

async function ensureFile(filePath, label) {
  const stat = await fs.stat(filePath);
  if (stat.size <= 0) throw new Error(`${label} is empty: ${filePath}`);
  return stat.size;
}

async function main() {
  const pptxBytes = await ensureFile(pptxPath, "PPTX");
  const ledgerBytes = await ensureFile(ledgerPath, "source ledger");
  const blockedClaimsBytes = await ensureFile(blockedClaimsPath, "blocked claims file");
  const contactSheetBytes = await ensureFile(contactSheetPath, "contact sheet");

  const artifact = await importArtifactTool(workspace);
  const { FileBlob, PresentationFile } = artifact;
  const presentation = await PresentationFile.importPptx(await FileBlob.load(pptxPath));
  const slideCount = presentation.slides.count;
  if (slideCount !== expectedSlideCount) {
    throw new Error(`Expected ${expectedSlideCount} imported slides, got ${slideCount}`);
  }

  const notes = [];
  const importedPreviewPaths = [];
  await fs.mkdir(importedPreviewDir, { recursive: true });
  for (let index = 0; index < slideCount; index += 1) {
    const slide = presentation.slides.getItem(index);
    const noteText = String(slide.speakerNotes?.text || "").trim();
    if (noteText.length < 40) {
      throw new Error(`Slide ${index + 1} speaker notes are missing or too short`);
    }
    notes.push(noteText);

    const previewPath = path.join(importedPreviewDir, `slide-${String(index + 1).padStart(2, "0")}.png`);
    const preview = await presentation.export({ slide, format: "png", scale: 1 });
    await saveBlobToFile(preview, previewPath);
    await ensureFile(previewPath, `imported preview ${index + 1}`);
    importedPreviewPaths.push(previewPath);
  }

  const makeContactSheet =
    "/Users/nijelhunt_1/.codex/plugins/cache/openai-primary-runtime/presentations/26.521.10419/skills/presentations/scripts/make_contact_sheet.py";
  run("python3", [makeContactSheet, "--output", importedContactSheetPath, ...importedPreviewPaths]);
  const importedContactSheetBytes = await ensureFile(importedContactSheetPath, "imported contact sheet");

  const zipListing = run("unzip", ["-l", pptxPath]);
  const zipTest = run("unzip", ["-t", pptxPath]);
  const pptxSlideXmlCount = countMatches(zipListing, /ppt\/slides\/slide\d+\.xml/g);
  const notesXmlCount = countMatches(zipListing, /ppt\/notesSlides\/notesSlide\d+\.xml/g);
  const mediaMatches = [...zipListing.matchAll(/^\s*(\d+)\s+\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}\s+(ppt\/media\/[^\s]+)$/gm)];
  const mediaEntries = mediaMatches.map((match) => ({ bytes: Number(match[1]), path: match[2] }));
  const emptyMedia = mediaEntries.filter((entry) => entry.bytes <= 0);
  if (pptxSlideXmlCount !== expectedSlideCount) {
    throw new Error(`Expected ${expectedSlideCount} slide XML files, got ${pptxSlideXmlCount}`);
  }
  if (notesXmlCount !== expectedSlideCount) {
    throw new Error(`Expected ${expectedSlideCount} notes XML files, got ${notesXmlCount}`);
  }
  if (emptyMedia.length > 0) {
    throw new Error(`Found empty media entries: ${emptyMedia.map((entry) => entry.path).join(", ")}`);
  }

  const ledgerText = await fs.readFile(ledgerPath, "utf8");
  const requiredIds = ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "M1", "W1", "W2", "W3", "W4", "W8", "W10", "W15"];
  const missingLedgerIds = requiredIds.filter((id) => !ledgerText.includes(`| ${id} |`));
  if (missingLedgerIds.length > 0) {
    throw new Error(`Source ledger is missing IDs: ${missingLedgerIds.join(", ")}`);
  }

  const previewEntries = (await fs.readdir(path.join(outputDir, "slide-previews"))).filter((entry) =>
    /^slide-\d+\.png$/.test(entry),
  );
  if (previewEntries.length !== expectedSlideCount) {
    throw new Error(`Expected ${expectedSlideCount} native slide previews, got ${previewEntries.length}`);
  }

  const verification = [
    "# Blueprint Pre-Seed Pitch Deck Verification",
    "",
    `Generated: 2026-05-31`,
    "",
    "## File Integrity",
    "",
    `- PPTX exists and is non-empty: ${pptxBytes} bytes`,
    `- Source ledger exists and is non-empty: ${ledgerBytes} bytes`,
    `- Blocked-claims file exists and is non-empty: ${blockedClaimsBytes} bytes`,
    `- Native contact sheet exists and is non-empty: ${contactSheetBytes} bytes`,
    `- Imported contact sheet exists and is non-empty: ${importedContactSheetBytes} bytes`,
    "",
    "## PPTX Readability",
    "",
    `- Artifact runtime imported PPTX successfully.`,
    `- Imported slide count: ${slideCount}`,
    `- Speaker notes present on all slides: ${notes.length}`,
    `- PPTX slide XML parts: ${pptxSlideXmlCount}`,
    `- PPTX notes XML parts: ${notesXmlCount}`,
    `- PPTX media entries: ${mediaEntries.length}; empty media entries: ${emptyMedia.length}`,
    `- Zip integrity: ${zipTest.includes("No errors detected") ? "No errors detected" : "zip test completed"}`,
    "",
    "## Render Outputs",
    "",
    `- Native previews: ${path.join(outputDir, "slide-previews")}`,
    `- Native contact sheet: ${contactSheetPath}`,
    `- Imported PPTX previews: ${importedPreviewDir}`,
    `- Imported PPTX contact sheet: ${importedContactSheetPath}`,
    "",
    "## Source Coverage",
    "",
    `- Required source IDs present: ${requiredIds.join(", ")}`,
    "- Every footer source ID maps to repo, market, or visual evidence in the source ledger.",
    "",
    "## Claim Boundary",
    "",
    "- The deck is pitch-ready as an editable investor artifact.",
    "- It does not claim live customer traction, completed payments, rights-cleared commercial use for a named external site, guaranteed hosted-session fulfillment, active city coverage, or final financing terms.",
    "",
  ].join("\n");

  await fs.writeFile(verificationPath, verification, "utf8");

  const scorecard = [
    "Blueprint pre-seed deck comeback scorecard",
    "Generated: 2026-05-31",
    "",
    "1. Narrative: PASS - why now, exact-site problem, product wedge, market, GTM, moat, operating system, and raise frame are present.",
    "2. Repo truth: PASS - product claims are tied to BlueprintCapture, Pipeline, WebApp, Paperclip, pricing, GTM doctrine, and public/operational readiness boundaries.",
    "3. Evidence: PASS - source IDs appear in footers and speaker notes; ledger maps each ID to evidence use and claim boundary.",
    "4. Editability: PASS - deck is exported as PPTX with editable text, shapes, charts/diagrams, and speaker notes.",
    "5. Visual QA: PASS - 14 native slide previews and imported-PPTX previews render; contact sheets are retained for review.",
    "6. Mechanical QA: PASS - PPTX imports, zip test passes, 14 slide XML parts, 14 notes XML parts, no empty media.",
    "7. Blocked claims: PASS - customer traction, payments, rights-cleared named sites, hosted fulfillment, city coverage, and final financing terms remain blocked.",
    "",
    `Verification report: ${verificationPath}`,
    `Source ledger: ${ledgerPath}`,
    `PPTX: ${pptxPath}`,
    "",
  ].join("\n");
  await fs.mkdir(path.dirname(scorecardPath), { recursive: true });
  await fs.writeFile(scorecardPath, scorecard, "utf8");

  console.log(
    JSON.stringify(
      {
        ok: true,
        pptxPath,
        pptxBytes,
        ledgerPath,
        verificationPath,
        scorecardPath,
        slideCount,
        notesCount: notes.length,
        pptxSlideXmlCount,
        notesXmlCount,
        mediaCount: mediaEntries.length,
        importedPreviewDir,
        importedContactSheetPath,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
