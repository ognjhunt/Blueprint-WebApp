// @vitest-environment node
/**
 * Every customer email leaves in one branded layout, built from the plain-text
 * template, and never greets anyone as "there" or points at a dead page.
 */
import { describe, expect, it } from "vitest";

import { brandedEmail, emailGreeting, textToEmailHtml, withTextFooter } from "../utils/emailLayout";

describe("the branded email layout", () => {
  it("turns a labelled link into a button and escapes template text", () => {
    const html = textToEmailHtml("Hi <b>Dana</b>,\n\nOpen your task:\nhttps://tryblueprint.io/capture-upload/abc");
    expect(html).toContain("Hi &lt;b&gt;Dana&lt;/b&gt;,");
    expect(html).toContain('href="https://tryblueprint.io/capture-upload/abc"');
    expect(html).toContain(">Open your task</a>");
    expect(html).not.toContain("Open your task:");
  });

  it("renders dash lines as a list and links inline URLs", () => {
    const html = textToEmailHtml("Missing views:\n\n- the left bench\n- the exit door\n\nSee https://tryblueprint.io/pricing.");
    expect(html).toMatch(/<ul[^>]*><li[^>]*>the left bench<\/li><li[^>]*>the exit door<\/li><\/ul>/);
    expect(html).toContain('<a href="https://tryblueprint.io/pricing"');
  });

  it("gives both parts the same company identity", () => {
    const message = brandedEmail({ subject: "s", text: "Body." });
    expect(message.text).toBe("Body.\n\n--\nBlueprint Robotics, Inc. · 1005 Crete St, Durham, NC 27707\nhttps://tryblueprint.io");
    expect(message.html).toContain("Blueprint Robotics, Inc. · 1005 Crete St, Durham, NC 27707");
    expect(withTextFooter(message.text)).toBe(message.text);
  });

  it("never greets anyone by a placeholder", () => {
    expect(emailGreeting("Dana Smith")).toBe("Hi Dana,");
    expect(emailGreeting("there")).toBe("Hi,");
    expect(emailGreeting("")).toBe("Hi,");
    expect(emailGreeting(null)).toBe("Hi,");
  });
});

describe("the request confirmation", () => {
  it("is plain, links only to live pages, and carries no internal terms", async () => {
    const { requestConfirmationText } = await import("../routes/inbound-request");
    for (const buyerType of ["robot_team", "site_operator"]) {
      const text = requestConfirmationText({ firstName: "", buyerType });
      expect(text.startsWith("Hi,\n")).toBe(true);
      expect(text).toContain("https://tryblueprint.io/how-it-works");
      expect(text).not.toMatch(/\/product|\/proof|provider execution|rights clearance|boundar|there,/i);
    }
  });
});
