/** Current withdrawal authority for notices that use capture-derived material. */
import {dbAdmin as db} from '../../client/src/lib/firebaseAdmin';
import {projectWebsiteCaptureRights} from './websiteTaskContext';
import type {OutboxKind} from './captureOutbox';
import {canNotifyCurrentWebsitePreparationIssue} from './websitePreparationStatus';
import {decryptFieldValue} from './field-encryption';
const CAPTURE_DEPENDENT_NOTICES=new Set<OutboxKind>([
 'video_received','scene_ready','scene_tests_started','screening_cleared','screening_started','results_ready','run_no_result',
 'awaiting_evaluations','no_team_passed','no_qualified_evaluation','footage_before_account',
 'brief_confirmed','coverage_shortfall','assessment_ready','input_needed',
]);
/** Call inside the dispatch transaction before recording an external side effect.
 * Intake receipts, fresh-link renewal and separate business notices keep their
 * existing authority checks; this grants no deletion/cancellation claim.
 * A missing capture source denies dispatch. A read failure stays recoverable. */
export async function taskLifecycleNotificationIsCurrent(
 entry:{kind:OutboxKind;requestId:string;preparationEventId?:string;to?:string},
 transaction?:FirebaseFirestore.Transaction,
):Promise<boolean>{
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
 if(entry.kind==='awaiting_evaluations'||entry.kind==='no_team_passed'||entry.kind==='no_qualified_evaluation'){
  const notices=await import('./taskLifecycleNotifications');
  return entry.kind==='awaiting_evaluations'?notices.openAndAwaitingEvaluations(entry.requestId)
   :entry.kind==='no_team_passed'?notices.noTeamHasPassed(entry.requestId):notices.noQualifiedEvaluationYet(entry.requestId);
 }
 return true;
}
