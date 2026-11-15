/**
 * Stand-in for `next/navigation`.
 *
 * On the server (build time) the current path is set once per page by
 * lib/compat/router.tsx before the page renders; pages build one at a time,
 * so every component of that page reads the right path. In the browser the
 * real location is used, which is the same value (no trailing slash).
 *
 * `useSearchParams` works as in a static Next page: the component that uses
 * it is drawn in the browser only (see useBailOut in lib/compat/islands.tsx).
 */
import { useBailOut } from "@/lib/compat/islands";

let serverPathname = "/";

export function setServerPathname(pathname: string) {
  serverPathname = pathname;
}

export function usePathname(): string {
  return typeof window === "undefined" ? serverPathname : window.location.pathname;
}

/** Like Next in a static page: on the server the component is not drawn (see useBailOut). */
export function useSearchParams(): URLSearchParams {
  useBailOut();
  return new URLSearchParams(window.location.search);
}

export function useRouter() {
  return {
    push: (href: string) => window.location.assign(href),
    replace: (href: string) => window.location.replace(href),
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    refresh: () => window.location.reload(),
    prefetch: () => {},
  };
}

/** Thrown by a page for a URL it does not have; the router turns it into a 404. */
export class NotFoundError extends Error {
  constructor() {
    super("NEXT_NOT_FOUND");
  }
}

export function notFound(): never {
  throw new NotFoundError();
}

export function redirect(href: string): never {
  throw new Error(`redirect(${href}) is not supported in a static build`);
}
