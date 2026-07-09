import { SEO } from "@/components/SEO";
import {
  EditorialSectionIntro,
  EditorialSectionLabel,
  MonochromeMedia,
  ProofChip,
} from "@/components/site/editorial";
import { editorialGeneratedAssets } from "@/lib/editorialGeneratedAssets";
import {
  Activity,
  ArrowRight,
  Bot,
  Braces,
  FileJson,
  KeyRound,
  Route,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react";

const lifecycle = [
  ["Discover", "Read /llms.txt, /api/site-content, call blueprint.siteWorld.search for store or warehouse language, and inspect the OpenAPI contract before loading a specific site-world id."],
  ["Request", "The request/commerce/session lifecycle starts with request intake: use requestCandidate or blueprint.request.locationDraft to produce a contact URL and inbound-request draft without writing or granting access."],
  ["Commerce", "Use dry-run commerce for quote, checkout, order, entitlement, and entitlement-readiness proof. These planning artifacts do not call live Stripe or deliver package access."],
  ["Session", "Use the hosted-session lifecycle only when public-demo eligibility or protected auth allows it: create, reset, step, runBatch, control, renderExplorer, and export."],
];

const truthLabels = [
  ["capture_grounded", "Raw capture, timestamps, route context, device metadata, provenance, and approved package references."],
  ["provider_derived", "World-model/runtime outputs produced from a provider or adapter path and tied back to the package."],
  ["generated", "Rollout frames, summaries, and artifacts created during the hosted session."],
  ["sample_demo", "Public sample shape for integration work, not customer proof or deployment evidence."],
  ["public_demo_eligible", "Credential-free sample path eligibility, not protected customer access or provider success."],
  ["request_gated", "Protected package, rights, export, or hosted access still needs account/request review."],
  ["protected_robot_team", "Protected hosted-session creation requires robot-team/admin auth plus a provisioned entitlement; existing session operations require creator ownership, admin access, or an active per-session share grant."],
  ["dry_run_order", "A repo-safe test order, receipt, and entitlement proof that does not touch live Stripe or grant live package access."],
];

const errorRows = [
  ["400 bad_request", "Missing ids, invalid JSON, unsupported option shape, or malformed command input."],
  ["401 unauthorized", "Protected flow is missing a Firebase robot-team or admin bearer token."],
  ["403 forbidden", "Authenticated account is not a robot-team/admin profile, lacks a provisioned hosted-session entitlement, or does not own the session."],
  ["404 not_found", "Site world, session, artifact, or explorer asset was not found."],
  ["409 blocked", "Launch readiness, session mode, runtime handle, provider, or active operation blocks the request."],
];

const commands = [
  "npx tsx scripts/agent-access/blueprint-agent-cli.ts help --format json",
  "npx tsx scripts/agent-access/blueprint-agent-cli.ts doctor --format json",
  "npx tsx scripts/agent-access/blueprint-agent-cli.ts setup-auth --format json",
  "npx tsx scripts/agent-access/blueprint-agent-cli.ts plan --q \"Whole Foods near Durham\" --want hosted-review",
  "npx tsx scripts/agent-access/blueprint-agent-cli.ts discover",
  "npx tsx scripts/agent-access/blueprint-agent-cli.ts catalog list --limit 3",
  "npx tsx scripts/agent-access/blueprint-agent-cli.ts site-world search --q \"Whole Foods near Durham\" --limit 5",
  "npx tsx scripts/agent-access/blueprint-agent-cli.ts request location --location \"Whole Foods near Durham\" --site-class grocery --workflow \"shelf restocking\"",
  "npx tsx scripts/agent-access/blueprint-agent-cli.ts commerce quote --site-world-id siteworld-f5fd54898cfb --product site-world-package",
  "npx tsx scripts/agent-access/blueprint-agent-cli.ts commerce checkout --site-world-id siteworld-f5fd54898cfb --product site-world-package --mode dry_run",
  "npx tsx scripts/agent-access/blueprint-agent-cli.ts commerce entitlement <dry-entitlement-id>",
  "npx tsx scripts/agent-access/blueprint-agent-cli.ts commerce entitlement-readiness --site-world-id siteworld-f5fd54898cfb --entitlement-id <dry-entitlement-id>",
  "npx tsx scripts/agent-access/blueprint-agent-cli.ts session create --site-world-id siteworld-f5fd54898cfb --entitlement-id <dry-entitlement-id> --order-id <dry-order-id> --commerce-mode dry_run --robot-profile-id other_sample --task-id sw-chi-01-task-1 --scenario-id sw-chi-01-scenario-1 --start-state-id sw-chi-01-start-1",
];

const noCredentialCommands = [
  "unset BLUEPRINT_AGENT_AUTH_TOKEN",
  "npm run smoke:agent-headless",
  "npx tsx scripts/agent-access/blueprint-agent-cli.ts session create --site-world-id siteworld-f5fd54898cfb --session-mode runtime_only --robot-profile-id other_sample --task-id sw-chi-01-task-1 --scenario-id sw-chi-01-scenario-1 --start-state-id sw-chi-01-start-1",
];

const agentAccessRequestHref =
  "/contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=agents-hero&requestedOutputs=OpenAPI%2C%20CLI%2C%20MCP%2C%20and%20hosted-session%20access&message=Robot-team%20agent%20access%20request";

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="min-w-0 max-w-full overflow-x-auto whitespace-pre-wrap break-words border border-white/12 bg-black px-4 py-4 text-xs leading-6 text-white/82">
      <code className="break-words">{children}</code>
    </pre>
  );
}

export default function Agents() {
  return (
    <>
      <SEO
        title="Robot-Team Agent Access | Blueprint"
        description="Blueprint's headless agent access path for searching capture-backed site worlds, quoting dry-run hosted-session rentals, proving entitlements, requesting eligible hosted sessions, rendering explorer frames, and exporting datasets."
        canonical="/agents"
      />

      <div className="bg-[#f5f1e8] text-[#15130f]">
        <section className="relative border-b border-black/10 bg-[#0d0d0b] text-white">
          <MonochromeMedia
            src={editorialGeneratedAssets.hostedReviewHero}
            alt="Blueprint hosted-session workspace for headless robot-team agents"
            className="min-h-[42rem] rounded-none"
            imageClassName="min-h-[42rem]"
            loading="eager"
            overlayClassName="bg-[linear-gradient(90deg,rgba(13,13,11,0.96)_0%,rgba(13,13,11,0.82)_42%,rgba(13,13,11,0.24)_100%)]"
          >
            <div className="absolute inset-0">
              <div className="mx-auto flex h-full max-w-[88rem] items-end px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
                <div className="max-w-[48rem]">
                  <EditorialSectionLabel light>Blueprint for agents</EditorialSectionLabel>
                  <h1 className="font-editorial mt-5 max-w-[10ch] text-[3.45rem] leading-none tracking-normal text-white sm:text-[5.3rem]">
                    Robot-team agent access.
                  </h1>
                  <p className="mt-6 max-w-[42rem] text-base leading-8 text-white/78">
                    Search capture-backed site worlds in agent language, quote hosted-session rentals, create dry-run orders and entitlement proof, request eligible hosted sessions, manipulate scenarios and start states, run headless rollouts, render explorer frames, and export dataset artifacts without weakening auth, rights, or entitlement gates.
                  </p>
                  <div className="mt-7 flex flex-wrap gap-2">
                    <ProofChip light>Public demo path</ProofChip>
                    <ProofChip light>Protected robot-team flow</ProofChip>
                    <ProofChip light>Dry-run commerce</ProofChip>
                    <ProofChip light>OpenAPI, CLI, MCP</ProofChip>
                  </div>
                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <a
                      href={agentAccessRequestHref}
                      className="inline-flex items-center justify-center border border-white bg-white px-5 py-3 text-sm font-semibold text-[#15130f] transition hover:bg-[#f5f1e8]"
                    >
                      Request agent access
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                    <a
                      href="/agent-access.openapi.json"
                      className="inline-flex items-center justify-center border border-white/25 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      Open contract
                      <FileJson className="ml-2 h-4 w-4" />
                    </a>
                    <a
                      href="/world-models/siteworld-f5fd54898cfb/start"
                      className="inline-flex items-center justify-center border border-white/25 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      Inspect public demo
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        <section className="border-b border-black/10 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-5 px-5 py-10 sm:px-8 lg:grid-cols-[0.42fr_0.58fr] lg:px-10 lg:py-12">
            <EditorialSectionIntro
              eyebrow="Quickstart"
              title="Start with the public demo, then add scoped auth."
              description="JSON is the default contract for the CLI and MCP tools. Human-readable output is opt-in so automation can parse every response predictably."
            />
            <div className="min-w-0 space-y-3">
              <CodeBlock>
                {[
                  "export BLUEPRINT_API_BASE_URL=https://tryblueprint.io",
                  "# Protected flows: set a Firebase robot-team or admin bearer token.",
                  "export BLUEPRINT_AGENT_AUTH_TOKEN=<firebase-id-token>",
                  ...commands,
                ].join("\n")}
              </CodeBlock>
              <p className="text-sm leading-7 text-slate-600">
                Public demo commands omit the token when the demo site world is enabled. Site-world search returns ranked close matches plus no-exact scanned-package semantics and requestCandidate URLs/drafts for intake. Dry-run checkout creates no live Stripe session or charge. Protected worlds keep Firebase, session ownership, and provisioned-entitlement checks in place.
              </p>
              <div className="border border-black/10 bg-[#f5f1e8] p-4">
                <h2 className="text-sm font-semibold text-slate-950">No-credential mock proof</h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  This local smoke path proves discovery, first-class site-world search, dry-run quote/order/entitlement readiness, truth labels, and a mock public-demo hosted session without a bearer token.
                </p>
                <div className="mt-3">
                  <CodeBlock>{noCredentialCommands.join("\n")}</CodeBlock>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <div className="grid gap-4 lg:grid-cols-4">
            {lifecycle.map(([title, body], index) => (
              <div key={title} className="border border-black/10 bg-white p-5">
                <span className="font-editorial text-4xl tracking-normal text-[#a47b3f]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h2 className="mt-5 text-base font-semibold text-slate-950">{title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-black/10 bg-[#15130f] text-white">
          <div className="mx-auto grid min-w-0 max-w-[88rem] gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[0.42fr_0.58fr] lg:px-10 lg:py-12">
            <div className="min-w-0">
              <EditorialSectionIntro
                eyebrow="Auth model"
                title="Public demo is narrow. Protected access stays gated."
                description="Blueprint does not expose private supply or package access because an agent can send HTTP. Public demo sessions stay sample-scoped. Protected robot-team launches require bearer auth plus a provisioned entitlement; existing sessions require creator ownership, admin access, or an active per-session share grant."
                light
              />
              <div className="mt-6 grid min-w-0 gap-3 sm:grid-cols-2">
                {[
                  [Bot, "Public demo", "No privileged token, only demo-eligible site worlds."],
                  [KeyRound, "Protected flow", "Firebase robot-team or admin bearer token."],
                  [ShieldCheck, "No bypass", "Buyer type, entitlement proof, and launch readiness remain authoritative."],
                  [Activity, "Rate limits", "Inherits server API rate limiting and runtime blockers."],
                ].map(([Icon, title, body]) => {
                  const IconComponent = Icon as typeof Bot;
                  return (
                    <div key={String(title)} className="min-w-0 border border-white/12 bg-white/[0.04] p-4">
                      <IconComponent className="h-5 w-5 text-[#d0ad72]" />
                      <p className="mt-4 text-sm font-semibold text-white">{String(title)}</p>
                      <p className="mt-2 text-sm leading-6 text-white/68">{String(body)}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="min-w-0 space-y-3">
              <CodeBlock>
                {[
                  "curl \"$BLUEPRINT_API_BASE_URL/api/site-worlds?limit=3\"",
                  "curl \"$BLUEPRINT_API_BASE_URL/api/site-worlds/search?q=whole%20foods&limit=5\"",
                  "curl \"$BLUEPRINT_API_BASE_URL/api/site-worlds/search?q=warehouse%20tote&limit=5\"",
                  "",
                  "curl \"$BLUEPRINT_API_BASE_URL/api/agent-access/commerce/quote?siteWorldId=siteworld-f5fd54898cfb&product=site_world_package\"",
                  "",
                  "curl -X POST \"$BLUEPRINT_API_BASE_URL/api/agent-access/commerce/dry-run-checkout\" \\",
                  "  -H \"Content-Type: application/json\" \\",
                  "  --data '{\"mode\":\"dry_run\",\"siteWorldId\":\"siteworld-f5fd54898cfb\",\"product\":\"site_world_package\"}'",
                  "",
                  "curl \"$BLUEPRINT_API_BASE_URL/api/agent-access/commerce/entitlement-readiness?siteWorldId=siteworld-f5fd54898cfb&entitlementId=<dry-entitlement-id>\"",
                  "",
                  "curl -H \"Authorization: Bearer $BLUEPRINT_AGENT_AUTH_TOKEN\" \\",
                  "  \"$BLUEPRINT_API_BASE_URL/api/site-worlds/sessions/launch-readiness?siteWorldId=siteworld-f5fd54898cfb\"",
                  "",
                  "curl -X POST \"$BLUEPRINT_API_BASE_URL/api/site-worlds/sessions\" \\",
                  "  -H \"Content-Type: application/json\" \\",
                  "  -H \"Authorization: Bearer $BLUEPRINT_AGENT_AUTH_TOKEN\" \\",
                  "  --data '{\"siteWorldId\":\"siteworld-f5fd54898cfb\",\"entitlementId\":\"<dry-entitlement-id>\",\"orderId\":\"<dry-order-id>\",\"commerceMode\":\"dry_run\",\"sessionMode\":\"runtime_only\",\"robotProfileId\":\"other_sample\",\"taskId\":\"sw-chi-01-task-1\",\"scenarioId\":\"sw-chi-01-scenario-1\",\"startStateId\":\"sw-chi-01-start-1\"}'",
                ].join("\n")}
              </CodeBlock>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <EditorialSectionIntro
            eyebrow="Truth labels"
            title="Agents should preserve evidence type in every downstream artifact."
            description="A hosted rollout can be useful before it is operational proof. The label says what kind of evidence an agent is looking at."
          />
          <div className="mt-8 divide-y divide-black/10 border border-black/10 bg-white">
            {truthLabels.map(([label, body]) => (
              <div key={label} className="grid gap-3 p-4 text-sm leading-6 text-slate-700 md:grid-cols-[0.25fr_0.75fr]">
                <code className="font-semibold text-slate-950">{label}</code>
                <span>{body}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-black/10 bg-white">
          <div className="mx-auto grid min-w-0 max-w-[88rem] gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[0.45fr_0.55fr] lg:px-10 lg:py-12">
            <div className="min-w-0">
              <EditorialSectionIntro
                eyebrow="MCP"
                title="Mirror the CLI as tools."
                description="The MCP server is stdio-first for Codex and other local agent clients. Read-only tools can use public endpoints; session tools require public-demo eligibility or scoped bearer auth."
              />
              <div className="mt-6 flex flex-wrap gap-2">
                <ProofChip>blueprint.siteWorld.search</ProofChip>
                <ProofChip>blueprint.catalog.search</ProofChip>
                <ProofChip>blueprint.request.locationDraft</ProofChip>
                <ProofChip>blueprint.siteWorld.get</ProofChip>
                <ProofChip>blueprint.siteWorld.launchReadiness</ProofChip>
                <ProofChip>blueprint.commerce.quote</ProofChip>
                <ProofChip>blueprint.commerce.checkoutDryRun</ProofChip>
                <ProofChip>blueprint.commerce.order.get</ProofChip>
                <ProofChip>blueprint.commerce.entitlement.get</ProofChip>
                <ProofChip>blueprint.commerce.entitlementReadiness</ProofChip>
                <ProofChip>blueprint.session.create</ProofChip>
                <ProofChip>blueprint.session.reset</ProofChip>
                <ProofChip>blueprint.session.step</ProofChip>
                <ProofChip>blueprint.session.control</ProofChip>
                <ProofChip>blueprint.session.runBatch</ProofChip>
                <ProofChip>blueprint.session.renderExplorer</ProofChip>
                <ProofChip>blueprint.session.export</ProofChip>
              </div>
            </div>
            <CodeBlock>
              {[
                "{",
                "  \"mcpServers\": {",
                "    \"blueprint\": {",
                "      \"command\": \"npx\",",
                "      \"args\": [\"tsx\", \"scripts/agent-access/blueprint-mcp-server.ts\"],",
                "      \"env\": {",
                "        \"BLUEPRINT_API_BASE_URL\": \"https://tryblueprint.io\",",
                "        \"BLUEPRINT_AGENT_AUTH_TOKEN\": \"<firebase-id-token>\"",
                "      }",
                "    }",
                "  }",
                "}",
              ].join("\n")}
            </CodeBlock>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <div className="mb-8 border border-black/10 bg-white p-5">
            <EditorialSectionLabel>Request scope</EditorialSectionLabel>
            <p className="mt-4 max-w-[62rem] text-sm leading-7 text-slate-600">
              Dry-run commerce proves the shape of quote, order, receipt, entitlement, and hosted-session rental access. Live Stripe payment, webhook fulfillment, package delivery, rights clearance, provider execution, and guaranteed hosted fulfillment remain request-scoped until the owning system supplies current proof.
            </p>
          </div>
          <div className="grid gap-5 lg:grid-cols-[0.38fr_0.62fr]">
            <div>
              <EditorialSectionLabel>Error semantics</EditorialSectionLabel>
              <h2 className="font-editorial mt-4 text-4xl tracking-normal text-slate-950 sm:text-[3.2rem]">
                Machines get blockers, not vague failure text.
              </h2>
            </div>
            <div className="divide-y divide-black/10 border border-black/10 bg-white">
              {errorRows.map(([label, body]) => (
                <div key={label} className="grid gap-3 p-4 text-sm leading-6 md:grid-cols-[0.24fr_0.76fr]">
                  <code className="font-semibold text-slate-950">{label}</code>
                  <span className="text-slate-600">{body}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-black/10 bg-[#0d0d0b] text-white">
          <div className="mx-auto grid max-w-[88rem] gap-6 px-5 py-10 sm:px-8 lg:grid-cols-3 lg:px-10 lg:py-12">
            {[
              [TerminalSquare, "CLI", "scripts/agent-access/blueprint-agent-cli.ts"],
              [Braces, "OpenAPI", "agent-access.openapi.json"],
              [Route, "Smoke", "scripts/agent-access/headless-hosted-session-smoke.ts"],
            ].map(([Icon, title, body]) => {
              const IconComponent = Icon as typeof Bot;
              return (
                <a key={String(title)} href={String(title) === "OpenAPI" ? "/agent-access.openapi.json" : "/agents"} className="border border-white/12 bg-white/[0.04] p-5 transition hover:bg-white/[0.08]">
                  <IconComponent className="h-5 w-5 text-[#d0ad72]" />
                  <p className="mt-5 text-sm font-semibold text-white">{String(title)}</p>
                  <p className="mt-2 text-sm leading-6 text-white/68">{String(body)}</p>
                </a>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
