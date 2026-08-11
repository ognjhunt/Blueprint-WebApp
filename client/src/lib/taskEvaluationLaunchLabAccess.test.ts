// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import {
  resolveTaskEvaluationLaunchLabToken,
  TASK_EVALUATION_LAUNCH_LAB_HEADER,
  withTaskEvaluationLaunchLabHeader,
} from "./taskEvaluationLaunchLabAccess";

describe("Task Evaluation launch-lab browser access", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/ops/task-evaluation-launches");
  });

  it("moves a fragment token into tab-scoped storage and clears the URL", () => {
    window.history.replaceState(
      {},
      "",
      "/ops/task-evaluation-launches#launch-access=temporary-token",
    );

    expect(resolveTaskEvaluationLaunchLabToken()).toBe("temporary-token");
    expect(window.location.hash).toBe("");
    expect(resolveTaskEvaluationLaunchLabToken()).toBe("temporary-token");
  });

  it("adds the scoped header only when temporary access is present", () => {
    expect(withTaskEvaluationLaunchLabHeader("token", { existing: "yes" })).toEqual({
      existing: "yes",
      [TASK_EVALUATION_LAUNCH_LAB_HEADER]: "token",
    });
    expect(withTaskEvaluationLaunchLabHeader("", { existing: "yes" })).toEqual({
      existing: "yes",
    });
  });
});

