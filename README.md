# hsgattorneys.co.za — static site

The firm's website, rebuilt as a static site: plain HTML/CSS/JS generated from JSON
content by a small Node script. No CMS, no plugins, nothing to patch on the server.

- **Content** lives in `content/*.json` — edit those, rebuild, upload.
- **Design** is `src/css/site.css` (one file, monochrome tokens at the top) and
  `src/js/site.js` (progressive enhancement; every page works without it).
- **Images** go in `images/src/<folder>/`; the build makes responsive WebP variants.
- **Server pieces** (`.htaccess`, `contact.php`, mail library) live in `server/`.
- **Output** is `dist/` — the exact folder that goes on the host.

## Quick start

```bash
npm install          # once (installs sharp for image processing)
npm run build        # images + pages → dist/
npm run serve        # preview at http://localhost:4180
npm run check        # JS parses, links / headings / alt text, copy consistency
npm run test:calc    # calculator figures, to check parity with the app
npm run pack         # dist/ → hsg-site.zip for cPanel
npm run pack:staging # same, but noindex throughout → hsg-site-staging.zip (review copies)
npm run pack:review  # noindex AND built for a subfolder (hsgattorneys.co.za/review/)
```

## Editing content

| What | File | Notes |
|---|---|---|
| Firm details, offices, phones, nav, stats | `content/site.json` | `linkedin` is empty until the firm's company-page URL is added. |
| Homepage copy | `content/home.json` | Hero, statement, section headings, contact band. |
| Practice areas | `content/services.json` | Four `pillars`, thirteen `services`. Each service: `title`, `summary` (card text), `metaDescription`, `body` (array of HTML blocks), `icon`. |
| People | `content/team.json` | One object per person, in display order. `section` is one of `directors`, `associates`, `management`, `professionals`. A person gets a profile page only if `bio` has at least one paragraph. `photo` points at `images/src/team/<slug>.<ext>`. |
| About page | `content/about.json` | History milestones, B-BBEE facts, notable appointments (also drives the homepage timeline), values. |
| Case studies | `content/projects.json` | Shown on the About page under Projects. |
| Insights | `content/articles.json` | `date` (YYYY-MM-DD), `title`, `excerpt`, `image`, `body` (HTML blocks). Newest first automatically. |
| Privacy / Terms | `content/legal/*.json` | Update `modified` when the text changes. |
| LinkedIn posts | `content/linkedin.json` | Hand-picked posts, at the top of Insights. Paste a post's "Embed this post" snippet, its plain link, or a bare urn into `embed` — all three carry the id. `caption` is the heading shown on the card, so make it say what the post is about. Newest first; `initialCount` sets how many show before "Show more"; an empty list removes the section. |
| Client reviews | `content/reviews.json` | The panel on the home page. One object per review: `name`, `role`, `organisation`, `matter`, `rating` (1–5), `date` (YYYY-MM), `quote`. `summary` is the figure shown beside them. **`placeholder` must be `true` while the reviews are sample text** — that shows a "sample content" label on the page and makes `npm run pack` refuse to build the live zip. Set it to `false` once every review is a real one. |
| Calculators | `content/calculators.json` | Page copy, the disclaimer, and the fields of each calculator. |
| Old → new URL redirects | `content/redirects.json` | Baked into `.htaccess` at build time. |

Body copy is an array of HTML strings so it survives JSON without a Markdown
toolchain: `"<p>…</p>"`, `"<ul><li>…</li></ul>"`, `"<h2>…</h2>"`. Links between pages
are root-relative (`/practice/planning-law/`).

### Adding a team member
1. Drop a square-ish photo (≥ 640 px, JPG or PNG) into `images/src/team/` named after
   the slug, e.g. `jane-doe.jpg`.
2. Add an entry to `content/team.json` in the position you want it shown:
   ```json
   { "slug": "jane-doe", "name": "Jane Doe", "section": "associates",
     "position": "Associate Attorney", "qualifications": "LLB", "email": null,
     "linkedin": null, "membership": null, "projects": null, "bio": [], "photo": "team/jane-doe.jpg" }
   ```
3. `npm run build`, then upload (see DEPLOY.md).

### Adding an article
Add an object to `content/articles.json` (copy an existing one), put its image in
`images/src/articles/`, rebuild. The article gets `/insights/<slug>/`, appears on the
Insights page and in the sitemap.

## Calculators

`/calculators/` runs the four property calculators on the site itself. The arithmetic is
**not** reimplemented here: `src/js/tariffs.js` is the verified engine from the HSG
Property app, copied verbatim, and `tariffs.json` in the repo root ships to the web root
so the firm can edit rates on the host exactly as they do for the app. `npm run test:calc`
prints the figures for R1m / R2m / R3m / R5m to check parity against the app.

**If a rate changes, update it in both places** — this repo's `tariffs.json` and the app's
— or the two will disagree.

## Where it can live

By default every link and asset is root-relative, so the site expects to own the web
root — `npm run pack` for that. `--base=review` rewrites them all to sit under a
subfolder instead (`npm run pack:review`), which lets the site run *inside* the
existing WordPress site at `hsgattorneys.co.za/review/` without touching WordPress:
WordPress serves real files and folders before its own routing, so the folder just
works. Handy for showing people, and it needs no subdomain and no DNS.

## How the build works

`scripts/images.mjs` walks `images/src/`, writes WebP variants to `dist/images/` and a
manifest to `build/images.json`. Photography in `scenes/`, `projects/` and
`articles/` is rendered in greyscale (the brand is strictly black, white and grey);
headshots stay in colour and are desaturated by CSS, revealing colour on hover.
Service icons are normalised to `currentColor` and inlined.

`scripts/build.mjs` renders every page from the content files with plain template
literals (`scripts/lib/html.mjs` holds the shared header/footer/head), writes the
sitemap, robots.txt, `.htaccess` (with redirects) and copies the server files.
Only files whose source changed are re-encoded, so rebuilds take seconds.

Team photos use the largest original in the old media library, not the resized copy the
old site linked to. Six directors (Odwa, Karl, Jacques, Fuad, Tess, Warda) are still
limited to 350px because no larger file exists anywhere — they need a new photograph
before those profile pages can look sharp.

`scripts/import-wordpress.mjs` is the one-off importer that produced the initial
content from the old WordPress site. It is kept for the record; **re-running it would
overwrite hand edits in `content/`**, so do not run it unless you mean to.

## Interactive pieces (all in `src/js/site.js`, all optional)

- **Facets** (`src/js/facets.js`) — the emblem as fine linework: the rim of the brand
  artwork plus the four dividers between its facets, taken along the centre of each bar
  in the logo so the geometry matches the artwork at any stroke weight. It is **invisible
  at rest** — baked into offscreen layers and revealed only by a soft light that follows
  the cursor, fading away when the cursor leaves. Touch screens have no hover, so there
  the light traces the lines by itself. Mounts on any element with `data-facets` (the
  value scales intensity: `1` hero, `0.45` page heads, `0.35` contact band). Levers are
  in `cfg` at the top of `mount()` (`baseline` — raise above 0 to show it at rest —
  `intensity`, `radius`, `trail`, `width`, `reduced`) and the placements in `bake()`.
  Pauses off-screen and in hidden tabs; `prefers-reduced-motion` gets a faint static
  mark instead, since the cursor reveal is switched off for those visitors.
- **Practice explorer** — `role="tablist"` tabs with hover intent and arrow-key
  navigation on wide screens; the same markup becomes an accordion below 860 px.
- **Colour lens** — greyscale photo with a colour twin that bleeds in under the
  cursor through a feathered opening (`.lens`). A click, or a tap on a touch screen,
  opens the colour out from that point across the whole frame.
- **LinkedIn posts** — LinkedIn has no public feed API for company pages, so the posts
  are chosen by hand in `content/linkedin.json` and lead the Insights page. Each is a
  card of ours — our caption as the heading, then LinkedIn's own official embed — and an
  embed is only fetched once its card nears the viewport, so a long list costs nothing
  until it is read. Six show at first; "Show more posts" reveals the rest.
  `frame-src` in `server/.htaccess` includes linkedin.com for this.
- **Timeline**, **count-up stats**, **magnetic CTAs**, **in-page nav** on About.

`npm run check` also runs `scripts/copy-lint.mjs`: headings never end in a full stop,
eyebrows carry no punctuation, leads end in one, no double spaces. Paragraph copy is
justified site-wide (see the `p` rule at the top of `site.css`); labels and UI text stay
left-aligned so nothing short is stretched.

## Conventions
- Brand: black chrome (`--chrome`), white paper, greys — no accent colour.
- Type: Jost for display, Instrument Sans for text (self-hosted, OFL). Jost is a
  geometric sans in the same family of shapes as the lettering in the HSG logo.
- Motion respects `prefers-reduced-motion`; third parties (YouTube, Google Maps) load
  only when a visitor clicks their facade, which keeps the CSP strict.
- Every page: one `<h1>`, a meta description, canonical URL, Open Graph tags and
  JSON-LD (LegalService + BreadcrumbList; Person / Article / Service where relevant).
