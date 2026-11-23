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

      // Blueprint runs no robot software in the simulation (owner, 2026-11-14); companies may test the download themselves.
      expect(payload.summary).toContain("Blueprint runs no robot software in the simulation; a company can test the downloaded simulation in its own tools.");
      expect(payload.summary).toContain("A simulation is a bounded estimate; it is not physical proof and never certifies physical performance or safety.");
      expect(payload.summary).not.toContain("Task Evaluation Run");
      expect(payload.definitions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            term: "Job packet",
            definition: expect.stringContaining("Blueprint's one service for a site"),
          }),
        ]),
      );
      // Launch copy (2026-11-20, a-006 to a-010, a-047): only the words a reader of the public pages needs. Pipeline's
      // internal vocabulary, other companies' products and the retired pilot frame are not served.
      expect(payload.definitions.map(({ term }) => term)).toEqual(["Blueprint", "Site sign-up", "Job packet"]);
      expect(payload.safety).toBe("This endpoint returns public summaries only.");
      expect(JSON.stringify(payload)).not.toMatch(/Pipeline|abstention|claim ceiling|Site-Task Testbed|Ground truth|Google|Waymo|\bpilot\b|\bbrief\b|\bpartner\b/i);
      // The frame of 2026-11-12: free for sites, no price stated, a job packet whose summary deployment companies
      // see only with the site's permission, the video private; Blueprint's own early trial is no longer described (2026-11-14).
      expect(JSON.stringify(payload)).toContain("Free for sites. Nothing is charged today.");
      expect(payload.summary).toContain("Blueprint turns a site's video of one recurring job into a job packet.");
      expect(payload.summary).not.toMatch(/judge|evaluate the packet|receive the packet/i);
      expect(payload.summary).toContain("We add a first look at which robots could fit when we have enough detail. We use published specifications and a cited track record.");
      expect(payload.summary).not.toMatch(/early trial|openly available/i);
      // Sharing is the service (2026-11-12): the job packet goes to approved companies; contact details only by introduction.
      expect(payload.summary).toContain("The packet includes the video without sound and adds the simulation when it is ready. Blueprint sends each job automatically to the deployment companies it has approved.");
      expect(payload.summary).toContain("A site sees each company's name and website with its answer, and its own name, address and contact details go to a company only when the site accepts that company.");
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
