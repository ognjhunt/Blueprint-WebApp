// @vitest-environment node
/**
 * Every customer email leaves in one branded layout, built from the plain-text
 * template, and never greets anyone as "there" or points at a dead page.
 */
import { describe, expect, it } from "vitest";

import { brandedEmail, emailGreeting, textToEmailHtml, withTextFooter } from "../utils/emailLayout";

describe("the branded email layout", () => {
  it("turns a labelled link into a button and escapes template text", () => {
    const html = textToEmailHtml("Hi <b>Dana</b>,\n\nOpen your job:\nhttps://tryblueprint.io/capture-upload/abc");
    expect(html).toContain("Hi &lt;b&gt;Dana&lt;/b&gt;,");
    expect(html).toContain('href="https://tryblueprint.io/capture-upload/abc"');
    expect(html).toContain(">Open your job</a>");
    expect(html).not.toContain("Open your job:");
  });

  it("renders dash lines as a list and links inline URLs", () => {
    const html = textToEmailHtml("Missing views:\n\n- the left bench\n- the exit door\n\nSee https://tryblueprint.io/pricing.");
    expect(html).toMatch(/<ul[^>]*><li[^>]*>the left bench<\/li><li[^>]*>the exit door<\/li><\/ul>/);
    expect(html).toMatch(/<a\b[^>]*href="https:\/\/tryblueprint.io\/pricing"/);
  });

  it("gives both parts the same company identity", () => {
    const message = brandedEmail({ subject: "s", text: "Body." });
    expect(message.text).toBe("Body.\n\n--\nBlueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757\nhttps://tryblueprint.io");
    expect(message.html).toContain("Blueprint Robotics, Inc. · 6801 Burnet Rd, Austin, TX 78757");
    expect(withTextFooter(message.text)).toBe(message.text);
  });

  it("keeps the private link and security wording intact in both parts", () => {
    const url = `https://tryblueprint.io/capture-upload/${"signed-token_".repeat(35)}?role=owner&version=1`;
    const text = `It opens your site's job without a password, so please don't forward it.\n\nOpen your job:\n${url}\n\n— The Blueprint team`;
    const message = brandedEmail({ subject: "Your Blueprint job", text });
    expect(message.text).toBe(withTextFooter(text));
    expect(message.html).toContain("without a password, so please don&#39;t forward it.");
    // The visible fallback and button lead to the exact same owner-scoped URL.
    const links = [...message.html.matchAll(/href="([^"]+)"/g)].map(match => match[1]);
    expect(links).toEqual([url.replace(/&/g, "&amp;"), url.replace(/&/g, "&amp;")]);
  });

  it("escapes the visible heading and footer and preserves optional unsubscribe", () => {
    const message = brandedEmail({
      subject: 'Received <script>alert("x")</script>',
      text: "Body.",
      footerNote: "Reply to <ops>.",
      unsubscribeUrl: "https://tryblueprint.io/email-preferences?token=existing&action=unsubscribe",
    });
    expect(message.html).toMatch(/<h1[^>]*>Received &lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;<\/h1>/);
    expect(message.html).not.toContain("<script>");
    expect(message.html).toContain("Reply to &lt;ops&gt;.");
    expect(message.html).toContain('href="https://tryblueprint.io/email-preferences?token=existing&amp;action=unsubscribe"');
    expect(message.html).toContain(">Unsubscribe</a>");
    expect(brandedEmail({ subject: "Receipt", text: "Body." }).html).not.toContain(">Unsubscribe</a>");
  });

  it("keeps sender identity and message readable independently of the logo", () => {
    const message = brandedEmail({ subject: "We received your walkthrough", text: "Your walkthrough arrived safely." });
    const withoutImages = message.html.replace(/<img\b[^>]*>/g, "");
    expect(withoutImages).toMatch(/class="email-wordmark"[^>]*>Blueprint<\/td>/);
    expect(withoutImages).toContain("Your walkthrough arrived safely.");
    expect(withoutImages).toContain("6801 Burnet Rd, Austin, TX 78757");
    expect(message.html).toContain('src="https://tryblueprint.io/brand/email-mark.png" alt="" width="35" height="35"');
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
