import { Helmet } from "@/lib/helmet";

export type JsonLdValue = Record<string, unknown>;

interface SEOProps {
  title: string;
  description: string;
  canonical?: string;
  image?: string;
  type?: "website" | "article" | "product";
  noIndex?: boolean;
  jsonLd?: JsonLdValue | JsonLdValue[];
}

const BASE_URL = "https://tryblueprint.io";
// The one share image: current brand, 1200x630 PNG, which LinkedIn, Slack,
// Outlook and X all render. Pages use it unless they have a better one.
const DEFAULT_IMAGE = `${BASE_URL}/brand/og-default.png`;
const DEFAULT_IMAGE_ALT = "Blueprint — From one recurring task to a measured robot pilot.";
const SITE_NAME = "Blueprint";

export function SEO({
  title,
  description,
  canonical,
  image = DEFAULT_IMAGE,
  type = "website",
  noIndex = false,
  jsonLd,
}: SEOProps) {
  const fullTitle = title.includes("Blueprint") ? title : `${title} | ${SITE_NAME}`;
  const canonicalUrl = canonical
    ? canonical.startsWith("http")
      ? canonical
      : `${BASE_URL}${canonical}`
    : undefined;
  const jsonLdItems = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />

      {/* Robots */}
      <meta
        name="robots"
        content={
          noIndex
            ? "noindex, nofollow"
            : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        }
      />

      {/* Canonical URL */}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      {image === DEFAULT_IMAGE && <meta property="og:image:width" content="1200" />}
      {image === DEFAULT_IMAGE && <meta property="og:image:height" content="630" />}
      <meta property="og:image:alt" content={image === DEFAULT_IMAGE ? DEFAULT_IMAGE_ALT : "Blueprint"} />
      <meta property="og:site_name" content={SITE_NAME} />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:image:alt" content={image === DEFAULT_IMAGE ? DEFAULT_IMAGE_ALT : "Blueprint"} />

      {jsonLdItems.map((item, index) => (
        <script key={`json-ld-${index}`} type="application/ld+json">
          {JSON.stringify(item)}
        </script>
      ))}
    </Helmet>
  );
}
