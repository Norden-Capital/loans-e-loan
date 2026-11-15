import type { APIRoute } from "astro";

import { POST as handler } from "@/app/api/contact/route";

// The contact form's server route, unchanged (app/api/contact/route.ts).
export const prerender = false;

export const POST: APIRoute = ({ request }) => handler(request);

// Next answered other methods with 405.
export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { Allow: "POST" } });
