import { preload } from "react-dom";

/**
 * Stand-in for `next/script` (strategy "afterInteractive", the only one these
 * sites use). Next added these scripts in the browser after the page had
 * loaded, so they were never in the HTML. Here they are written as inert
 * `text/x-next-script` tags; lib/compat/islands-client.ts turns them into real
 * scripts after hydration, at the end of <body>, as Next did. A script with a
 * `src` is preloaded in <head>, as Next did.
 */
type ScriptProps = {
  id?: string;
  src?: string;
  type?: string;
  strategy?: string;
  children?: string;
  dangerouslySetInnerHTML?: { __html: string };
  [attr: string]: unknown;
};

export default function Script({ strategy: _strategy, children, dangerouslySetInnerHTML, ...attrs }: ScriptProps) {
  if (typeof attrs.src === "string") preload(attrs.src, { as: "script" });
  const text = typeof children === "string" ? children : (dangerouslySetInnerHTML?.__html ?? "");
  const plain = Object.fromEntries(
    Object.entries(attrs).filter(([, value]) => typeof value === "string" || typeof value === "number"),
  );
  return (
    <script
      type="text/x-next-script"
      data-attrs={JSON.stringify(plain)}
      // "</" would end the tag early; "<\/" means the same in JS and JSON.
      dangerouslySetInnerHTML={{ __html: text.replace(/<\//g, "<\\/") }}
    />
  );
}
