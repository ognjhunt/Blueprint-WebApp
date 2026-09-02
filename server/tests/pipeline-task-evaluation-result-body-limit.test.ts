import { createServer, request as httpRequest } from "node:http";
import express, { type Request, type Response } from "express";
import { describe, expect, it } from "vitest";

import {
  createPipelineTaskEvaluationResultBodyParser,
  DEFAULT_PIPELINE_TASK_EVALUATION_RESULT_BODY_LIMIT,
  PIPELINE_TASK_EVALUATION_RESULT_PATH,
} from "../utils/pipelineTaskEvaluationResultBodyParser";

function postJson(url: string, payload: unknown) {
  const body = JSON.stringify(payload);
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const request = httpRequest(
      url,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () =>
          resolve({
            status: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    request.on("error", reject);
    request.end(body);
  });
}

describe("Pipeline Task Evaluation result body limit", () => {
  it("accepts a full report payload without widening unrelated routes", async () => {
    const app = express();
    app.use(
      PIPELINE_TASK_EVALUATION_RESULT_PATH,
      createPipelineTaskEvaluationResultBodyParser({
        limit: DEFAULT_PIPELINE_TASK_EVALUATION_RESULT_BODY_LIMIT,
        verify(req: Request & { rawBody?: string }, _res: Response, buffer: Buffer) {
          req.rawBody = buffer.toString("utf8");
        },
      }),
    );
    app.use(express.json({ limit: "1mb" }));
    app.post(PIPELINE_TASK_EVALUATION_RESULT_PATH, (req, res) => {
      res.status(200).json({
        payloadBytes: Buffer.byteLength(req.rawBody ?? "", "utf8"),
      });
    });
    app.post("/api/public-default", (_req, res) => res.sendStatus(200));

    const report = { evidence: "x".repeat(1_250_000) };
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("test server unavailable");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    try {
      const internal = await postJson(
        `${baseUrl}${PIPELINE_TASK_EVALUATION_RESULT_PATH}`,
        report,
      );
      expect(internal.status).toBe(200);
      const internalBody = JSON.parse(internal.body) as { payloadBytes: number };
      expect(internalBody.payloadBytes).toBeGreaterThan(1_000_000);

      const unrelated = await postJson(`${baseUrl}/api/public-default`, report);
      expect(unrelated.status).toBe(413);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
