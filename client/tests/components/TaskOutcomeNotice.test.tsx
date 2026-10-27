// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TaskOutcomeNotice } from "@/components/site/TaskOutcomeNotice";
import { processingFailure, projectPreparationOutcome } from "../../../server/utils/taskPreparationOutcome";

describe("the site's stopped attempt", () => {
  it("gives Blueprint the processing repair without telling the site to confirm or reupload", () => {
    render(<TaskOutcomeNotice outcome={processingFailure({label: "Reconstruction status", digest: `sha256:${"a".repeat(64)}`})} />);
    expect(screen.getByRole("region", {name: "Preparation outcome"})).toBeInTheDocument();
    expect(screen.getByText(/Next step — Blueprint/)).toBeInTheDocument();
    expect(screen.getByText(/do not need to record or upload it again/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Evidence references").closest("details")).not.toHaveAttribute("open");
  });
  it.each(["robot_carry_path_rejected", "task_evidence_incomplete"] as const)("makes %s readable with its limits", reason => {
    const outcome = projectPreparationOutcome(reason === "robot_carry_path_rejected"
      ? {reason, category: "robot_incompatibility", basis: "conservative_configuration_check", robot_id: "franka_panda", evidence_digest: `sha256:${"b".repeat(64)}`}
      : {reason, category: "insufficient_evidence", basis: "missing_evidence", robot_id: null, evidence_digest: `sha256:${"b".repeat(64)}`});
    render(<TaskOutcomeNotice outcome={outcome} />);
    expect(screen.getByRole("heading", {name: outcome.title})).toBeInTheDocument();
    expect(screen.getByText(outcome.scope)).toBeInTheDocument();
  });
});
