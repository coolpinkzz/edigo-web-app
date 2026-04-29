import { useEffect } from "react";
import {
  buildLandingJsonLd,
  getSiteOrigin,
  LANDING_PAGE_DESCRIPTION,
  LANDING_PAGE_TITLE,
} from "../../constants/landing-seo";

const DATA_ATTR = "data-edigo-landing-seo";

function applyMeta(
  nameOrProperty: "name" | "property",
  key: string,
  content: string,
  created: HTMLElement[],
) {
  const el = document.createElement("meta");
  el.setAttribute(nameOrProperty, key);
  el.setAttribute("content", content);
  el.setAttribute(DATA_ATTR, "");
  document.head.appendChild(el);
  created.push(el);
}

/**
 * Landing-only SEO: JSON-LD (Organization, WebSite, SoftwareApplication, WebPage)
 * plus Open Graph meta. Injects on mount; removes on unmount.
 */
export function LandingPageSeo() {
  const origin = getSiteOrigin();
  const canonical = `${origin}/`;
  const imageUrl = `${origin}/apple-touch-icon.png`;
  const jsonLd = buildLandingJsonLd(origin);

  useEffect(() => {
    const created: HTMLElement[] = [];

    const prevTitle = document.title;
    document.title = LANDING_PAGE_TITLE;

    const hadDescriptionMeta = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    const prevDescriptionContent =
      hadDescriptionMeta?.getAttribute("content") ?? "";
    let descriptionEl = hadDescriptionMeta;
    if (!descriptionEl) {
      descriptionEl = document.createElement("meta");
      descriptionEl.setAttribute("name", "description");
      descriptionEl.setAttribute(DATA_ATTR, "");
      document.head.appendChild(descriptionEl);
      created.push(descriptionEl);
    }
    descriptionEl.setAttribute("content", LANDING_PAGE_DESCRIPTION);

    applyMeta("property", "og:type", "website", created);
    applyMeta("property", "og:title", LANDING_PAGE_TITLE, created);
    applyMeta(
      "property",
      "og:description",
      LANDING_PAGE_DESCRIPTION,
      created,
    );
    applyMeta("property", "og:url", canonical, created);
    applyMeta("property", "og:site_name", "Edigo", created);
    applyMeta("property", "og:image", imageUrl, created);
    applyMeta("property", "og:locale", "en_US", created);

    const link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    link.setAttribute("href", canonical);
    link.setAttribute(DATA_ATTR, "");
    document.head.appendChild(link);
    created.push(link);

    return () => {
      document.title = prevTitle;
      if (hadDescriptionMeta) {
        descriptionEl.setAttribute("content", prevDescriptionContent);
      }
      for (const el of created) {
        el.remove();
      }
    };
  }, [canonical, imageUrl]);

  return (
    <script
      type="application/ld+json"
      // Safe for JSON-LD: escapes </script> sequences in string values
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
      }}
    />
  );
}
