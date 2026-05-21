#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import { buildRobotAgentOpenApiContract } from "../../server/utils/robot-agent-contract";

const contract = `${JSON.stringify(buildRobotAgentOpenApiContract(), null, 2)}\n`;
const outputs = [
  path.resolve(process.cwd(), "client/public/agent-access.openapi.json"),
  path.resolve(process.cwd(), "docs/agent-access/agent-access.openapi.json"),
];

for (const output of outputs) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, contract, "utf8");
  console.log(`Wrote ${output}`);
}
