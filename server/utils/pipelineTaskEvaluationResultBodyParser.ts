import type { OptionsJson } from "body-parser";
import express, { type RequestHandler } from "express";

export const PIPELINE_TASK_EVALUATION_RESULT_PATH =
  "/api/internal/pipeline/capture-task-evaluation-runs";
export const DEFAULT_PIPELINE_TASK_EVALUATION_RESULT_BODY_LIMIT = "4mb";

export function createPipelineTaskEvaluationResultBodyParser(
  options: Pick<OptionsJson, "limit" | "verify">,
): RequestHandler {
  return express.json(options);
}
