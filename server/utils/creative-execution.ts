import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function renderBlueprintProofReel() {
  const { stdout, stderr } = await execFileAsync(
    "npm",
    ["run", "render:proof-reel"],
    {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024 * 8,
    },
  );

  return {
    outputPath: "/proof/blueprint-proof-reel.mp4",
    stdout,
    stderr,
  };
}
