// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
import { createHash } from "node:crypto";
import { notifySlackRobotTeamAccessApplication } from "../utils/slack";

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it("says only that a company applied, with one link to its card on the approvals page", async () => {
  vi.stubEnv("SLACK_INBOUND_WEBHOOK_URL", "https://hooks.example.invalid/x");
  vi.stubEnv("APP_URL", "https://app.example.invalid");
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok", { status: 200 }));
  const application = { name: "Fixture Person", company: "Fixture Co", email: " Fixture@Example.invalid ", robot: "Arm",
    workWanted: "Picking", testSite: "Fixture site", fit: { checks: [] }, autoApproved: false };
  await notifySlackRobotTeamAccessApplication(application);
  const text = JSON.parse(String(fetchSpy.mock.calls[0][1]!.body)).text as string;
  // The record id is the sha256 of the normalised email (accessRecordId), so the link lands on that card.
  const id = createHash("sha256").update("fixture@example.invalid").digest("hex");
  expect(text).toContain(`https://app.example.invalid/admin/robot-team-access?application=${id}`);
  expect(text.match(/https?:\/\//g)).toHaveLength(1);
  expect(text).not.toMatch(/Fixture|Arm|Picking/i);
});
