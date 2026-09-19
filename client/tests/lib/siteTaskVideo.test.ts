import { describe, expect, it } from "vitest";

import { taskVideoField } from "@/data/siteTaskQualification";

/**
 * The video field is optional, is a link, and says so.
 *
 * The reason it is a link is not convenience: `/governance` promises that a
 * capture without its consent record does not process, and an upload widget on
 * a public form would take footage of identifiable workers before any consent
 * record exists. That would make the trust page false. These assertions keep
 * the framing that makes the field safe from being edited away.
 */
describe("task video field", () => {
  it("is offered as optional and never as a requirement", () => {
    expect(taskVideoField.optional).toMatch(/optional/i);
  });

  it("asks for a link rather than an upload, and says custody stays with the site", () => {
    // "Up to five" is the promise; the form keeps every link it is given.
    expect(taskVideoField.hint).toMatch(/up to five links/i);
    expect(taskVideoField.hint).toMatch(/every one is kept/i);
    expect(taskVideoField.privacy).toMatch(/link rather than an upload/i);
    expect(taskVideoField.privacy).toMatch(/revoke access/i);
  });

  it("tells the site to film the work rather than the worker", () => {
    expect(taskVideoField.privacy).toMatch(/film the work, not the worker/i);
    expect(taskVideoField.privacy).toMatch(/identifiable people/i);
  });
});
