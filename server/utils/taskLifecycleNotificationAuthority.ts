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
 'brief_confirmed','coverage_shortfall','assessment_ready','input_needed','answer_ready',
]);
/** Notices about evaluations a robot team asked for (`evaluationRuns`). Blueprint runs the
 * evaluations itself now, so these no longer belong on a site's journey. Their rows are still
 * written, so recovery markers clear and each team still hears about its own run; they are
 * cancelled at dispatch instead of being sent. Blueprint's own simulation (`evaluation_outcome`,
 * `scene_outcome`, `scene_tests_started`) is unaffected. */
const TEAM_RUN_EVALUATION_NOTICES=new Set<OutboxKind>([
 'results_ready','run_no_result','awaiting_evaluations','no_team_passed','no_qualified_evaluation',
]);
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
