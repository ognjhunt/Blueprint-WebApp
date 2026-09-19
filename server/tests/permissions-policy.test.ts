// @vitest-environment node
/**
 * The camera permission, scoped.
 *
 * `camera=()` denied the camera on the capture page itself, which is why the
 * guided recorder could never open one on any browser that honors the policy.
 * These tests pin both directions: the capture page may open a camera, and
 * nowhere else may.
 */
import { describe, expect, it } from "vitest";

import { permissionsPolicyForPath } from "../utils/permissionsPolicy";

describe("permissions policy", () => {
  it("allows the camera on the capture upload page", () => {
    expect(permissionsPolicyForPath("/capture-upload/some-token")).toContain("camera=(self)");
  });

  it("denies the camera everywhere else", () => {
    for (const path of ["/", "/contact/site-operator", "/capture-uploadx", "/sites"]) {
      expect(permissionsPolicyForPath(path)).toContain("camera=()");
    }
  });

  it("keeps the microphone origin-scoped and geolocation denied", () => {
    const policy = permissionsPolicyForPath("/capture-upload/some-token");
    expect(policy).toContain("microphone=(self)");
    expect(policy).toContain("geolocation=()");
  });
});
