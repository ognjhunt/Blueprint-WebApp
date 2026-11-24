/**
 * The ops monitor's catch-up sweep of waiting company applications, run once against the local Firestore emulator at a
 * given time, with a website that passes and a model that says yes (no network, no model), then the direct check of one
 * record. Prints what it did. For `e2e/site-journey-round2-flows.spec.ts` (stress test round 2, 2026-11-24).
 * Usage: node --import tsx e2e/helpers/company-check-sweep.ts <nowMs> <recordId>
 */
const realFetch = globalThis.fetch;
globalThis.fetch = ((input: any, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (!["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error(`company-check-sweep: blocked ${url.hostname}`);
  return realFetch(input, init);
}) as typeof fetch;
if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "")) throw new Error("emulator only");
const [nowMs, recordId] = process.argv.slice(2);
const QUOTE = "We design, install and support robot cells for warehouses.";
const deps = {
  now: () => new Date(Number(nowMs)),
  fetchPage: async (url: string) => ({ status: 200, finalUrl: url,
    html: `<html><body><h1>Real Robots</h1><p>${QUOTE}</p><p>${"We deploy robots. ".repeat(20)}</p></body></html>` }),
  askModel: async () => ({ deploys_robots: "yes" as const, reason: "The page says so.", evidence_quote: QUOTE }),
};
const { sweepUncheckedCompanyApplications, checkCompanyApplication } = await import("../../server/utils/companyCheck");
console.log(`SWEEP checked=${await sweepUncheckedCompanyApplications(Number(nowMs), deps as never)}`);
console.log(`SWEEP direct=${JSON.stringify(await checkCompanyApplication(recordId, deps as never))}`);
process.exit(0);
