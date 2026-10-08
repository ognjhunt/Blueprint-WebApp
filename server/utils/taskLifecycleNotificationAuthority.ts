/** Current withdrawal authority for notices that use capture-derived material. */
import {dbAdmin as db} from '../../client/src/lib/firebaseAdmin';
import {projectWebsiteCaptureRights} from './websiteTaskContext';
import type {OutboxKind} from './captureOutbox';
import {canNotifyCurrentWebsitePreparationIssue} from './websitePreparationStatus';
import {decryptFieldValue} from './field-encryption';
const CAPTURE_DEPENDENT_NOTICES=new Set<OutboxKind>([
 'video_received','scene_ready','screening_cleared','screening_started','results_ready','run_no_result',
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
 if(entry.kind==='preparation_needs_attention'){
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
 return snapshot.exists&&!projectWebsiteCaptureRights(snapshot.data()).consent_revoked;
}
