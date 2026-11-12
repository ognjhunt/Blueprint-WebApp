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
 * send, and the three dispatch gates (new-job email, introduction email to the company, outcome question) all call it.
 */
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { buildLegalAcceptanceRecord, isCurrentLegalAcceptance } from "../../client/src/lib/legalAcceptance";

export const TERMS_ACCEPTANCE_REQUIRED = "terms_acceptance_required";

type AccessLike = { status?: unknown; partnerRole?: unknown; termsAcceptance?: unknown } | null | undefined;

/** The record holds an acceptance of the current Terms AND the current Privacy Policy. */
export function recordHasCurrentTerms(record: { termsAcceptance?: unknown } | null | undefined): boolean {
  return isCurrentLegalAcceptance(record?.termsAcceptance);
}

/** Approved, a deployment company, and the current Terms accepted. */
export function companyMaySeeJobs(record: AccessLike): boolean {
  return record?.status === "approved" && record.partnerRole !== "technology" && recordHasCurrentTerms(record);
}

/** The acceptance an applicant gives on the application form, recorded with its time (ISO, so it survives a merge). */
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
 * Keep the account and the access record in step on a signed-in visit: an acceptance the applicant gave on the
 * application (or one recorded on the account) is carried to the other, so a company accepts once. Best effort.
 */
export async function syncCompanyTerms(viewer: { uid: string }, companyId: string,
  record: { termsAcceptance?: unknown } | null): Promise<{ termsAcceptance?: unknown } | null> {
  if (!db || !record) return record;
  const userRef = db.collection("users").doc(viewer.uid);
  const user = (await userRef.get()).data();
  const onRecord = recordHasCurrentTerms(record);
  const onAccount = isCurrentLegalAcceptance(user?.termsAcceptance);
  if (onRecord && !onAccount) {
    const acceptance = record.termsAcceptance as ReturnType<typeof buildLegalAcceptanceRecord>;
    await userRef.set({ acceptedTerms: true, termsVersion: acceptance.terms_version, privacyVersion: acceptance.privacy_version,
      termsAcceptance: acceptance, termsAcceptanceSource: { kind: "deployment_company_application", companyId } }, { merge: true });
  } else if (!onRecord && onAccount) {
    await db.collection("robotTeamAccess").doc(companyId).set({ termsAcceptance: user!.termsAcceptance, termsAcceptedByUid: viewer.uid }, { merge: true });
    return { ...record, termsAcceptance: user!.termsAcceptance };
  }
  return record;
}
