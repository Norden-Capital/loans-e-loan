import { createElement, Fragment, Suspense, type ComponentType, type ReactNode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import islands from "virtual:next-islands";

import { InIsland } from "@/lib/compat/islands";

/**
 * Browser side of the islands (see lib/compat/islands.tsx): hydrates every
 * outermost <x-island> with its component and props, then runs the
 * after-load scripts (lib/compat/script.tsx), as Next did after hydration.
 */
type Loader = () => Promise<Record<string, unknown>>;
type Mod = Record<string, unknown>;
const loaders = islands as Record<string, Loader>;

/** Ids of the "use client" files named in server content ({$$el: "c"}). */
function clientRefs(value: unknown, out: Set<string>): Set<string> {
  if (Array.isArray(value)) for (const v of value) clientRefs(v, out);
  else if (value && typeof value === "object") {
    const node = value as Record<string, unknown>;
    if (node.$$el === "c") out.add(node.i as string);
    for (const v of Object.values(node)) clientRefs(v, out);
  }
  return out;
}

/** Server content (see toPayload in lib/compat/islands.tsx) → React elements. */
function fromPayload(value: unknown, mods: Map<string, Mod>): unknown {
  if (Array.isArray(value)) return value.map((v) => fromPayload(v, mods));
  if (!value || typeof value !== "object") return value;
  const node = value as Record<string, unknown>;
  const props = (p: unknown) => ({ ...(fromPayload(p, mods) as object), key: node.k as string | undefined });
  switch (node.$$el) {
    case "h":
      return createElement(node.t as string, props(node.p));
    case "f":
      return createElement(Fragment, { key: node.k as string | undefined }, fromPayload(node.c, mods) as ReactNode);
    case "c":
      return createElement(mods.get(node.i as string)?.[node.n as string] as ComponentType, props(node.p));
    case "s":
      return createElement(Suspense, { key: node.k as string | undefined, fallback: fromPayload(node.f, mods) as ReactNode }, fromPayload(node.c, mods) as ReactNode);
    case "p":
      return Promise.resolve(fromPayload(node.v, mods));
  }
  return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, fromPayload(v, mods)]));
}

/**
 * A part that reads the URL inside another island is left out on the server
 * (see useBailOut); React then draws it here and reports "#419". That is
 * expected, and Next does not show it either. Other errors are reported as usual.
 */
function onRecoverableError(error: unknown) {
  const message = String((error as Error | undefined)?.message ?? error);
  if (/#419|could not finish this Suspense boundary|BAILOUT_TO_CLIENT_SIDE_RENDERING/.test(message)) return;
  (globalThis.reportError ?? console.error)(error);
}

async function hydrateIslands() {
  const jobs: Promise<void>[] = [];
  for (const el of document.querySelectorAll<HTMLElement>("x-island[data-props]")) {
    if (el.parentElement?.closest("x-island[data-props]")) continue; // part of an outer island
    const load = loaders[el.dataset.id ?? ""];
    if (!load) continue;
    const data = JSON.parse(el.dataset.props ?? "{}") as unknown;
    const refs = [...clientRefs(data, new Set())];
    jobs.push(
      Promise.all([load(), ...refs.map((id) => loaders[id]())]).then(([mod, ...more]) => {
        const mods = new Map(refs.map((id, i) => [id, more[i]]));
        const Component = mod[el.dataset.export ?? "default"] as ComponentType<Record<string, unknown>>;
        const element = createElement(InIsland, null, createElement(Component, fromPayload(data, mods) as Record<string, unknown>));
        // Not drawn on the server (it reads the URL): replace the placeholder.
        if (el.hasAttribute("data-client-render")) createRoot(el).render(element);
        else hydrateRoot(el, element, { onRecoverableError });
      }),
    );
  }
  await Promise.allSettled(jobs);
}

/**
 * The scripts lib/compat/script.tsx left in the page, added to <body> for real.
 * The marker itself stays (it is inert): it belongs to an island, and React
 * may still be hydrating it, so removing it could cause a hydration error.
 */
const done = new WeakSet<Element>();
const loaded = new Set<string>(); // like Next: one script per id / src

function runScripts() {
  for (const marker of document.querySelectorAll<HTMLScriptElement>('script[type="text/x-next-script"]')) {
    if (done.has(marker)) continue;
    done.add(marker);
    const attrs = JSON.parse(marker.dataset.attrs ?? "{}") as Record<string, string>;
    const key = attrs.id || attrs.src;
    if (key) {
      if (loaded.has(key)) continue;
      loaded.add(key);
    }
    const script = document.createElement("script");
    for (const [key, value] of Object.entries(attrs)) script.setAttribute(key, value);
    if (attrs.src) script.async = true;
    else script.text = marker.text;
    document.body.appendChild(script);
  }
}

void hydrateIslands().then(() => {
  runScripts();
  // Parts drawn later in the browser (see data-client-render) can bring their
  // own scripts; Next loaded those when the part appeared.
  new MutationObserver(runScripts).observe(document.body, { childList: true, subtree: true });
});
