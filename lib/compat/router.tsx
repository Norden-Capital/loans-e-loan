import fs from "node:fs";
import path from "node:path";

import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";

import { resolveHead, type FileOgImage, type Metadata } from "@/lib/compat/metadata";
import { isIsland, markBailouts, resolved, takeBailouts } from "@/lib/compat/islands";
import { NotFoundError, setServerPathname } from "@/lib/compat/navigation";
import { site } from "@/lib/compat/site";

/**
 * Next.js's app router, for Astro: every app/** /page.tsx becomes a page at the
 * same URL, wrapped in its layouts, with the same metadata rules (layouts
 * first, then the page; a page key replaces the whole layout key; title
 * templates), rendered by React as a whole document like Next did. Pages and
 * layouts stay exactly as they were.
 */
type Params = Record<string, string | string[]>;
/** The `viewport` export (only themeColor writes a tag; the viewport tag itself is fixed, as on these sites). */
export type Viewport = { themeColor?: string; width?: string; initialScale?: number };
type Props = { params: Promise<Params>; searchParams: Promise<Record<string, string>> };
type Module = {
  default: (props: Props & { children?: ReactNode }) => ReactNode | Promise<ReactNode>;
  metadata?: Metadata;
  viewport?: Viewport;
  generateMetadata?: (props: Props) => Metadata | Promise<Metadata>;
  generateStaticParams?: (props: { params: Params }) => Params[] | Promise<Params[]>;
};

const pages = import.meta.glob<Module>("/app/**/page.tsx");
const layouts = import.meta.glob<Module>("/app/**/layout.tsx", { eager: true });
const ogFiles = import.meta.glob<{ alt?: string; size?: { width: number; height: number } }>(
  "/app/**/opengraph-image.tsx",
  { eager: true },
);

const hasManifest = Object.keys(import.meta.glob("/app/manifest.{ts,tsx,json,webmanifest}")).length > 0;

const dirOf = (file: string) => file.slice(0, file.lastIndexOf("/"));

/** "/app/(group)/loans/[slug]/page.tsx" → "/loans/[slug]" */
function routeOf(file: string): string {
  const parts = dirOf(file).replace(/^\/app/, "").split("/").filter((s) => s && !/^\(.*\)$/.test(s));
  return "/" + parts.join("/");
}

/** The layouts around a page, outermost first. */
function layoutsFor(file: string): Module[] {
  const chain: Module[] = [];
  let dir = dirOf(file);
  while (dir.startsWith("/app")) {
    const layout = layouts[`${dir}/layout.tsx`];
    if (layout) chain.unshift(layout);
    dir = dirOf(dir);
  }
  return chain;
}

export type PageEntry = { params: { path: string | undefined }; props: { file: string; params: Params } };

/** Every page and every value of its dynamic segments (from generateStaticParams), for Astro. */
export async function pagePaths(): Promise<PageEntry[]> {
  const out: PageEntry[] = [];
  for (const [file, load] of Object.entries(pages)) {
    const route = routeOf(file);
    if (!route.includes("[")) {
      out.push({ params: { path: route === "/" ? undefined : route.slice(1) }, props: { file, params: {} } });
      continue;
    }
    const mod = await load();
    for (const params of (await mod.generateStaticParams?.({ params: {} })) ?? []) {
      const url = route.replace(/\[(?:\.\.\.)?([^\]]+)\]/g, (_, key: string) => {
        const value = params[key];
        return Array.isArray(value) ? value.join("/") : String(value);
      });
      out.push({ params: { path: url.slice(1) }, props: { file, params } });
    }
  }
  return out;
}

/** Layout metadata, then the page's; a title template comes from the nearest layout that has one. */
function mergeMetadata(chain: Metadata[], page: Metadata): Metadata {
  let merged: Metadata = {};
  let template: string | undefined;
  for (const layout of chain) {
    merged = { ...merged, ...layout };
    if (layout.title && typeof layout.title === "object" && "template" in layout.title) template = layout.title.template;
  }
  merged = { ...merged, ...page };
  if (typeof page.title === "string" && template) merged.title = template.replace("%s", page.title);
  return merged;
}

/** The PNG's size, read from its header. */
function pngSize(file: string) {
  const head = fs.readFileSync(file).subarray(16, 24);
  return { width: head.readUInt32BE(0), height: head.readUInt32BE(4) };
}

/**
 * A social image file next to the page or above it (opengraph-image.png or
 * .tsx), used the way Next did: always when it is the page's own; from a
 * parent folder only when the page sets no openGraph of its own. For pages
 * (not the 404 page), a folder's file is skipped when that level's metadata
 * (the page in its own folder, the layout above) lists openGraph images
 * itself (Next: mergeStaticMetadata).
 */
function fileOgImage(file: string, url: string, pageMeta: Metadata, forPage = false): FileOgImage | undefined {
  let dir = dirOf(file);
  while (dir.startsWith("/app")) {
    const own = dir === dirOf(file);
    if (!own && pageMeta.openGraph) return undefined;
    // The metadata of that level: the page's own folder → the page; above → that folder's layout.
    const levelOg = own ? pageMeta.openGraph : layouts[`${dir}/layout.tsx`]?.metadata?.openGraph;
    if (forPage && levelOg && "images" in levelOg) return undefined;
    const tsx = ogFiles[`${dir}/opengraph-image.tsx`];
    if (tsx) {
      // Next gave some of these routes a code: /blog/<slug>/opengraph-image-x8nqxr
      const suffix = site.ogRouteSuffix?.[`${dir}/opengraph-image.tsx`] ?? "";
      return {
        url: `${url === "/" ? "" : url}/opengraph-image${suffix}`,
        type: "image/png",
        width: tsx.size?.width ?? 1200,
        height: tsx.size?.height ?? 630,
        alt: tsx.alt ?? "",
      };
    }
    const png = path.join(process.cwd(), `${dir}/opengraph-image.png`);
    if (fs.existsSync(png)) {
      const altFile = png.replace(/\.png$/, ".alt.txt");
      return {
        url: site.ogImageUrls[`${dir}/opengraph-image.png`] ?? `${dir.replace(/^\/app/, "")}/opengraph-image.png`,
        type: "image/png",
        ...pngSize(png),
        alt: fs.existsSync(altFile) ? fs.readFileSync(altFile, "utf8") : "",
      };
    }
    dir = dirOf(dir);
  }
  return undefined;
}

export type Rendered = {
  status: number;
  htmlAttrs: Record<string, string>;
  bodyAttrs: Record<string, string>;
  /** charset, viewport, font and other preloads */
  headStart: string;
  /** title, metadata tags and icons */
  headMeta: string;
  /** the layout's own <head> children */
  headEnd: string;
  body: string;
};

const attrsOf = (tag: string) =>
  Object.fromEntries([...tag.matchAll(/([a-zA-Z:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));

const titleText = (title: Metadata["title"]) =>
  typeof title === "string" ? title : title && "absolute" in title ? title.absolute : title?.default;

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

/** Renders a whole document (an <html> element) and splits it for the Astro page. */
export function renderDocument(
  tree: ReactElement,
  pathname: string,
  metadata: Metadata,
  ogImage?: FileOgImage,
  extraRobots?: string,
  viewport: Viewport = {},
): Rendered {
  setServerPathname(pathname);
  const html = markBailouts(renderToString(tree), takeBailouts());

  const htmlTag = html.match(/<html[^>]*>/)?.[0] ?? "<html>";
  const bodyTag = html.match(/<body[^>]*>/)?.[0] ?? "<body>";
  const headInner = html.match(/<head[^>]*>([\s\S]*?)<\/head>/)?.[1] ?? "";
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)?.[1] ?? "";

  // React puts what it hoists (charset, preloads) first; the rest is the layout's own head.
  const hoisted = headInner.match(/^(?:<meta charSet="utf-8"\/>|<link rel="preload"[^>]*\/>|<link[^>]*rel="preload"[^>]*\/>)*/)?.[0] ?? "";
  const rest = headInner.slice(hoisted.length);
  const charset = '<meta charSet="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>';

  // Like Next: the manifest link on every page; and with a share-image file but
  // no openGraph of its own, the title and description become the share text.
  const full: Metadata = { metadataBase: new URL(import.meta.env.SITE), ...metadata };
  if (hasManifest) full.manifest = "/manifest.webmanifest";
  if (ogImage && !full.openGraph) {
    full.openGraph = { title: titleText(full.title), description: full.description };
    full.twitter ??= { card: "summary_large_image", title: titleText(full.title), description: full.description };
  }
  const head = resolveHead({}, full, { fileOgImage: ogImage });
  const robots = extraRobots ? `<meta name="robots" content="${extraRobots}"/>` : "";
  return {
    status: 200,
    htmlAttrs: attrsOf(htmlTag),
    bodyAttrs: attrsOf(bodyTag),
    headStart: charset + robots + site.fontPreloads + hoisted.replace('<meta charSet="utf-8"/>', ""),
    headMeta: `${viewport.themeColor ? `<meta name="theme-color" content="${escapeHtml(viewport.themeColor)}"/>` : ""}<title>${escapeHtml(head.title)}</title>${head.tags}${site.iconLinks}`,
    headEnd: rest,
    body,
  };
}

/** One page of the site, ready for the Astro template. */
export async function renderPage(file: string, params: Params): Promise<Rendered> {
  const load = pages[file];
  const mod = await load();
  const props: Props = { params: resolved(params), searchParams: resolved({}) };
  const chain = layoutsFor(file);

  const pageMeta = mod.generateMetadata ? await mod.generateMetadata(props) : (mod.metadata ?? {});
  const metadata = mergeMetadata(
    chain.map((l) => l.metadata ?? {}),
    pageMeta,
  );

  let tree: ReactNode;
  try {
    // A "use client" page is a part like any other (it can sit inside a "use client" layout).
    tree = isIsland(mod.default) ? createElement(mod.default as (p: Props) => ReactNode, props) : await mod.default(props);
  } catch (error) {
    if (error instanceof NotFoundError) throw new Error(`${file}: notFound() for ${JSON.stringify(params)}`);
    throw error;
  }
  for (const layout of [...chain].reverse()) {
    tree = createElement(layout.default as (p: Props & { children?: ReactNode }) => ReactNode, { ...props, children: tree });
  }

  const url = routeOf(file).replace(/\[(?:\.\.\.)?([^\]]+)\]/g, (_, key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value.join("/") : String(value);
  });
  const viewport = Object.assign({}, ...chain.map((l) => l.viewport ?? {}), mod.viewport ?? {}) as Viewport;
  return renderDocument(tree as ReactElement, url, metadata, fileOgImage(file, url, pageMeta, true), undefined, viewport);
}

/** app/global-not-found.tsx (or app/not-found.tsx inside the root layout) as the 404 page. */
export async function renderNotFound(): Promise<Rendered> {
  const globalNotFound = import.meta.glob<Module>("/app/global-not-found.tsx", { eager: true })["/app/global-not-found.tsx"];
  if (globalNotFound) {
    const tree = await globalNotFound.default({ params: resolved({}), searchParams: resolved({}) });
    const meta = globalNotFound.metadata ?? {};
    const og = fileOgImage("/app/global-not-found.tsx", "/", meta);
    return { ...renderDocument(tree as ReactElement, "/_not-found", meta, og, "noindex", globalNotFound.viewport), status: 404 };
  }
  const notFound = import.meta.glob<Module>("/app/not-found.tsx", { eager: true })["/app/not-found.tsx"];
  const root = layouts["/app/layout.tsx"];
  const props: Props = { params: resolved({}), searchParams: resolved({}) };
  // Next gives not-found no props.
  const inner = !notFound ? null : isIsland(notFound.default) ? createElement(notFound.default as () => ReactNode) : await notFound.default({} as Props);
  const tree = root ? createElement(root.default as (p: Props & { children?: ReactNode }) => ReactNode, { ...props, children: inner }) : inner;
  const metadata = mergeMetadata([root?.metadata ?? {}], notFound?.metadata ?? {});
  const og = fileOgImage("/app/not-found.tsx", "/", notFound?.metadata ?? {});
  const viewport = { ...root?.viewport, ...notFound?.viewport };
  return { ...renderDocument(tree as ReactElement, "/_not-found", metadata, og, "noindex", viewport), status: 404 };
}
