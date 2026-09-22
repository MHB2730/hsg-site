# Going live — hsgattorneys.co.za

The new site is a folder of files. Going live means putting that folder where
WordPress currently lives, with the contact-form mail config alongside it. Do it on a
staging subdomain first so the partners can review, then cut over.

## 0. Before anything: back up WordPress
cPanel → **Backup** → download a full account backup (files + database). Keep it for
at least a few months; it is the only way back to the old site.

## 1. Stage it on a subdomain (review copy)
This is how the directors see it before anything touches the live site.

1. cPanel → **Domains** → create subdomain `new` on `hsgattorneys.co.za`. Note the
   document-root folder it creates (e.g. `/home/USER/new.hsgattorneys.co.za`).
2. On your PC: `npm run pack:staging` → **`hsg-site-staging.zip`**. Use this one for
   staging, not `hsg-site.zip`: every page in it is marked `noindex`, robots.txt
   disallows everything and the server sends `X-Robots-Tag: noindex`, so the draft can
   never be indexed or compete with the live site in Google.
3. cPanel → **File Manager** → open that folder → **Upload** the zip → select it →
   **Extract** → delete the zip. Confirm `.htaccess` is there (turn on *Show hidden
   files* in File Manager settings if you can't see it).
4. Copy `mail-config.php` from the app's folder (`app.hsgattorneys.co.za`) into this
   folder so the contact form can send; or create it from `mail-config.example.php`.
   Without it the form falls back to opening the visitor's email app.
5. **Put a password on it** (recommended for a client-facing draft): cPanel →
   **Directory Privacy** → tick the subdomain folder → *Password protect this
   directory* → add one user, e.g. `hsg` with a shared password. Send the directors
   the address plus that username and password.
6. Test before sending: every menu item, the calculators, the LinkedIn posts, a real
   contact-form submission, and the 404 page.

Send the directors: the address, the login if you set one, and a note that it is a
draft for comment.

## 1b. Or put it in a folder of the WordPress site (no subdomain needed)
If creating a subdomain is awkward, the review copy can live *inside* the current site
at `hsgattorneys.co.za/review/`. WordPress serves real files and folders before its own
routing, so it does not interfere — and WordPress itself is untouched.

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
1. cPanel → File Manager → the main document root (`public_html`). **Rename** it to
   `public_html_wordpress` rather than deleting it (instant rollback), then create a
   fresh `public_html`.
2. Upload and extract `hsg-site.zip` into the new `public_html`; copy `mail-config.php`
   in beside it.
3. Test https://hsgattorneys.co.za — including a handful of **old URLs** to confirm the
   redirects (e.g. `/about-us/`, `/team-summary/`, `/land-legal-sector/planning-law-service/`,
   `/contact-us/`). Each should land on its new page with a 301.
4. Submit the new sitemap in Google Search Console: `https://hsgattorneys.co.za/sitemap.xml`.
5. Cancel/uninstall nothing yet — after a week with no problems, delete
   `public_html_wordpress` and drop the WordPress database (cPanel → MySQL Databases).
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
```bash
npm run build && npm run check && npm run pack
```
Upload `hsg-site.zip` to the document root and extract, choosing to overwrite. CSS
and JS carry a content hash in their URLs, so visitors always get the new version;
`mail-config.php` and the lead logs are untouched because they are not in the zip.

## Where enquiries go
`contact.php` validates, rate-limits, writes `leads.log.jsonl` (in the web root,
blocked from the public by `.htaccess`) and sends via SMTP using `mail-config.php`.
If the email ever fails, the lead is still in the log and the error in
`mail-errors.log`. The recipient is `to` in `mail-config.php` (or `contact_to` if you
want website enquiries separated from calculator quotes).

## Rollback
Rename `public_html` → `public_html_new` and `public_html_wordpress` → `public_html`.
Nothing else changes.
