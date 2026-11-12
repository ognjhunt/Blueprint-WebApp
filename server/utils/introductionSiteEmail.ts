/**
 * The site's "Meet {company}" email (PACKAGE_E E6), as the company side's `requestIntroduction` asks for it (SEAMS,
 * 2026-11-12). The words live with the site's other emails (`introductionMadeSiteCopy`); this is its call shape.
 */
import { introductionMadeSiteCopy } from "./taskLifecycleNotifications";

export function introductionMadeSiteEmail(input: { jobUrl: string;
  company: { name: string; contactName: string; email: string; website: string | null };
  /** The company's stored answer as its fixed label ("Interested", "Tested it: can do"). Without it no answer is claimed. */
  answerLabel?: string | null }): { subject: string; body: string } {
  return introductionMadeSiteCopy(input.company, input.jobUrl, input.answerLabel);
}
