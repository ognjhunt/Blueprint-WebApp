/** Current withdrawal authority for notices that use capture-derived material. */
import {dbAdmin as db} from '../../client/src/lib/firebaseAdmin';
import {projectWebsiteCaptureRights} from './websiteTaskContext';
import type {OutboxKind} from './captureOutbox';
import {canNotifyCurrentWebsitePreparationIssue,resumedNoticeAsk} from './websitePreparationStatus';
import {decryptFieldValue} from './field-encryption';
import {siteWalkthroughIdentity} from './siteWalkthrough';
import {websiteRunClosure} from './websiteRunClosure';
import {OUTBOX_WENT_OUT} from './outboxWentOut';
const CAPTURE_DEPENDENT_NOTICES=new Set<OutboxKind>([
 'video_received','scene_ready','scene_tests_started','screening_cleared','screening_started',
 'evaluation_outcome','scene_outcome','robot_access_question','footage_before_account',
 'brief_confirmed','coverage_shortfall','assessment_ready','input_needed','answer_ready','video_too_large',
 'listing_live','job_sent','company_answered','introduction_made_site',
]);
/**
 * The answer emails, by slot (review, 2026-11-11): per job at most one paper-check answer and at most one test
 * result. A paper-check answer is never sent after a test result; a test result may follow a paper-check answer. A
 * slot is filled by a row that went out or may have (`OUTBOX_WENT_OUT`: dispatching, unknown, sent). The check runs
 * in the dispatch transaction that marks the row `dispatching`, so two dispatchers cannot both claim one slot. The
 * site's own endings (withdrawal, a run it closed) give no answer.
 */
export type AnswerSlot = "paper" | "result";
export function answerSlotOf(kind: OutboxKind, idempotencyKey: string | undefined, stored?: unknown): AnswerSlot | null {
 const key=idempotencyKey??'';
 if(kind==='evaluation_outcome'){
  // A finished test that scored no AI robot is an ending, so its email is a paper answer, as stored on its row.
  if(stored==='paper')return 'paper';
  return /:estimate-/.test(key)?'result':'paper';
 }
 if(kind==='answer_ready'||kind==='preparation_ended')return 'paper';
 if(kind==='scene_outcome')return /:withdrawn-/.test(key)?null:'paper';
 // The start form's "we can't simulate this kind of job yet" email is a notice, not an answer: it sits outside both
 // slots and blocks nothing (review, 2026-11-11). Its one effect is that a kept-on-file answer for the same reason is
 // not sent again (`keptOnFileAlreadyTold`).
 return null;
}
type SlotRow={kind: OutboxKind; idempotencyKey: string; status: string; answerSlot?: unknown};
/** Pure: whether a row that went out (or may have) fills this email's slot (or, for the paper slot, a test result did). */
export function answerSlotTaken(rows: SlotRow[], kind: OutboxKind, idempotencyKey: string | undefined, stored?: unknown): boolean {
 const slot=answerSlotOf(kind,idempotencyKey,stored);
 if(!slot)return false;
 return rows.some(row=>{
  if(row.idempotencyKey===idempotencyKey||!OUTBOX_WENT_OUT.has(row.status))return false;
  const taken=answerSlotOf(row.kind,row.idempotencyKey,row.answerSlot);
  return taken===slot||(slot==='paper'&&taken==='result');
 });
}
async function answerSlotFilled(requestId:string,kind:OutboxKind,idempotencyKey:string|undefined,stored:unknown,
 transaction?:FirebaseFirestore.Transaction):Promise<boolean>{
 if(!db)throw new Error('capture_notification_authority_unavailable');
 const query=db.collection('captureOutbox').where('requestId','==',requestId);
 const rows=transaction?await transaction.get(query):await query.get();
 return answerSlotTaken(rows.docs.map(row=>{const value=row.data()??{};
  return {kind:value.kind,idempotencyKey:typeof value.idempotencyKey==='string'?value.idempotencyKey:row.id,status:String(value.status),
   answerSlot:value.answerSlot};}),kind,idempotencyKey,stored);
}
/**
 * The site ended the job itself (withdrew recording permission, or closed its run): no answer email. A closure record
 * that does not read is unknown, so this throws and the row stays queued for a later pass; it is never cancelled on it.
 */
async function endedBySite(requestId:string,transaction?:FirebaseFirestore.Transaction):Promise<boolean>{
 if(!db)throw new Error('capture_notification_authority_unavailable');
 const ref=db.collection('inboundRequests').doc(requestId);
 const record=(transaction?await transaction.get(ref):await ref.get()).data();
 if(!record)return false;
 if(projectWebsiteCaptureRights(record).consent_revoked)return true;
 const [{websiteRunClosure},{siteWalkthroughIdentity}]=await Promise.all([import('./websiteRunClosure'),import('./siteWalkthrough')]);
 return Boolean(websiteRunClosure(record,requestId,siteWalkthroughIdentity(requestId,record).captureId));
}
/**
 * The start form's "we can't simulate this kind of job yet" notice went out (or may have): a kept-on-file answer for
 * the same job, given for the same reason, would repeat it, so it is skipped. Never any other answer.
 */
export async function keptOnFileAlreadyTold(requestId:string,transaction?:FirebaseFirestore.Transaction):Promise<boolean>{
 if(!db)throw new Error('capture_notification_authority_unavailable');
 const ref=db.collection('captureOutbox').doc(`${requestId}:brief-screening:task-not-yet-supported`);
 const row=(transaction?await transaction.get(ref):await ref.get()).data();
 return Boolean(row&&OUTBOX_WENT_OUT.has(String(row.status)));
}
/** Call inside the dispatch transaction before recording an external side effect.
 * Intake receipts, fresh-link renewal and separate business notices keep their
 * existing authority checks; this grants no deletion/cancellation claim.
 * A missing capture source denies dispatch. A read failure stays recoverable. */
export async function taskLifecycleNotificationIsCurrent(
 entry:{kind:OutboxKind;requestId:string;preparationEventId?:string;to?:string;body?:string;idempotencyKey?:string;answerSlot?:unknown},
 transaction?:FirebaseFirestore.Transaction,
):Promise<boolean>{
 // Coverage repair and candidate starts are internal work. Suppress old
 // queued notices without deleting findings or changing execution authority.
 if(entry.kind==='coverage_shortfall'||entry.kind==='screening_started'
  ||entry.kind==='screening_cleared'||entry.kind==='assessment_ready')return false;
 // Ended by the owner 2026-11-11: the team-request email and the four-conditions
 // screen's emails. Rows already queued are cancelled here, not sent. The
 // "can't simulate this kind of job yet" email shares the `screening_not_now`
 // kind and is kept, by its own fixed key.
 if(entry.kind==='pilot_request'||entry.kind==='brief_confirmed'||entry.kind==='input_needed')return false;
 if(entry.kind==='screening_not_now'
  &&entry.idempotencyKey!==`${entry.requestId}:brief-screening:task-not-yet-supported`)return false;
 // That kept notice is still the site's to hear only while the job is the site's: not after it withdrew or closed it.
 if(entry.kind==='screening_not_now'&&entry.idempotencyKey!==undefined&&await endedBySite(entry.requestId,transaction))return false;
 // The answer slots: at most one paper-check answer and one test result per job, never a paper check after a result,
 // and none once the site closed its own run.
 // Checked once the row exists (its key names the email); queueing without a key is decided at dispatch.
 if(entry.idempotencyKey!==undefined&&answerSlotOf(entry.kind,entry.idempotencyKey,entry.answerSlot)&&(await endedBySite(entry.requestId,transaction)
  ||await answerSlotFilled(entry.requestId,entry.kind,entry.idempotencyKey,entry.answerSlot,transaction)))return false;
 // Older queued ownership notices asked for an account that cannot repair
 // the recording. Keep their history, but do not dispatch that stale request.
 if(entry.kind==='footage_before_account'&&typeof entry.body==='string'
  &&/\bsave\b[^.\n]*\baccount\b/i.test(entry.body))return false;
 // Both preparation notices: current consent and recipient, and the same current event.
 if(entry.kind==='preparation_needs_attention'||entry.kind==='preparation_ended'||entry.kind==='preparation_resumed'){
  if(!/^sha256:[a-f0-9]{64}$/.test(entry.preparationEventId||''))return false;
  if(!db)throw new Error('website_preparation_recipient_unavailable');
  const ref=db.collection('inboundRequests').doc(entry.requestId);
  const snapshot=transaction?await transaction.get(ref):await ref.get();
  if(!snapshot.exists||projectWebsiteCaptureRights(snapshot.data()).consent_revoked)return false;
  let currentRecipient:string;
  try{currentRecipient=String(await decryptFieldValue(snapshot.data()?.contact?.email??'')).trim();}
  catch{throw new Error('website_preparation_recipient_unavailable');}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentRecipient)||currentRecipient!==entry.to)return false;
  // "No new video is needed" only while the walkthrough that was asked about is still the job's video, and the site
  // has not closed the job's run (review, 2026-11-12).
  // It follows the ask for the capture that owes it: still the job's current video (the outlook's own identity),
  // the run not closed, and the ask's own email went out (`OUTBOX_WENT_OUT`). An ask queued and never sent is
  // dropped with the hand-off, and nothing follows it.
  if(entry.kind==='preparation_resumed'){
   const record=snapshot.data();
   const ask=await resumedNoticeAsk(entry.requestId,entry.preparationEventId!,transaction);
   if(!ask||siteWalkthroughIdentity(entry.requestId,record).captureId!==ask.captureId)return false;
   try{if(websiteRunClosure(record,entry.requestId,ask.captureId))return false;}catch{return false;}
   const askRef=db.collection('captureOutbox').doc(`${entry.requestId}:preparation_needs_attention:${ask.askEventId.replace(/[^A-Za-z0-9._-]/g,'_').slice(0,120)}`);
   const asked=(transaction?await transaction.get(askRef):await askRef.get()).data();
   if(!asked||!OUTBOX_WENT_OUT.has(String(asked.status)))return false;
  }
  return canNotifyCurrentWebsitePreparationIssue(entry.requestId,entry.preparationEventId!,transaction);
 }
 if(!CAPTURE_DEPENDENT_NOTICES.has(entry.kind))return true;
 if(!db)throw new Error('capture_notification_authority_unavailable');
 const ref=db.collection('inboundRequests').doc(entry.requestId);
 const snapshot=transaction?await transaction.get(ref):await ref.get();
 if(!snapshot.exists||projectWebsiteCaptureRights(snapshot.data()).consent_revoked)return false;
 // "Deployment companies we approve can now see a summary of your job": sent only while that is true, by the one
 // predicate that decides what a company can see (paused or closed by the site, held by Blueprint, or under a rights hold, it is not).
 if(entry.kind==='listing_live'){
  // The whole rule a company's own reads use (review M1): the job sentence and an authority end included.
  const {loadCompanyJobAccess}=await import('./teamJobAccess');
  return (await loadCompanyJobAccess(entry.requestId,snapshot.data()??null,transaction)).access.listed;
 }
 // A company was sent the job, or answered it (package C1): sent only while the summary is visible to companies by the
 // same predicate, and while what the email says still stands (the send not voided, the answer unchanged).
 if(entry.kind==='job_sent'||entry.kind==='company_answered'||entry.kind==='introduction_made_site'){
  // The whole sharing rule, with the facts outside the record (the brief, the preparation state): an operator hold, a rights
  // hold, the site closing its job or an authority end each stop these emails.
  const {loadCompanyJobAccess}=await import('./teamJobAccess');
  if(!(await loadCompanyJobAccess(entry.requestId,snapshot.data()??null,transaction)).access.listed)return false;
  if(entry.idempotencyKey===undefined)return entry.kind!=='introduction_made_site';
  // "Meet {company}" (PACKAGE_E E6): only while the introduction is on record.
  if(entry.kind==='introduction_made_site'){
   const prefix=`${entry.requestId}:introduction_made_site:`;
   if(!entry.idempotencyKey.startsWith(prefix))return false;
   const companyId=entry.idempotencyKey.slice(prefix.length);
   const introRef=ref.collection('introductions').doc(companyId);
   if(!(transaction?await transaction.get(introRef):await introRef.get()).exists)return false;
   // The company must still be an approved deployment company (review must-fix 2): never after a suspension.
   const {isApprovedDeploymentCompany}=await import('./jobCompanies');
   const {ROBOT_TEAM_ACCESS_COLLECTION}=await import('./robotTeamEarlyAccess');
   const companyRef=db.collection(ROBOT_TEAM_ACCESS_COLLECTION).doc(companyId);
   const company=(transaction?await transaction.get(companyRef):await companyRef.get()).data();
   return isApprovedDeploymentCompany(company as never);
  }
  const {companyNoticeStillTrue}=await import('./jobCompanies');
  return companyNoticeStillTrue(entry.requestId,entry.kind,entry.idempotencyKey,snapshot.data()??{},transaction);
 }
 // A waiting notice is sent only while what it says is still true.
 if(entry.kind==='footage_before_account'){
  const notices=await import('./taskLifecycleNotifications');
  return notices.footageBeforeAccountShown(entry.requestId);
 }
 // The new-video ask for a video too large to process names its capture and video in its key,
 // and is sent only while the job page still asks exactly that.
 if(entry.kind==='video_too_large'){
  if(entry.idempotencyKey===undefined)return false;
  const sweep=await import('./websiteJobWindowSweep');
  return sweep.largeVideoAskShown(entry.requestId,entry.idempotencyKey,snapshot.data());
 }
 if(entry.kind==='scene_tests_started'){
  const notices=await import('./taskLifecycleNotifications');
  return notices.sceneTestsStarted(entry.requestId);
 }
 // The answer email is sent only while the job's answer is still a settled one.
 if(entry.kind==='answer_ready'){
  const notices=await import('./taskLifecycleNotifications');
  return notices.answerReadyShown(entry.requestId,entry.idempotencyKey);
 }
 // A finished evaluation's outcome (F-01) is queued once its run ends, after
 // the consent check above. A queued notice names its outcome in its key and is
 // sent only while the job page still states it, so an estimate that has since
 // won cancels a held notice instead of leaving it pending.
 if(entry.kind==='evaluation_outcome'){
  if(entry.idempotencyKey===undefined)return true;
  const notices=await import('./screeningOutcomeNotifications');
  return notices.evaluationOutcomeShown(entry.requestId,entry.idempotencyKey);
 }
 // A terminal scene outcome (C-04) names its outcome digest in its key, and is
 // sent only while the job page still states that exact outcome and no
 // evaluation outcome email (F-01) has told the site where its job stands.
 if(entry.kind==='scene_outcome'){
  if(entry.idempotencyKey===undefined)return true;
  // The WebApp's own window ending is a job outcome too, under its own fixed key: sent only
  // while the job page still states that ending and no other outcome email has gone out.
  const ending=await import('./websiteJobWindowSweep');
  if(ending.isWebsiteJobWindowEndedNotice(entry.requestId,entry.idempotencyKey))
   return ending.websiteJobWindowEndingShown(entry.requestId,entry.idempotencyKey);
  // A job that never received a grant ends the same way, under its own fixed key.
  if(ending.isWebsiteJobNoGrantEndedNotice(entry.requestId,entry.idempotencyKey))
   return ending.websiteJobNoGrantEndingShown(entry.requestId,entry.idempotencyKey);
  const notices=await import('./sceneOutcomeNotifications');
  return notices.sceneOutcomeShown(entry.requestId,entry.idempotencyKey);
 }
 // The owner's question about moving chairs in the simulation names its
 // proposal digest in its key, and is sent only while the job page still asks
 // exactly that question, unanswered, and the capture is not withdrawn.
 if(entry.kind==='robot_access_question'){
  if(entry.idempotencyKey===undefined)return true;
  const questions=await import('./websiteRobotAccessRemoval');
  return questions.robotAccessQuestionOpen(entry.requestId,entry.idempotencyKey,snapshot.data());
 }
 return true;
}
