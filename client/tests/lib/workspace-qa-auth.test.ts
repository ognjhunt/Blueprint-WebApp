import { afterEach, describe, expect, it } from "vitest";
import { resolveOperatorQaAuth } from "@/lib/operatorQaAuth";
afterEach(() => localStorage.removeItem("blueprint_workspace_qa_role"));
describe("workspace visual-test identity boundary", () => {
  it("cannot activate a persona or fake auth in production", () => {
    localStorage.setItem("blueprint_workspace_qa_role", "site_operator");
    expect(
      resolveOperatorQaAuth({
        MODE: "production",
        DEV: false,
        VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH: "1",
      }),
    ).toMatchObject({ enabled: false, currentUser: null, userData: null });
  });
  it("requires the explicit local fake-auth flag before reading the persona", () => {
    localStorage.setItem("blueprint_workspace_qa_role", "site_operator");
    expect(
      resolveOperatorQaAuth({ MODE: "development", DEV: true }),
    ).toMatchObject({ enabled: false, currentUser: null });
    expect(
      resolveOperatorQaAuth({
        MODE: "development",
        DEV: true,
        VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH: "1",
      }).userData?.buyerType,
    ).toBe("site_operator");
  });
});
