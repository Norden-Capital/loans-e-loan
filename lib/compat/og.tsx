import fs from "node:fs";
import path from "node:path";

import { initWasm, Resvg } from "@resvg/resvg-wasm";
import type { ReactElement } from "react";
import satori from "satori";

/**
 * Stand-in for `next/og`'s ImageResponse. Same engines (satori + resvg, the
 * versions Next 16 bundled) and the same default font (Geist), so share
 * images look as before. Rendered at build time.
 */
let ready: Promise<void> | null = null;
let font: Buffer | null = null;

function init() {
  if (!ready) {
    const root = process.cwd();
    ready = initWasm(fs.readFileSync(path.join(root, "node_modules/@resvg/resvg-wasm/index_bg.wasm")));
    font = fs.readFileSync(path.join(root, "lib/compat/og-fonts/Geist-Regular.ttf"));
  }
  return ready;
}

async function render(element: ReactElement, width: number, height: number): Promise<Uint8Array> {
  await init();
  const svg = await satori(element, {
    width,
    height,
    fonts: [{ name: "sans serif", data: font!, weight: 700, style: "normal" }],
  });
  return new Uint8Array(new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng());
}

export class ImageResponse extends Response {
  constructor(
    element: ReactElement,
    options: { width?: number; height?: number; headers?: Record<string, string>; status?: number } = {},
  ) {
    const { width = 1200, height = 630 } = options;
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(await render(element, width, height));
        controller.close();
      },
    });
    super(body, {
      status: options.status ?? 200,
      headers: { "Content-Type": "image/png", ...options.headers },
    });
  }
}
