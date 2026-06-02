import { ContactForm } from "@/components/site/ContactForm";
import { SEO } from "@/components/SEO";
import { siteWorldCards } from "@/data/siteWorlds";
import { analyticsEvents } from "@/lib/analytics";
import {
  buildCatalogSearchSuggestions,
  classifyCatalogSearch,
  getCatalogLocationLabel,
  type CatalogSearchSuggestion,
} from "@/lib/siteWorldCatalogSearch";
import {
  buildContactRequestUrl,
  CONTACT_REQUEST_PATH_OPTIONS,
  parseContactRequestPrefill,
  requestPathToCommercialRequestPath,
  type ContactRequestPath,
} from "@/lib/contactRequestPrefill";
import {
  ArrowRight,
  Bot,
  HelpCircle,
  MapPin,
  MonitorPlay,
  Package,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocation, useSearch } from "wouter";

type SiteWorld = (typeof siteWorldCards)[number];

const pathIcons = {
  "world-model": Package,
  "hosted-review": MonitorPlay,
  "new-capture": MapPin,
  "site-question": HelpCircle,
} satisfies Record<ContactRequestPath, typeof Package>;

function optionForPath(path: ContactRequestPath) {
  return (
    CONTACT_REQUEST_PATH_OPTIONS.find((option) => option.value === path) ||
    CONTACT_REQUEST_PATH_OPTIONS[0]
  );
}

function clean(value: unknown) {
  return String(value || "").trim();
}

function buildRequestLabel(path: ContactRequestPath, fallback: string) {
  return optionForPath(path)?.cta || fallback;
}

function buildSourceRows(prefill: ReturnType<typeof parseContactRequestPrefill>) {
  return [
    ["Path", optionForPath(prefill.requestPath).label],
    ["Need", prefill.primaryNeed],
    ["Site", prefill.siteName],
    ["Location", prefill.siteLocation],
    ["Site class", prefill.targetSiteType],
    ["Workflow", prefill.workflow || prefill.taskStatement],
    ["Robot", prefill.targetRobotTeam],
    ["Source", prefill.source],
  ].filter(([, value]) => Boolean(value));
}

function suggestionKindLabel(suggestion: CatalogSearchSuggestion) {
  if (suggestion.kind === "site_code") return "site code";
  if (suggestion.kind === "robot_fit") return "robot fit";
  return suggestion.kind.replaceAll("_", " ");
}

function buildContactHref(params: {
  selectedPath: ContactRequestPath;
  query: string;
  selectedSuggestion: CatalogSearchSuggestion | null;
  knownMatch: SiteWorld | null;
  prefill: ReturnType<typeof parseContactRequestPrefill>;
}) {
  const query = clean(params.query);
  const suggestion = params.selectedSuggestion;
  const knownMatch = params.knownMatch;
  const siteName =
    knownMatch?.siteName ||
    params.prefill.siteName ||
    (suggestion?.kind === "site" || suggestion?.kind === "site_code" ? suggestion.label : "") ||
    query;
  const siteLocation =
    knownMatch?.siteAddress ||
    suggestion?.siteLocation ||
    params.prefill.siteLocation ||
    params.prefill.address ||
    query;
  const targetSiteType =
    knownMatch?.industry ||
    suggestion?.targetSiteType ||
    params.prefill.targetSiteType ||
    "";
  const workflow =
    suggestion?.workflow ||
    params.prefill.workflow ||
    (suggestion?.kind === "workflow" || suggestion?.kind === "robot_fit" || suggestion?.kind === "object"
      ? suggestion.value
      : "");
  const taskStatement =
    params.prefill.taskStatement ||
    workflow ||
    (query ? `Request a site/task readiness evaluation for ${query}.` : "");

  return `${buildContactRequestUrl({
    requestPath: params.selectedPath,
    buyerType: optionForPath(params.selectedPath).buyerType,
    source: params.prefill.source || "contact-primary-input",
    query,
    primaryNeed: query,
    siteWorldId: knownMatch?.id || suggestion?.siteId || params.prefill.siteWorldId,
    siteName,
    siteLocation,
    targetSiteType,
    workflow,
    taskStatement,
    targetRobotTeam: params.prefill.targetRobotTeam,
    scenario: params.prefill.scenario,
    requestedOutputs: params.prefill.requestedOutputs,
    message: params.prefill.message,
    proofPathPreference:
      params.prefill.proofPathPreference ||
      (params.selectedPath === "world-model" ? "need_guidance" : "exact_site_required"),
  })}#contact-intake`;
}

export default function Contact() {
  const search = useSearch();
  const [location] = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const prefill = useMemo(
    () => parseContactRequestPrefill(searchParams, location),
    [location, searchParams],
  );
  const [primaryQuery, setPrimaryQuery] = useState(prefill.primaryNeed);
  const [selectedPath, setSelectedPath] = useState<ContactRequestPath>(prefill.requestPath);
  const [selectedSuggestion, setSelectedSuggestion] =
    useState<CatalogSearchSuggestion | null>(null);

  useEffect(() => {
    setPrimaryQuery(prefill.primaryNeed);
    setSelectedPath(prefill.requestPath);
    setSelectedSuggestion(null);
  }, [prefill.primaryNeed, prefill.requestPath]);

  const trimmedQuery = primaryQuery.trim();
  const suggestions = useMemo(
    () => buildCatalogSearchSuggestions(siteWorldCards, primaryQuery, 5),
    [primaryQuery],
  );
  const searchClassification = useMemo(
    () => classifyCatalogSearch(siteWorldCards, primaryQuery, selectedSuggestion),
    [primaryQuery, selectedSuggestion],
  );
  const knownMatch = searchClassification.exactMatches[0] || null;
  const noExactMatch = Boolean(trimmedQuery && searchClassification.noExactMatch);
  const requestHref = buildContactHref({
    selectedPath,
    query: primaryQuery,
    selectedSuggestion,
    knownMatch,
    prefill,
  });
  const selectedOption = optionForPath(selectedPath);
  const sourceRows = buildSourceRows(prefill);
  const hasPrefillContext = Boolean(
    prefill.primaryNeed ||
      prefill.source ||
      prefill.siteWorldId ||
      prefill.message ||
      prefill.scenario ||
      prefill.requestedOutputs,
  );
  const trackContactCta = (
    ctaId: string,
    ctaLabel: string,
    destination: string,
    sourceName: string,
    requestPath: ContactRequestPath = selectedPath,
  ) => {
    analyticsEvents.contactPageCtaClicked({
      persona: optionForPath(requestPath).buyerType,
      ctaId,
      ctaLabel,
      destination,
      source: sourceName,
      requestedLane:
        optionForPath(requestPath).buyerType === "site_operator"
          ? "qualification"
          : "deeper_evaluation",
      commercialRequestPath: requestPathToCommercialRequestPath(requestPath),
    });
  };

  const submitRequest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    trackContactCta(
      "contact_primary_submit",
      buildRequestLabel(selectedPath, "Send request"),
      requestHref,
      "contact-primary-input",
    );
    window.location.href = requestHref;
  };

  return (
    <>
      <SEO
        title="Request A Readiness Evaluation | Blueprint"
        description="Request a Blueprint site/task readiness evaluation, hosted review, new capture, or site/operator access answer by naming a facility, robot task, threshold, or pilot timeline."
        canonical={location === "/contact/site-operator" ? "/contact/site-operator" : "/contact"}
      />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10 bg-white">
          <div className="mx-auto grid min-h-[35rem] max-w-[88rem] items-center gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[0.58fr_0.42fr] lg:px-10">
            <div>
              <h1 className="font-editorial max-w-[46rem] text-[3.25rem] leading-[0.94] tracking-[-0.05em] text-slate-950 sm:text-[5.1rem] sm:tracking-[-0.06em]">
                Request a site/task readiness evaluation.
              </h1>
              <p className="mt-5 max-w-[38rem] text-base leading-8 text-slate-600">
                Name the facility, task, robot stack, threshold, or pilot timeline. Blueprint routes the request to a readiness report, hosted review, new capture, or site-access answer without treating the form as payment, rights clearance, provider execution, or fulfillment.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a
                  href="#contact-intake"
                  className="inline-flex items-center justify-center bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Request readiness evaluation
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
                <a
                  href="/proof"
                  className="inline-flex items-center justify-center border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-50"
                >
                  Inspect proof
                </a>
              </div>

              <form className="mt-8" onSubmit={submitRequest}>
                <label
                  htmlFor="contact-primary-request"
                  className="mb-2 block text-sm font-semibold text-slate-900"
                >
                  What site, task, or robot workflow do you need evaluated?
                </label>
                <div className="grid gap-3 border border-black/10 bg-[#f8f6f1] p-3 sm:grid-cols-[1fr_auto]">
                  <div className="flex min-h-14 items-center gap-3 bg-white px-4">
                    <Search className="h-5 w-5 shrink-0 text-slate-500" />
                    <input
                      id="contact-primary-request"
                      value={primaryQuery}
                      onChange={(event) => {
                        setPrimaryQuery(event.target.value);
                        setSelectedSuggestion(null);
                      }}
                      placeholder="Site, task, robot type, threshold, or pilot workflow"
                      className="min-w-0 flex-1 bg-transparent text-base font-medium text-slate-950 outline-none placeholder:text-slate-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex min-h-14 items-center justify-center bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    {selectedOption.cta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </button>
                </div>
              </form>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {CONTACT_REQUEST_PATH_OPTIONS.map((option) => {
                  const Icon = pathIcons[option.value];
                  const active = selectedPath === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setSelectedPath(option.value);
                        trackContactCta(
                          `contact_path_select_${option.value}`,
                          option.label,
                          option.value,
                          "contact-primary-path-selector",
                          option.value,
                        );
                      }}
                      className={`flex min-h-[5.5rem] items-start gap-3 border px-4 py-3 text-left transition ${
                        active
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-black/10 bg-[#f8f6f1] text-slate-800 hover:bg-white"
                      }`}
                    >
                      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${active ? "text-[#c7a775]" : "text-slate-500"}`} />
                      <span>
                        <span className="block text-sm font-semibold">{option.label}</span>
                        <span className={`mt-1 block text-xs leading-5 ${active ? "text-white/70" : "text-slate-500"}`}>
                          {option.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              {trimmedQuery ? (
                <div className="border border-black/10 bg-[#f8f6f1] p-4">
                  {knownMatch ? (
                    <div className="flex gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-emerald-200 bg-emerald-50 text-emerald-800">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-950">Known catalog match</p>
                        <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-950">
                          {knownMatch.siteName}
                        </h2>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {getCatalogLocationLabel(knownMatch)} / {knownMatch.industry}
                        </p>
                        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                          <a
                            href={`/world-models/${knownMatch.id}`}
                            className="inline-flex items-center justify-center border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                          >
                            Open catalog match
                          </a>
                          <a
                            href={requestHref}
                            onClick={() =>
                              trackContactCta(
                                "contact_known_match_request",
                                selectedOption.cta,
                                requestHref,
                                "contact-known-match",
                              )
                            }
                            className="inline-flex items-center justify-center bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                          >
                            {selectedOption.cta}
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </a>
                        </div>
                      </div>
                    </div>
                  ) : noExactMatch ? (
                    <div className="flex gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-black/10 bg-white text-slate-900">
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-950">
                          No exact-site package in the catalog yet.
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          Send it as a capture request. Blueprint will review the site, workflow, capture path, and proof needed before claiming package access or hosted availability.
                        </p>
                        <a
                          href={requestHref}
                          onClick={() =>
                            trackContactCta(
                              "contact_unknown_location_request",
                              selectedOption.cta,
                              requestHref,
                              "contact-no-exact-match",
                            )
                          }
                          className="mt-4 inline-flex items-center justify-center bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                          {selectedOption.cta}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="border border-black/10 bg-[#f8f6f1] p-5">
                  <Bot className="h-5 w-5 text-slate-950" />
                  <p className="mt-4 text-sm font-semibold text-slate-950">Human and agent friendly</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Use a site name, address, city, site class, workflow, robot task, or threshold. Google Places is optional; catalog-local matching and free text still work.
                  </p>
                </div>
              )}

              {suggestions.length > 0 ? (
                <div className="border border-black/10 bg-white" role="listbox" aria-label="Request suggestions">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      role="option"
                      onClick={() => {
                        setPrimaryQuery(suggestion.value);
                        setSelectedSuggestion(suggestion);
                      }}
                      className="grid w-full gap-2 border-b border-black/10 px-4 py-3 text-left transition last:border-b-0 hover:bg-[#f8f6f1] sm:grid-cols-[1fr_auto]"
                    >
                      <span>
                        <span className="block text-sm font-semibold text-slate-950">{suggestion.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-slate-600">{suggestion.description}</span>
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {suggestionKindLabel(suggestion)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section id="contact-intake" className="mx-auto max-w-[76rem] scroll-mt-8 px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <div className="border border-black/10 bg-white p-5 shadow-[0_20px_60px_-48px_rgba(15,23,42,0.28)] sm:p-6 lg:p-8">
            <div className="mb-7 border-b border-black/10 pb-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Send request
              </p>
              <h2 className="font-editorial mt-2 text-[2.4rem] leading-[0.96] tracking-[-0.05em] text-slate-950 sm:text-[3.2rem]">
                Add contact details and send the request.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                This creates an intake record only. Access, payment, rights clearance, provider execution, fulfillment, and hosted-session launch stay request-specific until the owning proof exists.
              </p>
            </div>

            {hasPrefillContext ? (
              <details className="mb-6 border border-black/10 bg-[#f8f6f1]">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-950">
                  Prefilled request context
                </summary>
                <div className="grid gap-px border-t border-black/10 bg-black/10 sm:grid-cols-2">
                  {sourceRows.map(([label, value]) => (
                    <div key={label} className="bg-white px-4 py-3 text-sm">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
                      <p className="mt-1 text-slate-800">{value}</p>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}

            <ContactForm />
          </div>
        </section>
      </div>
    </>
  );
}
