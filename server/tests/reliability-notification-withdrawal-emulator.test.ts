// @vitest-environment node
/** Real transactions in the isolated B emulator; fake email transport, no schedulers. */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
const enabled = process.env.BLUEPRINT_WITHDRAWAL_EMULATOR_TEST === "1";
const send = vi.hoisted(()=>vi.fn());
const recommendation=vi.hoisted(()=>vi.fn(async()=>true));
vi.mock("../../client/src/lib/firebaseAdmin",async()=>{
 if(process.env.BLUEPRINT_WITHDRAWAL_EMULATOR_TEST!=="1")return{default:{firestore:{FieldValue:{serverTimestamp:()=>null}}},dbAdmin:null};
 if(process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8080"||process.env.GOOGLE_CLOUD_PROJECT!=="demo-blueprint-reliability-b")throw new Error("Owned demo B Firestore required");
 const {default:admin}=await import("firebase-admin");const app=admin.initializeApp({projectId:"demo-blueprint-reliability-b"},"b-notification-withdrawal-parity");return{default:admin,dbAdmin:admin.firestore(app)};
});
vi.mock("../logger",()=>({logger:{info:vi.fn(),warn:vi.fn(),error:vi.fn()}}));
vi.mock("../utils/email",()=>({sendEmail:send}));
vi.mock("../utils/pilotRecommendationNotifications",()=>({pilotRecommendationNotificationIsCurrent:recommendation}));
vi.mock("../utils/taskStatusUpdates",()=>({enqueueDueTaskStatusUpdates:async()=>{},taskStatusUpdateIsCurrent:async()=>true,acknowledgeTaskStatusUpdate:async()=>{}}));
vi.mock("../utils/taskLifecycleNotifications",()=>({reconcileSceneReadyNotifications:async()=>{}}));
vi.mock("../utils/agentRunResultNotifications",()=>({reconcileAgentRunResultNotifications:async()=>{}}));
vi.mock("../utils/taskEvaluationNotificationRetry",()=>({reconcileTaskEvaluationNotificationRetries:async()=>{}}));
import {dbAdmin as db} from "../../client/src/lib/firebaseAdmin";
import {deliverOutbox,buildOutboxEntry} from "../utils/captureOutbox";
const requestId="b-withdrawal-emulator-001";
const requestRef=()=>db!.collection("inboundRequests").doc(requestId);
const noticeRef=()=>db!.collection("captureOutbox").doc(`${requestId}:scene_ready`);
beforeEach(async()=>{if(!enabled)return;const pending=await db!.collection("captureOutbox").where("status","==","pending").get();if(pending.docs.some(row=>row.id!==`${requestId}:scene_ready`))throw new Error("Other owned B pending intents require coordination before replay");send.mockReset().mockResolvedValue({sent:true,provider:"fake-sink",messageId:"synthetic"});recommendation.mockReset().mockResolvedValue(true);await requestRef().set({request:{consent_attestation:{granted:true,statement_version:"2026-09-18.v1",recorded_at_iso:"2026-01-01T00:00:00Z"}}});await noticeRef().set(buildOutboxEntry({idempotencyKey:`${requestId}:scene_ready`,requestId,kind:"scene_ready",to:"sink@example.invalid",subject:"Synthetic",body:"Synthetic"}));});
afterAll(async()=>{if(enabled)await db!.terminate();});
describe.skipIf(!enabled)("current withdrawal authority through actual Firestore transactions",()=>{
 it("blocks persisted withdrawn notice before fake provider dispatch",async()=>{await requestRef().set({consent_revoked:true},{merge:true});await deliverOutbox();expect(send).not.toHaveBeenCalled();expect((await noticeRef().get()).data()).toMatchObject({status:"cancelled",attempts:0});});
 it("rejects withdrawal between claim and dispatch authority read",async()=>{let withdrawn=false;recommendation.mockImplementation(async()=>{if(!withdrawn){withdrawn=true;await requestRef().set({consent_revoked:true},{merge:true});}return true;});await deliverOutbox();expect(send).not.toHaveBeenCalled();expect((await noticeRef().get()).data()).toMatchObject({status:"cancelled",attempts:0});});
 it("preserves unknown receipt after dispatch and withdrawal",async()=>{send.mockImplementation(async()=>{await requestRef().set({consent_revoked:true},{merge:true});return{sent:false,provider:"fake-sink",outcome:"unknown",messageId:null};});await deliverOutbox();await deliverOutbox();expect(send).toHaveBeenCalledTimes(1);expect((await noticeRef().get()).data()).toMatchObject({status:"unknown",attempts:1});expect((await noticeRef().collection("deliveryReceipts").get()).size).toBe(1);});
});
