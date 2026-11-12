// @vitest-environment node
import express from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";

async function startServer() {
  const { default: siteContentRouter } = await import("../routes/site-content");
  const app = express();
  app.use("/api/site-content", siteContentRouter);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("server failed to bind");
  }
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function stopServer(server: Server) {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

describe("site-content route", () => {
  it("returns capture-grounded public summaries without upgrading support signals into operational proof", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/api/site-content`);
      expect(response.status).toBe(200);
      const payload = (await response.json()) as {
        summary: string;
        definitions: Array<{ term: string; definition: string }>;
        safety: string;
      };

      expect(payload.summary).toContain("Task Evaluation Run");
      expect(payload.summary).toContain("bounded decision or explicit abstention");
      expect(payload.definitions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            term: "Task Evaluation Run",
            definition: expect.stringContaining("one customer-facing service"),
          }),
          expect.objectContaining({
            term: "Decision/Evidence Request",
            definition: expect.stringContaining("does not select a simulator"),
          }),
          expect.objectContaining({
            term: "Ground-truth boundary",
            definition: expect.stringContaining("Ground truth means immutable raw capture evidence"),
          }),
        ]),
      );
      expect(payload.safety).toContain("provider execution");
      expect(payload.safety).toContain("owner-system evidence");
      // The frame of 2026-11-12: free for sites, no price stated, a job packet whose summary deployment companies
      // see only with the site's permission, the video private, and the early trial labelled as a trial.
      expect(JSON.stringify(payload)).toContain("Free for sites. Nothing is charged today.");
      expect(payload.summary).toContain("Blueprint turns a site's video of one recurring job into a job packet.");
      expect(payload.summary).not.toMatch(/judge|evaluate the packet|receive the packet/i);
      expect(payload.summary).toContain("a first look on paper (the robot most likely to fit, from published specifications and a cited track record)");
      expect(payload.summary).toContain("this early trial is not the site's answer and does not predict what a deployment company's robot would do");
      // Sharing is the service (2026-11-12): the job packet goes to approved companies; contact details only by introduction.
      expect(payload.summary).toContain("Blueprint shares each job with the deployment companies it approves by hand: the site's description of the job, its video without sound, the simulation, what counts as done, the first look and the early trial's result where one exists.");
      expect(payload.summary).toContain("A site's name, address and contact details go to a company only when the site asks for an introduction.");
      expect(payload.summary).not.toMatch(/stays private|only the summary/);
      expect(payload.summary).not.toMatch(/never sees? the site's own sentence/);
      expect(payload.summary).not.toMatch(/proves it|which did best|top AI robots|paper check/);
      expect(JSON.stringify(payload.pages)).not.toMatch(/\$\s?\d/);
      expect(JSON.stringify(payload)).not.toMatch(/compare delivery proposals|full evaluation|join by invitation|evaluated free when invited/);
      expect(JSON.stringify(payload)).not.toContain("books it in one step");
      expect(JSON.stringify(payload)).toContain("anyone can start a job");
      expect(JSON.stringify(payload)).not.toMatch(/\$2,500|No pilot, no fee/);
      // Page and offer copy never speaks of matching sites to teams.
      const offerCopy = JSON.stringify([
        (payload as unknown as { pages: unknown }).pages,
        payload.definitions.filter(({ term }) => /recommendation|sign-up/i.test(term)),
      ]);
      expect(offerCopy).not.toMatch(/\bmatch(?:ed|es|ing)?\b/i);
      expect(JSON.stringify(payload)).not.toContain("per-episode rate");
      expect(JSON.stringify(payload)).not.toMatch(/Policy Shortlist|Robot Match|Policy Improvement Run|Post-Training Data Package/);
      expect(payload.safety).not.toMatch(/coming soon|not launched|not ready|placeholder/i);
    } finally {
      await stopServer(server);
    }
  });
});
