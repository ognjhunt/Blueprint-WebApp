import { afterEach, describe, expect, it } from "vitest";

import {
  createTaskEvaluationResultDownloadTicket,
  verifyTaskEvaluationResultDownloadTicket,
} from "../utils/taskEvaluationResultDownloadTicket";

afterEach(() => {
  delete process.env.TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET;
});

describe("Task Evaluation Result download tickets", () => {
  it("binds one short-lived ticket to the exact record and artifact", () => {
    process.env.TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET = "test-download-secret";
    const ticket = createTaskEvaluationResultDownloadTicket("record-1", "a".repeat(32), 1_000);
    expect(ticket).not.toBeNull();
    expect(verifyTaskEvaluationResultDownloadTicket(
      "record-1", "a".repeat(32), ticket!.expires, ticket!.signature, 1_001,
    )).toBe(true);
    expect(verifyTaskEvaluationResultDownloadTicket(
      "record-2", "a".repeat(32), ticket!.expires, ticket!.signature, 1_001,
    )).toBe(false);
    expect(verifyTaskEvaluationResultDownloadTicket(
      "record-1", "b".repeat(32), ticket!.expires, ticket!.signature, 1_001,
    )).toBe(false);
  });

  it("rejects expired, overlong, malformed, and unconfigured tickets", () => {
    process.env.TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET = "test-download-secret";
    const ticket = createTaskEvaluationResultDownloadTicket("record-1", "a".repeat(32), 1_000)!;
    expect(verifyTaskEvaluationResultDownloadTicket(
      "record-1", "a".repeat(32), ticket.expires, ticket.signature, ticket.expires + 1,
    )).toBe(false);
    expect(verifyTaskEvaluationResultDownloadTicket(
      "record-1", "a".repeat(32), 99_999, ticket.signature, 1_001,
    )).toBe(false);
    expect(verifyTaskEvaluationResultDownloadTicket(
      "record-1", "a".repeat(32), ticket.expires, "not-a-signature", 1_001,
    )).toBe(false);
    delete process.env.TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET;
    expect(createTaskEvaluationResultDownloadTicket("record-1", "a".repeat(32), 1_000)).toBeNull();
  });
});
