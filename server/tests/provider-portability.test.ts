import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { auditProductionPortability, repositoryPortabilityAudit } from "../../scripts/research-learning/check-portability";

describe("permanent provider-portability regression boundary", () => {
  it.each(["canonicalArtifactUri: 'library://file_123'", '"canonicalStorageRef": "sediment://file_123"',
    'canonicalProvider = "chatgpt_library"', 'sourceOfTruthUri: "openai_library:file_123"', 'productionRequiresLibrary: true', '"requiresChatGPTLibrary": true'])
    ("rejects a production Library-only dependency: %s", text => expect(auditProductionPortability([{ file: "server/runtime.ts", text }])).toHaveLength(1));
  it("permits optional delivery copies, vendor integrations and examples outside production", () => {
    expect(auditProductionPortability([
      { file: "server/runtime.ts", text: 'canonicalArtifactUri: "gs://company-bucket/blueprint-proof.json"\noptionalUserDeliveryUri: "library://file_123"\nrequiresLibrary: false\nmodel: "gpt-6-luna"' },
      { file: "docs/example.md", text: 'canonicalArtifactUri: "library://example"' },
      { file: "server/tests/a.test.ts", text: 'canonicalArtifactUri: "library://fixture"' },
      { file: "server/tests/library-fixture.ts", text: 'canonicalArtifactUri: "library://fixture"' },
      { file: "server/fixtures/a.json", text: '"canonicalStorageRef": "library://fixture"' },
      { file: "server/runtime.ts", text: '// canonicalArtifactUri: "library://documented-noncanonical-example"' },
    ])).toEqual([]);
  });
  it("catches unquoted YAML and split-line canonical references with their source line", () => {
    expect(auditProductionPortability([
      { file: "render.yaml", text: "service: worker\ncanonicalArtifactUri: library://file_123" },
      { file: "server/runtime.ts", text: "const manifest = {\n  canonicalArtifactUri:\n    'library://file_123'\n};" },
      { file: "server/config.json", text: '{\n  "sourceOfTruthUri":\n    "sediment://file_123"\n}' },
    ])).toEqual([
      { file: "render.yaml", line: 2, rule: "library_only_canonical_reference" },
      { file: "server/runtime.ts", line: 2, rule: "library_only_canonical_reference" },
      { file: "server/config.json", line: 2, rule: "library_only_canonical_reference" },
    ]);
  });
  it("audits current production source/config without claiming remote migration or access", () => {
    const report = repositoryPortabilityAudit(resolve(".")); expect(report.findings).toEqual([]);
    expect(report.limitations).toContain("no remote access verification"); expect(report.scope).toContain("docs, fixtures and tests excluded");
  });
});
