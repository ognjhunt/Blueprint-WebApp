import { describe, expect, it } from "vitest";
import { authReturnPath, companyJobSignInHref, resultSignInHref } from "@/lib/authReturnPath";

describe("result sign-in return path", () => {
  it("keeps a valid result URL through sign-in", () => {
    expect(resultSignInHref("/app/results/capture-run-123"))
      .toBe("/sign-in?next=%2Fapp%2Fresults%2Fcapture-run-123");
  });

  it("ignores unrelated paths", () => {
    expect(resultSignInHref("//outside.example/app/results/123")).toBe("/sign-in");
    expect(resultSignInHref("/app/runs")).toBe("/sign-in");
  });
});

describe("company job sign-in return path", () => {
  it("keeps a local job ID and leaves the result helper scoped to results", () => {
    expect(companyJobSignInHref("job.2026_11-20")).toBe("/sign-in?next=%2Fjobs%2Fjob.2026_11-20");
    expect(authReturnPath("/jobs/job.2026_11-20")).toBe("/jobs/job.2026_11-20");
    expect(resultSignInHref("/jobs/job.2026_11-20")).toBe("/sign-in");
  });

  it.each(["", "../app", "job-1/", "job-1?next=other", "job-1#top", "job-1\n", "job%2F1", "job\\other", "a".repeat(121)])(
    "rejects a job ID that is outside the local route grammar: %j", jobId => {
      expect(companyJobSignInHref(jobId)).toBe("/sign-in");
      expect(authReturnPath(`/jobs/${jobId}`)).toBeNull();
    },
  );

  it.each(["//outside.example/jobs/job-1", "https://outside.example/jobs/job-1", "/jobs", "/app/runs"])(
    "rejects paths outside the two sign-in destinations: %s", pathname => {
      expect(authReturnPath(pathname)).toBeNull();
    },
  );
});
