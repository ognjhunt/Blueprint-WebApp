// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Firebase Storage configuration", () => {
  it("registers non-empty Firebase Storage rules", () => {
    const firebaseConfig = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), "firebase.json"), "utf-8"),
    ) as { storage?: { rules?: string } };
    const rulesPath = firebaseConfig.storage?.rules;

    expect(rulesPath).toBe("storage.rules");

    const rulesSource = fs.readFileSync(path.resolve(process.cwd(), rulesPath!), "utf-8");
    expect(rulesSource.trim().length).toBeGreaterThan(0);
    expect(rulesSource).toContain("match /blueprints/{blueprintId}/{filePath=**}");
    expect(rulesSource).toContain("match /captures/{userId}/{filePath=**}");
    expect(rulesSource).toContain("match /marketplace-artifacts/{entitlementId}/{filePath=**}");
    expect(rulesSource).toContain("hasProvisionedMarketplaceEntitlement(entitlementId)");
    expect(rulesSource).toContain("allow read, write: if false;");
  });

  it("keeps bucket CORS off wildcard origins", () => {
    const cors = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), "cors.json"), "utf-8"),
    ) as Array<{ origin?: string[]; method?: string[] }>;

    expect(cors).toHaveLength(1);
    expect(cors[0].origin).not.toContain("*");
    expect(cors[0].origin).toEqual(
      expect.arrayContaining([
        "https://tryblueprint.io",
        "https://www.tryblueprint.io",
      ]),
    );
    expect(cors[0].method).not.toContain("OPTIONS");
  });
});
