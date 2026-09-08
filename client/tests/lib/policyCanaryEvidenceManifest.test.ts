import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/verifiedResultArtifactJson',()=>({fetchVerifiedResultArtifactJson:vi.fn()}));
import { mergeVerifiedCanaryManifest } from '@/lib/policyCanaryEvidenceManifest';
import type { TaskEvaluationResultSiteRecord } from '@/lib/taskEvaluationResults';
const sha=(c:string)=>'sha256:'+c.repeat(64);
const artifact=(id:string)=>({artifact_id:id,sha256:sha('a'),size_bytes:3,role:'episode_evidence',relative_path:id,content_type:'image/png'});
const result={publication:{run_id:'run',result_delivery:{artifacts:[artifact('inline')],episodes:[]},policy_canary_result:{report:{result_digest:sha('b')}}}} as unknown as TaskEvaluationResultSiteRecord;
const manifest={schema_version:'task_evaluation_policy_canary_evidence_manifest.v1',run_id:'run',result_digest:sha('b'),artifacts:[artifact('inline'),artifact('omitted-frame')]};
describe('full manifest inventory',()=>{
 it('restores compacted descriptors without changing the publication',()=>{
  const before=structuredClone(result);expect(mergeVerifiedCanaryManifest(result,manifest).map(row=>row.artifact_id)).toEqual(['inline','omitted-frame']);expect(result).toEqual(before);
 });
 it('refuses wrong-run, changed-result, invalid-size, and conflicting duplicate descriptors',()=>{
  expect(()=>mergeVerifiedCanaryManifest(result,{...manifest,run_id:'other'})).toThrow(/does not match/);
  expect(()=>mergeVerifiedCanaryManifest(result,{...manifest,result_digest:sha('c')})).toThrow(/does not match/);
  expect(()=>mergeVerifiedCanaryManifest(result,{...manifest,artifacts:[{...artifact('bad'),size_bytes:-1}]})).toThrow(/invalid/);
  expect(()=>mergeVerifiedCanaryManifest(result,{...manifest,artifacts:[{...artifact('inline'),sha256:sha('c')}]})).toThrow(/conflicts/);
 });
});
