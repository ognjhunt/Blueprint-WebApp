// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import {
  probeTaskEvaluationLaunchStore,
  resetTaskEvaluationLaunchStoreReadinessCacheForTests,
  taskEvaluationLaunchStoreErrorCode,
  withTaskEvaluationLaunchStoreTimeout,
} from "../utils/taskEvaluationLaunchStore";

afterEach(() => {
  resetTaskEvaluationLaunchStoreReadinessCacheForTests();
});

describe("Task Evaluation launch store boundary", () => {
  it("returns a typed timeout instead of waiting for the Firestore retry horizon", async () => {
    await expect(withTaskEvaluationLaunchStoreTimeout(
      new Promise(() => undefined),
      10,
    )).rejects.toMatchObject({ code: "task_evaluation_launch_store_timeout" });
  });

  it("normalizes provider errors without exposing raw Firestore messages", () => {
    expect(taskEvaluationLaunchStoreErrorCode({ code: 7, message: "sensitive" }))
      .toBe("task_evaluation_launch_store_permission_denied");
    expect(taskEvaluationLaunchStoreErrorCode({ code: 8 }))
      .toBe("task_evaluation_launch_store_resource_exhausted");
    expect(taskEvaluationLaunchStoreErrorCode(new Error("unknown")))
      .toBe("task_evaluation_launch_store_unavailable");
  });

  it("probes and caches a successful Firestore read", async () => {
    let reads = 0;
    const firestore = {
      collection: () => ({
        doc: () => ({
          get: async () => {
            reads += 1;
            return { exists: false };
          },
        }),
      }),
    };
    const first = await probeTaskEvaluationLaunchStore({
      firestore: firestore as never,
      timeoutMs: 250,
      cacheMs: 1_000,
      now: () => 1_000,
    });
    const second = await probeTaskEvaluationLaunchStore({
      firestore: firestore as never,
      timeoutMs: 250,
      cacheMs: 1_000,
      now: () => 1_100,
    });
    expect(first).toMatchObject({ ready: true, code: "ok" });
    expect(second).toEqual(first);
    expect(reads).toBe(1);
  });
});
