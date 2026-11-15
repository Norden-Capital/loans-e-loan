import type { APIRoute } from "astro";

import { GET as handler } from "@/app/(main)/news/feed.xml/route";

export const GET: APIRoute = () => handler();
