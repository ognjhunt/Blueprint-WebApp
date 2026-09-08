import { describe, expect, it } from 'vitest';
import { sealRigidTaskSuccessContract } from '../utils/rigidTaskSuccessContract';
import { projectCorrectedScoringContract } from '../utils/taskEvaluationCorrectedScoringContract';
const sha=(c:string)=>'sha256:'+c.repeat(64);
const contract=sealRigidTaskSuccessContract({siteId:'fixture-site',taskId:'fixture-task',authorSource:'compatibility_default',authorId:'fixture-registry',confirmationStatus:'confirmed',criteria:{
 destination_containment:{mode:'required',position_bounds_world_m:{minimum:[0,0,0],maximum:[1,1,1]}},
 orientation:{mode:'ignored',reference_xyzw:[0,0,0,1],tolerance_rad:0.1},support:{height_mode:'required',height_interval_m:[0,1],contact_mode:'required'},terminal_task_contact:{mode:'cleared'},gripper_state:{mode:'ignored',threshold_m:null},settling:{mode:'required',window_samples:2,position_tolerance_m:0.01,orientation_tolerance_rad:0.1},safety:{mode:'required'},motion:{movement_epsilon_m:0.01,minimum_translation_m:0.02,minimum_lift_m:null},temporal_invariants:{schema_version:'rigid_task_event_ledger_expectation.v1',no_drop:{mode:'ignored',minimum_fall_m:0.02},maximum_task_contact_force_n:null,forbidden_contact_classes:[],containment_excursions:'forbidden',workspace_excursions:'ignored',maximum_retries:null,maximum_regrasps:null},
}});
const publication={run_id:'run',policy_canary_result:{projection_digest:sha('a')},result_delivery:{delivery_digest:sha('b')}};
const sidecar:any={source_binding:{source_projection_digest:sha('a'),source_delivery_digest:sha('b')},correction:{source_run_id:'run',correction_digest:sha('c'),score_updates:Array.from({length:20},()=>({success_contract_digest:contract.contract_digest,new_score:{task_success_contract_digest:contract.contract_digest,task_success_contract:contract}}))}};
describe('corrected scoring criteria',()=>{
 it('exposes a verified common registry default without turning it into team or request authorization',()=>{
  expect(projectCorrectedScoringContract(publication,sidecar)).toMatchObject({team_confirmation_recorded:false,original_request_authorization:false,contract:{contract_digest:contract.contract_digest}});
 });
 it('refuses stale bindings, changed criteria bytes, and heterogeneous contracts',()=>{
  expect(projectCorrectedScoringContract({...publication,run_id:'other'},sidecar)).toBeNull();
  expect(projectCorrectedScoringContract({...publication,result_delivery:{delivery_digest:sha('d')}},sidecar)).toBeNull();
  const corrupt=structuredClone(sidecar);corrupt.correction.score_updates[0].new_score.task_success_contract.criteria.motion.minimum_translation_m=0.5;
  expect(projectCorrectedScoringContract(publication,corrupt)).toBeNull();
  const changed=structuredClone(sidecar);changed.correction.score_updates[0].success_contract_digest=sha('d');
  expect(projectCorrectedScoringContract(publication,changed)).toBeNull();
 });
});
