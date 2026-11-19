/** Whether a site's email about its job is still true at dispatch (`taskLifecycleNotifications.ts`). */
import {dbAdmin as db} from '../../client/src/lib/firebaseAdmin';
import {projectWebsiteCaptureRights} from './websiteCaptureRights';
import type {OutboxKind} from './captureOutbox';

/** Call inside the dispatch transaction before recording an external side effect.
 * The job's link (`task_received`) goes while the job is on record and not withdrawn; the company emails go only while
 * the job is visible to companies and what they say still stands. A read failure stays recoverable. */
export async function taskLifecycleNotificationIsCurrent(
 entry:{kind:OutboxKind;requestId:string;idempotencyKey?:string},
 transaction?:FirebaseFirestore.Transaction,
):Promise<boolean>{
 // "Meet {company}" (PACKAGE_E E6; planner 20:35Z, H2): one commit point. It may go only once the company's email is
 // definitely sent, and from then on it goes whatever has changed since (a withdrawal, a hold, a suspension, a stale
 // acceptance): the company holds the site's details and the site must be told who has them. Before that point the one
 // predicate decides (`siteIntroductionEmailState`). Checked first, so no later rule of this function can stop it.
 if(entry.kind==='introduction_made_site'){
  const prefix=`${entry.requestId}:introduction_made_site:`;
  if(!entry.idempotencyKey?.startsWith(prefix))return false;
  const {siteIntroductionEmailState}=await import('./jobIntroductionGate');
  return (await siteIntroductionEmailState(entry.requestId,entry.idempotencyKey.slice(prefix.length),transaction)).state==='go';
 }
 if(entry.kind!=='task_received'&&entry.kind!=='job_sent'&&entry.kind!=='company_answered')return true;
 if(!db)throw new Error('capture_notification_authority_unavailable');
 const ref=db.collection('inboundRequests').doc(entry.requestId);
 const snapshot=transaction?await transaction.get(ref):await ref.get();
 // The job is on record and not withdrawn: after a withdrawal nothing more is sent about it.
 if(!snapshot.exists||projectWebsiteCaptureRights(snapshot.data()).consent_revoked)return false;
 if(entry.kind==='task_received')return true;
 // A company was sent the job, or answered it (package C1): sent only while the job is visible to companies by the whole
 // sharing rule (an operator hold, a rights hold, the site closing its job or an authority end each stop these emails),
 // and while what the email says still stands (the send not voided, the answer unchanged).
 const {loadCompanyJobAccess}=await import('./teamJobAccess');
 if(!(await loadCompanyJobAccess(entry.requestId,snapshot.data()??null,transaction)).access.listed)return false;
 if(entry.idempotencyKey===undefined)return true;
 const {companyNoticeStillTrue}=await import('./jobCompanies');
 return companyNoticeStillTrue(entry.requestId,entry.kind,entry.idempotencyKey,snapshot.data()??{},transaction);
}
