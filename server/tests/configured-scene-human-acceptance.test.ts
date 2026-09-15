// @vitest-environment node
import { describe, expect, it } from "vitest";
import fixture from "./fixtures/pipeline-configured-scene-offering.v1.json";
import { configuredSceneOfferingSchema } from "../utils/configuredSceneOfferingContract";
import { canonicalArtifactDigest } from "../utils/taskCandidateContract";

function humanOffering() {
  const value: any = structuredClone(fixture);
  const metadata = {
    appearance_review_status: "human_accepted_with_known_artifacts",
    ai_visual_review_status: "rejected",
    human_approval_digest: `sha256:${"a".repeat(64)}`,
    human_reviewer_identity: "owner",
    known_artifacts: ["Small dark residual marks"],
  };
  Object.assign(value.presentation, metadata, {selected_from_exact_reviewed_frame_count:16});
  Object.assign(value.presentation.selection, metadata, {
    thumbnail_selector:"deterministic_first_approved_camera",
    reviewer:{kind:"human",identity:"owner",runtime:"owner_approval",model:"none"},
  });
  Object.assign(value.proof_boundary, metadata, {
    appearance_visual_review_completed:true,appearance_quality_graded:true,
  });
  value.offering_digest=canonicalArtifactDigest(value,"offering_digest");
  return value;
}

describe("owner-accepted generated appearance", () => {
  it("admits16 bound views while preserving the rejected AI grade", () => {
    const parsed=configuredSceneOfferingSchema.parse(humanOffering());
    expect(parsed.presentation.selection.reviewer.kind).toBe("human");
    expect(parsed.proof_boundary.ai_visual_review_status).toBe("rejected");
    expect(parsed.proof_boundary.configuration_is_deployment_or_safety_approval).toBe(false);
  });
  it.each(["missing-approval","wrong-approval","ai-reviewer","missing-artifacts","ungraded","too-few","ai-runtime","wrong-owner"])("refuses %s", (fault) => {
    const value=humanOffering();
    if(fault==="missing-approval") delete value.presentation.human_approval_digest;
    if(fault==="wrong-approval") value.proof_boundary.human_approval_digest=`sha256:${"b".repeat(64)}`;
    if(fault==="ai-runtime") value.presentation.selection.reviewer.runtime="openai_agents_sdk";
    if(fault==="wrong-owner") value.proof_boundary.human_reviewer_identity="someone-else";
    if(fault==="ai-reviewer") value.presentation.selection.reviewer.kind="ai";
    if(fault==="missing-artifacts") value.presentation.known_artifacts=[];
    if(fault==="ungraded") value.proof_boundary.appearance_quality_graded=false;
    if(fault==="too-few") value.presentation.selected_from_exact_reviewed_frame_count=7;
    value.offering_digest=canonicalArtifactDigest(value,"offering_digest");
    expect(configuredSceneOfferingSchema.safeParse(value).success).toBe(false);
  });
});
