import type { ComponentType } from "react";

/**
 * Stand-in for `next/dynamic`. The usual form, `dynamic(() => import("…"))`,
 * is turned into a normal import at build time (integrations/next-compat.mjs),
 * as Next drew it on the server too. Other forms are not supported yet.
 */
export default function dynamic<P>(_loader: () => Promise<unknown>, _options?: unknown): ComponentType<P> {
  throw new Error("next/dynamic: only `dynamic(() => import(\"…\"))` without options is supported (see integrations/next-compat.mjs)");
}
