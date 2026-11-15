// @ts-check
import fs from "node:fs";
import path from "node:path";

/**
 * Lets the old Next.js code run unchanged under Astro.
 *
 * 1. Imports of `next`, `next/link`, `next/image`, `next/script`,
 *    `next/navigation`, `next/og` and `next/font/google` are sent to small
 *    stand-ins in lib/compat/.
 *
 * 2. Islands. In Next, a file that starts with "use client" runs in the
 *    browser too, wherever it is used. Astro has no such rule, so this plugin
 *    adds it: when a server file imports a "use client" file, it gets a
 *    wrapped copy whose components render inside <x-island> (with their
 *    props). lib/compat/islands-client.ts then hydrates each one in the
 *    browser. A "use client" file importing another one gets the plain file,
 *    as in Next (it is already inside an island).
 *
 * @returns {import("vite").Plugin}
 */
export default function nextCompat() {
  const root = process.cwd();
  const compat = (/** @type {string} */ file) => path.join(root, "lib/compat", file).replace(/\\/g, "/");
  const VIRTUAL = "virtual:next-islands";
  const ISLAND = "\0next-island:";
  const cache = new Map();

  /**
   * True when the file starts with the "use client" directive.
   * @param {string} file
   */
  function isClient(file) {
    const clean = file.split("?")[0];
    if (!/\.[cm]?[jt]sx?$/.test(clean) || clean.includes("/node_modules/")) return false;
    if (!cache.has(clean)) {
      let code = "";
      try {
        code = fs.readFileSync(clean, "utf8");
      } catch {
        // not a file on disk
      }
      cache.set(clean, /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*["']use client["']/.test(code));
    }
    return cache.get(clean);
  }

  /** Every "use client" file of the site, for the browser's island map. */
  function clientFiles() {
    /** @type {string[]} */
    const out = [];
    const walk = (/** @type {string} */ dir) => {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (isClient(full.replace(/\\/g, "/"))) out.push(full.replace(/\\/g, "/"));
      }
    };
    for (const dir of ["app", "components", "lib"]) walk(path.join(root, dir));
    return out;
  }

  const idOf = (/** @type {string} */ file) => path.relative(root, file).replace(/\\/g, "/");

  /**
   * Value exports of a module (type-only exports are left out).
   * @param {string} code
   */
  function exportNames(code) {
    const names = new Set();
    for (const m of code.matchAll(/^export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
    if (/^export\s+default\b/m.test(code)) names.add("default");
    for (const m of code.matchAll(/^export\s*\{([^}]*)\}/gm)) {
      for (const part of m[1].split(",")) {
        const item = part.trim();
        if (!item || item.startsWith("type ")) continue;
        names.add((item.split(/\s+as\s+/).pop() ?? item).trim());
      }
    }
    return [...names];
  }

  /**
   * Next writes the value of every `process.env.NEXT_PUBLIC_…` into the code at
   * build time (in the browser too); an unset one becomes undefined. Same here.
   */
  function publicEnv() {
    /** @type {Record<string, string>} */
    const define = {};
    const walk = (/** @type {string} */ dir) => {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.[cm]?[jt]sx?$/.test(entry.name)) {
          for (const m of fs.readFileSync(full, "utf8").matchAll(/process\.env\.(NEXT_PUBLIC_\w+)/g)) {
            const value = process.env[m[1]];
            define[`process.env.${m[1]}`] = value === undefined ? "undefined" : JSON.stringify(value);
          }
        }
      }
    };
    for (const dir of ["app", "components", "lib"]) walk(path.join(root, dir));
    return define;
  }

  return {
    name: "next-compat",
    enforce: "pre",
    config() {
      return {
        define: publicEnv(),
        resolve: {
          alias: [
            { find: /^next$/, replacement: compat("next.ts") },
            { find: /^next\/link$/, replacement: compat("link.tsx") },
            { find: /^next\/image$/, replacement: compat("image.tsx") },
            { find: /^next\/script$/, replacement: compat("script.tsx") },
            { find: /^next\/navigation$/, replacement: compat("navigation.ts") },
            { find: /^next\/og$/, replacement: compat("og.tsx") },
            { find: /^next\/font\/google$/, replacement: compat("font.ts") },
            { find: /^next\/dynamic$/, replacement: compat("dynamic.ts") },
          ],
        },
      };
    },
    async resolveId(source, importer, options) {
      if (source === VIRTUAL) return "\0" + VIRTUAL;
      if (!importer || importer.startsWith("\0") || source.startsWith("\0")) return null;
      if (isClient(importer)) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (!resolved || resolved.external) return null;
      const file = resolved.id.split("?")[0];
      return isClient(file) ? ISLAND + file : null;
    },
    /**
     * 3. `import(\`@/lib/guides/${slug}\`)`: Next (webpack) finds the file from a
     * name made at run time; Vite cannot with the "@/" path. Same result with
     * a list of the folder's files (import.meta.glob).
     */
    async transform(code, id) {
      if (id.startsWith("\0") || id.includes("/node_modules/") || !/\.[cm]?[jt]sx?$/.test(id.split("?")[0])) return null;
      const original = code;
      // 4. <style jsx>: Next's built-in scoped CSS (styled-jsx). Compiled with
      //    the same tool Next uses (SWC + its styled-jsx plugin), so the class
      //    names (jsx-…) and the CSS are the same as on the old site. Only for
      //    sites that use it (they have @swc/core and styled-jsx installed).
      if (/<style\s+jsx[\s>]/.test(code)) {
        const { transform: swc } = await import("@swc/core");
        const file = id.split("?")[0];
        const out = await swc(code, {
          filename: file,
          sourceMaps: false,
          jsc: {
            parser: { syntax: /\.tsx?$/.test(file) ? "typescript" : "ecmascript", tsx: file.endsWith(".tsx"), jsx: !/\.tsx?$/.test(file) },
            target: "es2022",
            transform: { react: { runtime: "automatic" } },
            experimental: { plugins: [["@swc/plugin-styled-jsx", {}]] },
          },
          module: { type: "es6" },
        });
        code = out.code;
      }
      // 5. `dynamic(() => import("…"))` without options: Next draws it on the
      //    server like a normal import (only the browser file is split), so
      //    here it becomes a normal import.
      if (code.includes("next/dynamic")) {
        /** @type {string[]} */
        const imports = [];
        code = code.replace(/\bdynamic\(\s*\(\)\s*=>\s*import\((['"])([^'"]+)\1\)\s*\)/g, (_, quote, spec) => {
          const name = `__nextDynamic${imports.length}`;
          imports.push(`import ${name} from ${JSON.stringify(spec)};`);
          return name;
        });
        if (imports.length) code = imports.join("\n") + "\n" + code;
      }
      if (!code.includes("import(`@/")) return code === original ? null : { code, map: null };
      const out = code.replace(/import\(`@\/([\w\-/]+)\/\$\{([^}`]+)\}`\)/g, (_, dir, expr) => {
        const base = JSON.stringify(`/${dir}/`);
        return `((m, k) => { const f = m[k + ".ts"] ?? m[k + ".tsx"] ?? m[k + ".js"] ?? m[k + ".jsx"]; return f ? f() : Promise.reject(new Error("Cannot find module " + k)); })(import.meta.glob(${JSON.stringify(`/${dir}/*.{ts,tsx,js,jsx}`)}), ${base} + (${expr}))`;
      });
      return out === original ? null : { code: out, map: null };
    },
    load(id) {
      if (id === "\0" + VIRTUAL) {
        const entries = clientFiles().map((file) => `  ${JSON.stringify(idOf(file))}: () => import(${JSON.stringify(file)}),`);
        return `export default {\n${entries.join("\n")}\n};\n`;
      }
      if (id.startsWith(ISLAND)) {
        const file = id.slice(ISLAND.length);
        const names = exportNames(fs.readFileSync(file, "utf8"));
        const ref = JSON.stringify(idOf(file));
        const lines = [
          `import * as M from ${JSON.stringify(file)};`,
          `import { islandWrap } from ${JSON.stringify(compat("islands.tsx"))};`,
          ...names.map((name) =>
            name === "default"
              ? `export default islandWrap(M.default, ${ref}, "default");`
              : `export const ${name} = islandWrap(M.${name}, ${ref}, ${JSON.stringify(name)});`,
          ),
        ];
        return lines.join("\n");
      }
      return null;
    },
  };
}
