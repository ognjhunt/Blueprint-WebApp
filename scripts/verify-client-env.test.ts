import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  CLIENT_ENV_DIR,
  OPT_OUT_VAR,
  REQUIRED_CLIENT_ENV_KEYS,
  missingClientEnvKeys,
} from "./verify-client-env.mjs";

const projectRoot = path.resolve(__dirname, "..");

function read(relativePath: string) {
  return readFileSync(path.resolve(projectRoot, relativePath), "utf8");
}

describe("client env build guard", () => {
  it("demands exactly the keys firebase.ts requires", () => {
    // The guard exists to catch a missing key before a build ships. If
    // firebase.ts starts requiring one the guard does not know about, a
    // deploy can still reach users with a sign-in page that throws.
    const source = read("client/src/lib/firebase.ts");
    const required = [...source.matchAll(/requireFirebaseEnv\("([^"]+)"\)/g)].map(
      (match) => match[1],
    );

    expect(required.length).toBeGreaterThan(0);
    expect([...REQUIRED_CLIENT_ENV_KEYS].sort()).toEqual([...required].sort());
  });

  it("reads env from the directory Vite actually builds from", () => {
    // Vite resolves env files relative to `root`. If root moves, the guard
    // would read a directory the build does not, and pass on a broken build.
    expect(read("vite.config.ts")).toContain('root: path.resolve(__dirname, "client")');
    expect(CLIENT_ENV_DIR).toBe(path.resolve(projectRoot, "client"));
  });

  it("treats absent, blank and whitespace-only values as missing", () => {
    const env = Object.fromEntries(REQUIRED_CLIENT_ENV_KEYS.map((key) => [key, "set"]));
    expect(missingClientEnvKeys(env)).toEqual([]);

    expect(missingClientEnvKeys({ ...env, VITE_FIREBASE_API_KEY: "" })).toEqual([
      "VITE_FIREBASE_API_KEY",
    ]);
    expect(missingClientEnvKeys({ ...env, VITE_FIREBASE_APP_ID: "   " })).toEqual([
      "VITE_FIREBASE_APP_ID",
    ]);

    const { VITE_FIREBASE_PROJECT_ID: _omitted, ...withoutProjectId } = env;
    expect(missingClientEnvKeys(withoutProjectId)).toEqual(["VITE_FIREBASE_PROJECT_ID"]);
  });

  it("exempts the worker deploy but never the web deploy", () => {
    // Both Render services run the same build command. The worker starts
    // dist/worker.js and never serves the client, and is given only Firebase
    // Admin credentials — so it must stay exempt or its deploy breaks. The web
    // service serves the sign-in page, so it must never be exempt.
    const render = read("render.yaml");
    const [web, worker] = render.split("- type: worker");
    expect(worker).toContain(OPT_OUT_VAR);
    expect(web).not.toContain(OPT_OUT_VAR);
  });

  it("keeps the compile-only opt-out wired to the CI build step", () => {
    // CI builds without Firebase config on purpose. That exemption has to stay
    // explicit in the workflow, so a deploy build never inherits it silently.
    const workflow = read(".github/workflows/ci.yml");
    expect(workflow).toContain(`${OPT_OUT_VAR}: "1"`);
    expect(read("package.json")).toContain(
      "node scripts/verify-client-env.mjs && vite build",
    );
    // This suite shells out to `npm run build` itself; without the exemption
    // the guard fails it in any lane where dist/ is absent.
    expect(read("client/tests/build-output.test.ts")).toContain(OPT_OUT_VAR);
  });
});
