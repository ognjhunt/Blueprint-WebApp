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
  ["Discover", "Read /llms.txt, /api/site-content, and the OpenAPI contract."],
  ["Inspect", "List catalog entries, load a site world, and check task/scenario/start-state catalogs."],
  ["Gate", "Call launch readiness and respect access, runtime, presentation, and qualification blockers."],
  ["Run", "Create a runtime-only session, reset to a known start state, step, batch, render explorer frames, and export artifacts."],
];

const truthLabels = [
  ["capture_grounded", "Raw capture, timestamps, route context, device metadata, provenance, and approved package references."],
  ["provider_derived", "World-model/runtime outputs produced from a provider or adapter path and tied back to the package."],
  ["generated", "Rollout frames, summaries, and artifacts created during the hosted session."],
  ["sample_demo", "Public sample shape for integration work, not customer proof or deployment evidence."],
  ["request_gated", "Protected package, rights, export, or hosted access still needs account/request review."],
];

const errorRows = [
  ["400 bad_request", "Missing ids, invalid JSON, unsupported option shape, or malformed command input."],
  ["401 unauthorized", "Protected flow is missing a Firebase robot-team or admin bearer token."],
  ["403 forbidden", "Authenticated account is not a robot-team/admin profile for hosted-session access."],
  ["404 not_found", "Site world, session, artifact, or explorer asset was not found."],
  ["409 blocked", "Launch readiness, session mode, runtime handle, provider, or active operation blocks the request."],
];

const commands = [
  "npx tsx scripts/agent-access/blueprint-agent-cli.ts discover",
  "npx tsx scripts/agent-access/blueprint-agent-cli.ts catalog list --limit 3",
  "npx tsx scripts/agent-access/blueprint-agent-cli.ts readiness --site-world-id siteworld-f5fd54898cfb",
  "npx tsx scripts/agent-access/blueprint-agent-cli.ts session create --site-world-id siteworld-f5fd54898cfb --robot-profile-id other_sample --task-id sw-chi-01-task-1 --scenario-id sw-chi-01-scenario-1 --start-state-id sw-chi-01-start-1",
];

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto border border-white/12 bg-black px-4 py-4 text-xs leading-6 text-white/82">
      <code>{children}</code>
    </pre>
  );
}

export default function Agents() {
  return (
    <>
      <SEO
        title="Robot-Team Agent Access | Blueprint"
        description="Blueprint's headless agent access path for discovering capture-backed site worlds, creating hosted sessions, running rollouts, rendering explorer frames, and exporting datasets."
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
                    Discover capture-backed site worlds, inspect grounded package context, open eligible hosted sessions, manipulate scenarios and start states, run headless rollouts, render explorer frames, and export dataset artifacts without a human click.
                  </p>
                  <div className="mt-7 flex flex-wrap gap-2">
                    <ProofChip light>Public demo path</ProofChip>
                    <ProofChip light>Protected robot-team flow</ProofChip>
                    <ProofChip light>OpenAPI, CLI, MCP</ProofChip>
                  </div>
                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <a
                      href="/agent-access.openapi.json"
                      className="inline-flex items-center justify-center border border-white bg-white px-5 py-3 text-sm font-semibold text-[#15130f] transition hover:bg-[#f5f1e8]"
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
            <div className="space-y-3">
              <CodeBlock>
                {[
                  "export BLUEPRINT_API_BASE_URL=https://tryblueprint.io",
                  "# Protected flows: set a Firebase robot-team or admin bearer token.",
                  "export BLUEPRINT_AGENT_AUTH_TOKEN=<firebase-id-token>",
                  ...commands,
                ].join("\n")}
              </CodeBlock>
              <p className="text-sm leading-7 text-slate-600">
                Public demo commands omit the token when the demo site world is enabled. Protected worlds keep Firebase and entitlement checks in place.
              </p>
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
          <div className="mx-auto grid max-w-[88rem] gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[0.42fr_0.58fr] lg:px-10 lg:py-12">
            <div>
              <EditorialSectionIntro
                eyebrow="Auth model"
                title="Public demo is narrow. Protected access stays gated."
                description="Blueprint does not expose private supply or package access because an agent can send HTTP. Public demo sessions are sample/demo only. Protected robot-team flows require bearer auth that resolves through Firebase Admin and the existing robot_team/admin access check."
                light
              />
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  [Bot, "Public demo", "No privileged token, only demo-eligible site worlds."],
                  [KeyRound, "Protected flow", "Firebase robot-team or admin bearer token."],
                  [ShieldCheck, "No bypass", "Buyer type and launch readiness remain authoritative."],
                  [Activity, "Rate limits", "Inherits server API rate limiting and runtime blockers."],
                ].map(([Icon, title, body]) => {
                  const IconComponent = Icon as typeof Bot;
                  return (
                    <div key={String(title)} className="border border-white/12 bg-white/[0.04] p-4">
                      <IconComponent className="h-5 w-5 text-[#d0ad72]" />
                      <p className="mt-4 text-sm font-semibold text-white">{String(title)}</p>
                      <p className="mt-2 text-sm leading-6 text-white/68">{String(body)}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <CodeBlock>
                {[
                  "curl \"$BLUEPRINT_API_BASE_URL/api/site-worlds?limit=3\"",
                  "",
                  "curl -H \"Authorization: Bearer $BLUEPRINT_AGENT_AUTH_TOKEN\" \\",
                  "  \"$BLUEPRINT_API_BASE_URL/api/site-worlds/sessions/launch-readiness?siteWorldId=siteworld-f5fd54898cfb\"",
                  "",
                  "curl -X POST \"$BLUEPRINT_API_BASE_URL/api/site-worlds/sessions\" \\",
                  "  -H \"Content-Type: application/json\" \\",
                  "  -H \"Authorization: Bearer $BLUEPRINT_AGENT_AUTH_TOKEN\" \\",
                  "  --data '{\"siteWorldId\":\"siteworld-f5fd54898cfb\",\"sessionMode\":\"runtime_only\",\"robotProfileId\":\"other_sample\",\"taskId\":\"sw-chi-01-task-1\",\"scenarioId\":\"sw-chi-01-scenario-1\",\"startStateId\":\"sw-chi-01-start-1\"}'",
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
          <div className="mx-auto grid max-w-[88rem] gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[0.45fr_0.55fr] lg:px-10 lg:py-12">
            <div>
              <EditorialSectionIntro
                eyebrow="MCP"
                title="Mirror the CLI as tools."
                description="The MCP server is stdio-first for Codex and other local agent clients. Read-only tools can use public endpoints; session tools require public-demo eligibility or scoped bearer auth."
              />
              <div className="mt-6 flex flex-wrap gap-2">
                <ProofChip>blueprint.catalog.search</ProofChip>
                <ProofChip>blueprint.siteWorld.get</ProofChip>
                <ProofChip>blueprint.session.create</ProofChip>
                <ProofChip>blueprint.session.runBatch</ProofChip>
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
