import { createContext, createElement, Fragment, isValidElement, Suspense, useContext, type ComponentType, type ReactNode } from "react";

/**
 * Next's "bail out to client-side rendering": a component that reads the URL's
 * search params (useSearchParams) is not drawn on the server; the nearest
 * <Suspense> fallback is sent instead, and the browser draws the component.
 * `bailOut()` records which island did it; `markBailouts()` wraps each such
 * fallback in an <x-island data-client-render>, which the browser replaces.
 * Inside another island's content ("nested") nothing is marked: when that
 * island hydrates, React itself draws the part in the browser, as in Next.
 */
type IslandInfo = { id: string; name: string; props: string | undefined; hydrated?: boolean; nested?: boolean };
const IslandContext = createContext<IslandInfo | null>(null);
let bailouts: (IslandInfo | null)[] = [];

export function useBailOut(): void {
  const island = useContext(IslandContext);
  if (typeof window !== "undefined") return;
  if (island) bailouts.push(island.nested ? null : island);
  throw new Error("BAILOUT_TO_CLIENT_SIDE_RENDERING");
}

export function takeBailouts(): (IslandInfo | null)[] {
  const taken = bailouts;
  bailouts = [];
  return taken;
}

const attr = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export function markBailouts(html: string, taken: (IslandInfo | null)[]): string {
  let index = 0;
  return html.replace(/<!--\$!-->((?:<template[^>]*><\/template>)?)([\s\S]*?)<!--\/\$-->/g, (whole, template: string, fallback: string) => {
    const island = taken[index++];
    if (!island) return whole;
    const props = island.props === undefined ? "" : ` data-props="${attr(island.props)}"`;
    return `<!--$!-->${template}<x-island data-id="${attr(island.id)}" data-export="${attr(island.name)}"${props} data-client-render="" style="display:contents">${fallback}</x-island><!--/$-->`;
  });
}

/**
 * Wraps a "use client" component (see integrations/next-compat.mjs) so it
 * renders inside <x-island> with its props. lib/compat/islands-client.ts
 * hydrates it in the browser, as Next did. `display: contents` keeps the
 * wrapper out of the layout.
 *
 * Props must be data that can be sent to the browser, as in Next: plain data
 * (strings, numbers, arrays, objects), or content made on the server
 * (children like <AccordionItem>…</AccordionItem>). That content is sent as
 * a description (see toPayload), with the "use client" parts in it named by
 * file, and rebuilt in the browser; the whole thing then is one island, as
 * it was one client tree in Next. Anything else (a function) makes the
 * component render once on the server only, and a warning is printed.
 */
const warned = new Set<string>();
const ISLAND = Symbol.for("next-compat.island");
type IslandFn = { [ISLAND]?: { id: string; name: string } };

class NotSendable extends Error {}

const RESOLVED = Symbol.for("next-compat.resolved");

/**
 * A promise whose value is known now, like the page's `params` and
 * `searchParams`. Next sends these to "use client" pages too; this marks the
 * value so it can be sent to the browser the same way.
 */
export function resolved<T>(value: T): Promise<T> {
  return Object.assign(Promise.resolve(value), { [RESOLVED]: value });
}

/** Server content → data for the browser (React elements become {$$el: …}). */
function toPayload(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (["string", "number", "boolean"].includes(typeof value)) return value;
  if (Array.isArray(value)) return value.map(toPayload);
  if (isValidElement(value)) {
    const { type, key } = value;
    const props = value.props as Record<string, unknown>;
    const k = key ?? undefined;
    if (typeof type === "string") return { $$el: "h", t: type, p: propsPayload(props), k };
    if (type === Fragment) return { $$el: "f", c: toPayload(props.children), k };
    if (type === Suspense) return { $$el: "s", f: toPayload(props.fallback), c: toPayload(props.children), k };
    const island = typeof type === "function" ? (type as IslandFn)[ISLAND] : undefined;
    if (island) return { $$el: "c", i: island.id, n: island.name, p: propsPayload(props), k };
    // A server component: its output is what is sent (as Next did).
    if (typeof type === "function" && !(type as { prototype?: { isReactComponent?: unknown } }).prototype?.isReactComponent) {
      const out = (type as (p: unknown) => unknown)(props);
      if (out instanceof Promise) throw new NotSendable("async server component");
      return k === undefined ? toPayload(out) : { $$el: "f", c: toPayload(out), k };
    }
    // forwardRef / memo components without "use client" (e.g. lucide icons): server components too.
    const special = type as { $$typeof?: symbol; render?: (p: unknown, ref: unknown) => unknown; type?: unknown };
    if (special?.$$typeof === Symbol.for("react.forward_ref") && special.render) {
      const out = special.render(props, null);
      return k === undefined ? toPayload(out) : { $$el: "f", c: toPayload(out), k };
    }
    if (special?.$$typeof === Symbol.for("react.memo")) {
      return toPayload(createElement(special.type as ComponentType, { ...props, key: k }));
    }
    throw new NotSendable("component type");
  }
  if (value instanceof Promise && RESOLVED in value) return { $$el: "p", v: toPayload((value as { [RESOLVED]: unknown })[RESOLVED]) };
  if (typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) throw new NotSendable("object");
    return propsPayload(value as Record<string, unknown>);
  }
  throw new NotSendable(typeof value);
}

function propsPayload(props: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(props)) if (val !== undefined) out[key] = toPayload(val);
  return out;
}

function plain(value: unknown): boolean {
  if (value === null || ["string", "number", "boolean", "undefined"].includes(typeof value)) return true;
  if (typeof value === "function" || typeof value === "symbol" || isValidElement(value)) return false;
  if (Array.isArray(value)) return value.every(plain);
  if (typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return false;
    return Object.values(value as Record<string, unknown>).every(plain);
  }
  return false;
}

/** True for a "use client" component (wrapped by islandWrap). */
export function isIsland(value: unknown): boolean {
  return typeof value === "function" && ISLAND in value;
}

export function islandWrap<T>(value: T, id: string, name: string): T {
  if (typeof value !== "function") return value;
  const label = name === "default" ? (value as { name?: string }).name || "default" : name;
  // Only components (capitalized), not hooks or helpers.
  if (!/^[A-Z]/.test(label)) return value;

  const Component = value as unknown as ComponentType<Record<string, unknown>>;
  function Island(props: Record<string, unknown>): ReactNode {
    // Inside another island's content: part of that island (one client tree).
    // (try: the router sometimes calls a page part as a plain function, outside React.)
    let outer: IslandInfo | null = null;
    try {
      outer = useContext(IslandContext);
    } catch {
      // not inside a React render
    }
    if (outer?.hydrated) return createElement(IslandContext.Provider, { value: { ...outer, nested: true } }, createElement(Component, props));

    let json: string | undefined;
    if (plain(props)) json = JSON.stringify(props);
    else {
      try {
        json = JSON.stringify(propsPayload(props));
      } catch (error) {
        // NotSendable, or a server component that cannot run here
        if (typeof window === "undefined" && !warned.has(`${id}#${name}`)) {
          warned.add(`${id}#${name}`);
          console.warn(`[islands] ${id} (${label}): props cannot be sent to the browser (${(error as Error).message}), rendered on the server only`);
        }
      }
    }
    return createElement(
      "x-island",
      {
        "data-id": id,
        "data-export": name,
        "data-props": json,
        style: { display: "contents" },
        suppressHydrationWarning: true,
      },
      createElement(IslandContext.Provider, { value: { id, name, props: json, hydrated: json !== undefined } }, createElement(Component, props)),
    );
  }
  Island.displayName = `Island(${label})`;
  (Island as IslandFn)[ISLAND] = { id, name };
  return Island as unknown as T;
}

/**
 * Browser: the hydrated component is one island, so islands used inside it
 * render without their wrapper, the same as on the server.
 */
export function InIsland({ children }: { children?: ReactNode }) {
  return createElement(IslandContext.Provider, { value: { id: "", name: "", props: undefined, hydrated: true } }, children);
}
