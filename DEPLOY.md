# Going live — hsgattorneys.co.za

The new site is a folder of files. Going live means putting that folder where
WordPress currently lives, with the contact-form mail config alongside it. Do it on a
staging subdomain first so the partners can review, then cut over.

## Where things are hosted
This repository is public, so the hosting details (servers, accounts, mailboxes) are kept
in the firm's own records, not here. What matters for going live:

- The live domain, its WordPress site and **the domain's email are on the same hosting
  package**. Nothing here moves it; nobody should move the package or change the
  domain's MX record as part of this.
- **Going live** needs access to that package. The least to ask its holder for is an
  **FTP user on that package** — enough for the cut-over and for the admin's automatic
  publishing, and it cannot touch email or DNS. The host accepts uploads over **SFTP on
  port 22** only; the publishing workflow uses SFTP.
- A **review copy** can go on a separate subdomain package instead, with no one else
  needed.

## 0. Before anything: back up WordPress
The WordPress package's control panel → **Backup** → download a full backup (files + database). Keep it for
at least a few months; it is the only way back to the old site.

## 1. Stage it on a subdomain (review copy)
This is how the directors see it before anything touches the live site.

1. The hosting control panel (the account that holds the calculators app) → **Web Hosting → Add** →
   `new.hsgattorneys.co.za`. Note the web-root folder it creates, and switch on SSL for it
   as for the app. (A second paid package; cancel it after go-live.)
2. On your PC: `npm run pack:staging` → **`hsg-site-staging.zip`**. Use this one for
   staging, not `hsg-site.zip`: every page in it is marked `noindex`, robots.txt
   disallows everything and the server sends `X-Robots-Tag: noindex`, so the draft can
   never be indexed or compete with the live site in Google.
3. The package's **File Manager** → open that folder → **Upload** the zip → select it →
   **Extract** → delete the zip. Confirm `.htaccess` is there (turn on *Show hidden
   files* if you can't see it). Or, once the admin's automatic publishing is set up
   (README › Website admin), point it at this folder and skip the zip altogether.
4. Copy `mail-config.php` from the app's folder (`app.hsgattorneys.co.za`) into this
   folder so the contact and testimonial forms can send; or create it from
   `mail-config.example.php`. Without it the contact form falls back to opening the
   visitor's email app.
5. **Put a password on it** (recommended for a client-facing draft): the package's
   password-protected directories → the subdomain's folder → add one user, e.g. `hsg`
   with a shared password. Send the directors the address plus that username and
   password.
6. Test before sending: every menu item, the calculators, the LinkedIn posts, a real
   contact-form submission, and the 404 page. (Client testimonials are switched off for
   now; when they are back on, a test one should arrive by email.)

Send the directors: the address, the login if you set one, and a note that it is a
draft for comment.

## 1b. Or put it in a folder of the WordPress site (no subdomain needed)
If creating a subdomain is awkward, the review copy can live *inside* the current site
at `hsgattorneys.co.za/review/`. WordPress serves real files and folders before its own
routing, so it does not interfere — and WordPress itself is untouched. This one needs
access to the account that holds the WordPress site (see *Where things are hosted*).

1. `npm run pack:review` → `hsg-site-staging.zip`, built for that folder and noindex.
2. In File Manager, open `public_html`, create a folder named `review`, upload the zip
   into it and **Extract**. (If you have no hosting access at all, a WordPress
   file-manager plugin can do the same job — but see the warning below.)
3. Copy `mail-config.php` in beside the extracted files if you want the form to send.
4. Password-protect the `review` folder as in step 5 above, then send the directors
   `https://hsgattorneys.co.za/review/`.

The folder name is baked into the links, so `--base=review` must match the folder you
create. To use a different name, rebuild with `node scripts/build.mjs --staging --base=yourname`.

**Warning about file-manager plugins:** they run as WordPress, so a mistake can damage
the live site, and they are a common target for attacks. Prefer real hosting access;
if you must use one, install it, do the upload, then remove it.

## 2. Cut over (replaces WordPress)
Done in the account that holds `hsgattorneys.co.za` (see *Where things are hosted*).
Only the web folder changes; the domain's email and DNS are left exactly as they are.

1. That package's File Manager → the main document root (`public_html`). **Rename** it to
   `public_html_wordpress` rather than deleting it (instant rollback), then create a
   fresh `public_html`.
2. Upload and extract `hsg-site.zip` into the new `public_html`; copy `mail-config.php`
   in beside it.
3. Test https://hsgattorneys.co.za — including a handful of **old URLs** to confirm the
   redirects (e.g. `/about-us/`, `/team-summary/`, `/land-legal-sector/planning-law-service/`,
   `/contact-us/`). Each should land on its new page with a 301.
4. Submit the new sitemap in Google Search Console: `https://hsgattorneys.co.za/sitemap.xml`.
5. Cancel/uninstall nothing yet — after a week with no problems, delete
   `public_html_wordpress` and drop the WordPress database (the package's control panel → databases).
   Until then, WordPress is just dormant files.

## 3. Put Cloudflare in front (recommended, free)
Cloudflare gives a global CDN, caching of the static files at the edge, HTTP/3,
DDoS protection and automatic HTTPS — the last big performance step.
1. Sign up at cloudflare.com, add `hsgattorneys.co.za`, let it import the DNS records,
   and change the nameservers at the registrar to the two it gives you.
2. SSL/TLS → **Full (strict)**. Enable **Always Use HTTPS** and **HSTS** (the site
   already sends HSTS itself).
3. Speed → enable **Brotli**, **Early Hints**, **Auto Minify** is unnecessary (already small).
4. Caching → **Browser Cache TTL: Respect Existing Headers**. Optionally a Cache Rule
   to cache HTML at the edge for 1 hour (safe: pages only change when you upload).
5. Keep the `app` subdomain record proxied too, unless the PWA's service worker
   misbehaves — then set it to DNS-only.

## Updating the site later
Normally through the admin (`/admin`): save, and the site rebuilds and uploads itself.
After go-live, change the repository variables to the live package — `DEPLOY_DIR` to its
web root and `SITE_MODE` to `live` — and give the FTP secrets for that package's FTP user,
plus `SFTP_KNOWN_HOSTS` (the server's public key: one line from `ssh-keyscan <host>`).
The upload never deletes anything on the server; a page removed from the site must be
deleted there by hand.

By hand, if ever needed:
```bash
npm run build && npm run check && npm run pack
```
Upload `hsg-site.zip` to the document root and extract, choosing to overwrite. CSS
and JS carry a content hash in their URLs, so visitors always get the new version;
`mail-config.php` and the lead logs are untouched because they are not in the zip.
`npm run pack` refuses to zip a staging build as the live site.

## Where enquiries go
`contact.php` validates, rate-limits, writes `leads.log.jsonl` and sends via SMTP using
`mail-config.php`. Every log goes in a `hsg-leads/` folder beside the web root (outside
it, so never served) when that folder exists and is writable; otherwise in the web root,
blocked from the public by `.htaccess`. Logs are trimmed to 365 days, at most once a day,
when a real enquiry comes in.
If the email ever fails, the lead is still in the log and the error in
`mail-errors.log`. The recipient is `to` in `mail-config.php` (or `contact_to` if you
want website enquiries separated from calculator quotes).

Testimonials go through `testimonial.php`: kept in `testimonials.log.jsonl` and emailed
to `testimonials_to` (or `to`); never committed to the repository, which is public.
Failures are in `testimonial-errors.log`. All of these logs are refused over HTTP by
`.htaccess`. While testimonials are switched off the build leaves `testimonial.php` out;
if an older copy is on the server, delete it, and remove any `'github'` block from the
server's `mail-config.php` (revoking that token in GitHub too, if one was ever made).

## Rollback
Rename `public_html` → `public_html_new` and `public_html_wordpress` → `public_html`.
Nothing else changes.
