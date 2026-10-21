// @vitest-environment node
import { describe, expect, it } from "vitest";
import { robotSetupIntegrationBlocker, teamPolicyBlocker } from "../utils/policyIntegration";
import { syntheticRobotEmbodiment } from "./helpers/supply-agreement";
const checkpoint={runtime:"policy_endpoint",reference:"https://policy.test/action",
  policyCredential:{ref:"credential",kind:"bearer",expiresAtIso:"2100-01-01T00:00:00Z"}};
describe("named planning robots never fall back to DROID",()=>{
  it("blocks support options even when a valid native manifest is attached",()=>{
    const options={robotDescription:{source:"support_option"},robotEmbodiment:syntheticRobotEmbodiment()};
    expect(robotSetupIntegrationBlocker(options)).toBe("team_evaluation_robot_integration_required");
    expect(teamPolicyBlocker(checkpoint,options)).toBe("team_evaluation_robot_integration_required");
  });
  it("requires an explicit native manifest for custom model descriptions while preserving native admission",()=>{
    const robotDescription={source:"model"};
    expect(teamPolicyBlocker(checkpoint,{robotDescription})).toBe("team_evaluation_robot_integration_required");
    expect(teamPolicyBlocker(checkpoint,{robotDescription,robotEmbodiment:syntheticRobotEmbodiment()})).toBeNull();
    expect(teamPolicyBlocker(checkpoint)).toBeNull();
  });
});
