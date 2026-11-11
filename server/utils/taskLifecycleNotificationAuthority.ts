/** Current withdrawal authority for notices that use capture-derived material. */
import {dbAdmin as db} from '../../client/src/lib/firebaseAdmin';
import {projectWebsiteCaptureRights} from './websiteTaskContext';
import type {OutboxKind} from './captureOutbox';
import {canNotifyCurrentWebsitePreparationIssue} from './websitePreparationStatus';
import {decryptFieldValue} from './field-encryption';
const CAPTURE_DEPENDENT_NOTICES=new Set<OutboxKind>([
 'video_received','scene_ready','scene_tests_started','screening_cleared','screening_started','results_ready','run_no_result',
 'evaluation_outcome','scene_outcome','robot_access_question',
 'awaiting_evaluations','no_team_passed','no_qualified_evaluation','footage_before_account',
 'brief_confirmed','coverage_shortfall','assessment_ready','input_needed','answer_ready','video_too_large',
]);
/** Notices about evaluations a robot team asked for (`evaluationRuns`). Blueprint runs the
 * evaluations itself now, so these no longer belong on a site's journey. Their rows are still
 * written, so recovery markers clear and each team still hears about its own run; they are
 * cancelled at dispatch instead of being sent. Blueprint's own simulation (`evaluation_outcome`,
 * `scene_outcome`, `scene_tests_started`) is unaffected. */
const TEAM_RUN_EVALUATION_NOTICES=new Set<OutboxKind>([
 'results_ready','run_no_result','awaiting_evaluations','no_team_passed','no_qualified_evaluation',
]);
/**
 * The answer emails, by slot (review, 2026-11-11): per job at most one paper-check answer and at most one test
 * result. A paper-check answer is never sent after a test result; a test result may follow a paper-check answer (the
 * answer changed, and the site must hear it). Only rows that were actually sent count: a claimed row later cancelled
 * or failed never blocks the answer. The site's own withdrawal gives no answer.
 */
export type AnswerSlot = "paper" | "result";
export function answerSlotOf(kind: OutboxKind, idempotencyKey: string | undefined): AnswerSlot | null {
 const key=idempotencyKey??'';
 if(kind==='evaluation_outcome')return /:estimate-/.test(key)?'result':'paper';
 if(kind==='answer_ready'||kind==='preparation_ended')return 'paper';
 if(kind==='scene_outcome')return /:withdrawn-/.test(key)?null:'paper';
 // The "we can't simulate this kind of job yet" email and the other-kind answer share the paper slot.
 if(kind==='screening_not_now'&&key.endsWith(':brief-screening:task-not-yet-supported'))return 'paper';
 return null;
}
/** Pure: whether a row already sent fills this email's slot (or, for the paper slot, a test result was sent). */
export function answerSlotTaken(rows: Array<{kind: OutboxKind; idempotencyKey: string; status: string}>, kind: OutboxKind,
 idempotencyKey: string | undefined): boolean {
 const slot=answerSlotOf(kind,idempotencyKey);
 if(!slot)return false;
 return rows.some(row=>{
  if(row.idempotencyKey===idempotencyKey||row.status!=='sent')return false;
  const taken=answerSlotOf(row.kind,row.idempotencyKey);
  return taken===slot||(slot==='paper'&&taken==='result');
 });
}
async function answerSlotFilled(requestId:string,kind:OutboxKind,idempotencyKey:string|undefined,transaction?:FirebaseFirestore.Transaction):Promise<boolean>{
 if(!db)throw new Error('capture_notification_authority_unavailable');
 const query=db.collection('captureOutbox').where('requestId','==',requestId);
 const rows=transaction?await transaction.get(query):await query.get();
 return answerSlotTaken(rows.docs.map(row=>{const value=row.data()??{};
  return {kind:value.kind,idempotencyKey:typeof value.idempotencyKey==='string'?value.idempotencyKey:row.id,status:String(value.status)};}),kind,idempotencyKey);
}
/** The site closed its own run: no answer email. */
async function closedByOwner(requestId:string,transaction?:FirebaseFirestore.Transaction):Promise<boolean>{
 if(!db)throw new Error('capture_notification_authority_unavailable');
 const ref=db.collection('inboundRequests').doc(requestId);
 const record=(transaction?await transaction.get(ref):await ref.get()).data();
 if(!record)return false;
 const [{websiteRunClosure},{siteWalkthroughIdentity}]=await Promise.all([import('./websiteRunClosure'),import('./siteWalkthrough')]);
 try{return Boolean(websiteRunClosure(record,requestId,siteWalkthroughIdentity(requestId,record).captureId));}catch{return false;}
}
/** Call inside the dispatch transaction before recording an external side effect.
 * Intake receipts, fresh-link renewal and separate business notices keep their
 * existing authority checks; this grants no deletion/cancellation claim.
 * A missing capture source denies dispatch. A read failure stays recoverable. */
export async function taskLifecycleNotificationIsCurrent(
 entry:{kind:OutboxKind;requestId:string;preparationEventId?:string;to?:string;body?:string;idempotencyKey?:string},
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
 // The answer slots: at most one paper-check answer and one test result per job, never a paper check after a result,
 // and none once the site closed its own run.
 if(answerSlotOf(entry.kind,entry.idempotencyKey)&&(await answerSlotFilled(entry.requestId,entry.kind,entry.idempotencyKey,transaction)
  ||await closedByOwner(entry.requestId,transaction)))return false;
 // The dispatch transaction is the send: a team-run evaluation notice stops there.
 if(transaction&&TEAM_RUN_EVALUATION_NOTICES.has(entry.kind))return false;
 // Older queued ownership notices asked for an account that cannot repair
 // the recording. Keep their history, but do not dispatch that stale request.
 if(entry.kind==='footage_before_account'&&typeof entry.body==='string'
  &&/\bsave\b[^.\n]*\baccount\b/i.test(entry.body))return false;
 // Both preparation notices: current consent and recipient, and the same current event.
 if(entry.kind==='preparation_needs_attention'||entry.kind==='preparation_ended'){
  if(!/^sha256:[a-f0-9]{64}$/.test(entry.preparationEventId||''))return false;
  if(!db)throw new Error('website_preparation_recipient_unavailable');
  const ref=db.collection('inboundRequests').doc(entry.requestId);
  const snapshot=transaction?await transaction.get(ref):await ref.get();
  if(!snapshot.exists||projectWebsiteCaptureRights(snapshot.data()).consent_revoked)return false;
  let currentRecipient:string;
  try{currentRecipient=String(await decryptFieldValue(snapshot.data()?.contact?.email??'')).trim();}
  catch{throw new Error('website_preparation_recipient_unavailable');}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentRecipient)||currentRecipient!==entry.to)return false;
  return canNotifyCurrentWebsitePreparationIssue(entry.requestId,entry.preparationEventId!,transaction);
 }
 if(!CAPTURE_DEPENDENT_NOTICES.has(entry.kind))return true;
 if(!db)throw new Error('capture_notification_authority_unavailable');
 const ref=db.collection('inboundRequests').doc(entry.requestId);
 const snapshot=transaction?await transaction.get(ref):await ref.get();
 if(!snapshot.exists||projectWebsiteCaptureRights(snapshot.data()).consent_revoked)return false;
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
  return notices.answerReadyShown(entry.requestId);
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
 if(entry.kind==='awaiting_evaluations'||entry.kind==='no_team_passed'||entry.kind==='no_qualified_evaluation'){
  const notices=await import('./taskLifecycleNotifications');
  return entry.kind==='awaiting_evaluations'?notices.openAndAwaitingEvaluations(entry.requestId)
   :entry.kind==='no_team_passed'?notices.noTeamHasPassed(entry.requestId):notices.noQualifiedEvaluationYet(entry.requestId);
 }
 return true;
}
