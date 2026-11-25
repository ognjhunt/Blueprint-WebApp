/**
 * The job summary (owner, 2026-11-25: "isnt the whole job packet available to download?"): a one-to-two page PDF of what
 * a company's job page shows in words, for the company to forward inside its own team. Served by
 * `GET /api/site-worlds/jobs/:jobId/summary.pdf` (`server/routes/site-worlds.ts`) under every check the page has.
 *
 * It is written from the page's own payload (`loadCompanyJobPage`) and nothing else, so it carries exactly the words the
 * page shows, already screened for the site's identity, in the page's own words (`client/src/lib/companyJobPage.ts`):
 * the title, the country and the day it was shared, the line about the site's identity, where the video and the
 * simulation stand with a link back to the page, the site's words and what counts as done when the site said it, At a
 * glance, the facts about the object, and what a visit must confirm. No first look: it stays on the site's own pages, as
 * on the company's page (owner, 2026-11-25), and no line asks the company what it tested. Never the video, a frame or
 * the thumbnail (the site keeps custody of its video: it is played on the page only), never a media ticket, the
 * company's own answer or anyone's contact details, and no price.
 */
import { jobTitleForDisplay, type CompanyJobPage } from "../../client/src/types/taskBrowse";
import { JOB_PAGE_HEADINGS, JOB_SUMMARY_FOOTER, NOTHING_TESTED_AT_SITE, NOT_STATED, NOT_STATED_YET,
  PACKET_FACTS_PENDING, SIMULATION_DOWNLOAD_HINT, SIMULATION_NOT_FINISHED, SIMULATION_WITHOUT_OBJECT, SITE_ANSWERS_HINT,
  SITE_DESCRIPTION_CANT_BE_SHOWN, SITE_IDENTITY_RULE, VIDEO_PREPARING, fitRowMarks, fitRowValue, fitRowsShown,
  sharedOnInWords } from "../../client/src/lib/companyJobPage";
import { SUCCESS_RULE_CANT_BE_SHOWN } from "../../client/src/lib/companiesRead";
import { pdfCanShow, renderPdf, type PdfBlock } from "./simplePdf";

/** The heading over where the video and the simulation stand, which the page shows at its top as buttons. */
export const JOB_SUMMARY_MEDIA_HEADING = "The video and the simulation";
/** What of the packet is on the job's page rather than in this file. */
export const JOB_SUMMARY_ON_PAGE = {
  both: "The site's video, without sound, and the simulation of the site are on the job's page.",
  video: "The site's video, without sound, is on the job's page.",
  simulation: "The simulation of the site is on the job's page.",
} as const;
export const JOB_SUMMARY_PAGE_OPENS_FOR = "The page opens for a signed-in, approved deployment company:";
/** Said in place of a text the PDF's fonts cannot draw (`pdfCanShow`): the text is never shown with a gap. */
export const JOB_SUMMARY_TEXT_ON_PAGE = "This text uses characters this summary cannot show. Read it on the job's page.";

/** A text as the PDF can draw it, else the line pointing to the page. */
const shown = (text: string) => pdfCanShow(text) ? text : JOB_SUMMARY_TEXT_ON_PAGE;

/** The summary's blocks, top to bottom, in the page's order. */
export function companyJobSummaryBlocks(page: CompanyJobPage, jobUrl: string): PdfBlock[] {
  const blocks: PdfBlock[] = [];
  const paragraph = (text: string, tone?: "hint" | "quote") => blocks.push({ kind: "paragraph", text: shown(text), ...(tone ? { tone } : {}) });

  // The title and its line: the country, how often and how long, and the day it was shared.
  blocks.push({ kind: "title", text: shown(page.headline || jobTitleForDisplay(page.title)) });
  const meta = [page.country, ...page.headlineFacts, sharedOnInWords(page.publishedAtIso)].filter((part): part is string => Boolean(part));
  if (meta.length) blocks.push({ kind: "meta", text: shown(meta.join(" · ")) });
  // About the site: its identity comes only with an introduction it asks for, always said.
  for (const line of page.aboutSite.includes(SITE_IDENTITY_RULE) ? page.aboutSite : [SITE_IDENTITY_RULE, ...page.aboutSite]) paragraph(line);

  // Where the video and the simulation stand, as the page's buttons and the line under them say, and the way back.
  blocks.push({ kind: "heading", text: JOB_SUMMARY_MEDIA_HEADING });
  const video = page.video.state === "ready";
  const download = page.simulationDownload?.state === "ready" ? page.simulationDownload : null;
  const simulation = page.simulation.state === "ready" || Boolean(download);
  if (video || simulation) paragraph(video && simulation ? JOB_SUMMARY_ON_PAGE.both : video ? JOB_SUMMARY_ON_PAGE.video : JOB_SUMMARY_ON_PAGE.simulation);
  if (!video) paragraph(VIDEO_PREPARING);
  if (!simulation) paragraph(page.simulationStatus ?? SIMULATION_NOT_FINISHED);
  if (download) paragraph(SIMULATION_DOWNLOAD_HINT, "hint");
  if (download?.objectIncluded === false) paragraph(SIMULATION_WITHOUT_OBJECT, "hint");
  paragraph(JOB_SUMMARY_PAGE_OPENS_FOR);
  blocks.push({ kind: "link", text: jobUrl, url: jobUrl });

  // The site's own words.
  blocks.push({ kind: "heading", text: JOB_PAGE_HEADINGS.job });
  paragraph(page.sentence || SITE_DESCRIPTION_CANT_BE_SHOWN, page.sentence ? "quote" : undefined);
  // What counts as done, only when the site said it, or while its rule is being prepared, as the page shows it.
  if (page.successRule || page.successRulePending) {
    blocks.push({ kind: "subheading", text: JOB_PAGE_HEADINGS.done });
    paragraph(page.successRule || SUCCESS_RULE_CANT_BE_SHOWN);
  }

  // At a glance: each answer and "Not sure" as a row with its marks, the skipped questions on one line.
  blocks.push({ kind: "heading", text: JOB_PAGE_HEADINGS.glance });
  if (!page.fitSummary.length) paragraph(`${NOT_STATED}.`);
  const { shown: rows, skipped } = fitRowsShown(page.fitSummary);
  if (rows.length) blocks.push({ kind: "rows", rows: rows.map(row => ({ label: shown(row.label),
    value: `${shown(fitRowValue(row))}${fitRowMarks(row).join("")}` })) });
  if (skipped.length) paragraph(`${NOT_STATED_YET} ${skipped.map(row => row.label).join(" · ")}`);
  if (page.fitSummary.some(row => row.state === "stated" || row.state === "unsure")) paragraph(SITE_ANSWERS_HINT, "hint");

  // The facts about the object, once there are some (or while they are being checked).
  if (page.packetFacts || page.packetFactsPending) {
    blocks.push({ kind: "heading", text: JOB_PAGE_HEADINGS.object });
    if (page.packetFacts) {
      if (page.packetFacts.object.length) blocks.push({ kind: "bullets", items: page.packetFacts.object.map(shown) });
      for (const section of ["measured", "estimated"] as const) {
        if (!page.packetFacts[section].length) continue;
        blocks.push({ kind: "subheading", text: JOB_PAGE_HEADINGS[section] });
        blocks.push({ kind: "bullets", items: page.packetFacts[section].map(shown) });
      }
    } else paragraph(PACKET_FACTS_PENDING);
  }

  // What a first visit must still confirm, and that nothing here was tested at the site.
  blocks.push({ kind: "heading", text: JOB_PAGE_HEADINGS.visit });
  blocks.push({ kind: "bullets", items: page.visitMustConfirm.map(shown) });
  paragraph(NOTHING_TESTED_AT_SITE, "hint");
  return blocks;
}

/** The job summary as PDF bytes, with the page's address for the video and the simulation. */
export function companyJobSummaryPdf(page: CompanyJobPage, jobUrl: string): Buffer {
  const title = page.headline || jobTitleForDisplay(page.title);
  return renderPdf({ title: pdfCanShow(title) ? `Job summary: ${title}` : "Job summary", footer: JOB_SUMMARY_FOOTER,
    blocks: companyJobSummaryBlocks(page, jobUrl) });
}
