/**
 * Outreach gap 1 (2026-11-27). The new-job email's link (`/jobs/<id>?link=…`) was read on the job page by a useState
 * initializer that also stripped it from the address. Under React's StrictMode in development the initializer ran on a
 * second mount pass after the first had stripped the address, so the kept value was null and the link was never offered
 * (e2e/outreach-company-links.spec.ts, test 5, before the fix). The page now reads the link with a pure initializer
 * (`readSignInLinkFromAddress`) and strips it in an effect (`stripSignInLinkFromAddress`): both passes keep the link.
 */
import { StrictMode, useEffect, useState } from "react";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { readSignInLinkFromAddress, stripSignInLinkFromAddress } from "@/lib/companySignInLink";

function Probe() {
  const [link] = useState(readSignInLinkFromAddress);
  useEffect(() => { stripSignInLinkFromAddress(); }, []);
  return <p data-testid="link">{link ?? "none"}</p>;
}

afterEach(() => { window.history.replaceState(null, "", "/"); });

describe("the emailed link read once and taken out of the address bar in an effect", () => {
  it("is kept without StrictMode's double pass (as in a production build), and the address loses only the link", () => {
    window.history.replaceState(null, "", "/jobs/job-1?link=abc.def&from=q%3Dx#top");
    const view = render(<Probe />);
    expect(view.getByTestId("link").textContent).toBe("abc.def");
    expect(window.location.search).toBe("?from=q%3Dx");
    expect(window.location.hash).toBe("#top");
  });

  it("is kept under StrictMode in development too", () => {
    window.history.replaceState(null, "", "/jobs/job-1?link=abc.def");
    const view = render(<StrictMode><Probe /></StrictMode>);
    expect(view.getByTestId("link").textContent).toBe("abc.def");
    expect(window.location.search).toBe("");
  });

  it("reads nothing when the address has no link", () => {
    window.history.replaceState(null, "", "/jobs/job-1");
    const view = render(<StrictMode><Probe /></StrictMode>);
    expect(view.getByTestId("link").textContent).toBe("none");
  });
});
