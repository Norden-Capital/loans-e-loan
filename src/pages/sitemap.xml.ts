import type { APIRoute } from "astro";

import { GET as handler } from "@/app/sitemap.xml/route";

export const GET: APIRoute = () => handler();
