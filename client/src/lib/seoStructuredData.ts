import type { JsonLdValue } from "@/components/SEO";

const BASE_URL = "https://tryblueprint.io";
const ORGANIZATION_ID = `${BASE_URL}/#organization`;
const WEBSITE_ID = `${BASE_URL}/#website`;

export type SeoFaqItem = {
  question: string;
  answer: string;
};

export type SeoBreadcrumbItem = {
  name: string;
  path: string;
};

function absoluteUrl(path: string) {
  if (path.startsWith("http")) {
    return path;
  }

  return path === "/" ? `${BASE_URL}/` : `${BASE_URL}${path}`;
}

export function organizationJsonLd(): JsonLdValue {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: "Blueprint",
    url: `${BASE_URL}/`,
    logo: `${BASE_URL}/gradientBPLogo.png`,
    sameAs: ["https://www.linkedin.com/company/blueprintsim/"],
    description:
      "Blueprint turns lawful real-site capture into site-specific world models robot teams can train on, evaluate, request, and review before deployment work.",
  };
}

export function websiteJsonLd(): JsonLdValue {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: "Blueprint",
    url: `${BASE_URL}/`,
    publisher: { "@id": ORGANIZATION_ID },
    inLanguage: "en-US",
  };
}

export function webPageJsonLd({
  path,
  name,
  description,
}: {
  path: string;
  name: string;
  description: string;
}): JsonLdValue {
  const url = absoluteUrl(path);
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name,
    description,
    isPartOf: { "@id": WEBSITE_ID },
    publisher: { "@id": ORGANIZATION_ID },
    inLanguage: "en-US",
  };
}

export function breadcrumbJsonLd(items: SeoBreadcrumbItem[]): JsonLdValue {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function faqJsonLd(items: SeoFaqItem[]): JsonLdValue {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function productJsonLd({
  path,
  name,
  description,
  image,
  category,
  properties,
}: {
  path: string;
  name: string;
  description: string;
  image?: string;
  category: string;
  properties?: Array<{ name: string; value: string }>;
}): JsonLdValue {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${absoluteUrl(path)}#product`,
    name,
    description,
    url: absoluteUrl(path),
    image: image ? absoluteUrl(image) : `${BASE_URL}/generated/editorial/world-models-hero.png`,
    category,
    brand: { "@id": ORGANIZATION_ID },
    additionalProperty: (properties || []).map((property) => ({
      "@type": "PropertyValue",
      name: property.name,
      value: property.value,
    })),
  };
}
