// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { extractPublishedAddress, FREE_MAIL_DOMAINS, isLinkedInUrl, publishedPeople } from "../agents/communications-contact-evidence";
import { HYPOTHESIS_CONTACT_VERSION, resolveHypothesisContact, verifyHypothesisContactResolution,
  type HypothesisPersonEvidence } from "../agents/communications-contact-resolution";
import { communicationsDigest } from "../agents/communications-contract";
import type { ContactPage } from "../agents/communications-contact-fetch";

// Owner decision 2026-10-05 (contact sources), on invented operators and *.example hosts only.
const NOW = Date.parse("2026-10-05T16:00:00Z");
const OPERATOR = "https://sorting-operator.example";
const page = (url: string, body: string): ContactPage => ({ requestedUrl: url, finalUrl: url, redirects: [],
  checkedAt: new Date(NOW).toISOString(), status: 200, contentType: "text/html; charset=utf-8", bodyBase64: Buffer.from(body).toString("base64") });
const TEAM = "<p>Synthetic Sorting Co operations team for sorting returned parcels: sortingops@sorting-operator.example</p>";
const NEWS: HypothesisPersonEvidence = { url: "https://news.example/synthetic-sorting-story", checkedAt: "2026-10-05T11:00:00+00:00",
  quote: "Synthetic Person, operations manager at Synthetic sorting site, said returned parcels are sorted each morning.",
  level: "in_citation_excerpt", toolResultSha256: "d".repeat(64) };

function source(mutate: (candidate: any) => void = () => undefined) {
  const candidate: any = { candidate_key: "synthetic-hypothesis", organization: "Synthetic Sorting Co", organization_url: OPERATOR,
    site: "Synthetic sorting site", location: "Testville, Example State", task: "sorting returned parcels", unknowns: [],
    evidence: [{ role: "task", url: `${OPERATOR}/sorting`, classification: "operator", claim_kind: "fact",
      claim: "The operator sorts returned parcels at its synthetic site", quote: "Returned parcels are sorted at the synthetic site" }] };
  mutate(candidate);
  return { candidate, date: "2026-10-05", runKey: "blueprint-researcher:2026-10-05", packetDigest: "a".repeat(64),
    rawArtifactDigest: "b".repeat(64), qaArtifactDigest: "c".repeat(64), researchReview: { reviewer_reference: "agent-turn:synthetic:qa" },
    sheetsId: "synthetic-sheet", sheetsProspectId: "BP-000043" };
}
/** A reader that serves the operator's contact page and its landing page, and fails for anything else. */
function reader(contactBody: string) {
  return vi.fn(async (url: string) => {
    if (url === `${OPERATOR}/contact`) return page(url, contactBody);
    if (new URL(url).hostname === "sorting-operator.example") return page(url, `<p>Synthetic Sorting Co</p><a href="${OPERATOR}/contact">Contact</a>`);
    throw new Error("contact_fetch_page_unavailable");
  });
}
const resolve = (contactBody: string, evidence: HypothesisPersonEvidence[] = [NEWS], value = source()) =>
  resolveHypothesisContact(value, "prospect-hypothesis", reader(contactBody), () => NOW, evidence);

describe("hypothesis contacts follow the owner's 2026-10-05 contact rules (synthetic)", () => {
  it("takes a named person from a news story and addresses whoever runs the task through the operator's team inbox", async () => {
    const proof = await resolve(TEAM);
    expect(proof).toMatchObject({ version: HYPOTHESIS_CONTACT_VERSION, contact: { email: "sortingops@sorting-operator.example",
      route: "team_inbox", sourceUrl: `${OPERATOR}/contact` },
      person: { name: "Synthetic Person", role: "operations manager", sourceUrl: NEWS.url, level: "in_citation_excerpt" },
      addressIsPersonal: false });
    const verified = verifyHypothesisContactResolution(proof, source(), "prospect-hypothesis", [NEWS]);
    expect(verified).toMatchObject({ email: "sortingops@sorting-operator.example", kind: "public_source_resolution",
      evidenceDigest: communicationsDigest(proof), recipient: { kind: "inbox",
        addressee: "whoever runs sorting returned parcels at Synthetic sorting site",
        person: { name: "Synthetic Person", role: "operations manager", sourceUrl: NEWS.url } } });
  });
  it("greets a person by name only when the operator publishes their own address beside their name", async () => {
    const own = "<p>Synthetic Person, Manager, oversees sorting returned parcels at Synthetic sorting site: synthetic.person@sorting-operator.example</p>";
    const proof = await resolve(own + TEAM);
    expect(proof).toMatchObject({ contact: { email: "synthetic.person@sorting-operator.example", route: "named_person" },
      person: { name: "Synthetic Person", role: "Manager", sourceUrl: `${OPERATOR}/contact`, level: "fresh_operator_page" }, addressIsPersonal: true });
    expect(verifyHypothesisContactResolution(proof, source(), "prospect-hypothesis", [NEWS]).recipient)
      .toEqual({ kind: "named_person", name: "Synthetic Person", role: "Manager", sourceUrl: `${OPERATOR}/contact` });
    // A role inbox beside a name is still an inbox: the address is not the person's own.
    const beside = await resolve("<p>Synthetic Person, Manager, oversees sorting returned parcels at Synthetic sorting site: sortingops@sorting-operator.example</p>");
    expect(beside).toMatchObject({ addressIsPersonal: false, contact: { email: "sortingops@sorting-operator.example" } });
  });
  it("still ranks a title with no stated responsibility below a team inbox", async () => {
    const titleOnly = "<p>Synthetic Person, Director, synthetic.person@sorting-operator.example</p>";
    expect((await resolve(titleOnly + TEAM)).contact.email).toBe("sortingops@sorting-operator.example");
    expect((await resolve(TEAM + titleOnly)).contact.email).toBe("sortingops@sorting-operator.example");
    // Alone, the published personal address is used, and it is the person's own.
    expect(await resolve(titleOnly)).toMatchObject({ contact: { email: "synthetic.person@sorting-operator.example", route: "named_person" },
      addressIsPersonal: true });
  });
  it.each<[string, string, string]>([
    ["guessed from a name pattern (never published)", "<p>Synthetic Person, Director of Operations</p>", "contact_resolution_missing_or_ambiguous"],
    ["on a free-mail domain", "<p>Synthetic Person, Director of Operations: synthetic.person@gmail.com</p>", "contact_resolution_missing_or_ambiguous"],
    ["on another organization's domain", "<p>Operations team for sorting returned parcels: ops@another-operator.example</p>", "contact_resolution_missing_or_ambiguous"],
  ])("refuses an address %s", async (_name, body, code) => {
    await expect(resolve(body)).rejects.toThrow(code);
  });
  it.each<[string, string, string]>([
    ["a free-mail address", "Synthetic Person, Director of Operations: synthetic.person@gmail.com", "contact_address_free_mail_refused"],
    ["another domain", "Operations team: ops@another-operator.example", "contact_address_other_domain_refused"],
    ["a lookalike domain", "Operations team: ops@sorting-operator.example.evil.example", "contact_address_other_domain_refused"],
    ["two addresses in one segment", "Write to ops@sorting-operator.example or sales@sorting-operator.example", "contact_address_not_published_once"],
    ["a careers inbox", "Careers: talent@sorting-operator.example", "contact_address_restricted_route"],
    ["a jobs local part", "Write to jobs@sorting-operator.example", "contact_address_restricted_route"],
    ["a legal inbox", "Legal notices: legal@sorting-operator.example", "contact_address_restricted_route"],
    ["a privacy inbox", "Privacy requests: privacy@sorting-operator.example", "contact_address_restricted_route"],
    ["a support inbox", "Customer support only: help@sorting-operator.example", "contact_address_restricted_route"],
    ["a do-not-contact notice", "No unsolicited email please: ops@sorting-operator.example", "contact_address_restricted_route"],
  ])("extracts no address from %s", (_name, quote, code) => {
    expect(() => extractPublishedAddress(quote, source().candidate, `${OPERATOR}/contact`)).toThrow(code);
  });
  it("lists the common free-mail providers and accepts the operator's own domain and subdomains", () => {
    for (const domain of ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "proton.me", "aol.com"]) expect(FREE_MAIL_DOMAINS.has(domain)).toBe(true);
    expect(extractPublishedAddress("Operations team: ops@sorting-operator.example", source().candidate, `${OPERATOR}/contact`))
      .toEqual({ email: "ops@sorting-operator.example", press: false });
    expect(extractPublishedAddress("Operations team: ops@mail.sorting-operator.example", source().candidate, `https://www.sorting-operator.example/team`))
      .toEqual({ email: "ops@mail.sorting-operator.example", press: false });
    expect(() => extractPublishedAddress("Operations team: ops@sorting-operator.example", source().candidate, "https://news.example/story"))
      .toThrow("contact_address_page_not_operator_domain");
  });
  it("ranks a press inbox as a general inbox: below a team inbox, used only when nothing better is published", async () => {
    const press = "<p>Press and media inquiries: press@sorting-operator.example</p>";
    expect((await resolve(press + TEAM)).contact.email).toBe("sortingops@sorting-operator.example");
    expect(await resolve(press)).toMatchObject({ contact: { email: "press@sorting-operator.example", route: "general_inbox" } });
  });
  it("never takes LinkedIn as evidence for a person or an address", async () => {
    for (const url of ["https://www.linkedin.com/in/synthetic-person", "https://linkedin.com/company/synthetic", "https://lnkd.in/abc",
      "https://uk.linkedin.com/in/synthetic-person"]) expect(isLinkedInUrl(url)).toBe(true);
    for (const url of ["https://news.example/story", "https://notlinkedin.com/in/x", "not a url"]) expect(isLinkedInUrl(url)).toBe(false);
    const linkedin = { ...NEWS, url: "https://www.linkedin.com/in/synthetic-person" };
    const proof = await resolve(TEAM, [linkedin]);
    expect(proof.person).toBeNull();
    expect(verifyHypothesisContactResolution(proof, source(), "prospect-hypothesis", [linkedin]).recipient)
      .toEqual({ kind: "inbox", addressee: "whoever runs sorting returned parcels at Synthetic sorting site", person: null });
    // A proof that binds a LinkedIn person source is refused outright.
    const forged = structuredClone(await resolve(TEAM));
    forged.person!.sourceUrl = linkedin.url;
    expect(() => verifyHypothesisContactResolution(forged, source(), "prospect-hypothesis", [NEWS])).toThrow("contact_source_linkedin_refused");
    // An operator recorded by its LinkedIn page has no own domain to publish an address on.
    await expect(resolve(TEAM, [NEWS], source(candidate => { candidate.organization_url = "https://www.linkedin.com/company/synthetic"; })))
      .rejects.toThrow("contact_source_linkedin_refused");
  });
  it("refuses a proof whose address, person or pages changed after resolution", async () => {
    const proof = await resolve(TEAM);
    const guessed = structuredClone(proof);
    guessed.contact.email = "synthetic.person@sorting-operator.example";
    expect(() => verifyHypothesisContactResolution(guessed, source(), "prospect-hypothesis", [NEWS])).toThrow("contact_resolution_extraction_changed");
    const renamed = structuredClone(proof);
    renamed.person!.role = "plant director";
    expect(() => verifyHypothesisContactResolution(renamed, source(), "prospect-hypothesis", [NEWS])).toThrow("contact_resolution_person_changed");
    // The person's research evidence must still prove the quote.
    expect(() => verifyHypothesisContactResolution(proof, source(), "prospect-hypothesis", [])).toThrow("contact_resolution_person_changed");
    const edited = structuredClone(proof);
    edited.pages[0].bodyBase64 = Buffer.from(TEAM.replace("sortingops", "other")).toString("base64");
    expect(() => verifyHypothesisContactResolution(edited, source(), "prospect-hypothesis", [NEWS])).toThrow();
  });
  it("reads people only from a quoted 'Name, role' pair and refuses ambiguity", () => {
    expect(publishedPeople(NEWS.quote)).toEqual([{ name: "Synthetic Person", role: "operations manager" }]);
    expect(publishedPeople("Synthetic Person, Director of Operations, synthetic.person@sorting-operator.example"))
      .toEqual([{ name: "Synthetic Person", role: "Director of Operations" }]);
    expect(publishedPeople("Returned parcels are sorted by hand at the synthetic site.")).toEqual([]);
    expect(publishedPeople("Synthetic Sorting, a parcel company, sorts returned parcels.")).toEqual([]);
  });
});
