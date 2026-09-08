import { describe, expect, it } from 'vitest';
import { projectWebsiteResultNotification } from '../utils/taskEvaluationResultNotification';
const sha=(c:string)=>'sha256:'+c.repeat(64);
const result={record_id:'result',owner_user_id:'owner',organization_id:'team',publication:{run_id:'run',run_kind:'internal_policy_canary',request_digest:sha('a'),result_status:'completed_unqualified',result_delivery:{delivery_digest:sha('b')},policy_canary_result:{projection_digest:sha('c'),notification_delivery:{status:'pending'}}}};
const run={run_id:'run',run_kind:'internal_policy_canary',result_record_id:'result',owner_user_id:'owner',team_namespace:'team',request_digest:sha('a'),delivery_digest:sha('b'),notification_delivery:{run_result_digest:sha('c'),terminal_state:'completed',status:'accepted',attempts:1,accepted_at:'2026-09-07T00:00:00Z',delivered_at:null}};
describe('Website notification projection',()=>{
 it('projects the Website accepted receipt separately without changing a pending Pipeline snapshot',()=>{
  const before=structuredClone(result);
  expect(projectWebsiteResultNotification(result,run)).toMatchObject({status:'accepted',accepted_at_iso:'2026-09-07T00:00:00Z',delivered_at_iso:null});
  expect(result).toEqual(before);
 });
 it.each(['run_id','result_record_id','owner_user_id','team_namespace','request_digest','delivery_digest'])('refuses wrong %s binding',field=>{
  expect(projectWebsiteResultNotification(result,{...run,[field]:'different'})).toBeNull();
 });
 it('refuses stale projection receipts and removes provider error details',()=>{
  expect(projectWebsiteResultNotification(result,{...run,notification_delivery:{...run.notification_delivery,run_result_digest:sha('d')}})).toBeNull();
  expect(projectWebsiteResultNotification(result,{...run,notification_delivery:{...run.notification_delivery,status:'failed',failure_reason:'https://private.example/?token=secret'}})).toMatchObject({status:'failed',failure_reason:'notification_delivery_failed'});
 });
});
