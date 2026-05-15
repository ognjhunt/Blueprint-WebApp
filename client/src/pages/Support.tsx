import { useMemo, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CreditCard,
  FileQuestion,
  LifeBuoy,
  Mail,
  PackageOpen,
  PlayCircle,
  Rocket,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Wrench,
} from "lucide-react";

import { SEO } from "@/components/SEO";
import {
  EditorialSectionLabel,
  MonochromeMedia,
  ProofChip,
  RouteTraceOverlay,
} from "@/components/site/editorial";
import {
  getArticlesForCategory,
  getFeaturedArticles,
  getHelpArticle,
  getHelpCategory,
  getHelpCategoryForArticle,
  helpArticles,
  helpCategories,
  type HelpArticle,
  type HelpCategory,
} from "@/data/helpCenter";
import { editorialRefreshAssets } from "@/lib/editorialRefreshAssets";
import { cn } from "@/lib/utils";

type SupportProps = {
  params?: {
    articleSlug?: string;
    categorySlug?: string;
  };
};

const iconByKey: Record<HelpCategory["iconKey"], LucideIcon> = {
  rocket: Rocket,
  package: PackageOpen,
  play: PlayCircle,
  shield: ShieldCheck,
  credit: CreditCard,
  tool: Wrench,
};

const supportPacketFields = [
  "Your name and work email",
  "Organization and role",
  "Page, package, session, or request URL",
  "What you expected to happen",
  "What happened instead",
  "Deadline or review date, if urgent",
];

function articleHref(article: Pick<HelpArticle, "slug">) {
  return `/help/article/${article.slug}`;
}

function categoryHref(category: Pick<HelpCategory, "slug">) {
  return `/help/category/${category.slug}`;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function matchArticle(article: HelpArticle, query: string) {
  const haystack = [
    article.title,
    article.description,
    article.summary,
    ...article.sections.flatMap((section) => [
      section.heading,
      section.body,
      ...(section.bullets || []),
    ]),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function HelpSearch({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalize(query);
  const results = useMemo(() => {
    if (!normalizedQuery) return getFeaturedArticles();
    return helpArticles.filter((article) => matchArticle(article, normalizedQuery)).slice(0, 8);
  }, [normalizedQuery]);

  return (
    <div className={cn("border border-black/10 bg-white", className)}>
      <label className="sr-only" htmlFor={compact ? "help-search-compact" : "help-search"}>
        Search support
      </label>
      <div className="flex min-h-14 items-center border-b border-black/10 px-4">
        <Search className="mr-3 h-5 w-5 text-slate-400" />
        <input
          id={compact ? "help-search-compact" : "help-search"}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search support"
          className="min-h-12 w-full bg-transparent text-base font-medium text-slate-950 outline-none placeholder:text-slate-400"
        />
      </div>
      <div className={cn("grid gap-px bg-black/10", compact ? "max-h-[22rem] overflow-auto" : "")}>
        {results.length ? (
          results.map((article) => {
            const category = getHelpCategory(article.categorySlug);
            return (
              <a
                key={article.slug}
                href={articleHref(article)}
                className="group grid gap-3 bg-white p-4 transition hover:bg-[#f5f3ef] sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <span>
                  <span className="block text-sm font-semibold text-slate-950">
                    {article.title}
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-slate-600">
                    {article.description}
                  </span>
                </span>
                <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {category?.shortTitle || "Article"}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </a>
            );
          })
        ) : (
          <div className="bg-white p-5">
            <p className="text-sm font-semibold text-slate-950">No exact match.</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Try package access, hosted evaluation, capture rules, billing, or runtime issue.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function CrumbTrail({
  items,
}: {
  items: Array<{ label: string; href?: string }>;
}) {
  return (
    <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-500" aria-label="Breadcrumb">
      <a href="/help" className="font-semibold text-slate-700 transition hover:text-slate-950">
        Help
      </a>
      {items.map((item) => (
        <span key={`${item.label}-${item.href || "current"}`} className="inline-flex items-center gap-2">
          <span className="text-slate-300">/</span>
          {item.href ? (
            <a href={item.href} className="font-semibold text-slate-700 transition hover:text-slate-950">
              {item.label}
            </a>
          ) : (
            <span className="text-slate-500">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

function PageFrame({
  children,
  canonical,
  description,
  title,
  type = "website",
}: {
  children: ReactNode;
  canonical: string;
  description: string;
  title: string;
  type?: "website" | "article";
}) {
  return (
    <>
      <SEO title={title} description={description} canonical={canonical} type={type} />
      <div className="bg-[#f5f3ef] text-slate-950">{children}</div>
    </>
  );
}

function HelpHome() {
  const featured = getFeaturedArticles();

  return (
    <PageFrame
      title="Blueprint Help Center"
      description="Search Blueprint support for exact-site packages, hosted evaluation, capture provenance, billing, access, and troubleshooting."
      canonical="/help"
    >
      <section className="border-b border-black/10 bg-slate-950 text-white">
        <div className="mx-auto grid max-w-[96rem] gap-px bg-white/10 lg:grid-cols-[0.62fr_0.38fr]">
          <div className="bg-slate-950 px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
            <EditorialSectionLabel light>Blueprint support</EditorialSectionLabel>
            <h1 className="font-editorial mt-6 max-w-[10ch] text-[clamp(4rem,10vw,8.7rem)] leading-[0.84] tracking-[-0.08em]">
              Help Center
            </h1>
            <p className="mt-7 max-w-[38rem] text-base leading-8 text-white/72">
              Find the right route for world-model packages, hosted evaluation, capture
              provenance, billing, access, and runtime issues.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="/help/contact"
                className="inline-flex min-h-12 items-center justify-center bg-white px-6 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
              >
                Contact support
              </a>
              <a
                href="/world-models"
                className="inline-flex min-h-12 items-center justify-center border border-white/20 px-6 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Browse world models
              </a>
            </div>
          </div>

          <div className="relative min-h-[32rem] overflow-hidden bg-[#111111]">
            <MonochromeMedia
              src={editorialRefreshAssets.helpScopingRoom}
              alt="Blueprint support workspace"
              className="absolute inset-0 h-full rounded-none"
              imageClassName="h-full object-cover"
              overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.16),rgba(0,0,0,0.74))]"
              loading="eager"
            />
            <RouteTraceOverlay className="opacity-55" />
            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
              <div className="border border-white/15 bg-black/42 p-5 backdrop-blur-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
                  Support packet
                </p>
                <div className="mt-5 grid gap-2">
                  {supportPacketFields.slice(0, 4).map((item) => (
                    <div key={item} className="flex items-center justify-between border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/76">
                      <span>{item}</span>
                      <CheckCircle2 className="h-4 w-4 text-white/45" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[96rem] px-5 py-6 sm:px-8 lg:px-10">
        <HelpSearch />
      </section>

      <section className="mx-auto max-w-[96rem] px-5 pb-10 sm:px-8 lg:px-10">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <EditorialSectionLabel>Browse by topic</EditorialSectionLabel>
            <h2 className="font-editorial mt-3 text-4xl leading-none tracking-[-0.05em] text-slate-950 sm:text-[3.4rem]">
              The support map.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-7 text-slate-600">
            Support is organized around the real paths buyers, capturers, and
            operators use: packages, hosted sessions, provenance, billing, and access.
          </p>
        </div>

        <div className="grid gap-px overflow-hidden border border-black/10 bg-black/10 md:grid-cols-2 xl:grid-cols-3">
          {helpCategories.map((category) => {
            const Icon = iconByKey[category.iconKey];
            const articles = getArticlesForCategory(category.slug);
            return (
              <a
                key={category.slug}
                href={categoryHref(category)}
                className="group flex min-h-[20rem] flex-col justify-between bg-white p-5 transition hover:bg-[#fbfaf7] sm:p-6"
              >
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex h-11 w-11 items-center justify-center border border-black/10 bg-[#f5f3ef] text-slate-700">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-semibold text-slate-400">
                      {articles.length} articles
                    </span>
                  </div>
                  <h3 className="font-editorial mt-7 text-[2.6rem] leading-[0.94] tracking-[-0.06em] text-slate-950">
                    {category.title}
                  </h3>
                  <p className="mt-4 text-sm leading-7 text-slate-600">
                    {category.description}
                  </p>
                </div>
                <div className="mt-8 flex items-center justify-between border-t border-black/10 pt-4 text-sm font-semibold text-slate-950">
                  <span>{category.audience}</span>
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </div>
              </a>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-[96rem] px-5 pb-10 sm:px-8 lg:px-10">
        <div className="grid gap-3 lg:grid-cols-[0.36fr_0.64fr]">
          <div className="bg-slate-950 p-6 text-white sm:p-8">
            <Sparkles className="h-6 w-6 text-white/62" />
            <h2 className="font-editorial mt-6 text-[2.7rem] leading-[0.94] tracking-[-0.06em]">
              Popular articles.
            </h2>
            <p className="mt-4 text-sm leading-7 text-white/70">
              Start here when the blocker is access, package scope, hosted
              evaluation, or what to send support.
            </p>
          </div>
          <div className="grid gap-px border border-black/10 bg-black/10 md:grid-cols-2">
            {featured.map((article) => (
              <a
                key={article.slug}
                href={articleHref(article)}
                className="group bg-white p-5 transition hover:bg-[#fbfaf7]"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {getHelpCategory(article.categorySlug)?.title}
                </p>
                <h3 className="mt-4 text-lg font-semibold leading-tight text-slate-950">
                  {article.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {article.description}
                </p>
                <span className="mt-5 inline-flex items-center text-sm font-semibold text-slate-950">
                  Read article
                  <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <StillNeedHelpBand />
    </PageFrame>
  );
}

function CategoryPage({ category }: { category: HelpCategory }) {
  const Icon = iconByKey[category.iconKey];
  const articles = getArticlesForCategory(category.slug);

  return (
    <PageFrame
      title={`${category.title} Help`}
      description={category.description}
      canonical={categoryHref(category)}
    >
      <section className="mx-auto max-w-[96rem] px-5 py-8 sm:px-8 lg:px-10">
        <CrumbTrail items={[{ label: category.title }]} />
      </section>

      <section className="border-y border-black/10 bg-white">
        <div className="mx-auto grid max-w-[96rem] gap-px bg-black/10 lg:grid-cols-[0.62fr_0.38fr]">
          <div className="bg-white px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
            <span className="inline-flex h-12 w-12 items-center justify-center border border-black/10 bg-[#f5f3ef] text-slate-700">
              <Icon className="h-6 w-6" />
            </span>
            <h1 className="font-editorial mt-6 max-w-[12ch] text-[clamp(3.6rem,8vw,7.2rem)] leading-[0.84] tracking-[-0.08em] text-slate-950">
              {category.title}
            </h1>
            <p className="mt-7 max-w-[38rem] text-base leading-8 text-slate-600">
              {category.description}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={category.primaryActionHref}
                className="inline-flex min-h-12 items-center justify-center bg-slate-950 px-6 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                {category.primaryActionLabel}
              </a>
              <a
                href="/help/contact"
                className="inline-flex min-h-12 items-center justify-center border border-black/10 px-6 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Contact support
              </a>
            </div>
          </div>
          <div className="bg-slate-950 p-5 text-white sm:p-6 lg:p-8">
            <HelpSearch compact />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[96rem] px-5 py-10 sm:px-8 lg:px-10">
        <div className="grid gap-3 lg:grid-cols-[0.28fr_0.72fr]">
          <aside className="bg-slate-950 p-6 text-white lg:sticky lg:top-24 lg:self-start">
            <EditorialSectionLabel light>In this section</EditorialSectionLabel>
            <p className="font-editorial mt-5 text-[2.4rem] leading-[0.94] tracking-[-0.06em]">
              {articles.length} articles
            </p>
            <p className="mt-4 text-sm leading-7 text-white/70">
              {category.audience}
            </p>
          </aside>

          <div className="grid gap-px overflow-hidden border border-black/10 bg-black/10">
            {articles.map((article) => (
              <a
                key={article.slug}
                href={articleHref(article)}
                className="group grid gap-5 bg-white p-5 transition hover:bg-[#fbfaf7] md:grid-cols-[1fr_auto] md:items-center sm:p-6"
              >
                <span>
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {article.readTime} read
                  </span>
                  <span className="mt-3 block text-xl font-semibold leading-tight text-slate-950">
                    {article.title}
                  </span>
                  <span className="mt-3 block max-w-3xl text-sm leading-7 text-slate-600">
                    {article.description}
                  </span>
                </span>
                <span className="inline-flex h-11 w-11 items-center justify-center border border-black/10 text-slate-600 transition group-hover:border-slate-950 group-hover:text-slate-950">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <StillNeedHelpBand />
    </PageFrame>
  );
}

function ArticlePage({ article }: { article: HelpArticle }) {
  const category = getHelpCategoryForArticle(article);
  const categoryArticles = category ? getArticlesForCategory(category.slug) : [];
  const related = (article.relatedArticleSlugs || [])
    .map((slug) => getHelpArticle(slug))
    .filter((item): item is HelpArticle => Boolean(item));

  return (
    <PageFrame
      title={`${article.title} | Blueprint Help`}
      description={article.description}
      canonical={articleHref(article)}
      type="article"
    >
      <section className="mx-auto max-w-[96rem] px-5 py-8 sm:px-8 lg:px-10">
        <CrumbTrail
          items={[
            ...(category ? [{ label: category.title, href: categoryHref(category) }] : []),
            { label: article.title },
          ]}
        />
      </section>

      <section className="mx-auto max-w-[96rem] px-5 pb-10 sm:px-8 lg:px-10">
        <div className="grid gap-4 lg:grid-cols-[0.26fr_0.74fr]">
          <aside className="order-2 lg:order-1 lg:sticky lg:top-24 lg:self-start">
            <div className="border border-black/10 bg-white">
              <div className="border-b border-black/10 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {category?.title || "Help"}
                </p>
              </div>
              <nav className="grid gap-px bg-black/10">
                {categoryArticles.map((item) => (
                  <a
                    key={item.slug}
                    href={articleHref(item)}
                    className={cn(
                      "bg-white px-4 py-3 text-sm font-semibold leading-6 transition hover:bg-[#f5f3ef]",
                      item.slug === article.slug ? "text-slate-950" : "text-slate-500",
                    )}
                  >
                    {item.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          <article className="order-1 border border-black/10 bg-white lg:order-2">
            <header className="border-b border-black/10 p-6 sm:p-8 lg:p-10">
              <div className="mb-6 flex flex-wrap gap-2">
                {category ? <ProofChip>{category.shortTitle}</ProofChip> : null}
                <ProofChip>{article.readTime}</ProofChip>
                <ProofChip>Updated {article.lastUpdated}</ProofChip>
              </div>
              <h1 className="font-editorial max-w-[13ch] text-[clamp(3.2rem,7vw,6.5rem)] leading-[0.85] tracking-[-0.08em] text-slate-950">
                {article.title}
              </h1>
              <p className="mt-7 max-w-[42rem] text-lg leading-8 text-slate-600">
                {article.summary}
              </p>
            </header>

            <div className="grid gap-px bg-black/10">
              {article.sections.map((section) => (
                <section key={section.heading} className="bg-white p-6 sm:p-8 lg:p-10">
                  <h2 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                    {section.heading}
                  </h2>
                  <p className="mt-4 max-w-[46rem] text-base leading-8 text-slate-600">
                    {section.body}
                  </p>
                  {section.bullets?.length ? (
                    <ul className="mt-6 grid gap-3">
                      {section.bullets.map((bullet) => (
                        <li key={bullet} className="flex gap-3 text-sm leading-7 text-slate-600">
                          <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}
            </div>

            <footer className="grid gap-5 border-t border-black/10 bg-[#f5f3ef] p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center lg:p-10">
              <div>
                <p className="text-lg font-semibold text-slate-950">Still blocked?</p>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
                  Send support the page URL, package or request id if known, expected outcome,
                  and the exact blocker.
                </p>
              </div>
              <a
                href="/help/contact"
                className="inline-flex min-h-12 items-center justify-center bg-slate-950 px-6 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Contact support
              </a>
            </footer>
          </article>
        </div>
      </section>

      {related.length ? (
        <section className="mx-auto max-w-[96rem] px-5 pb-10 sm:px-8 lg:px-10">
          <div className="mb-4 flex items-end justify-between gap-4">
            <EditorialSectionLabel>Related</EditorialSectionLabel>
            <a href="/help" className="text-sm font-semibold text-slate-700 hover:text-slate-950">
              Back to help
            </a>
          </div>
          <div className="grid gap-px border border-black/10 bg-black/10 md:grid-cols-3">
            {related.map((item) => (
              <a key={item.slug} href={articleHref(item)} className="group bg-white p-5 transition hover:bg-[#fbfaf7]">
                <BookOpen className="h-5 w-5 text-slate-400" />
                <p className="mt-4 text-base font-semibold leading-tight text-slate-950">
                  {item.title}
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {item.description}
                </p>
                <span className="mt-5 inline-flex items-center text-sm font-semibold text-slate-950">
                  Read
                  <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </PageFrame>
  );
}

function ContactSupportPage() {
  const mailtoHref =
    "mailto:hello@tryblueprint.io?subject=Blueprint%20Support%20Request&body=Name%3A%0AWork%20email%3A%0AOrganization%3A%0APage%20or%20package%20URL%3A%0AExpected%20outcome%3A%0AActual%20blocker%3A%0AUrgency%3A";

  return (
    <PageFrame
      title="Contact Blueprint Support"
      description="Send Blueprint support the packet needed to route buyer, package, hosted-evaluation, capture, billing, and access issues."
      canonical="/help/contact"
    >
      <section className="mx-auto max-w-[96rem] px-5 py-8 sm:px-8 lg:px-10">
        <CrumbTrail items={[{ label: "Contact support" }]} />
      </section>

      <section className="border-y border-black/10 bg-white">
        <div className="mx-auto grid max-w-[96rem] gap-px bg-black/10 lg:grid-cols-[0.58fr_0.42fr]">
          <div className="bg-white px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
            <EditorialSectionLabel>Support packet</EditorialSectionLabel>
            <h1 className="font-editorial mt-6 max-w-[11ch] text-[clamp(3.8rem,8vw,7.5rem)] leading-[0.84] tracking-[-0.08em] text-slate-950">
              Still need help?
            </h1>
            <p className="mt-7 max-w-[38rem] text-base leading-8 text-slate-600">
              Send the context Blueprint needs to route the issue to buyer support,
              hosted evaluation, capture review, billing, or access repair without
              guessing.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={mailtoHref}
                className="inline-flex min-h-12 items-center justify-center bg-slate-950 px-6 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <Mail className="mr-2 h-4 w-4" />
                Email support
              </a>
              <a
                href="/contact?persona=robot-team"
                className="inline-flex min-h-12 items-center justify-center border border-black/10 px-6 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Buyer contact
              </a>
            </div>
          </div>

          <div className="bg-slate-950 p-6 text-white sm:p-8">
            <LifeBuoy className="h-6 w-6 text-white/62" />
            <h2 className="font-editorial mt-6 text-[2.7rem] leading-[0.94] tracking-[-0.06em]">
              Include these fields.
            </h2>
            <div className="mt-7 grid gap-2">
              {supportPacketFields.map((field) => (
                <div key={field} className="flex items-center justify-between border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/78">
                  <span>{field}</span>
                  <CheckCircle2 className="h-4 w-4 text-white/45" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[96rem] px-5 py-10 sm:px-8 lg:px-10">
        <div className="grid gap-px border border-black/10 bg-black/10 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              icon: PackageOpen,
              title: "Package or hosted access",
              body: "Send the package, session, or workspace URL and the account email that should have access.",
              href: "/help/article/missing-package-access",
            },
            {
              icon: PlayCircle,
              title: "Hosted runtime issue",
              body: "Send browser, timestamp, session URL, screenshot, visible diagnostic, and the action that failed.",
              href: "/help/article/report-a-runtime-issue",
            },
            {
              icon: ShieldCheck,
              title: "Rights or provenance",
              body: "Send the package, capture field, label in question, and why it affects buyer use.",
              href: "/help/article/rights-privacy-and-consent",
            },
            {
              icon: CreditCard,
              title: "Billing or procurement",
              body: "Send organization, billing contact, package or scope, and any invoice or vendor form needs.",
              href: "/help/article/checkout-and-invoices",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <a key={item.title} href={item.href} className="group bg-white p-5 transition hover:bg-[#fbfaf7]">
                <Icon className="h-5 w-5 text-slate-400" />
                <h2 className="mt-5 text-lg font-semibold leading-tight text-slate-950">
                  {item.title}
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {item.body}
                </p>
                <span className="mt-5 inline-flex items-center text-sm font-semibold text-slate-950">
                  Read guide
                  <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </a>
            );
          })}
        </div>
      </section>

      <StillNeedHelpBand compact />
    </PageFrame>
  );
}

function MissingHelpPage({
  mode,
}: {
  mode: "category" | "article";
}) {
  return (
    <PageFrame
      title="Help page not found"
      description="The requested Blueprint help page could not be found."
      canonical="/help"
      type="website"
    >
      <section className="mx-auto max-w-[88rem] px-5 py-12 sm:px-8 lg:px-10">
        <div className="border border-black/10 bg-white p-8 sm:p-10">
          <FileQuestion className="h-8 w-8 text-slate-400" />
          <h1 className="font-editorial mt-6 text-[clamp(3rem,7vw,5.8rem)] leading-[0.86] tracking-[-0.08em] text-slate-950">
            Help page not found.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
            That {mode} is not in the current help center. Search support or go back to the
            help hub.
          </p>
          <div className="mt-8 grid gap-4 lg:grid-cols-[0.62fr_0.38fr]">
            <HelpSearch compact />
            <div className="bg-slate-950 p-6 text-white">
              <SlidersHorizontal className="h-6 w-6 text-white/62" />
              <p className="mt-5 text-sm leading-7 text-white/70">
                The fastest support route is still the packet: page URL, expected outcome,
                actual blocker, organization, and urgency.
              </p>
              <a
                href="/help"
                className="mt-6 inline-flex min-h-12 items-center justify-center bg-white px-6 text-sm font-semibold text-slate-950"
              >
                Back to help
              </a>
            </div>
          </div>
        </div>
      </section>
    </PageFrame>
  );
}

function StillNeedHelpBand({ compact = false }: { compact?: boolean }) {
  return (
    <section className="mx-auto max-w-[96rem] px-5 pb-10 sm:px-8 lg:px-10">
      <div className="grid overflow-hidden border border-black/10 bg-white lg:grid-cols-[0.34fr_0.66fr]">
        <MonochromeMedia
          src={editorialRefreshAssets.helpDossier}
          alt="Blueprint support dossier"
          className={cn("hidden rounded-none lg:block", compact ? "min-h-[18rem]" : "min-h-[22rem]")}
          imageClassName="h-full object-cover object-left"
          overlayClassName="bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(0,0,0,0.26))]"
        />
        <div className="p-6 sm:p-8 lg:p-10">
          <EditorialSectionLabel>Still need help?</EditorialSectionLabel>
          <h2 className="font-editorial mt-5 max-w-[14ch] text-[3rem] leading-[0.9] tracking-[-0.06em] text-slate-950 sm:text-[4.8rem]">
            Route the blocker with evidence.
          </h2>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-600">
            Support works fastest when the request includes the exact page, package,
            session, or request id plus the outcome you expected.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href="/help/contact"
              className="inline-flex min-h-12 items-center justify-center bg-slate-950 px-6 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Contact support
            </a>
            <a
              href="/book-exact-site-review"
              className="inline-flex min-h-12 items-center justify-center border border-black/10 px-6 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              Request scoping call
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Support({ params }: SupportProps) {
  const [location] = useLocation();

  if (location.startsWith("/help/contact")) {
    return <ContactSupportPage />;
  }

  if (params?.articleSlug) {
    const article = getHelpArticle(params.articleSlug);
    return article ? <ArticlePage article={article} /> : <MissingHelpPage mode="article" />;
  }

  if (params?.categorySlug) {
    const category = getHelpCategory(params.categorySlug);
    return category ? <CategoryPage category={category} /> : <MissingHelpPage mode="category" />;
  }

  return <HelpHome />;
}
