#!/usr/bin/env -S npx tsx
import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export type PortabilityFinding = { file: string; line: number; rule: string };
/** Deliberately narrow: production canonical references and mandatory flags,
 * not optional delivery copies, model integrations, prose or Library examples. */
export function auditProductionPortability(files: { file: string; text: string }[]): PortabilityFinding[] {
  const findings: PortabilityFinding[] = [];
  for (const { file, text } of files) {
    if (!/\.(?:ts|tsx|js|mjs|json|ya?ml|py)$/.test(file) || /(?:^|\/)(?:docs|tests|fixtures|__fixtures__|__tests__)(?:\/|$)|\.(?:test|spec)\./.test(file)) continue;
    const code = text.split(/\r?\n/).map(line => /^\s*(?:\/\/|#|\*)/.test(line) ? "" : line).join("\n");
    const patterns = [
      { rule: "library_only_canonical_reference", pattern: /(?:canonical(?:Artifact|Source|Storage|Data|Evidence|Provider)(?:Id|Uri|Url|Ref|Location|Provider)?|primaryArtifact(?:Id|Uri|Url|Ref)|sourceOfTruth(?:Uri|Url|Ref|Provider))\s*["']?\s*[:=]\s*["']?(?:library:\/\/|sediment:\/\/|chatgpt[_ -]?library|openai[_ -]?library|dot:\/\/)/gi },
      { rule: "required_library_dependency", pattern: /(?:productionRequiresLibrary|requiresChatGPTLibrary|requiresLibrary)\s*["']?\s*[:=]\s*true\b/gi },
    ];
    for (const { rule, pattern } of patterns) for (const match of code.matchAll(pattern))
      findings.push({ file, line: code.slice(0, match.index).split("\n").length, rule });
  }
  return findings;
}

export function repositoryPortabilityAudit(root: string) {
  const files: { file: string; text: string }[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (/^(?:node_modules|dist|output|derived|graphify-out|\.git)$/.test(entry.name)) continue;
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && /\.(?:ts|tsx|js|mjs|json|ya?ml|py)$/.test(entry.name)) files.push({ file: relative(root, path), text: readFileSync(path, "utf8") });
    }
  };
  for (const path of ["server", "client/src", "scripts", ".github/workflows"]) walk(resolve(root, path));
  for (const file of ["package.json", "render.yaml", "firebase.json"]) files.push({ file, text: readFileSync(resolve(root, file), "utf8") });
  return { version: "blueprint.provider-portability-audit.v1", scope: "production source/config under server, client/src, scripts, .github/workflows plus package.json/render.yaml/firebase.json; docs, fixtures and tests excluded",
    findings: auditProductionPortability(files), limitations: "Static explicit canonical-reference/required-Library flags only; no remote access verification or complete artifact migration claim." };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = repositoryPortabilityAudit(resolve(".")); console.log(JSON.stringify(report, null, 2));
  if (report.findings.length) process.exitCode = 1;
}
