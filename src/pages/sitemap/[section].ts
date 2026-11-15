import type { APIRoute } from "astro";

import { GET as handler, generateStaticParams } from "@/app/sitemap/[section]/route";
import { nextGet } from "@/lib/compat/routes";

export const getStaticPaths = () => generateStaticParams().map((params) => ({ params }));

export const GET: APIRoute = ({ request, params }) => nextGet(handler, request, params);
