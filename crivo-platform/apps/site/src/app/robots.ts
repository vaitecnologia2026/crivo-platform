import type { MetadataRoute } from "next";
import { SITE_URL } from "./_site/site.config";

/**
 * §14 — o que os buscadores podem varrer.
 * Fora: rotas de API e a vitrine interna do design system.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/design-system"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
