import type { APIRoute } from "astro";

import image, { generateStaticParams } from "@/app/(main)/news/[slug]/opengraph-image";

// /news/<slug>/opengraph-image-mze28o (same path as the old site) — the post's share image (PNG), made at build time.
export const getStaticPaths = () => generateStaticParams().map((params) => ({ params }));

export const GET: APIRoute = ({ params }) => image({ params: Promise.resolve({ slug: String(params.slug) }) });
