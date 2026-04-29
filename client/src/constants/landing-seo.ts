import { env } from "./env";

/** Title aligned with `index.html` and hero — used for document + Open Graph. */
export const LANDING_PAGE_TITLE =
  "Edigo - Institute Management Software for Fees, Attendance & Students";

/** Meta description aligned with `index.html`. */
export const LANDING_PAGE_DESCRIPTION =
  "Manage fees, attendance, and students with Edigo. Automate installment tracking, monitor attendance, and run your institute efficiently.";

/**
 * Absolute site origin (no trailing slash). Uses `VITE_SITE_URL` when set;
 * otherwise `window.location.origin` on the client; build-time fallback from
 * `tenantRootDomain` or `edigo.in`.
 */
export function getSiteOrigin(): string {
  const explicit = import.meta.env.VITE_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (typeof globalThis.window !== "undefined") {
    return globalThis.window.location.origin;
  }
  const domain = env.tenantRootDomain || "edigo.in";
  return `https://${domain}`;
}

export function buildLandingJsonLd(origin: string) {
  const site = `${origin}/`;
  const logoUrl = `${origin}/apple-touch-icon.png`;
  const orgId = `${site}#organization`;
  const websiteId = `${site}#website`;
  const productId = `${site}#product`;
  const pageId = `${site}#webpage`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": orgId,
        name: "Edigo",
        url: site,
        logo: {
          "@type": "ImageObject",
          url: logoUrl,
        },
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        name: "Edigo",
        url: site,
        description: LANDING_PAGE_DESCRIPTION,
        inLanguage: "en",
        publisher: { "@id": orgId },
      },
      {
        "@type": "SoftwareApplication",
        "@id": productId,
        name: "Edigo",
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web",
        description:
          "Institute management software for fee installments, attendance, reminders, and admin dashboards.",
        featureList: [
          "Fee collection with templates, installments, and dues tracking",
          "Attendance with SMS reminders and operational dashboard",
          "Role-based access for staff and admins",
        ],
        publisher: { "@id": orgId },
        url: site,
        offers: {
          "@type": "Offer",
          price: "999",
          priceCurrency: "INR",
          description:
            "Per institute, monthly subscription; cancel anytime. Contact for a demo.",
        },
      },
      {
        "@type": "WebPage",
        "@id": pageId,
        url: site,
        name: LANDING_PAGE_TITLE,
        description: LANDING_PAGE_DESCRIPTION,
        isPartOf: { "@id": websiteId },
        primaryImageOfPage: {
          "@type": "ImageObject",
          url: logoUrl,
        },
        about: { "@id": productId },
      },
    ],
  };
}
