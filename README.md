# hsgattorneys.co.za — static site

The firm's website, rebuilt as a static site: plain HTML/CSS/JS generated from JSON
content by a small Node script. No database, no plugins, nothing to patch on the server.

- **Content** lives in `content/` — edited through the **website admin** at `/admin`
  (see below), or by hand; either way the site rebuilds from it.
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
npm run pack         # dist/ → hsg-site.zip for the host
npm run pack:staging # same, but noindex throughout → hsg-site-staging.zip (review copies)
npm run pack:review  # noindex AND built for a subfolder (hsgattorneys.co.za/review/)
```

## GitHub Pages preview

In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**. The `Build and deploy GitHub Pages` workflow builds and deploys the static site when `main` changes; it can also be run manually from the Actions tab. The project site is served under `/hsg-site`, and `npm run build:github-pages` applies that base path when building locally. Run `npm run check:github-pages` to check the generated output.

Contact and testimonial submission forms are disabled in this build. The contact page retains the firm's telephone, email and WhatsApp links. Published testimonials remain visible. The Pages preview is marked noindex; `robots.txt` permits crawlers to read that metadata, and the build does not generate the production sitemap. For a local preview, run `npm run serve` and open `http://localhost:4180/hsg-site/`.

## Editing content

| What | File | Notes |
|---|---|---|
| Firm details, offices, phones, nav, stats | `content/site.json` | **In the admin** (Settings › Firm details). |
| Homepage copy | `content/home.json` | Hero, statement, section headings, contact band. |
| Practice areas | `content/services.json` | Four `pillars`, thirteen `services`. Each service: `title`, `summary` (card text), `metaDescription`, `body` (array of HTML blocks), `icon`. |
| People | `content/team/<slug>.json` | **In the admin.** One file per person; the file name is their page address (`/team/<slug>/`). `section` is one of `directors`, `associates`, `management`, `professionals`; within a section people are listed by `order`, lowest first. A person gets a profile page only if `bio` has at least one paragraph. `photo` is a file in `images/src/team/`. |
| About page | `content/about.json` | History milestones, B-BBEE facts, notable appointments (also drives the homepage timeline), values. |
| Case studies | `content/projects.json` | Shown on the About page under Projects. |
| Insights | `content/articles/<slug>.json` | **In the admin.** One file per article; the file name is its address (`/insights/<slug>/`). `date` (YYYY-MM-DD), `title`, `excerpt`, `image` (in `images/src/articles/`), `body` in Markdown. Newest first automatically. |
| Privacy / Terms | `content/legal/*.json` | Update `modified` when the text changes. |
| LinkedIn posts | `content/linkedin.json` | **In the admin** (Settings › LinkedIn posts). Hand-picked posts, at the top of Insights. Paste a post's "Embed this post" snippet, its plain link, or a bare urn into `embed` — all three carry the id. `caption` is the heading shown on the card, so make it say what the post is about. Newest first; `initialCount` sets how many show before "Show more"; an empty list removes the section. |
| Client testimonials | `content/testimonials/*.json` + `content/testimonials.json` | **In the admin.** One file per testimonial, each `pending`, `published` or `declined`; only published ones with consent recorded reach the site. The settings file switches the home-page panel and the client form on and off. See *Client testimonials* below. |
| Calculators | `content/calculators.json` | Page copy, the disclaimer, and the fields of each calculator. |
| Old → new URL redirects | `content/redirects.json` | Baked into `.htaccess` at build time. |

Article bodies are Markdown. The fixed pages' copy (services, about) is an array of HTML
strings: `"<p>…</p>"`, `"<ul><li>…</li></ul>"`, `"<h2>…</h2>"`. Links between pages are
root-relative (`/practice/planning-law/`).

If a save leaves an entry unusable — a missing name, a photo that is not there, a
testimonial published without consent — the build stops and names the file, and nothing
is published.

## Website admin (`/admin`)

[Sveltia CMS](https://sveltiacms.app): forms for People, Articles, Testimonials, LinkedIn
posts and Firm details. It has no server side; every save is a commit to this repository,
and `.github/workflows/publish.yml` then rebuilds, checks and uploads the site — two to
three minutes. Every change is in the history, with who made it, and can be undone.
The fields are defined in `src/admin/config.yml`; every key in every file it edits is
listed there, so a save never drops a value the site depends on.

**Setting it up (once):**
1. The repository is on GitHub: `MHB2730/hsg-site` (the name is in
   `src/admin/config.yml`). It is **public**, so nothing personal or secret may ever be
   committed: no client details, no passwords, no hosting details.
2. **Signing in:** GitHub › Settings › Developer settings › Fine-grained tokens › *Generate*.
   Repository access: *only* `hsg-site`. Permissions: *Contents: Read and write*. Then
   `/admin` › **Sign In Using Access Token** and paste it. The browser keeps you signed in.
3. **Publishing:** in the repository, Settings › Secrets and variables › Actions:
   secrets `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD` (the hosting package's upload
   user, not a control-panel login); variables `DEPLOY_DIR` (the folder on the server,
   ending in `/`), `SFTP_KNOWN_HOSTS` (one line from `ssh-keyscan <host>`, so the password
   only goes to the real server) and `SITE_MODE` (`staging` until go-live, then `live`).
   Uploads go over SFTP (port 22) and never delete anything on the server.
   Until `DEPLOY_DIR` is set, saves still build and check but upload nothing.
4. The server holds **no** GitHub token. (Testimonials used to be committed from the
   server; they are now emailed and logged only, because the repository is public.)

**Without GitHub:** open `http://localhost:4180/admin/` (after `npm run build` and
`npm run serve`) in Chrome or Edge and choose **Work with Local Repository**, then this
folder. It edits the files here directly; build and upload by hand as before.

## Client testimonials

- Clients write one at `/testimonials/#share` (linked from the home-page panel and the
  Contact page). They choose how they are named — in full, by initials, or not at all —
  and must tick consent. Their email is never published.
- `testimonial.php` keeps the full submission in `testimonials.log.jsonl` (denied over
  HTTP) and emails it to the firm with the client's address. It is never committed to
  this repository, which is public. Nothing is public at this point.
- To publish one: confirm it with the client, then add it in the admin under
  **Testimonials** with status **Published**, and save. It is on the site a few minutes later.
- **Switched off as of 20 November 2026** (both switches in `content/testimonials.json`):
  no panel, no page, no form, and the build leaves `testimonial.php` out of `dist/`.
  Turn `invite.enabled` back on when the firm is ready to collect them.
- **Settings › Testimonials** switches the home-page panel and the client form on and off
  independently, and sets the wording. The average rating is worked out from what is
  published, and only shown once there are enough.
- The six sample testimonials (`"sample": true`) show on staging builds only, labelled,
  and never on the live site — `npm run check` fails a live build that contains them.
  Delete them once real ones are in.

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
  cursor through a feathered opening (`.lens`). A click opens the colour out from that
  point across the whole frame. Touch screens have no cursor, so there the colour opens
  by itself once the photo reaches the middle of the screen, the "move over the photo"
  hint is hidden, and a tap still toggles it.
- **Hero photograph** — a greyscale scene (`scenes/plans-overhead`) dimmed behind the
  home page statement, under the Facets linework, fading out above the figures row.
- **LinkedIn posts** — LinkedIn has no public feed API for company pages, so the posts
  are chosen by hand in `content/linkedin.json` and lead the Insights page. Each is a
  card of ours — our caption as the heading, then LinkedIn's own official embed — and an
  embed is only fetched once its card nears the viewport, so a long list costs nothing
  until it is read. Six show at first; "Show more posts" reveals the rest.
  `frame-src` in `server/.htaccess` includes linkedin.com for this.
- **Timeline**, **count-up stats**, **magnetic CTAs**, **in-page nav** on About.

`npm run check` also runs `scripts/copy-lint.mjs`: headings never end in a full stop,
eyebrows carry no punctuation, leads end in one, no double spaces. Paragraph copy is
set ragged-right (left-aligned) site-wide; it was justified until November 2026, which
opened wide gaps between words on phones.

## Conventions
- Brand: black chrome (`--chrome`), white paper, greys — no accent colour.
- Type: Jost for display, Instrument Sans for text (self-hosted, OFL). Jost is a
  geometric sans in the same family of shapes as the lettering in the HSG logo.
- Motion respects `prefers-reduced-motion`; third parties (YouTube, Google Maps) load
  only when a visitor clicks their facade, which keeps the CSP strict.
- Every page: one `<h1>`, a meta description, canonical URL, Open Graph tags and
  JSON-LD (LegalService + BreadcrumbList; Person / Article / Service where relevant).
