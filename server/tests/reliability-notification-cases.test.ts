// @vitest-environment node
/** Synthetic provider receipts, real dispatch/reconcile utilities, serialized fake Firestore transactions. */
import {beforeEach, afterEach, describe, expect, it, vi} from "vitest";
import catalog from "./fixtures/reliability-status-cases.json";
import {sharedFakeFirestoreState} from "./helpers/fake-firestore";
const transport = vi.hoisted(() => ({email:vi.fn()}));
vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const {sharedFakeFirestore} = await import("./helpers/fake-firestore");
  return {default:{apps:[],messaging:()=>{throw new Error("No push permitted");}},dbAdmin:sharedFakeFirestore};
});
vi.mock("../utils/email",()=>({sendEmail:transport.email}));
vi.mock("../logger",()=>({logger:{warn:vi.fn(),error:vi.fn(),info:vi.fn()}}));
const {dispatchTransactionalEmailNotification,reconcileVerifiedNotificationEmail}=await import("../utils/transactional-notifications");
beforeEach(()=>{
  sharedFakeFirestoreState.docs.clear();transport.email.mockReset();
  vi.stubEnv("BLUEPRINT_TRANSACTIONAL_EMAIL_NOTIFICATIONS_ENABLED","1");
});
afterEach(()=>vi.unstubAllEnvs());

describe("D generated notification outcome and receipt cases",()=>{
  it.each(catalog.filter(c=>c.family==="notification-accounting"))("$caseId",async row=>{
    const {providerOutcome,receipt}=row.parameters as {providerOutcome:string;receipt:string};
    if(providerOutcome==="accepted")transport.email.mockResolvedValue({sent:true,provider:"resend",messageId:"local-message"});
    if(providerOutcome==="lost_response")transport.email.mockRejectedValue(new Error("synthetic disconnected response"));
    if(providerOutcome==="returned_error")transport.email.mockResolvedValue({sent:false,provider:"resend",messageId:null,error:new Error("synthetic timeout")});
    if(providerOutcome==="transport_unavailable")transport.email.mockResolvedValue({sent:false,provider:null,messageId:null});
    const input={eventType:"evaluation_results_ready" as const,recipientType:"buyer" as const,
      recipientEmail:providerOutcome==="missing_recipient"?null:"owner@example.test",subjectId:"local-run"};
    const first=await dispatchTransactionalEmailNotification(input);
    expect(first).not.toBeNull();
    const sends=providerOutcome==="missing_recipient"?0:1;
    expect(transport.email).toHaveBeenCalledTimes(sends);
    const expectedInitial=providerOutcome==="accepted"?"sent":["transport_unavailable","missing_recipient"].includes(providerOutcome)?"skipped":"delivery_unknown";
    expect(first!.status).toBe(expectedInitial);
    const created=Date.parse(first!.created_at);
    const event={type:receipt==="bounced"?"email.bounced":"email.delivered",
      created_at:new Date(created+(receipt==="old"?-5000:5000)).toISOString(),
      data:{email_id:"local-message",to:[receipt==="wrong_recipient"?"other@example.test":"owner@example.test"],tags:{bp_notification_id:first!.id}}};
    if(receipt==="wrong_message"){
      // A prior verified acceptance binds every later callback to one provider message.
      await reconcileVerifiedNotificationEmail({...event,data:{...event.data,email_id:"local-message"}},"local-binding");
      event.data.email_id="different-message";
    }
    const shouldApply=!["transport_unavailable","missing_recipient"].includes(providerOutcome)
      && !["wrong_recipient","wrong_message","old"].includes(receipt);
    expect(await reconcileVerifiedNotificationEmail(event,"local-receipt")).toBe(shouldApply);
    if(receipt==="replayed")expect(await reconcileVerifiedNotificationEmail(event,"local-receipt")).toBe(shouldApply);
    const replay=await dispatchTransactionalEmailNotification(input);
    expect(transport.email).toHaveBeenCalledTimes(sends);
    if(shouldApply)expect(replay?.status).toBe(receipt==="bounced"?"failed":"sent");
    else if(receipt!=="wrong_message")expect(replay?.status).toBe(expectedInitial);
    expect([...sharedFakeFirestoreState.docs.keys()].filter(key=>key.startsWith("transactionalNotifications/"))).toHaveLength(1);
  });
});
