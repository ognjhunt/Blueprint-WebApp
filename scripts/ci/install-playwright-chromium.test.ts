// @vitest-environment node
/**
 * The CI Playwright install: a retry must get the package lock the stalled
 * attempt's apt-get still holds (main CI for #1107, 2026-10-26).
 */
import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = path.resolve(__dirname, "install-playwright-chromium.sh");

/** Stand-ins on PATH: sudo records instead of running, npx fails its first `failures` calls. */
function stubbed(failures: number) {
  const dir = mkdtempSync(path.join(tmpdir(), "playwright-install-"));
  const log = path.join(dir, "calls.log");
  const counter = path.join(dir, "npx-calls");
  writeFileSync(counter, "0");
  const stub = (name: string, body: string) => {
    writeFileSync(path.join(dir, name), `#!/bin/bash\n${body}\n`);
    chmodSync(path.join(dir, name), 0o755);
  };
  stub("sudo", `if [ "$1" = tee ]; then echo "sudo tee $2 <<< $(cat)" >> "${log}"; else echo "sudo $*" >> "${log}"; fi`);
  stub("timeout", `shift; exec "$@"`);
  stub("npx", `n=$(( $(cat "${counter}") + 1 )); echo $n > "${counter}"; echo "npx $*" >> "${log}"; [ $n -gt ${failures} ]`);
  return { dir, log };
}

function run(failures: number) {
  const { dir, log } = stubbed(failures);
  let status = 0;
  try {
    execFileSync("bash", [SCRIPT], { env: { ...process.env, PATH: `${dir}:${process.env.PATH}` }, stdio: "pipe" });
  } catch (error) {
    status = (error as { status: number }).status;
  }
  return { status, calls: readFileSync(log, "utf8").trim().split("\n") };
}

describe("install-playwright-chromium.sh", () => {
  it("waits for a held package lock and clears the stalled attempt's apt-get before retrying", () => {
    const { status, calls } = run(1);
    expect(status).toBe(0);
    expect(calls[0]).toMatch(/^sudo tee \/etc\/apt\/apt\.conf\.d\/80-blueprint-ci-retries <<< .*DPkg::Lock::Timeout "300";/);
    expect(calls.slice(1)).toEqual([
      "npx playwright install --with-deps chromium",
      "sudo pkill -x apt-get",
      "sudo dpkg --configure -a",
      "npx playwright install --with-deps chromium",
    ]);
  });

  it("gives up after three attempts", () => {
    const { status, calls } = run(3);
    expect(status).toBe(1);
    expect(calls.filter((call) => call.startsWith("npx "))).toHaveLength(3);
  });
});
