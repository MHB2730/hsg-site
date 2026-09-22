# Going live — hsgattorneys.co.za

The new site is a folder of files. Going live means putting that folder where
WordPress currently lives, with the contact-form mail config alongside it. Do it on a
staging subdomain first so the partners can review, then cut over.

## 0. Before anything: back up WordPress
cPanel → **Backup** → download a full account backup (files + database). Keep it for
at least a few months; it is the only way back to the old site.

## 1. Stage it on a subdomain (review copy)
1. cPanel → **Domains** → create subdomain `new` on `hsgattorneys.co.za`. Note the
   document-root folder it creates (e.g. `/home/USER/new.hsgattorneys.co.za`).
2. On your PC: `npm run build && npm run check && npm run pack` → `hsg-site.zip`.
3. cPanel → **File Manager** → open that folder → **Upload** `hsg-site.zip` → select it
   → **Extract** → delete the zip. Confirm `.htaccess` is present (enable *Show hidden
   files* in File Manager settings if it isn't listed).
4. Copy `mail-config.php` from the app's folder (`app.hsgattorneys.co.za`) into this
   folder — same SMTP credentials work — or create it from
   `mail-config.example.php`. It is never in the zip.
5. **Temporarily** stop search engines indexing the staging copy: add
   `Header set X-Robots-Tag "noindex"` to the top of `.htaccess` on the staging
   folder only (remove it before cut-over, or simply never copy that line).
6. Open https://new.hsgattorneys.co.za and test: every menu item, the calculators
   link, the map buttons, the video, a real contact-form submission (check the email
   arrives and that `leads.log.jsonl` was written), and the 404 page.

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
