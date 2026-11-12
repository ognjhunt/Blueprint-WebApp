/**
 * A deployment company sees a job only after it has accepted the CURRENT Terms and Privacy Policy (planner, 18:50Z).
 * The Terms tell a site that a company "may use your job only to decide whether it can do it. It may not pass it on,
 * use it to train software, or keep it after we ask it to delete it": that is true only of a company that agreed.
 *
 * The mechanism is the account acceptance the workspace already uses (`client/src/lib/legalAcceptance.ts`): a
 * `termsAcceptance` record built by `buildLegalAcceptanceRecord` and checked by `isCurrentLegalAcceptance`. It is kept on
 * the company's account (`users/{uid}`, with `acceptedTerms`, `termsVersion`, `privacyVersion`) and on its approved
 * access record (`robotTeamAccess/{companyId}.termsAcceptance`), which every company-facing check reads, including the
 * ones that run at dispatch with no signed-in viewer. The two are kept in step on each signed-in visit.
 *
 * ONE predicate decides who may see jobs: `companyMaySeeJobs(record)` = approved, a deployment company (never a
 * technology partner), and a current acceptance. The viewer gate (`resolveViewerAccess`: library, job page, answer
 * route), every media request and introduction (`companyStillApproved`), the answer route's transaction, the automatic
 * send, and the dispatch gates of the new-job email and both introduction emails (`introductionMayProceed`) call it.
 * An outcome question to a company is NOT gated on Terms: it goes while the company is still an approved deployment
 * company (`isApprovedDeploymentCompanyRecord`, in `jobOutcomeGate.ts`), since it asks about an introduction already made.
 */
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { buildLegalAcceptanceRecord, isCurrentLegalAcceptance } from "../../client/src/lib/legalAcceptance";

export const TERMS_ACCEPTANCE_REQUIRED = "terms_acceptance_required";

type AccessLike = { status?: unknown; partnerRole?: unknown; termsAcceptance?: unknown; termsAcceptedByUid?: unknown } | null | undefined;

/** The record holds an acceptance of the current Terms AND the current Privacy Policy. */
export function recordHasCurrentTerms(record: { termsAcceptance?: unknown } | null | undefined): boolean {
  return isCurrentLegalAcceptance(record?.termsAcceptance);
}

/**
 * Approved, a deployment company, and the current Terms accepted AS A SIGNED-IN ACT of its own: the acceptance carries
 * the accepting user's id (`termsAcceptedByUid`), written only by the signed-in accept route or copied by
 * `syncCompanyTerms` from that same person's signed-in account acceptance. The tick on the unsigned application form
 * (`applicationTermsAcceptance`) never satisfies it (planner, 19:50Z, G1).
 */
export function companyMaySeeJobs(record: AccessLike): boolean {
  return record?.status === "approved" && record.partnerRole !== "technology" && recordHasCurrentTerms(record)
    && typeof (record as { termsAcceptedByUid?: unknown }).termsAcceptedByUid === "string"
    && Boolean((record as { termsAcceptedByUid?: string }).termsAcceptedByUid);
}

/** Approved and a deployment company, whatever its Terms state: who an outcome question may still go to (G4). */
export function isApprovedDeploymentCompanyRecord(record: AccessLike): boolean {
  return record?.status === "approved" && record.partnerRole !== "technology";
}

/** What the application form showed and the applicant ticked, with the time: stored on the application only. */
export function applicationTermsAcceptance(nowIso = new Date().toISOString()) {
  return buildLegalAcceptanceRecord({ acceptedAt: nowIso });
}

/**
 * Record a signed-in company's acceptance of the current versions on its account and on its access record, in one
 * transaction. Only for an approved deployment company with a verified email.
 */
export async function recordCompanyTermsAcceptance(viewer: { uid: string; email: string }, companyId: string): Promise<boolean> {
  if (!db) throw new Error("company_terms_store_unavailable");
  const store = db;
  const accessRef = store.collection("robotTeamAccess").doc(companyId);
  const userRef = store.collection("users").doc(viewer.uid);
  return store.runTransaction(async tx => {
    const record = (await tx.get(accessRef)).data();
    if (!record || record.status !== "approved" || record.partnerRole === "technology"
      || String(record.email ?? "").trim().toLowerCase() !== viewer.email.trim().toLowerCase()) return false;
    const atIso = new Date().toISOString();
    const acceptance = buildLegalAcceptanceRecord({ acceptedAt: atIso });
    tx.set(accessRef, { termsAcceptance: acceptance, termsAcceptedByUid: viewer.uid }, { merge: true });
    tx.set(userRef, { acceptedTerms: true, termsVersion: acceptance.terms_version, privacyVersion: acceptance.privacy_version,
      termsAcceptance: { ...acceptance, accepted_at: admin.firestore.FieldValue.serverTimestamp() },
      termsAcceptanceSource: { kind: "deployment_company", companyId } }, { merge: true });
    return true;
  });
}

/**
 * Keep the account and the access record in step on a signed-in visit, only between the same person's own signed-in
 * acts: a current acceptance on this account is copied to the access record (with this user's id), and one the
 * record holds from this same user is copied to the account. Best effort.
 */
export async function syncCompanyTerms(viewer: { uid: string }, companyId: string,
  record: { termsAcceptance?: unknown } | null): Promise<{ termsAcceptance?: unknown } | null> {
  if (!db || !record) return record;
  const userRef = db.collection("users").doc(viewer.uid);
  const user = (await userRef.get()).data();
  const onRecord = recordHasCurrentTerms(record);
  // An account acceptance carried over from a site's unsigned intake form is not a signed-in act of this company's.
  const onAccount = isCurrentLegalAcceptance(user?.termsAcceptance) && user?.termsAcceptanceSource?.kind !== "site_capture_intake";
  if (onRecord && !onAccount && (record as { termsAcceptedByUid?: unknown }).termsAcceptedByUid === viewer.uid) {
    const acceptance = record.termsAcceptance as ReturnType<typeof buildLegalAcceptanceRecord>;
    await userRef.set({ acceptedTerms: true, termsVersion: acceptance.terms_version, privacyVersion: acceptance.privacy_version,
      termsAcceptance: acceptance, termsAcceptanceSource: { kind: "deployment_company", companyId } }, { merge: true });
  } else if (!onRecord && onAccount) {
    await db.collection("robotTeamAccess").doc(companyId).set({ termsAcceptance: user!.termsAcceptance, termsAcceptedByUid: viewer.uid }, { merge: true });
    return { ...record, termsAcceptance: user!.termsAcceptance, termsAcceptedByUid: viewer.uid } as typeof record;
  }
  return record;
}
