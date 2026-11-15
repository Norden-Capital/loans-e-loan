# e-loan.ca: Next.js → Astro, check report

Branch: `astro-migration` (local only; not committed, not pushed, not deployed).
Date of check: 2026-11-15.

The site was moved the same way as 365loan.ca: the same Astro setup ("Next compatibility" layer), so the old pages, components and content stay as they were. Only this repo's own code and IDs are used (domain `https://e-loan.ca` from `lib/seo.ts` / `lib/site.ts`).

How the check was done:
- Old site: a Next.js production build of this repo's `main` (port 3102), in a separate copy outside the repo.
- New site: `npm run build` + `PORT=4324 npm run preview`.
- Crawl of every sitemap URL, files and test URLs; layout and behaviour in a real browser, both sites side by side. GA, Clarity and LeadScout were blocked in the test browser.

## Result in one line

All 263 pages, all files, all tracking, the layout and the behaviour match. Differences:
1. Blog and news share-image links have no `?158256b540a4da44` at the end (old: `…/opengraph-image-x8nqxr?158256b540a4da44`). Same image, same path; only the cache code is gone, as on 365loan.ca and LoanHero.
2. `/loans/by-amount/999999` shows the real 404 page (old: an empty page). Status 404 on both.
3. Share images: tiny letter-edge pixel changes only (max 0.59% of pixels).
4. New page `/unsubscribe` (section 6).

## 1. Pages, head tags, text

| Check | Result |
|---|---|
| Sitemap pages | 263 old, 263 new + `/unsubscribe` |
| Head tags + body text | **175 identical**; the other 88 (blog + news posts) differ only by the share-image cache code (point 1 above) |
| 404 pages (`/does-not-exist`, `/index.html`, …) | same text, same tags (incl. both robots tags, as before) |
| `/api/contact` | GET 405; POST handled by the same code (not sent) |

## 2. Files

robots, sitemaps, manifest, feeds, favicon, icon, share images (89), logos, IndexNow key, Search Console file (`google211528508b1fc7e4.html`): **same content**. Only local-server header differences (`Cache-Control`, charset), as on 365loan.

## 3. Layout and behaviour

- **Layout:** 21 key pages × computer (1280) + phone (390): **42 of 42 identical** to the pixel.
- **Behaviour, same on both:** header menus, mobile menu, cookie banner, FAQ boxes (open/close on 4 page types), loan calculator (same numbers before/after moving the slider), contact form (not sent), apply form: LeadScout starts with the same settings (checked with a fake LeadScout file; sub1 `e-loan`). No console errors on any tested page.
- Friday countdown bar: not visible today (Sunday) on both; same code.

## 4. Tracking (this site's own IDs)

| Piece | ID | Result |
|---|---|---|
| Google Analytics 4 | `G-NWTTF2RR1X` | ✅ same as old, on every tested page (15) |
| Microsoft Clarity | `y1rlike05u` | ✅ same |
| JSON-LD | site-wide + per page | ✅ same ids and content size |
| LeadScout | affiliate `4PrKYVa8`, sub1 `e-loan` | ✅ same options |
| IndexNow / Search Console | `public/indexnow-key.txt`, `public/google211528508b1fc7e4.html` | ✅ unchanged, served the same. No real IndexNow submission was made. |

## 5. Speed (JavaScript sent to the browser, gzip)

| Page | Old (Next) | New (Astro) |
|---|---|---|
| Home | 265 KB | 160 KB |
| Blog post | 295 KB | 142 KB |
| /contact | 265 KB | 140 KB |
| /resources/tools (calculator) | 271 KB | 145 KB |

HTML is also smaller (home 37 → 29 KB gzip).

## 6. New page: /unsubscribe

Built from the Art Direction mockup (`LMS/design/brand-unsubscribe/e-loan`). **Not reviewed by the owner yet.**
- Look: same band, intro and form row as /contact; title "Stop our emails.", form head "Remove me from the list", square ink/lime reason rows, 2 side boxes, contact strip removed. Compared with the mockup in all 5 states, computer + phone: same size and position for everything. Only differences: the curly apostrophe in "You’re" (as on LoanHero), and the button label sits in its own `<span>` (same as the contact button; it keeps the pixel hover effect).
- The band uses the site's live moving grid (the mockup shows a still grid picture).
- Head: canonical `https://e-loan.ca/unsubscribe`, title "Unsubscribe | E-Loan"; added to `/sitemap/pages.xml`.
- Server route: sends `host: "e-loan.ca"` to the LMS (checked with a fake LMS on this computer; nothing reached the real LMS). Bad email → 400, LMS error → "Something went wrong". Test mode without `LMS_URL` / `PROXY_SECRET`: nothing sent, 503. GET → 405.
- Not tested: the real LMS (needs `LMS_URL` and `PROXY_SECRET` on Vercel; owner only).

## 7. Not checked (needs a Vercel preview deploy, owner + DevOps)

Vercel image optimizer, cache headers, real contact email, the Vercel "Framework" setting (change only at launch, after the owner says yes).

## 8. What changed in the code

- Added (same as 365loan.ca): `astro.config.mjs`, `integrations/`, `lib/compat/`, `src/`, `scripts/serve-local.mjs`.
- `lib/compat/site.ts`: this site's fonts, icons and share-image links (from its own Next build).
- `src/pages/blog/[slug]/opengraph-image-x8nqxr.ts` and `news/[slug]/opengraph-image-mze28o.ts`: same share-image paths as the old site.
- `public/favicon.ico`, `public/icon.png`, `public/opengraph-image.png`: copies of the files in `app/` (served at the same URLs).
- `package.json` / lock, `tsconfig.json` (`verbatimModuleSyntax: false`, as Next had), `.gitignore`.
- Unsubscribe: `app/(main)/unsubscribe/page.tsx`, `components/unsubscribe/unsubscribe-form.tsx`, `app/api/unsubscribe/route.ts`, `lib/unsubscribe.ts`, `src/pages/api/unsubscribe.ts`, one line + one date in `lib/sitemap.ts`.
- Removed: `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`. All other source is unchanged. `npm run check`: 0 errors, 0 warnings.

Shared improvements made for this site (also copied to 365loan.ca / .online, re-checked there: all pages unchanged, no errors):
- Interactive parts that get server-made content (the FAQ boxes) now work as one piece, like in Next.
- Twitter share tags filled from the Open Graph tags when a page has none, like Next.
- `import(\`@/lib/…/${name}\`)` (province, guide, loan-type pages) works.
- Images pass on extra settings (e.g. `draggable`), like Next.

## How to open the new site locally

```bash
npm install
npm run build
PORT=4324 npm run preview
```

Then open http://localhost:4324.
