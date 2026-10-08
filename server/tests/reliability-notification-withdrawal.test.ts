// @vitest-environment node
/** Actual outbox worker + consent projection; serialized fake Firestore and fake transport. */
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestore as db, sharedFakeFirestoreState as store } from "./helpers/fake-firestore";
const send = vi.hoisted(() => vi.fn());
const recommendation = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({default:{firestore:{FieldValue:{serverTimestamp:()=>"SERVER_TIMESTAMP"}}},dbAdmin:(await import("./helpers/fake-firestore")).sharedFakeFirestore}));
vi.mock("../logger",()=>({logger:{info:vi.fn(),warn:vi.fn(),error:vi.fn(),debug:vi.fn()}}));
vi.mock("../utils/email",()=>({sendEmail:send}));
vi.mock("../utils/pilotRecommendationNotifications",()=>({pilotRecommendationNotificationIsCurrent:recommendation}));
import { deliverOutbox, enqueueOutbox, type OutboxKind } from "../utils/captureOutbox";
const captureKinds: OutboxKind[] = ["video_received","scene_ready","screening_cleared","screening_started","results_ready","run_no_result","brief_confirmed","coverage_shortfall","assessment_ready","input_needed"];
const granted = () => ({request:{consent_attestation:{granted:true,statement_version:"2026-09-18.v1",recorded_at_iso:"2026-01-01T00:00:00Z"}}});
const request = () => store.docs.get("inboundRequests/withdrawal-fixture")!;
const row = () => store.docs.get("captureOutbox/withdrawal-fixture:notice")!;
const enqueue = (kind: OutboxKind) => enqueueOutbox({idempotencyKey:"withdrawal-fixture:notice",requestId:"withdrawal-fixture",kind,to:"sink@example.invalid",subject:"synthetic",body:"synthetic"});
beforeEach(()=>{store.docs.clear();store.docs.set("inboundRequests/withdrawal-fixture",granted());send.mockReset().mockResolvedValue({sent:true,provider:"sink",messageId:"synthetic"});recommendation.mockReset().mockResolvedValue(true);});
afterEach(()=>vi.restoreAllMocks());
describe("consent withdrawal final dispatch boundary",()=>{
  for(const kind of captureKinds)it(`blocks persisted ${kind} after withdrawal without consuming attempt`,async()=>{await enqueue(kind);request().consent_revoked=true;await deliverOutbox();expect(send).not.toHaveBeenCalled();expect(row()).toMatchObject({status:"cancelled",attempts:0});});
  it("rechecks current consent in dispatch transaction after claim",async()=>{await enqueue("scene_ready");recommendation.mockImplementation(async()=>{request().consent_revoked=true;return true;});await deliverOutbox();expect(send).not.toHaveBeenCalled();expect(row()).toMatchObject({status:"cancelled",attempts:0});});
  it("keeps uncertain in-flight provider outcome unknown after withdrawal",async()=>{await enqueue("results_ready");send.mockImplementation(async()=>{request().consent_revoked=true;return {sent:false,provider:"sink",messageId:null,outcome:"unknown",error:new Error("synthetic lost response")};});await deliverOutbox();expect(row()).toMatchObject({status:"unknown",attempts:1});await deliverOutbox();expect(send).toHaveBeenCalledTimes(1);expect(row().status).toBe("unknown");expect([...store.docs.keys()].filter(k=>k.includes("deliveryReceipts"))).toHaveLength(1);});
  it("preserves accepted provider receipt when withdrawal happens in flight",async()=>{await enqueue("results_ready");send.mockImplementation(async()=>{request().consent_revoked=true;return {sent:true,provider:"sink",messageId:"already-accepted"};});await deliverOutbox();expect(row()).toMatchObject({status:"sent",attempts:1,deliveryMessageId:"already-accepted"});});
  for(const kind of ["task_received","fresh_link"] as OutboxKind[])it(`preserves ${kind} recovery after withdrawal`,async()=>{await enqueue(kind);request().consent_revoked=true;await deliverOutbox();expect(send).toHaveBeenCalledTimes(1);expect(row().status).toBe("sent");});
  it("blocks capture notice whose authoritative request is missing",async()=>{await enqueue("video_received");store.docs.delete("inboundRequests/withdrawal-fixture");await deliverOutbox();expect(send).not.toHaveBeenCalled();expect(row()).toMatchObject({status:"cancelled",attempts:0});});
  it("permits current authorized capture notice",async()=>{await enqueue("video_received");await deliverOutbox();expect(send).toHaveBeenCalledTimes(1);expect(row().status).toBe("sent");});
  it("leaves predispatch recoverable if authority storage read fails",async()=>{await enqueue("scene_ready");const original=db.runTransaction.bind(db);vi.spyOn(db,"runTransaction").mockImplementation(async(cb:any)=>original(async(tx:any)=>cb({...tx,get:(ref:any)=>{if(ref.path==="inboundRequests/withdrawal-fixture")throw new Error("synthetic consent store unavailable");return tx.get(ref);}})));await expect(deliverOutbox()).rejects.toThrow(/synthetic consent store/);expect(send).not.toHaveBeenCalled();expect(row()).toMatchObject({status:"claimed",attempts:0});});
});
