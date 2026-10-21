// @vitest-environment node
import { describe, expect, it } from "vitest";
import { robotSetupIntegrationBlocker, teamPolicyBlocker } from "../utils/policyIntegration";
import { syntheticRobotEmbodiment } from "./helpers/supply-agreement";
import { deploymentEmbodimentCatalog } from "../../client/src/lib/deploymentEmbodimentSupport";
import { actionWidth, robotEmbodimentSchema } from "../../client/src/types/robotEmbodiment";
import { syntheticCatalogRobot } from "./helpers/catalog-robot";
const checkpoint={runtime:"policy_endpoint",reference:"https://policy.test/action",
  policyCredential:{ref:"credential",kind:"bearer",expiresAtIso:"2100-01-01T00:00:00Z"}};
describe("named planning robots never fall back to DROID",()=>{
  it("blocks a named robot with an unrelated manifest instead of defaulting to DROID",()=>{
    const options={robotDescription:{source:"support_option"},robotEmbodiment:syntheticRobotEmbodiment()};
    expect(robotSetupIntegrationBlocker(options)).toBe("team_evaluation_robot_binding_mismatch");
    expect(teamPolicyBlocker(checkpoint,options)).toBe("team_evaluation_robot_binding_mismatch");
  });
  it.each(deploymentEmbodimentCatalog.embodiments)("passes a complete declared $embodiment_id to the existing runtime, without qualification",robot=>{
    const manifest=syntheticCatalogRobot(robot);
    const options={robotDescription:{source:"support_option",embodimentId:robot.embodiment_id},robotEmbodiment:manifest};
    expect(robotEmbodimentSchema.parse(manifest)).toEqual(manifest);
    expect(actionWidth(manifest)).toBe(manifest.joints.length+robot.arm_count);
    expect(teamPolicyBlocker(checkpoint,options)).toBeNull();
    expect(robotSetupIntegrationBlocker({...options,robotEmbodiment:{...manifest,joints:manifest.joints.slice(1)}})).not.toBeNull();
  });
  it("requires independent bimanual channels, unique joints, tool references and complete reset",()=>{
    const robot=deploymentEmbodimentCatalog.embodiments.find(row=>row.arm_count===2)!;
    const manifest=syntheticCatalogRobot(robot);
    for(const change of [{grippers:manifest.grippers.slice(0,1)},
      {grippers:[manifest.grippers[0],manifest.grippers[0]]}, {tool_link:"absent"},
      {reset_joint_positions:{}}]) expect(robotEmbodimentSchema.safeParse({...manifest,...change}).success).toBe(false);
    expect(robotEmbodimentSchema.safeParse({...manifest,gripper:manifest.grippers[0]}).success).toBe(false);
    const legacy=syntheticRobotEmbodiment();
    expect(robotEmbodimentSchema.parse(legacy)).toEqual(legacy);
    expect(actionWidth(legacy)).toBe(legacy.joints.length);
  });
  it("requires an explicit native manifest for custom model descriptions while preserving native admission",()=>{
    const robotDescription={source:"model"};
    expect(teamPolicyBlocker(checkpoint,{robotDescription})).toBe("team_evaluation_robot_integration_required");
    expect(teamPolicyBlocker(checkpoint,{robotDescription,robotEmbodiment:syntheticRobotEmbodiment()})).toBeNull();
    expect(teamPolicyBlocker(checkpoint)).toBeNull();
  });
});
