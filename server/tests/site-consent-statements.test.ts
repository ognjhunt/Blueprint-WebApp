// @vitest-environment node
/**
 * The model each trial statement names is a decided value in
 * `SITE_CONSENT_STATEMENTS`, never read from the form. These tests pin it to
 * the statement as the start form shows and sends it: if the wording stops
 * naming the model, or the version the form sends changes, the mapping has to
 * be looked at again.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SITE_CONSENT_STATEMENTS, websiteSiteConsents } from "../utils/websiteSceneSponsorship";

const form = readFileSync(resolve(__dirname, "../../client/src/components/site/SiteCaptureStart.tsx"), "utf8");
const route = readFileSync(resolve(__dirname, "../routes/inbound-request.ts"), "utf8");
const words = (checkId: string) => {
  const start = form.indexOf(`id="${checkId}"`);
  expect(start, checkId).toBeGreaterThan(-1);
  return form.slice(start, form.indexOf("</BareCheck>", start)).replace(/\s+/g, " ");
};
const sentVersion = (field: string) => {
  const match = form.match(new RegExp(`${field}: \\{[^}]*statementVersion: "([^"]+)"`));
  return match?.[1];
};

describe("trial statements and the model each names", () => {
  it("maps the Claude statement 2026-09-24.v1, which names Claude Opus 5.5, to claude-opus-5-5 on Anthropic", () => {
    expect(SITE_CONSENT_STATEMENTS.claude_authoring_consent).toEqual(
      { statement_version: "2026-09-24.v1", provider: "anthropic", model: "claude-opus-5-5" });
    expect(words("start-claude-authoring")).toContain("to Anthropic for Claude Opus 5.5 3D authoring");
    expect(sentVersion("claudeAuthoringConsent")).toBe(SITE_CONSENT_STATEMENTS.claude_authoring_consent.statement_version);
    expect(route).toContain(`claudeAuthoringConsent.statement_version !== "${SITE_CONSENT_STATEMENTS.claude_authoring_consent.statement_version}"`);
  });

  it("maps the Sol statement 2026-09-24.v1, which names GPT-6.1 Sol, to gpt-6.1-sol on OpenAI", () => {
    expect(SITE_CONSENT_STATEMENTS.sol_agents_api_consent).toEqual(
      { statement_version: "2026-09-24.v1", provider: "openai", model: "gpt-6.1-sol" });
    expect(words("start-sol-agents-authoring")).toContain("to OpenAI for GPT-6.1 Sol managed-agent 3D authoring");
    expect(sentVersion("solAgentsApiConsent")).toBe(SITE_CONSENT_STATEMENTS.sol_agents_api_consent.statement_version);
    expect(route).toContain(`solAgentsApiConsent.statement_version !== "${SITE_CONSENT_STATEMENTS.sol_agents_api_consent.statement_version}"`);
  });

  it("lists only statements the site accepted, at the version the mapping knows", () => {
    const accepted = { granted: true, statement_version: "2026-09-24.v1", recorded_at_iso: "2026-11-13T09:00:00.000Z" };
    expect(websiteSiteConsents({ request: {} })).toEqual([]);
    expect(websiteSiteConsents({})).toEqual([]);
    expect(websiteSiteConsents({ request: { claude_authoring_consent: accepted } }))
      .toEqual([{ statement_version: "2026-09-24.v1", provider: "anthropic", model: "claude-opus-5-5" }]);
    expect(websiteSiteConsents({ request: { claude_authoring_consent: { ...accepted, granted: false } } })).toEqual([]);
    expect(websiteSiteConsents({ request: { claude_authoring_consent: { ...accepted, statement_version: "2026-12-01.v2" } } }))
      .toEqual([]);
    expect(websiteSiteConsents({ request: { sol_agents_api_consent: accepted, claude_authoring_consent: null } }))
      .toEqual([{ statement_version: "2026-09-24.v1", provider: "openai", model: "gpt-6.1-sol" }]);
  });
});
