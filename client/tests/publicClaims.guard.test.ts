/**
 * Public words claim only what the code does. Every sentence a site, a visitor
 * or a deployment company reads on these pages, in the job page's answer and
 * simulation result, in the emails and in `llms*.txt` is checked here against
 * a short list of claims nothing in Blueprint backs.
 *
 * Only user-visible text is read: string literals, template text and JSX text.
 * Comments, imports, type names, identifiers, log and error messages, and
 * single-token codes (ids, class names, keys) are left out.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");

/** The site-facing files: the public pages, the job page's answer and simulation result, their sentences, the email copy, the agent-readable summaries. */
const FILES = [
  "client/src/pages/Home.tsx",
  "client/src/pages/HowItWorks.tsx",
  "client/src/pages/Beta.tsx",
  "client/src/pages/Partners.tsx",
  "client/src/pages/Contact.tsx",
  "client/src/lib/publicCopy.ts",
  "client/src/lib/siteStartConsent.ts",
  "client/src/components/site/SiteCaptureStart.tsx",
  "server/routes/site-content.ts",
  "client/src/components/site/RobotScene.tsx",
  "client/src/components/site/Footer.tsx",
  "client/src/components/site/MinimalSiteLayout.tsx",
  "client/src/components/site/SiteAnswer.tsx",
  "client/src/components/site/SimulationProof.tsx",
  "client/src/components/site/JobCardAnswer.tsx",
  "client/src/components/site/TaskBrowse.tsx",
  "client/src/components/bare/Bare.tsx",
  "client/src/lib/jobCardAnswerConsent.ts",
  "client/src/pages/SelfCaptureUpload.tsx",
  "client/src/lib/simulationProof.ts",
  "client/src/lib/siteAnswer.ts",
  "client/src/data/simulationAccuracy.ts",
  "client/src/data/simulationPolicies.ts",
  "client/src/data/robotFit.ts",
  "server/utils/jobCardAnswer.ts",
  "server/utils/taskLifecycleNotifications.ts",
  "server/utils/captureOutbox.ts",
  "server/utils/qualificationEmails.ts",
  "client/src/lib/evaluationPricing.ts",
  "client/public/llms.txt",
  "client/public/llms-full.txt",
] as const;

interface Rule { name: string; test: (sentence: string) => boolean }

/**
 * The banned claims. Why: a simulation result is a bounded estimate and the answer is a fit check, so
 * nothing Blueprint runs proves, guarantees or certifies anything, and the simulation does not measure
 * cycle time; a public sentence that says otherwise claims more than the code does.
 */
const RULES: Rule[] = [
  { name: "prove, proves, proven or proof", test: sentence => /\b(prove|proves|proven|proof)\b/i.test(sentence) },
  { name: "guarantee", test: sentence => /\bguarantee(s|d)?\b/i.test(sentence) },
  { name: "certif… outside a negation", test: sentence => [...sentence.matchAll(/\bcertif\w*/gi)].some(match => {
    const before = sentence.slice(Math.max(0, match.index! - 30), match.index);
    const after = sentence.slice(match.index! + match[0].length);
    return !/\b(not|never|nor|no)\b|n['’]t\b/i.test(before) && !/^\s+neither\b/i.test(after);
  }) },
  // A promise that the site will see "which … did best": the comparison may find no clear difference. A result
  // ("{policy} did best: …", emitted only when the rule says so) names the policy and is not this form. The one
  // exception the owner's 2026-11-11 framing needed (the bare phrase "which did best") went with that framing on
  // 2026-11-12, so every form is caught.
  { name: "a promise of which one did best", test: sentence => /\bwhich\b(?:\s+[^\s.;:]+){0,4}\s+did best\b/i.test(sentence) },
  { name: "cycle time in a sentence about the simulation", test: sentence => /\bcycle[- ]?times?\b/i.test(sentence) && /simulat/i.test(sentence) },
  // The frame of 2026-11-12 (WEBSITE_DECISIONS.md): the old frame's words never reach a site or a company again.
  { name: "the old frame's \"top AI robots\"", test: sentence => /\btop AI robots?\b/i.test(sentence) },
  { name: "the old frame's \"AI robot\"", test: sentence => /\bAI robots?\b/i.test(sentence) },
  { name: "the old frame's \"paper check\"", test: sentence => /\bpaper checks?\b/i.test(sentence) },
  // Allowed only in the recorded statement, word for word (by path, in `allowedIn` below).
  { name: "the old frame's \"your answer\"", test: sentence => /\byour answer\b/i.test(sentence) },
  { name: "deployment companies judging the job", test: sentence => /deployment compan\w*[^.]{0,60}\bjudg|\bjudg\w*[^.]{0,60}deployment compan/i.test(sentence) },
  // No price anywhere a site or a company reads (the legal pages are not scanned here).
  { name: "a price", test: sentence => /[$€£]\s?\d/.test(sentence) },
];

/** A rule a file may break because the file holds a recorded statement that must stay word for word. */
const ALLOWED_IN: Record<string, ReadonlySet<string>> = {
  "client/src/lib/jobCardAnswerConsent.ts": new Set(["the old frame's \"your answer\""]),
};

const ENTITIES: Record<string, string> = { apos: "'", quot: "\"", amp: "&", nbsp: " ", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", rarr: "→", mdash: "—", ndash: "–" };
const decode = (text: string) => text.replace(/&(\w+);/g, (whole, name: string) => ENTITIES[name] ?? whole);

/** One-token strings with code punctuation, or all lower case: ids, class names, keys, enum values. */
const looksLikeCode = (text: string) => !/\s/.test(text) && (/[-_./:#@=]/.test(text) || text === text.toLowerCase());
/** JSX attributes a reader never sees: class names, ids, links, wiring. */
const HIDDEN_ATTRIBUTES = /^(className|class|id|key|href|src|rel|target|htmlFor|type|name|role|style|method|action|aria-labelledby|aria-describedby|aria-controls|data-[\w-]+)$/;
/** Calls whose strings are for logs and errors, never for a reader. */
const NOT_FOR_READERS = /^(logger|console)\.|(^|\.)(warn|error|info|debug|trace)$|Error$/;

/** The text a reader can see in a TypeScript or TSX source: string literals, template text and JSX text. */
function visibleTextOf(file: string, source: string): string[] {
  if (file.endsWith(".txt")) return source.split(/\n+/).filter(line => line.trim());
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const texts: string[] = [];
  const push = (text: string) => {
    const clean = decode(text.replace(/\s+/g, " ").trim());
    if (clean && !looksLikeCode(clean)) texts.push(clean);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isLiteralTypeNode(node) || ts.isTypeNode(node)) return;
    if ((ts.isCallExpression(node) || ts.isNewExpression(node)) && NOT_FOR_READERS.test(node.expression.getText(sourceFile))) return;
    if (ts.isJsxAttribute(node) && HIDDEN_ATTRIBUTES.test(node.name.getText(sourceFile))) return;
    if (ts.isJsxText(node)) push(node.getText(sourceFile));
    else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      // A property key is a name, not a sentence.
      const parent = node.parent;
      // A regular expression's replacement template (`[/your video/g, "the site's $1"]`) is code, not a sentence.
      const replacement = parent && ts.isArrayLiteralExpression(parent) && parent.elements.length === 2
        && ts.isRegularExpressionLiteral(parent.elements[0]) && parent.elements[1] === node;
      if (!replacement && !(parent && (ts.isPropertyAssignment(parent) || ts.isPropertyDeclaration(parent)) && parent.name === node)) push(node.text);
    } else if (ts.isTemplateExpression(node)) {
      push([node.head.text, ...node.templateSpans.map(span => span.literal.text)].join(" … "));
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return texts;
}

/** Each rule a file's visible text breaks, with the sentence that breaks it. */
function publicClaimFindings(read: (file: string) => string): string[] {
  const findings: string[] = [];
  for (const file of FILES) {
    for (const text of visibleTextOf(file, read(file))) {
      for (const sentence of text.split(/(?<=[.!?])\s+/)) {
        for (const rule of RULES) if (rule.test(sentence) && !ALLOWED_IN[file]?.has(rule.name)) findings.push(`${file}: ${rule.name}: “${sentence}”`);
      }
    }
  }
  return findings;
}

describe("public words claim only what the code does", () => {
  it("no site-facing sentence says prove, proof, guarantee, an unnegated certify, or cycle time about the simulation", () => {
    expect(publicClaimFindings(file => fs.readFileSync(path.join(ROOT, file), "utf8"))).toEqual([]);
  });

  it("lets the recorded statement keep its words, and nothing else", () => {
    const statement = "export const S = \"Shares a summary of your job and your answer, including later test results.\";";
    expect(publicClaimFindings(file => (file === "client/src/lib/jobCardAnswerConsent.ts" ? statement : ""))).toEqual([]);
    expect(publicClaimFindings(file => (file === FILES[0] ? statement : "")).map(finding => finding.split(": ")[1]))
      .toEqual(["the old frame's \"your answer\""]);
  });

  it("reads only what a reader sees, and catches each banned claim", () => {
    const sample = [
      "// This comment may say proof.",
      "import { proofOf } from \"./proof\";",
      "type Key = \"proof\";",
      "logger.warn({}, \"Could not read the proof\");",
      "const id = \"simulation-proof-title\";",
      "export const A = \"We prove it in simulation.\";",
      "export const B = `The ${name} is guaranteed.`;",
      "export const C = \"It does not certify safety, and never certifies performance; it certifies neither.\";",
      "export const D = \"Blueprint certifies the robot.\";",
      "export const E = \"The simulation checks cycle time on the stack.\";",
      "export const F = <p className=\"site-proof-row site-proof-best\">Your proof in simulation.</p>;",
      "export const G = \"You see which control policy did best in the simulation.\";",
      "export const H = \"In a simulation of your site, π0.5, an AI control policy from Physical Intelligence, did best: it completed the job in 9 of 10 tries.\";",
      // The bare "which did best" was allowed for the 2026-11-11 framing only; since 2026-11-12 it is a finding too.
      "export const I = \"We test the top robots on your job, and show you which did best.\";",
      // The reviewer's planted phrases (2026-11-12), and one of each new ban.
      "export const J = \"We test the top AI robots on your job.\";",
      "export const K = \"Your answer is ready: the paper check.\";",
      "export const L = \"A job packet robot deployment companies can judge.\";",
      "export const M = \"Each job costs $1,000 to evaluate.\";",
      "const swap: Array<[RegExp, string]> = [[/your (video)/g, \"the site's $1\"]];",
    ].join("\n");
    const findings = publicClaimFindings(file => (file === FILES[0] ? sample : ""));
    expect(findings.map(finding => finding.split(": ")[1])).toEqual([
      "prove, proves, proven or proof", "guarantee", "certif… outside a negation",
      "cycle time in a sentence about the simulation", "prove, proves, proven or proof", "a promise of which one did best",
      "a promise of which one did best",
      "the old frame's \"top AI robots\"", "the old frame's \"AI robot\"",
      "the old frame's \"paper check\"", "the old frame's \"your answer\"",
      "deployment companies judging the job", "a price"]);
  });
});
