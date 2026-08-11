// @vitest-environment node
import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";

import verifyTaskEvaluationLaunchAccess from "../middleware/verifyTaskEvaluationLaunchAccess";

const TOKEN = "temporary-launch-lab-token-0123456789abcdef";

async function startServer(): Promise<{ server: Server; url: string }> {
  const app = express();
  app.use(verifyTaskEvaluationLaunchAccess);
  app.get("/", (_req, res) => res.json({ user: res.locals.firebaseUser }));
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  return { server, url: `http://127.0.0.1:${address.port}` };
}

afterEach(() => {
  delete process.env.BLUEPRINT_TASK_EVALUATION_LAUNCH_LAB_ENABLED;
  delete process.env.BLUEPRINT_TASK_EVALUATION_LAUNCH_LAB_TOKEN;
});

describe("temporary Task Evaluation launch-lab access", () => {
  it("grants a scoped ops identity only for the exact configured token", async () => {
    process.env.BLUEPRINT_TASK_EVALUATION_LAUNCH_LAB_ENABLED = "true";
    process.env.BLUEPRINT_TASK_EVALUATION_LAUNCH_LAB_TOKEN = TOKEN;
    const { server, url } = await startServer();
    try {
      const response = await fetch(url, {
        headers: { "X-Blueprint-Launch-Lab-Token": TOKEN },
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("x-blueprint-launch-lab-mode")).toBe("temporary");
      expect(await response.json()).toMatchObject({
        user: {
          uid: "temporary-task-evaluation-launch-lab",
          ops: true,
          roles: ["ops"],
          temporaryLaunchLab: true,
        },
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it.each([
    ["disabled", false, TOKEN],
    ["wrong token", true, `${TOKEN}-wrong`],
    ["short configured token", true, "too-short"],
  ])("fails back to normal Firebase auth when %s", async (_label, enabled, token) => {
    process.env.BLUEPRINT_TASK_EVALUATION_LAUNCH_LAB_ENABLED = String(enabled);
    process.env.BLUEPRINT_TASK_EVALUATION_LAUNCH_LAB_TOKEN =
      token === "too-short" ? token : TOKEN;
    const { server, url } = await startServer();
    try {
      const response = await fetch(url, {
        headers: { "X-Blueprint-Launch-Lab-Token": token },
      });
      expect(response.status).toBe(401);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

