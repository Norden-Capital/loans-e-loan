import type { APIRoute } from "astro";

import { POST as handler } from "@/app/api/unsubscribe/route";

// The /unsubscribe form's server route (app/api/unsubscribe/route.ts). Runs as a
// Vercel function for every request, never prebuilt.
export const prerender = false;

export const POST: APIRoute = ({ request }) => handler(request);

// Only POST is allowed, as for /api/contact.
export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { Allow: "POST" } });
