import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

export type ClaimType =
  | "no_change_churn"
  | "stale_root_doctrine"
  | "unsupported_hosted_session_proof"
  | "public_copy_proof_drift"
  | "unsupported_rank_fidelity_claim"
  | "unsupported_robot_eval_dataset_claim"
  | "stale_payment_payout_provider_doc"
  | "city_live_claim"
  | "customer_or_traction_claim"
  | "rights_cleared_claim"
  | "provider_execution_claim"
  | "payment_or_payout_claim"
  | "support_guarantee_claim";

export type ScanTarget = {
  relativePath: string;
  absolutePath: string;
  sourceGroup: string;
};

export type ClaimFinding = {
  type: ClaimType;
  severity: "blocker";
  file: string;
  absoluteFile: string;
  line: number;
  sourceGroup: string;
  claimText: string;
  ownerProofRequired: string;
  safeReplacement: string;
};

export type ScanResult = {
  rootDir: string;
  targets: ScanTarget[];
  scannedFiles: string[];
  skippedTargets: string[];
  findings: ClaimFinding[];
  findingsByType: Partial<Record<ClaimType, number>>;
  reportPath?: string;
  jsonPath?: string;
};

type ScanOptions = {
  rootDir?: string;
  targets?: string[];
  outputDir?: string;
  writeReports?: boolean;
};

type ScanContext = {
  relativeFile: string;
  absoluteFile: string;
  sourceGroup: string;
};

type ClaimRule = {
  type: ClaimType;
  ownerProofRequired: string;
  safeReplacement: string;
  matches: (line: string, context: ScanContext) => boolean;
  allowed?: (line: string, context: ScanContext) => boolean;
};

const SCANNED_EXTENSIONS = new Set([".md", ".mdx", ".txt", ".tsx", ".ts", ".json"]);
const EXCLUDED_PATH_PARTS = new Set([
  ".git",
  ".next",
  ".pytest_cache",
  ".ruff_cache",
  "coverage",
  "derived",
  "dist",
  "graphify-out",
  "node_modules",
]);

const EXCLUDED_RELATIVE_PREFIXES = [
  "client/src/pages/Admin",
  "client/src/pages/admin-",
  "ops/paperclip/external/",
  "output/agent-improvement-observer/",
  "output/audits/",
  "output/autoagent/",
  "output/claims-guard/",
  "output/autonomous-org/",
  "output/launch-readiness-gap-closeout-2026-05-14/",
  "output/playwright/",
  "output/qa/",
];

const STALE_DOC_NAMES = [
  "CHANGES_APPLIED.md",
  "FILES_ADDED.md",
  "README_STRIPE_DEBUGGING.md",
  "SETTINGS_INTEGRATION_GUIDE.md",
  "SETTINGS_TAB_SUMMARY.md",
  "STRIPE_BACKEND_CONFIG.md",
  "STRIPE_CONFIGURATION_CHECKLIST.md",
  "STRIPE_DEBUGGING_GUIDE.md",
  "STRIPE_DEBUG_QUICK_START.md",
  "STRIPE_ERROR_REFERENCE.txt",
  "STRIPE_FLOW_DIAGRAM.md",
  "STRIPE_IMPLEMENTATION_SUMMARY.txt",
  "STRIPE_ISSUE_SUMMARY.md",
  "STRIPE_QUICK_SETUP.md",
];

const CITY_NAMES = [
  "Austin",
  "Chicago",
  "Durham",
  "Sacramento",
  "San Diego",
  "San Francisco",
  "San Jose",
  "Seattle",
];

const ROOT_DOCTRINE_FILES = new Set([
  "AGENTS.md",
  "README.md",
  "PLATFORM_CONTEXT.md",
  "WORLD_MODEL_STRATEGY_CONTEXT.md",
  "AUTONOMOUS_ORG.md",
  "client/src/AGENTS.md",
  "docs/ai-tooling-adoption-implementation-2026-04-07.md",
  "docs/ai-skills-governance-2026-04-07.md",
]);

const guardrailPatterns = [
  /\bdo not\b/i,
  /\bdon't\b/i,
  /\bdoes not\b/i,
  /\bdid not\b/i,
  /\bwill not\b/i,
  /\bmust not\b/i,
  /\bshould not\b/i,
  /\bnot\b/i,
  /\bcannot\b/i,
  /\bcan't\b/i,
  /\bnever\b/i,
  /\bwithout\b/i,
  /\?\s*$/i,
  /\bnot proof\b/i,
  /\bnot a proof\b/i,
  /\bnot enough\b/i,
  /\bnot\b[\s\S]{0,180}\bproof\b/i,
  /\bnot current\b/i,
  /\bnot submitted\b/i,
  /\bnot a live\b/i,
  /\bnot presented as\b/i,
  /\bnot claiming\b/i,
  /\bnot imply\b/i,
  /\bnot customer\b/i,
  /\bnot a customer result\b/i,
  /\bnot live\b/i,
  /\bno live\b/i,
  /\bno .*payments?\b/i,
  /\bno .*payouts?\b/i,
  /\bno .*provider\b/i,
  /\bno .*hosted\b/i,
  /\bno .*city\b/i,
  /\bno .*rights\b/i,
  /\bblocked\b/i,
  /\bblocker\b/i,
  /\bforbidden\b/i,
  /\bblockedClaims\b/i,
  /\bfail closed\b/i,
  /\bmissing\b/i,
  /\bguardrail\b/i,
  /\bunsupported\b/i,
  /\bqualify\b/i,
  /\bsource-of-truth\b/i,
  /\bcurrentSearch\b/i,
  /\bcheckout=success\b/i,
  /\bstage:/i,
  /\blabel:/i,
  /\bquestion\b/i,
  /\bask\b/i,
  /\bwhich\b/i,
  /\bwhether\b/i,
  /\bverify\b/i,
  /\bconfirm(?:ed|ing|s)?\b/i,
  /\bsafe replacement\b/i,
  /\bowner proof\b/i,
  /\brequires?\b/i,
  /\brequired\b/i,
  /\brequired before\b/i,
  /\bdependency\b/i,
  /\bdependencies\b/i,
  /\bconfirmed per\b/i,
  /\bconfirmed after review\b/i,
  /\bper site\/request\b/i,
  /\bper request\b/i,
  /\brequest[- ]specific\b/i,
  /\breview[- ]gated\b/i,
  /\breview before\b/i,
  /\bonly after\b/i,
  /\bbefore anything\b/i,
  /\bbefore a buyer\b/i,
  /\bonly when\b/i,
  /\bonly truthful when\b/i,
  /\bspeak truthfully\b/i,
  /\bafter first\b/i,
  /\botherwise\b/i,
  /\bonce\b/i,
  /\bstill required\b/i,
  /\bstill needs\b/i,
  /\bwill produce\b/i,
  /\bfirst rights-cleared\b/i,
  /\bproof-ready\b/i,
  /\bbuilding\b/i,
  /\bfocused on\b/i,
  /\bgoal is\b/i,
  /\bsecure\b[\s\S]{0,80}\bproduce\b/i,
  /\bnon-guaranteed\b/i,
  /\breviewable\b/i,
  /\battempts\b/i,
  /\bwhen approved\b/i,
  /\bwhen available\b/i,
  /\bpending\b/i,
  /\bunavailable\b/i,
  /\bunless\b/i,
  /\buntil\b/i,
  /\bplanning candidate\b/i,
  /\bcandidate only\b/i,
  /\btemplate\b/i,
  /\bexample\b/i,
  /\bexpected to\b/i,
  /\bfirst realistic proof motion\b/i,
  /\binstead of\b/i,
  /\blabeled proof shape\b/i,
  /\brepo-local only\b/i,
  /\bplaceholder blocker\b/i,
  /\bhistorical\/internal\b/i,
  /\bunsafe\/stale archive\b/i,
  /\bwarning required\b/i,
  /\bnegative[- ]controls?\b/i,
  /\bfixture=/i,
  /\bvariant=/i,
];

function has(patterns: RegExp[], value: string) {
  return patterns.some((pattern) => pattern.test(value));
}

function hasAll(patterns: RegExp[], value: string) {
  return patterns.every((pattern) => pattern.test(value));
}

function hasGuardrailContext(line: string) {
  return has(guardrailPatterns, line);
}

function hasOperationalAssertion(line: string) {
  return /\b(proof|proves|proved|proven|mark|treat|use|because|therefore|operational launch ready|production ready|launch ready|live|ready|available|open|completed|complete|fulfilled|configured|cleared|approved)\b/i.test(
    line,
  );
}

function isStaleDocReference(line: string, relativeFile: string) {
  const basename = path.basename(relativeFile);
  if (STALE_DOC_NAMES.includes(basename)) {
    return /\b(stripe|payment|payout|provider|earning|launch|production|ready|configured|complete|proof)\b/i.test(line);
  }

  return STALE_DOC_NAMES.some((docName) => line.includes(docName));
}

function hasCityName(line: string) {
  return CITY_NAMES.some((cityName) => new RegExp(`\\b${cityName}\\b`, "i").test(line));
}

function hasPaymentOperationalClaim(line: string) {
  return /\b(stripe|payments?|checkout|payouts?|capturer payouts?|Stripe Connect)\b[\s\S]{0,100}\b(success|successful|live|ready|production ready|completed|configured|guaranteed|guarantee|proof|proves)\b/i.test(line);
}

function isRootDoctrineFile(relativeFile: string) {
  return ROOT_DOCTRINE_FILES.has(relativeFile)
    || relativeFile.endsWith("fixtures/negative/stale-root-doctrine.md");
}

function hasWorldModelSupportContext(line: string) {
  return /\b(internal|legacy|compatibility|support|supporting|generated|model[- ]derived|advisory|data[- ]package|post[- ]training|augmentation|editing|substrate|inside packages?|not the primary|not primary|support artifact|support layer|allowed as)\b/i.test(
    line,
  );
}

function hasStaleRootDoctrineClaim(line: string) {
  if (/\b(world[- ]model[- ]product[- ]first|world model product first)\b/i.test(line)) {
    return true;
  }

  if (/\b(this platform is|blueprint is|product doctrine is)\b[\s\S]{0,80}\bqualification[- ]first\b/i.test(line)) {
    return !hasGuardrailContext(line);
  }

  if (/\bsite[- ]specific world models?\b[\s\S]{0,120}\b(primary|sellable|buy|buyer|public|main|center|product)\b/i.test(line)) {
    return !hasGuardrailContext(line) && !hasWorldModelSupportContext(line);
  }

  if (/\bprimary sellable outputs?\b[\s\S]{0,120}\b(world models?|hosted sessions?)\b/i.test(line)) {
    return !hasGuardrailContext(line) && !hasWorldModelSupportContext(line);
  }

  if (/\brobot teams?\b[\s\S]{0,80}\bbuy\b[\s\S]{0,80}\b(site[- ]specific )?world models?\b/i.test(line)) {
    return !hasGuardrailContext(line) && !hasWorldModelSupportContext(line);
  }

  if (/\bworld models?\b[\s\S]{0,100}\b(primary public offer|primary public product|main public offer|main public product)\b/i.test(line)) {
    return !hasGuardrailContext(line) && !hasWorldModelSupportContext(line);
  }

  return false;
}

const rules: ClaimRule[] = [
  {
    type: "no_change_churn",
    ownerProofRequired:
      "Repo diff, durable suppression rule, changed fixture/eval/report artifact, or explicit blocked state with proof paths.",
    safeReplacement:
      "No durable change was made; classify as no-change churn and keep the issue report-only until changed proof, a suppression rule, or a blocker packet exists.",
    matches: (line) =>
      hasAll([/\b(no files changed|no code changed|no docs changed|no diff|no[- ]change|no changes?)\b/i, /\b(mark|claim|close|done|complete|completed|ship|operational proof|polished|generated report)\b/i], line),
    allowed: (line) => /\b(report-only|not complete|not done|blocked until|requires changed proof|durable suppression)\b/i.test(line),
  },
  {
    type: "stale_root_doctrine",
    ownerProofRequired:
      "Current cross-repo doctrine: Blueprint sells real-site robot Task Evaluation Runs and sim-only Policy Improvement Runs; world-model language is internal compatibility or generated/advisory policy-improvement support.",
    safeReplacement:
      "Use `capture-first and real-site robot-evaluation/policy-improvement first`; describe world models as support artifacts inside scoped runs, not the primary public offer.",
    matches: (line, context) =>
      isRootDoctrineFile(context.relativeFile) && hasStaleRootDoctrineClaim(line),
    allowed: (line) => hasGuardrailContext(line) || hasWorldModelSupportContext(line),
  },
  {
    type: "unsupported_hosted_session_proof",
    ownerProofRequired:
      "hosted-session runtime/session artifacts, entitlement path, package manifest, and live availability evidence for the exact request.",
    safeReplacement:
      "Use `book hosted review` or `hosted review is confirmed per site/request` until runtime and entitlement proof exists.",
    matches: (line) =>
      hasAll([/\b(hosted[- ]session|hosted session|hosted review|package access)\b/i, /\b(proves|proof|mark|treat|because|therefore|implies)\b/i, /\b(fulfillment|fulfilled|live|available|availability|ready|open|completed)\b/i], line),
    allowed: (line) =>
      hasGuardrailContext(line)
      || /\bbook hosted review\b/i.test(line)
      || /\bbefore claiming\b/i.test(line)
      || /\bnot available\b/i.test(line)
      || /\bonly when the evidence supports it\b/i.test(line)
      || /\bplanning ranges\b/i.test(line),
  },
  {
    type: "unsupported_rank_fidelity_claim",
    ownerProofRequired:
      "Request-scoped owner-system proof for the exact site/task and robot: simulator traces, action logs, robot trials, safety review/signoff, rights/privacy approval, and hosted/runtime artifacts where applicable.",
    safeReplacement:
      "Use `evaluation planning advisory`, `pre-pilot estimate`, `task-specific confidence packet`, or `confirmed after review`; proof requires simulator traces, action logs, and owner-system artifacts. Research correlations must not be described as real-world accuracy.",
    matches: (line) =>
      /\b(ranked in generated-world policy evaluation|deployment[- ]ready|off-scope validated|collision validated|contact validated|manipulation validated|ran the buyer'?s actual robot policy|simulator execution completed|real customer deployment result|real[- ]world accuracy|accuracy guarantee|guaranteed accuracy|guaranteed success rate|guaranteed cycle time|guaranteed intervention rate|guaranteed safety threshold|success rate guarantee|cycle time guarantee|intervention rate guarantee|safety threshold guarantee)\b/i.test(line),
    allowed: (line) =>
      hasGuardrailContext(line)
      || /\bevaluation planning platform\b/i.test(line)
      || /\bevaluation planning advisory\b/i.test(line)
      || /\bpre[- ]pilot readiness estimate\b/i.test(line)
      || /\breadiness report\b/i.test(line)
      || /\btask[- ]specific confidence packet\b/i.test(line)
      || /\bevidence[- ]backed recommendation\b/i.test(line)
      || /\bconfirmed after review\b/i.test(line)
      || /\brequires? simulator traces\b/i.test(line)
      || /\badvisory\b/i.test(line),
  },
  {
    type: "unsupported_robot_eval_dataset_claim",
    ownerProofRequired:
      "Request-scoped owner-system proof beyond the eval-card dataset: simulator traces, action logs, robot trials, safety review/signoff, rights/privacy approval, and actual outcome records for the exact site/task/robot.",
    safeReplacement:
      "Use `real-site robot evaluation card workflow assembled for advisory review` or `Site, Task, Scenario, and Eval Cards with proof boundaries attached`; operational proof still requires simulator, action, robot-trial, safety, rights, and outcome records.",
    matches: (line) =>
      /\b(real[- ]site robot eval(?:uation)? dataset|robot eval(?:uation)? dataset|Site Cards?|Task Cards?|Scenario Cards?|Eval Cards?|eval[- ]card(?:s)?|card family)\b/i.test(line)
      && /\b(simulator execution(?: completed| proof)?|robot policy execution|action[- ]policy readiness|policy execution proof|robot trial(?: passed| proof)?|off-scope validated|off-scope validation|collision validated|contact validated|deployment[- ]ready|ranked in generated-world policy evaluation|operational robot proof|operational proof|guaranteed success rate|guaranteed cycle time|guaranteed intervention rate|guaranteed safety threshold)\b/i.test(line),
    allowed: (line) =>
      hasGuardrailContext(line)
      || /\badvisory\b/i.test(line)
      || /\bproof[- ]boundar(?:y|ies)\b/i.test(line)
      || /\brequires? simulator\b/i.test(line)
      || /\brequires? action\b/i.test(line)
      || /\brequires? robot[- ]trial\b/i.test(line)
      || /\brequires? safety\b/i.test(line),
  },
  {
    type: "public_copy_proof_drift",
    ownerProofRequired:
      "Current owner-system evidence for the specific operational claim: Stripe, provider/runtime, capture/provenance, rights/privacy, city-launch, Paperclip/Firestore/Render/Redis, or entitlement proof as applicable.",
    safeReplacement:
      "Keep the page as Public Launch Ready and say live availability, rights, access, and fulfillment are confirmed per site/request.",
    matches: (line) =>
      hasAll([/\b(public copy|public page|product hero|hero|marketing draft|launch-ready public|public sample|public site)\b/i, /\b(proof|proves|treat|mark|because|therefore)\b/i, /\b(operational launch ready|operational proof|hosted review availability|rights cleared|package access open|city live|customer traction|provider execution|payment|payout)\b/i], line),
    allowed: (line) => hasGuardrailContext(line) || /\bPublic Launch Ready\b.*\b(default|posture|surface)\b/i.test(line),
  },
  {
    type: "stale_payment_payout_provider_doc",
    ownerProofRequired:
      "Stripe dashboard/webhook/entitlement state for payments, Stripe Connect ledger for payouts, and provider runtime artifacts or run logs for provider execution.",
    safeReplacement:
      "Treat Stripe, payout, and provider docs as historical/internal unless current owner-system proof is attached.",
    matches: (line, context) =>
      isStaleDocReference(line, context.relativeFile)
      && hasAll([/\b(proof|proves|use|ready|configured|complete|completed|production|launch|live)\b/i, /\b(stripe|payment|payout|provider|capturer payout|earnings?)\b/i], line),
    allowed: (line) => hasGuardrailContext(line) || /\bcurrent-vs-public-copy note\b/i.test(line),
  },
  {
    type: "city_live_claim",
    ownerProofRequired:
      "Supported-city activation record, city-launch artifacts, active capture supply/proof packet evidence, and current operator approval for that city.",
    safeReplacement:
      "Use `request the city`, `planned city`, or `capture access reviewed by city` until city activation evidence exists.",
    matches: (line) =>
      hasCityName(line)
      && /\b(is live|now live|city live|launched|active city coverage|active coverage|operational launch ready|open for capture|live coverage)\b/i.test(line),
    allowed: (line) => hasGuardrailContext(line) || /\brequest the city\b/i.test(line),
  },
  {
    type: "customer_or_traction_claim",
    ownerProofRequired:
      "Signed/customer-approved evidence, public-use approval, CRM/Paperclip/analytics proof, and approved metric source for the exact customer or traction claim.",
    safeReplacement:
      "Replace with labeled sample, representative packet, product workflow language, or internal target language.",
    matches: (line) =>
      (
        /\b(has|have|secured|signed|serves|serving|with|won|landed)\b[\s\S]{0,120}\b(real customers?|paying customers?|signed pilots?|customer logos?|testimonials?|case outcomes?|customer traction|buyer traction|traction|active customers?)\b/i.test(line)
        || /\b(real customers?|paying customers?|signed pilots?|customer logos?|testimonials?|case outcomes?)\b[\s\S]{0,120}\b(proven|proved|live|signed|active|public|approved)\b/i.test(line)
      ),
    allowed: (line) => hasGuardrailContext(line) || /\binternal target\b/i.test(line) || /\bprivate\b/i.test(line),
  },
  {
    type: "rights_cleared_claim",
    ownerProofRequired:
      "Rights/privacy/consent/commercialization record for the exact site, request, use scope, and export boundary.",
    safeReplacement:
      "Use `rights reviewed per request` or `rights posture attached when available` until clearance proof exists.",
    matches: (line) =>
      /\b(rights[- ]cleared|cleared rights|rights approval|unrestricted commercial use|commercial use approved)\b/i.test(
        line,
      )
      && hasOperationalAssertion(line),
    allowed: (line) => hasGuardrailContext(line) || /\bposture\b/i.test(line) || /\bshould\b/i.test(line),
  },
  {
    type: "provider_execution_claim",
    ownerProofRequired:
      "Provider artifacts, run logs, package manifest evidence, adapter proof, account/billing/quota state, and exact request linkage.",
    safeReplacement:
      "Use `provider-swappable`, `provider path selected after review`, or `provider execution confirmed per request` until provider proof exists.",
    matches: (line) =>
      /\b(provider execution|provider-ready|provider ready|provider run|provider artifacts?|adapter proof)\b/i.test(line)
      && /\b(complete|completed|ready|live|proved|proven|proof|confirmed|production)\b/i.test(line),
    allowed: (line) => hasGuardrailContext(line) || /\bconfirmed per request\b/i.test(line),
  },
  {
    type: "payment_or_payout_claim",
    ownerProofRequired:
      "Stripe checkout/webhook/entitlement state for payment claims and Stripe Connect payout ledger plus approved policy for payout claims.",
    safeReplacement:
      "Treat forms and CTAs as requests; use `payout eligibility reviewed after accepted capture` or `payment state confirmed after checkout`.",
    matches: (line) => hasPaymentOperationalClaim(line),
    allowed: (line) =>
      hasGuardrailContext(line)
      || /\beligible\b/i.test(line)
      || /\bafter accepted capture\b/i.test(line)
      || /\bcanceled\b/i.test(line)
      || /\bresume\b/i.test(line)
      || /\bsetup\b/i.test(line)
      || /\bsensitive zones\b/i.test(line)
      || /\bblockedClaims\b/i.test(line),
  },
  {
    type: "support_guarantee_claim",
    ownerProofRequired:
      "Current support-loop, SLA, Paperclip/Firestore/reply-durability, and human-review policy evidence for the exact support outcome being claimed.",
    safeReplacement:
      "Use `support reviewed per request` or `routed for operator review`; keep refunds, access, hosted-session, and support-outcome guarantees human/proof gated.",
    matches: (line) =>
      /\b(support|support request|buyer request|refund|billing|account[- ]access|hosted access|hosted[- ]session)\b/i.test(line)
      && (
        /\b(guarantee|guaranteed|same[- ]day|resolution|resolved|auto[- ]clos(?:e|ed)|automatically close|without human review|no human review)\b/i.test(line)
        || /\bsla\b[\s\S]{0,80}\b(guarantee|guaranteed|commitment|committed|resolution|resolved)\b/i.test(line)
      ),
    allowed: (line) =>
      (hasGuardrailContext(line) && !/\b(without human review|no human review)\b/i.test(line))
      || /\breviewed per request\b/i.test(line),
  },
];

export function buildDefaultScanTargets(rootDir = process.cwd()): ScanTarget[] {
  const specs = [
    ["AGENTS.md", "root_doctrine"],
    ["README.md", "root_doctrine"],
    ["PLATFORM_CONTEXT.md", "root_doctrine"],
    ["WORLD_MODEL_STRATEGY_CONTEXT.md", "root_doctrine"],
    ["AUTONOMOUS_ORG.md", "root_doctrine"],
    ["client/src/AGENTS.md", "root_doctrine"],
    ["docs/ai-tooling-adoption-implementation-2026-04-07.md", "root_doctrine"],
    ["docs/ai-skills-governance-2026-04-07.md", "root_doctrine"],
    ["client/src/pages", "webapp_pages"],
    ["client/src/data/content/publicPages.ts", "webapp_pages"],
    ["client/src/lib/proofEvidence.ts", "webapp_pages"],
    ["../BlueprintCapture/docs/PUBLIC_COPY_TRUTH_INDEX_2026-05-24.md", "capture_public_copy_docs"],
    ["scripts/gtm", "gtm_artifacts"],
    ["ops/paperclip/playbooks", "gtm_artifacts"],
    ["knowledge/reports", "notion_ready_markdown"],
    ["knowledge/compiled", "notion_ready_markdown"],
    ["output", "generated_reports"],
  ] as const;

  return specs.map(([relativePath, sourceGroup]) => ({
    relativePath,
    absolutePath: path.resolve(rootDir, relativePath),
    sourceGroup,
  }));
}

function targetFromRelative(rootDir: string, relativePath: string): ScanTarget {
  return {
    relativePath,
    absolutePath: path.resolve(rootDir, relativePath),
    sourceGroup: "custom",
  };
}

async function pathExists(value: string) {
  try {
    await fs.access(value);
    return true;
  } catch {
    return false;
  }
}

function shouldExclude(relativeFile: string) {
  const parts = relativeFile.split("/");
  return parts.some((part) => EXCLUDED_PATH_PARTS.has(part))
    || EXCLUDED_RELATIVE_PREFIXES.some((prefix) => relativeFile.startsWith(prefix));
}

async function collectFiles(target: ScanTarget, rootDir: string): Promise<string[]> {
  if (!(await pathExists(target.absolutePath))) {
    return [];
  }

  const stat = await fs.stat(target.absolutePath);
  if (stat.isFile()) {
    const relativeFile = path.relative(rootDir, target.absolutePath).split(path.sep).join("/");
    return SCANNED_EXTENSIONS.has(path.extname(target.absolutePath)) && !shouldExclude(relativeFile)
      ? [target.absolutePath]
      : [];
  }

  const files: string[] = [];
  const entries = await fs.readdir(target.absolutePath, { withFileTypes: true });

  for (const entry of entries) {
    const absoluteEntry = path.join(target.absolutePath, entry.name);
    const relativeEntry = path.relative(rootDir, absoluteEntry).split(path.sep).join("/");

    if (shouldExclude(relativeEntry)) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...await collectFiles({ ...target, absolutePath: absoluteEntry }, rootDir));
      continue;
    }

    if (entry.isFile() && SCANNED_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(absoluteEntry);
    }
  }

  return files;
}

function sourceGroupForFile(file: string, targets: ScanTarget[]) {
  const match = targets
    .filter((target) => file === target.absolutePath || file.startsWith(`${target.absolutePath}${path.sep}`))
    .sort((a, b) => b.absolutePath.length - a.absolutePath.length)[0];

  return match?.sourceGroup ?? "custom";
}

function scanLine(line: string, context: ScanContext, lineNumber: number): ClaimFinding[] {
  const trimmed = line.trim();
  if (!trimmed) {
    return [];
  }

  return rules.flatMap((rule) => {
    if (context.sourceGroup === "root_doctrine" && rule.type !== "stale_root_doctrine") {
      return [];
    }

    if (!rule.matches(trimmed, context)) {
      return [];
    }

    if (rule.allowed?.(trimmed, context)) {
      return [];
    }

    return [
      {
        type: rule.type,
        severity: "blocker" as const,
        file: context.relativeFile,
        absoluteFile: context.absoluteFile,
        line: lineNumber,
        sourceGroup: context.sourceGroup,
        claimText: trimmed,
        ownerProofRequired: rule.ownerProofRequired,
        safeReplacement: rule.safeReplacement,
      },
    ];
  });
}

function countByType(findings: ClaimFinding[]) {
  return findings.reduce<Partial<Record<ClaimType, number>>>((acc, finding) => {
    acc[finding.type] = (acc[finding.type] ?? 0) + 1;
    return acc;
  }, {});
}

export async function scanClaims(options: ScanOptions = {}): Promise<ScanResult> {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const targets = options.targets?.length
    ? options.targets.map((target) => targetFromRelative(rootDir, target))
    : buildDefaultScanTargets(rootDir);
  const skippedTargets: string[] = [];
  const fileSet = new Set<string>();

  for (const target of targets) {
    if (!(await pathExists(target.absolutePath))) {
      skippedTargets.push(target.relativePath);
      continue;
    }

    for (const file of await collectFiles(target, rootDir)) {
      fileSet.add(file);
    }
  }

  const scannedFiles = [...fileSet].sort();
  const findings: ClaimFinding[] = [];

  for (const absoluteFile of scannedFiles) {
    const relativeFile = path.relative(rootDir, absoluteFile).split(path.sep).join("/");
    const sourceGroup = sourceGroupForFile(absoluteFile, targets);
    const text = await fs.readFile(absoluteFile, "utf-8");
    const lines = text.split(/\r?\n/);
    let inMarkdownFence = false;

    lines.forEach((line, index) => {
      if (line.trim().startsWith("```")) {
        inMarkdownFence = !inMarkdownFence;
        return;
      }
      if (inMarkdownFence) {
        return;
      }
      findings.push(...scanLine(line, { absoluteFile, relativeFile, sourceGroup }, index + 1));
    });
  }

  const result: ScanResult = {
    rootDir,
    targets,
    scannedFiles: scannedFiles.map((file) => path.relative(rootDir, file).split(path.sep).join("/")),
    skippedTargets,
    findings,
    findingsByType: countByType(findings),
  };

  if (options.writeReports ?? true) {
    const outputDir = path.resolve(rootDir, options.outputDir ?? "output/claims-guard/latest");
    await fs.mkdir(outputDir, { recursive: true });

    result.reportPath = path.join(outputDir, "claims-guard-report.md");
    result.jsonPath = path.join(outputDir, "claims-guard-report.json");

    await fs.writeFile(result.reportPath, renderClaimsGuardReport(result), "utf-8");
    await fs.writeFile(result.jsonPath, `${JSON.stringify(result, null, 2)}\n`, "utf-8");
  }

  return result;
}

function escapeTableCell(value: string | number) {
  return String(value).replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

export function renderClaimsGuardReport(result: ScanResult) {
  const lines = [
    "# Cross-Source Claims Guard Report",
    "",
    `Root: \`${result.rootDir}\``,
    `Scanned files: ${result.scannedFiles.length}`,
    `Findings: ${result.findings.length}`,
    "",
    "## Target Surfaces",
    "",
    "| Source group | Target | Status |",
    "| --- | --- | --- |",
    ...result.targets.map((target) => {
      const status = result.skippedTargets.includes(target.relativePath) ? "missing" : "scanned";
      return `| ${escapeTableCell(target.sourceGroup)} | \`${escapeTableCell(target.relativePath)}\` | ${status} |`;
    }),
    "",
    "## Findings",
    "",
  ];

  if (result.findings.length === 0) {
    lines.push("No operational proof drift findings.");
    return `${lines.join("\n")}\n`;
  }

  lines.push("| File | Line | Claim type | Claim text | Owner proof required | Safe replacement |");
  lines.push("| --- | ---: | --- | --- | --- | --- |");

  for (const finding of result.findings) {
    lines.push(
      `| \`${escapeTableCell(finding.file)}\` | ${finding.line} | ${escapeTableCell(finding.type)} | ${escapeTableCell(finding.claimText)} | ${escapeTableCell(finding.ownerProofRequired)} | ${escapeTableCell(finding.safeReplacement)} |`,
    );
  }

  lines.push("");
  lines.push("## Claim Type Counts");
  lines.push("");
  lines.push("| Claim type | Count |");
  lines.push("| --- | ---: |");

  for (const [type, count] of Object.entries(result.findingsByType).sort()) {
    lines.push(`| ${type} | ${count} |`);
  }

  return `${lines.join("\n")}\n`;
}

function parseArgs(argv: string[]) {
  const targets: string[] = [];
  let outputDir = "output/claims-guard/latest";
  let writeReports = true;
  let includeNegativeFixtures = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--target") {
      const target = argv[index + 1];
      if (!target) {
        throw new Error("--target requires a path");
      }
      targets.push(target);
      index += 1;
    } else if (arg === "--output") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--output requires a path");
      }
      outputDir = value;
      index += 1;
    } else if (arg === "--no-write") {
      writeReports = false;
    } else if (arg === "--include-negative-fixtures") {
      includeNegativeFixtures = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      targets.push(arg);
    }
  }

  if (includeNegativeFixtures) {
    targets.push("scripts/claims/fixtures/negative");
  }

  return { targets, outputDir, writeReports };
}

function printHelp() {
  console.log(`Usage: tsx scripts/claims/cross-source-claims-guard.ts [--target <path>] [--output <dir>] [--include-negative-fixtures] [--no-write]

Without --target, scans the default cross-source surfaces:
- WebApp public pages
- Capture public-copy truth index
- GTM scripts and playbooks
- generated reports under output/
- Notion-ready markdown under knowledge/

The command exits nonzero when operational proof drift findings are present.`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await scanClaims({
    targets: args.targets.length ? args.targets : undefined,
    outputDir: args.outputDir,
    writeReports: args.writeReports,
  });

  console.log(renderClaimsGuardReport(result));
  if (result.reportPath) {
    console.log(`Report: ${result.reportPath}`);
  }
  if (result.jsonPath) {
    console.log(`JSON: ${result.jsonPath}`);
  }

  if (result.findings.length > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
