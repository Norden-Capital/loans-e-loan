import type { MetadataRoute } from "@/lib/compat/next";

/**
 * Next's file conventions that are not pages: app/robots.ts and
 * app/manifest.ts return objects that Next turned into files. Same output here.
 */
const list = (value: string | string[] | undefined) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);

export function robotsResponse(robots: MetadataRoute.Robots): Response {
  let text = "";
  for (const rule of Array.isArray(robots.rules) ? robots.rules : [robots.rules]) {
    for (const agent of list(rule.userAgent)) text += `User-Agent: ${agent}\n`;
    for (const allow of list(rule.allow)) text += `Allow: ${allow}\n`;
    for (const disallow of list(rule.disallow)) text += `Disallow: ${disallow}\n`;
    if (rule.crawlDelay !== undefined) text += `Crawl-delay: ${rule.crawlDelay}\n`;
    text += "\n";
  }
  if (robots.host) text += `Host: ${robots.host}\n`;
  for (const sitemap of list(robots.sitemap)) text += `Sitemap: ${sitemap}\n`;
  return new Response(text, { headers: { "Content-Type": "text/plain" } });
}

export function manifestResponse(manifest: MetadataRoute.Manifest): Response {
  return new Response(JSON.stringify(manifest), { headers: { "Content-Type": "application/manifest+json" } });
}

/** Calls an old route handler's GET with Next's (request, { params }) arguments. */
export function nextGet<P>(
  handler: (request: Request, context: { params: Promise<P> }) => Response | Promise<Response>,
  request: Request,
  params: Record<string, string | undefined> = {},
) {
  return handler(request, { params: Promise.resolve(params as P) });
}

/** app/sitemap.ts: the list Next turned into /sitemap.xml (same XML lines). */
export function sitemapResponse(sitemap: MetadataRoute.Sitemap): Response {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (const item of sitemap) {
    xml += `<url>\n<loc>${item.url}</loc>\n`;
    if (item.lastModified) {
      const date = item.lastModified instanceof Date ? item.lastModified.toISOString() : item.lastModified;
      xml += `<lastmod>${date}</lastmod>\n`;
    }
    if (item.changeFrequency) xml += `<changefreq>${item.changeFrequency}</changefreq>\n`;
    if (typeof item.priority === "number") xml += `<priority>${item.priority}</priority>\n`;
    xml += "</url>\n";
  }
  xml += "</urlset>\n";
  return new Response(xml, { headers: { "Content-Type": "application/xml" } });
}
