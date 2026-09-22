// Shared rendering helpers for the static build: escaping, responsive images,
// inline icons, and the page chrome (head, header, menu, footer).
import { readFileSync } from 'node:fs';

export const site = JSON.parse(readFileSync('content/site.json', 'utf8'));
export const images = JSON.parse(readFileSync('build/images.json', 'utf8'));

export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const attr = s => esc(s).replace(/'/g, '&#39;');
export const slugify = s => String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const telHref = n => 'tel:' + String(n).replace(/[^\d+]/g, '');
export const waHref = n => 'https://wa.me/' + String(n).replace(/[^\d]/g, '');
export const mapHref = q => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
export const fmtDate = iso => new Date(iso + 'T00:00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });

export const arrow = (cls = 'arrow') => `<svg class="${cls}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 8h11M8.5 3.5 13 8l-4.5 4.5"/></svg>`;
export const arrowLeft = (cls = 'arrow') => `<svg class="${cls}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 8H3M7.5 3.5 3 8l4.5 4.5"/></svg>`;
export const playIcon = () => `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 2.5v11l9-5.5z"/></svg>`;
export const emblem = () => `<svg viewBox="0 0 24.3 19.63" fill="currentColor" aria-hidden="true"><path d="M17.55,18.89H4.49L8,12l12.3,3.67ZM3.11,5.31l4.28,6.31L4,18.26.81,7.26ZM8.39.76l4.24.34V12.65L8.05,11.28,3.68,4.82ZM20.82,15.1l-7.45-2.23V1.69l9.94,10.54ZM13.17.4l-5-.4L0,7.05,3.63,19.63H17.89l6.41-7.42Z"/></svg>`;

/** Responsive <img> from the image manifest. `key` is "folder/name" (extension-less). */
export function img(key, { alt = '', sizes = '100vw', cls = '', loading = 'lazy', priority = false, width, height, colour = false } = {}) {
  const k = key.replace(/\.[a-z]+$/i, '');
  const m = images[k];
  if (!m) { console.warn('image missing from manifest:', key); return ''; }
  if (m.type === 'file') return `<img src="${m.src}"${m.width ? ` width="${m.width}" height="${m.height}"` : ''} alt="${attr(alt)}"${cls ? ` class="${cls}"` : ''}${priority ? '' : ' loading="lazy"'} decoding="async">`;
  const variants = colour && m.colour ? m.colour : m.variants;
  const srcset = variants.map(v => `${v.src} ${v.w}w`).join(', ');
  const largest = variants[variants.length - 1];
  return `<img src="${largest.src}" srcset="${srcset}" sizes="${sizes}" width="${width || m.width}" height="${height || m.height}" alt="${attr(alt)}"${cls ? ` class="${cls}"` : ''} loading="${priority ? 'eager' : loading}"${priority ? ' fetchpriority="high"' : ''} decoding="async">`;
}
export function icon(name) { return images[`services/${name}`]?.svg || ''; }
export function hasImage(key) { return !!images[String(key || '').replace(/\.[a-z]+$/i, '')]; }

/** Split a heading into per-word spans for the staggered rise animation. */
export function words(text) {
  return text.split(' ').map((w, i) => `<span class="hero-word"><span style="--i:${i}">${esc(w)}</span></span>`).join(' ');
}

const navLinks = (current) => site.nav.map(n => {
  const active = n.href !== '/' && current.startsWith(n.href) ? ' aria-current="page"' : '';
  return `<li><a href="${n.href}"${active}${n.external ? ' rel="noopener"' : ''}>${esc(n.label)}</a></li>`;
}).join('');

function header(current) {
  return `<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header chrome">
  <div class="wrap">
    <a class="brand" href="/" aria-label="${attr(site.name)} — home"><img src="/images/brand/hsg-lockup-white.png" width="445" height="327" alt="${attr(site.name)}" decoding="async" fetchpriority="high"></a>
    <nav aria-label="Primary"><ul class="nav-links">${navLinks(current)}</ul></nav>
    <div class="nav-actions">
      <a class="btn btn-sm" href="${site.cta.href}">${esc(site.cta.label)}${arrow()}</a>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="menu"><span class="nav-toggle-label">Menu</span><span class="bars" aria-hidden="true"><span></span><span></span><span></span></span></button>
    </div>
  </div>
</header>
<div class="menu chrome" id="menu">
  <nav aria-label="Mobile">
    <ul>${site.nav.map((n, i) => `<li style="--i:${i}"><a href="${n.href}"${n.external ? ' rel="noopener"' : ''}>${esc(n.label)}${arrow()}</a></li>`).join('')}</ul>
  </nav>
  <div class="menu-foot">
    ${site.offices.map(o => `<div><strong>${esc(o.city)}</strong> · <a href="${telHref(o.phones[0])}">${esc(o.phones[0])}</a></div>`).join('')}
    <div><a href="mailto:${site.email}">${site.email}</a> · <a href="${waHref(site.whatsapp)}" rel="noopener">WhatsApp</a></div>
  </div>
</div>`;
}

function footer() {
  const services = JSON.parse(readFileSync('content/services.json', 'utf8'));
  return `<footer class="site-footer chrome">
  <div class="wrap">
    <div class="footer-grid">
      <div class="footer-brand">
        <img src="/images/brand/hsg-lockup-white.png" width="445" height="327" alt="${attr(site.name)}" loading="lazy" decoding="async">
        <p>${esc(site.description)}</p>
      </div>
      <div>
        <h3>Practice</h3>
        <ul>${services.pillars.map(p => `<li><a href="/practice/#${p.id}">${esc(p.title)}</a></li>`).join('')}<li><a href="/practice/">All practice areas</a></li></ul>
      </div>
      <div>
        <h3>Firm</h3>
        <ul><li><a href="/about/">About</a></li><li><a href="/team/">People</a></li><li><a href="/insights/">Insights</a></li><li><a href="/calculators/">Calculators</a></li><li><a href="/contact/">Contact</a></li></ul>
      </div>
      <div>
        <h3>Contact</h3>
        <ul>${site.offices.map(o => `<li><strong>${esc(o.city)}</strong><br><a href="${telHref(o.phones[0])}">${esc(o.phones[0])}</a></li>`).join('')}<li><a href="mailto:${site.email}">${site.email}</a></li><li><a href="${waHref(site.whatsapp)}" rel="noopener">WhatsApp ${esc(site.whatsapp)}</a></li></ul>
      </div>
    </div>
    <div class="footer-legal">
      <div>© <span id="year">${new Date().getFullYear()}</span> ${esc(site.name)} · ${esc(site.legalName)} · <span class="group-mark">${emblem()} A division of ${esc(site.group)}</span></div>
      <ul><li><a href="/privacy/">Privacy policy</a></li><li><a href="/terms/">Terms &amp; conditions</a></li></ul>
    </div>
  </div>
</footer>`;
}

/**
 * Full document. `path` is the canonical path ("/practice/planning-law/").
 */
export function layout({ title, description, path, body, bodyClass = '', ogImage = '/images/og-default.jpg', jsonld = [], noindex = false, module = '', base = '', assets }) {
  const url = site.url + base + path;
  const fullTitle = path === '/' ? `${site.name} — ${site.tagline}` : `${title} — ${site.name}`;
  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'LegalService', '@id': site.url + '/#organization',
      name: site.name, legalName: site.legalName, url: site.url, email: site.email, telephone: site.offices[0].phones[0],
      logo: site.url + '/images/brand/hsg-lockup-black.png', image: site.url + ogImage, foundingDate: String(site.founded),
      parentOrganization: { '@type': 'Organization', name: site.group },
      areaServed: 'ZA',
      address: site.offices.map(o => ({ '@type': 'PostalAddress', streetAddress: o.address.join(', '), addressLocality: o.city, addressRegion: o.region, addressCountry: 'ZA' })),
      ...(site.linkedin ? { sameAs: [site.linkedin] } : {}),
    },
    ...jsonld,
  ];
  return `<!doctype html>
<html lang="en-ZA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${attr(description)}">
<link rel="canonical" href="${url}">
${noindex ? '<meta name="robots" content="noindex, follow">' : ''}
<meta name="theme-color" content="#0a0a0b">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${attr(site.name)}">
<meta property="og:locale" content="en_ZA">
<meta property="og:title" content="${attr(fullTitle)}">
<meta property="og:description" content="${attr(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${site.url}${ogImage}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/fonts/jost-regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/instrument-sans-regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/site.css?v=${assets.css}">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body class="${bodyClass}">
${header(path)}
<main id="main">
${body}
</main>
${footer()}
<script src="/js/facets.js?v=${assets.facets}" defer></script>
<script src="/js/site.js?v=${assets.js}" defer></script>
${module ? `<script type="module" src="${module}?v=${assets.module}"></script>` : ''}
</body>
</html>`;
}

export function breadcrumbs(items) {
  return `<ol class="crumbs">${items.map(([label, href]) => `<li>${href ? `<a href="${href}">${esc(label)}</a>` : `<span aria-current="page">${esc(label)}</span>`}</li>`).join('')}</ol>`;
}
export function breadcrumbLd(items) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map(([name, href], i) => ({ '@type': 'ListItem', position: i + 1, name, ...(href ? { item: site.url + href } : {}) })) };
}
