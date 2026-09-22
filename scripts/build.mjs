// Static site build: content/*.json + build/images.json -> dist/**.
// Run `node scripts/images.mjs` first (or `npm run build`, which does both).
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import sharp from 'sharp';
import { site, esc, attr, img, icon, hasImage, arrow, arrowLeft, playIcon, words, layout, breadcrumbs, breadcrumbLd, telHref, waHref, mapHref, fmtDate } from './lib/html.mjs';

const J = f => JSON.parse(readFileSync(f, 'utf8'));
const home = J('content/home.json'), about = J('content/about.json'), team = J('content/team.json');
const { pillars, services } = J('content/services.json');
const articles = J('content/articles.json').sort((a, b) => b.date.localeCompare(a.date));
const projects = J('content/projects.json');
const legal = { privacy: J('content/legal/privacy.json'), terms: J('content/legal/terms.json') };
const calculators = J('content/calculators.json');
const linkedin = J('content/linkedin.json');
const redirects = J('content/redirects.json');

// `--staging` builds a review copy: every page is marked noindex and the server sends
// X-Robots-Tag too, so a draft on new.hsgattorneys.co.za can never be indexed or end up
// competing with the live site.
const STAGING = process.argv.includes('--staging');
const hash = f => createHash('sha1').update(readFileSync(f)).digest('hex').slice(0, 8);
const assets = { css: hash('src/css/site.css'), js: hash('src/js/site.js'), facets: hash('src/js/facets.js'), module: hash('src/js/calculators.js') };
const pages = []; // [path, lastmod?] for the sitemap
let written = 0;

function write(path, html, { lastmod, sitemap = true } = {}) {
  const file = path.endsWith('/') ? join('dist', path, 'index.html') : join('dist', path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html.replace(/\n\s*\n/g, '\n'));
  if (sitemap) pages.push([path, lastmod]);
  written++;
}
const page = (opts) => layout({ ...opts, assets, noindex: opts.noindex || STAGING });

/* ---------- reusable fragments ---------- */
const byPillar = id => services.filter(s => s.pillar === id);
const directors = team.filter(p => p.section === 'directors');
const sectionTitles = { directors: 'Directors', associates: 'Associates', management: 'Management', professionals: 'Professionals' };
const sectionOrder = ['directors', 'associates', 'management', 'professionals'];
const personHref = p => p.bio.length ? `/team/${p.slug}/` : null;

const personCard = (p, i = 0) => {
  const href = personHref(p);
  const inner = `<div class="person-photo">${p.photo ? img(`team/${p.photo.split('/').pop()}`, { alt: p.name, sizes: '(max-width: 640px) 45vw, (max-width: 1000px) 30vw, 300px' }) : ''}</div>
    <div class="person-name">${esc(p.name)}</div><div class="person-role">${esc(p.position || '')}</div>`;
  return href
    ? `<a class="person" href="${href}" data-section="${p.section}" data-reveal style="--i:${i % 8}">${inner}</a>`
    : `<div class="person" data-section="${p.section}" data-reveal style="--i:${i % 8}">${inner}</div>`;
};

const serviceCard = (s, i = 0) => `<a class="service-card" href="/practice/${s.id}/" data-reveal style="--i:${i % 6}">
  <span class="icon">${icon(s.icon)}</span>
  <h3>${esc(s.title)}</h3>
  <p>${esc(s.summary)}</p>
  <span class="link"><span>Read more</span>${arrow()}</span>
</a>`;

/** Page head used by every inner page: black, with the quiet emblem-contour layer. */
const pageHead = ({ crumbs, eyebrow, title, lead, extra = '' }) => `<section class="page-head chrome" data-facets="0.45">
  <div class="wrap">
    ${breadcrumbs(crumbs)}
    ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}
    <h1 class="h1">${esc(title)}</h1>
    ${lead ? `<p class="lead">${esc(lead)}</p>` : ''}
    ${extra}
  </div>
</section>`;

const officeLines = () => site.offices.map(o => `<div><strong>${esc(o.city)}</strong><span class="muted">${esc(o.address.join(', '))}</span>${o.phones.map(t => `<a href="${telHref(t)}">${esc(t)}</a>`).join(' · ')}</div>`).join('');

const contactBand = () => `<section class="band chrome section" data-facets="0.35">
  <div class="wrap band-grid">
    <div data-reveal>
      <p class="eyebrow">${esc(home.contact.eyebrow)}</p>
      <h2 class="h2">${esc(home.contact.title)}</h2>
      <p class="lead">${esc(home.contact.text)}</p>
      <div class="btn-row mt-2"><a class="btn" href="/contact/">${esc(home.contact.label)}${arrow()}</a><a class="btn btn-ghost" href="${waHref(site.whatsapp)}" rel="noopener">Chat on WhatsApp</a></div>
    </div>
    <div class="band-offices" data-reveal style="--i:2">${officeLines()}<div><a href="mailto:${site.email}">${site.email}</a></div></div>
  </div>
</section>`;

const contactCard = (title = 'Talk to us about your matter') => `<div class="contact-card chrome">
  <h3>${esc(title)}</h3>
  <p>Tell us where the matter stands and we will map the way forward.</p>
  <a class="btn btn-sm" href="/contact/">Start a matter${arrow()}</a>
  <div class="lines">${site.offices.map(o => `<span>${esc(o.city)} <a href="${telHref(o.phones[0])}">${esc(o.phones[0])}</a></span>`).join('')}<a href="mailto:${site.email}">${site.email}</a></div>
</div>`;

const statTile = s => `<div class="stat"><div class="stat-value">${s.prefix ? `<small>${esc(s.prefix)}</small>` : ''}<span data-count="${s.value}"${s.raw ? ' data-raw="1"' : ''}>${s.value}</span>${s.suffix ? `<small>${esc(s.suffix)}</small>` : ''}</div><div class="stat-label">${esc(s.label)}</div><div class="stat-note">${esc(s.note)}</div></div>`;

/* ---------- home ---------- */
function renderHome() {
  const h = home.hero, f = home.firm;
  const marqueeItems = services.map(s => `<span>${esc(s.title)}</span>`).join('');
  const body = `
<section class="hero chrome" data-facets="1">
  <div class="wrap hero-inner">
    <p class="eyebrow">${esc(h.eyebrow)}</p>
    <h1 class="display">${words(h.title)}</h1>
    <p class="lead" data-reveal="fade" style="--i:4">${esc(h.lead)}</p>
    <div class="btn-row" data-reveal="fade" style="--i:5"><a class="btn" href="${h.primary.href}">${esc(h.primary.label)}${arrow()}</a><a class="btn btn-ghost" href="${h.secondary.href}">${esc(h.secondary.label)}</a></div>
  </div>
  <div class="wrap hero-stats" data-reveal="fade" style="--i:6">${site.stats.map(statTile).join('')}</div>
  <div class="marquee" aria-hidden="true"><div class="marquee-track">${marqueeItems}${marqueeItems}</div></div>
</section>

<section class="section ruled" id="practice">
  <div class="wrap">
    <div class="section-head">
      <div data-reveal><p class="eyebrow">${esc(home.practice.eyebrow)}</p><h2 class="h2">${esc(home.practice.title)}</h2></div>
      <p class="lead" data-reveal style="--i:2">${esc(home.practice.text)}</p>
    </div>
    <div class="explorer" data-reveal style="--i:1">
      <div class="explorer-tabs" role="tablist" aria-label="Areas of practice">
        ${pillars.map((p, i) => `<button class="explorer-tab" role="tab" id="tab-${p.id}" aria-controls="panel-${p.id}" aria-selected="${i === 0}" style="--i:${i}"><span class="num">0${i + 1}</span><span class="title">${esc(p.title)}</span>${arrow()}</button>`).join('')}
      </div>
      <div class="explorer-panels">
        ${pillars.map((p, i) => `<div class="explorer-panel" role="tabpanel" id="panel-${p.id}" aria-labelledby="tab-${p.id}" style="--i:${i}"${i ? ' hidden' : ''}>
          <p class="lead">${esc(p.summary)}</p>
          <div class="explorer-services">${byPillar(p.id).map((s, j) => `<a class="explorer-service" href="/practice/${s.id}/" style="--i:${j}"><span class="icon">${icon(s.icon)}</span><span><h3>${esc(s.title)}</h3><p>${esc(s.summary)}</p></span></a>`).join('')}</div>
          <a class="link" href="/practice/#${p.id}"><span>More about ${esc(p.title.toLowerCase())}</span>${arrow()}</a>
        </div>`).join('')}
      </div>
    </div>
  </div>
</section>

<section class="section" id="firm">
  <div class="wrap firm">
    <div class="lens" data-reveal>
      ${img(f.image, { alt: f.imageAlt, sizes: '(max-width: 960px) 100vw, 620px' })}
      ${img(f.image, { alt: '', sizes: '(max-width: 960px) 100vw, 620px', cls: 'lens-colour', colour: true })}
      <span class="lens-hint">${esc(f.imageHint)}</span>
    </div>
    <div data-reveal style="--i:2">
      <p class="eyebrow">${esc(f.eyebrow)}</p>
      <h2 class="h2">${esc(f.title)}</h2>
      <p class="mt-2">${esc(f.text)}</p>
      <div class="firm-values">${about.values.map(v => `<div><h3>${esc(v.title)}</h3><p>${esc(v.text)}</p></div>`).join('')}</div>
      <p class="mt-2"><a class="link" href="${f.link.href}"><span>${esc(f.link.label)}</span>${arrow()}</a></p>
    </div>
  </div>
</section>

<section class="section ruled" id="track-record">
  <div class="wrap">
    <div class="section-head">
      <div data-reveal><p class="eyebrow">${esc(home.appointments.eyebrow)}</p><h2 class="h2">${esc(home.appointments.title)}</h2></div>
      <p class="lead" data-reveal style="--i:2">${esc(home.appointments.text)}</p>
    </div>
    ${timeline()}
    <p class="mt-2"><a class="link" href="/about/#appointments"><span>The full record and the firm’s history</span>${arrow()}</a></p>
  </div>
</section>

<section class="section" id="people">
  <div class="wrap">
    <div class="section-head">
      <div data-reveal><p class="eyebrow">${esc(home.people.eyebrow)}</p><h2 class="h2">${esc(home.people.title)}</h2></div>
      <p class="lead" data-reveal style="--i:2">${esc(home.people.text)}</p>
    </div>
    <div class="people people-directors">${directors.map(personCard).join('')}</div>
    <p class="mt-2"><a class="link" href="/team/"><span>Everyone at HSG</span>${arrow()}</a></p>
  </div>
</section>

<section class="chrome">
  <div class="wrap tools">
    <a class="tool" href="/calculators/"><span><h3>${esc(home.tools.calculators.title)}</h3><p>${esc(home.tools.calculators.text)}</p></span>${arrow()}</a>
    <a class="tool" href="/insights/"><span><h3>${esc(home.tools.insights.title)}</h3><p>${esc(home.tools.insights.text)}</p></span>${arrow()}</a>
  </div>
</section>
${contactBand()}`;
  write('/', page({ title: site.name, description: site.description, path: '/', body, bodyClass: 'home' }));
}

function timeline() {
  const items = about.appointments;
  return `<div class="timeline" data-reveal>
    <div class="timeline-track" tabindex="0" aria-label="Appointments — scroll horizontally">
      ${items.map(a => `<article class="tl-item"><div class="tl-when">${esc(a.from)}<small>${a.to === 'Current' ? 'to date' : `– ${esc(a.to)}`}</small></div><div class="tl-client">${esc(a.client)}</div><p class="tl-text">${esc(a.short || a.text)}</p></article>`).join('')}
    </div>
    <div class="timeline-nav">
      <button class="icon-btn" type="button" data-prev aria-label="Previous">${arrowLeft('')}</button>
      <div class="timeline-progress" aria-hidden="true"><i></i></div>
      <button class="icon-btn" type="button" data-next aria-label="Next">${arrow('')}</button>
    </div>
  </div>`;
}

/* ---------- practice ---------- */
function renderPractice() {
  const body = `
${pageHead({ crumbs: [['Home', '/'], ['Practice']], eyebrow: 'Areas of practice', title: 'Thirteen disciplines, organised the way a development moves', lead: 'From the ground, through approval, to transfer and beyond. Each area below lists the work within it.' })}
${pillars.map((p, i) => `<section class="section${i % 2 ? ' ruled' : ''}" id="${p.id}">
  <div class="wrap">
    <div class="section-head">
      <div data-reveal><p class="eyebrow">Area 0${i + 1}</p><h2 class="h2">${esc(p.title)}</h2></div>
      <p class="lead" data-reveal style="--i:2">${esc(p.summary)}</p>
    </div>
    <div class="service-cards">${byPillar(p.id).map(serviceCard).join('')}</div>
  </div>
</section>`).join('')}
${contactBand()}`;
  write('/practice/', page({ title: 'Areas of practice', description: 'HSG Attorneys’ thirteen areas of practice across property and conveyancing, land and tenure, planning and environmental law, and disputes and advisory.', path: '/practice/', body, jsonld: [breadcrumbLd([['Home', '/'], ['Practice', '/practice/']])] }));

  for (const s of services) {
    const pillar = pillars.find(p => p.id === s.pillar);
    const siblings = byPillar(s.pillar);
    const bodyHtml = s.body.map((b, i) => i === 0 && b.startsWith('<p>') ? b.replace('<p>', '<p class="intro">') : b).join('\n');
    const body = `
${pageHead({ crumbs: [['Home', '/'], ['Practice', '/practice/'], [pillar.title, `/practice/#${pillar.id}`], [s.title]], eyebrow: pillar.title, title: s.title, lead: s.summary })}
<section class="section">
  <div class="wrap article-layout">
    <div class="prose" data-reveal>${bodyHtml}
      <hr>
      <p><strong>Ready to talk?</strong> Tell us about the matter and one of our attorneys will come back to you.</p>
      <p class="btn-row"><a class="btn" href="/contact/">Start a matter${arrow()}</a><a class="btn btn-ghost" href="${waHref(site.whatsapp)}" rel="noopener">Chat on WhatsApp</a></p>
    </div>
    <aside class="aside" data-reveal style="--i:2">
      <div class="aside-block"><h3>${esc(pillar.title)}</h3><ul class="aside-list">${siblings.map(x => `<li><a href="/practice/${x.id}/"${x.id === s.id ? ' aria-current="page"' : ''}>${esc(x.title)}${arrow()}</a></li>`).join('')}</ul></div>
      ${contactCard()}
    </aside>
  </div>
</section>`;
    write(`/practice/${s.id}/`, page({ title: s.title, description: s.metaDescription || s.summary, path: `/practice/${s.id}/`, body, jsonld: [breadcrumbLd([['Home', '/'], ['Practice', '/practice/'], [s.title, `/practice/${s.id}/`]]), { '@context': 'https://schema.org', '@type': 'Service', name: s.title, description: s.summary, provider: { '@id': site.url + '/#organization' }, areaServed: 'ZA' }] }));
  }
}

/* ---------- about ---------- */
function renderAbout() {
  const e = about.empowerment;
  const subnav = `<nav class="subnav" aria-label="On this page"><div class="wrap"><ul>
    <li><a href="#firm">The firm</a></li><li><a href="#history">History</a></li><li><a href="#empowerment">Staff and B-BBEE</a></li><li><a href="#appointments">Appointments</a></li><li><a href="#projects">Projects</a></li>
  </ul></div></nav>`;
  const body = `
${pageHead({ crumbs: [['Home', '/'], ['About']], eyebrow: about.title, title: 'A specialist practice since 1990', lead: about.intro })}
${subnav}
<section class="section" id="firm">
  <div class="wrap split">
    <div data-reveal>
      <p class="eyebrow">The firm</p>
      <h2 class="h2">The whole development process, in one file</h2>
    </div>
    <div class="prose" data-reveal style="--i:2">${about.body.join('')}
      <p><a class="link" href="/team/"><span>Meet the directors</span>${arrow()}</a></p>
    </div>
  </div>
  <div class="wrap mt-4">
    <div class="video" data-youtube="${attr(site.video.youtubeId)}" data-title="${attr(site.video.title)}" data-reveal>
      ${img('scenes/directors-notes', { alt: '', sizes: '(max-width: 1280px) 100vw, 1280px' })}
      <button type="button">${playIcon()} Watch the firm video</button>
    </div>
  </div>
</section>

<section class="section ruled" id="history">
  <div class="wrap split">
    <div data-reveal>
      <p class="eyebrow">History</p>
      <h2 class="h2">From 1990 to today</h2>
      <p class="lead">Founded by practitioners who also taught environmental law at the University of KwaZulu-Natal, and grown since into a land-legal practice for government, communities and developers.</p>
    </div>
    <ol class="milestones">
      ${about.milestones.map((m, i) => `<li class="milestone" data-reveal style="--i:${i % 4}"><div class="milestone-year">${esc(m.year)}</div><div><h3>${esc(m.title)}</h3><p>${esc(m.text)}</p></div></li>`).join('')}
    </ol>
  </div>
</section>

<section class="section" id="empowerment">
  <div class="wrap split">
    <div data-reveal>
      <p class="eyebrow">${esc(e.title)}</p>
      <h2 class="h2">${esc(e.level)}</h2>
      <p class="lead">${esc(e.ownership)}. The firm invests in the people who work here.</p>
      <p class="mt-2"><a class="btn btn-ghost btn-sm" href="/images/${e.certificate}" rel="noopener">${esc(e.certificateLabel)}${arrow()}</a></p>
    </div>
    <div data-reveal style="--i:2">
      <div class="stats" style="grid-template-columns:repeat(3,minmax(0,1fr))">
        <div class="stat"><div class="stat-value"><span data-count="56">56</span><small>%</small></div><div class="stat-label">Women</div></div>
        <div class="stat"><div class="stat-value"><span data-count="36">36</span><small>%</small></div><div class="stat-label">Black staff</div></div>
        <div class="stat"><div class="stat-value"><span data-count="34">34</span><small>%</small></div><div class="stat-label">Youth</div></div>
      </div>
      <ul class="prose mt-3">${e.facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
    </div>
  </div>
</section>

<section class="section ruled" id="appointments">
  <div class="wrap">
    <div class="section-head">
      <div data-reveal><p class="eyebrow">Appointments</p><h2 class="h2">Public and private work since 1994</h2></div>
      <p class="lead" data-reveal style="--i:2">${esc(about.appointmentsIntro)}</p>
    </div>
    <ol class="appointments">
      ${about.appointments.map((a, i) => `<li class="appointment" data-reveal style="--i:${i % 3}"><div class="when">${esc(a.from)} – ${esc(a.to === 'Current' ? 'present' : a.to)}</div><div class="client">${esc(a.client)}</div><p>${esc(a.text)}</p></li>`).join('')}
    </ol>
  </div>
</section>

<section class="section" id="projects">
  <div class="wrap">
    <div class="section-head">
      <div data-reveal><p class="eyebrow">Projects</p><h2 class="h2">Built-environment projects the firm has worked on</h2></div>
    </div>
    <div class="cards">
      ${projects.map((p, i) => `<a class="card" href="/about/projects/${p.slug}/" data-reveal style="--i:${i}"><div class="card-media">${p.image && hasImage(p.image) ? img(p.image, { alt: p.imageAlt || p.title, sizes: '(max-width: 600px) 100vw, 33vw' }) : ''}</div><div class="card-body"><h3>${esc(p.title)}</h3><p>${esc(p.excerpt)}</p><span class="link"><span>Read the case study</span>${arrow()}</span></div></a>`).join('')}
    </div>
  </div>
</section>
${contactBand()}`;
  write('/about/', page({ title: 'About the firm', description: about.intro, path: '/about/', body, jsonld: [breadcrumbLd([['Home', '/'], ['About', '/about/']])] }));

  for (const p of projects) {
    const body = `
${pageHead({ crumbs: [['Home', '/'], ['About', '/about/'], ['Projects', '/about/#projects'], [p.title]], eyebrow: 'Project', title: p.title, lead: p.excerpt })}
<section class="section">
  <div class="wrap article-layout">
    <div data-reveal>
      ${p.image && hasImage(p.image) ? `<div class="article-hero mb-2">${img(p.image, { alt: p.imageAlt || p.title, sizes: '(max-width: 960px) 100vw, 860px' })}</div>` : ''}
      <div class="prose">${p.body.join('')}</div>
      ${p.gallery.length ? `<div class="gallery">${p.gallery.map(g => img(g, { alt: '', sizes: '(max-width: 600px) 100vw, 400px' })).join('')}</div>` : ''}
      <p class="mt-3"><a class="link" href="/about/#projects">${arrowLeft()}<span>All projects</span></a></p>
    </div>
    <aside class="aside" data-reveal style="--i:2">
      <div class="aside-block"><h3>Other projects</h3><ul class="aside-list">${projects.map(x => `<li><a href="/about/projects/${x.slug}/"${x.slug === p.slug ? ' aria-current="page"' : ''}>${esc(x.title)}${arrow()}</a></li>`).join('')}</ul></div>
      ${contactCard()}
    </aside>
  </div>
</section>`;
    write(`/about/projects/${p.slug}/`, page({ title: p.title, description: p.excerpt, path: `/about/projects/${p.slug}/`, body, ogImage: p.image && hasImage(p.image) ? `/images/${p.image.replace(/\.[a-z]+$/, '')}-960.webp` : undefined, jsonld: [breadcrumbLd([['Home', '/'], ['About', '/about/'], [p.title, `/about/projects/${p.slug}/`]])] }));
  }
}

/* ---------- team ---------- */
function renderTeam() {
  const body = `
${pageHead({ crumbs: [['Home', '/'], ['People']], eyebrow: 'People', title: 'The people at HSG', lead: 'Directors, associates and candidate attorneys, conveyancing secretaries, environmental specialists and the property administrators who keep large portfolios moving, in Durban and Cape Town.' })}
<section class="section">
  <div class="wrap">
    <div class="filters" role="group" aria-label="Filter people">
      <button class="chip" type="button" data-filter="all" aria-pressed="true">Everyone</button>
      ${sectionOrder.map(s => `<button class="chip" type="button" data-filter="${s}" aria-pressed="false">${sectionTitles[s]}</button>`).join('')}
    </div>
    ${sectionOrder.map(s => { const list = team.filter(p => p.section === s); return list.length ? `<div class="person-group" data-section="${s}" id="${s}"><h2 class="serif">${sectionTitles[s]}</h2><div class="people">${list.map(personCard).join('')}</div></div>` : ''; }).join('')}
  </div>
</section>
${contactBand()}`;
  write('/team/', page({ title: 'People', description: 'The directors, associates and professionals of HSG Attorneys in Durban and Cape Town.', path: '/team/', body, jsonld: [breadcrumbLd([['Home', '/'], ['People', '/team/']])] }));

  for (const p of team) {
    if (!personHref(p)) continue;
    const others = directors.filter(x => x.slug !== p.slug && personHref(x));
    const body = `
${pageHead({ crumbs: [['Home', '/'], ['People', '/team/'], [p.name]], eyebrow: p.position || sectionTitles[p.section], title: p.name, extra: p.qualifications ? `<p class="quals">${esc(p.qualifications)}</p>` : '' })}
<section class="section">
  <div class="wrap profile">
    <div data-reveal>
      <div class="profile-photo">
        ${p.photo ? img(`team/${p.photo.split('/').pop()}`, { alt: p.name, sizes: '(max-width: 860px) 100vw, 416px' }) : ''}
        <dl class="profile-meta">
          ${p.email ? `<div><dt>Email</dt><dd><a href="mailto:${attr(p.email)}">${esc(p.email)}</a></dd></div>` : ''}
          ${p.linkedin ? `<div><dt>LinkedIn</dt><dd><a href="${attr(p.linkedin)}" rel="noopener">${esc(p.linkedin.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a></dd></div>` : ''}
          ${p.membership ? `<div><dt>Memberships</dt><dd>${esc(p.membership)}</dd></div>` : ''}
          ${p.projects ? `<div><dt>Current projects</dt><dd>${esc(p.projects)}</dd></div>` : ''}
        </dl>
      </div>
    </div>
    <div class="prose" data-reveal style="--i:2">
      ${p.bio.map((b, i) => `<p${i === 0 ? ' class="intro"' : ''}>${esc(b)}</p>`).join('')}
      <hr>
      <p class="btn-row"><a class="btn" href="/contact/">Contact ${esc(p.name.split(' ')[0])}${arrow()}</a><a class="link" href="/team/">${arrowLeft()}<span>All people</span></a></p>
    </div>
  </div>
  ${others.length ? `<div class="wrap mt-4"><h2 class="h3 mb-2">Other directors</h2><div class="people-row">${others.map(personCard).join('')}</div></div>` : ''}
</section>`;
    write(`/team/${p.slug}/`, page({ title: p.name, description: `${p.name}, ${p.position} at HSG Attorneys. ${p.bio[0]?.slice(0, 140)}…`, path: `/team/${p.slug}/`, body, jsonld: [breadcrumbLd([['Home', '/'], ['People', '/team/'], [p.name, `/team/${p.slug}/`]]), { '@context': 'https://schema.org', '@type': 'Person', name: p.name, jobTitle: p.position, worksFor: { '@id': site.url + '/#organization' }, ...(p.email ? { email: p.email } : {}), ...(p.linkedin ? { sameAs: [p.linkedin] } : {}), ...(p.photo ? { image: site.url + `/images/team/${p.slug}-640.webp` } : {}) }] }));
  }
}


/* ---------- LinkedIn: hand-picked posts, embedded by LinkedIn itself ----------
   `embed` in content/linkedin.json may be the whole <iframe> snippet LinkedIn's
   "Embed this post" gives you, a plain post link, or a bare urn — all three carry
   the id, which is all we need. Nothing is fetched from LinkedIn until a visitor
   asks for it, so the page stays free of third-party requests by default. */
const LI_TYPES = { share: 'share', activity: 'activity', ugcpost: 'ugcPost' };
const linkedInUrn = raw => {
  // Matches all the forms a post can arrive in: "urn:li:ugcPost:123" inside an embed
  // snippet, and the "…-activity-123-XyZ" / "…-ugcPost-123-XyZ" tail of a post link.
  const m = String(raw || '').match(/(share|activity|ugcPost)[-:](\d{10,})/i);
  return m ? `urn:li:${LI_TYPES[m[1].toLowerCase()]}:${m[2]}` : null;
};

function linkedInSection() {
  const posts = (linkedin.posts || []).map(p => ({ ...p, urn: linkedInUrn(p.embed) })).filter(p => p.urn);
  if (!posts.length) return '';
  const initial = Number(linkedin.initialCount) || 6;
  // Each post is a card of ours: our caption leads, LinkedIn's embed sits inside it.
  // The embed is only fetched once the card nears the viewport (see site.js), so a
  // long list costs nothing until it is looked at.
  const card = (p, i) => `<article class="li-card${i >= initial ? ' is-hidden' : ''}"${i >= initial ? ' hidden' : ''} data-reveal style="--i:${i % 3}">
      <div class="li-card-head">
        <p class="meta">HSG Attorneys on LinkedIn${p.date ? ` · ${fmtDate(p.date)}` : ''}</p>
        <h3>${esc(p.caption || 'A post from HSG Attorneys')}</h3>
      </div>
      <div class="li-embed" data-embed="https://www.linkedin.com/embed/feed/update/${p.urn}?collapsed=1" data-title="${attr(p.caption || 'Post from HSG Attorneys on LinkedIn')}">
        <a class="li-fallback" href="https://www.linkedin.com/feed/update/${p.urn}/" rel="noopener">Read this post on LinkedIn${arrow()}</a>
      </div>
      <a class="link li-open" href="https://www.linkedin.com/feed/update/${p.urn}/" rel="noopener"><span>Open on LinkedIn</span>${arrow()}</a>
    </article>`;
  return `<section class="section" id="linkedin">
  <div class="wrap">
    <div class="section-head">
      <div data-reveal><p class="eyebrow">LinkedIn</p><h2 class="h2">${esc(linkedin.title)}</h2></div>
      <p class="lead" data-reveal style="--i:2">${esc(linkedin.intro)}</p>
    </div>
    <div class="li-feed">
      <div class="li-grid">${posts.map(card).join('')}</div>
      <div class="btn-row li-actions">
        ${posts.length > initial ? `<button class="btn" type="button" data-more>${esc(linkedin.moreLabel || 'Show more posts')}${arrow()}</button>` : ''}
        <a class="btn btn-ghost" href="${attr(site.linkedin)}" rel="noopener">${esc(linkedin.followLabel)}</a>
      </div>
      <p class="fine muted">${esc(linkedin.privacyNote)}</p>
    </div>
  </div>
</section>`;
}

/* ---------- insights ---------- */
function renderInsights() {
  const body = `
${pageHead({ crumbs: [['Home', '/'], ['Insights']], eyebrow: 'Insights', title: 'Commentary from the land-legal sector', lead: 'Posts from the firm’s LinkedIn page, and longer articles on the planning, tenure and environmental developments that affect property and development in South Africa.' })}
${linkedInSection()}
<section class="section ruled" id="articles">
  <div class="wrap">
    <div class="section-head">
      <div data-reveal><p class="eyebrow">Articles</p><h2 class="h2">Longer reading</h2></div>
    </div>
    <div class="cards">
      ${articles.map((a, i) => `<a class="card" href="/insights/${a.slug}/" data-reveal style="--i:${i % 3}"><div class="card-media">${a.image && hasImage(a.image) ? img(a.image, { alt: a.imageAlt || '', sizes: '(max-width: 600px) 100vw, 33vw' }) : ''}</div><div class="card-body"><span class="meta">${fmtDate(a.date)}</span><h3>${esc(a.title)}</h3><p>${esc(a.excerpt)}</p><span class="link"><span>Read</span>${arrow()}</span></div></a>`).join('')}
    </div>
  </div>
</section>
${contactBand()}`;
  write('/insights/', page({ title: 'Insights', description: 'Commentary and analysis from HSG Attorneys on planning, land tenure, environmental and property law.', path: '/insights/', body, lastmod: articles[0]?.date, jsonld: [breadcrumbLd([['Home', '/'], ['Insights', '/insights/']])] }));

  for (const a of articles) {
    const others = articles.filter(x => x.slug !== a.slug);
    const body = `
${pageHead({ crumbs: [['Home', '/'], ['Insights', '/insights/'], [a.title]], title: a.title, lead: a.excerpt, extra: '' }).replace('<h1 class="h1">', `<p class="byline"><span>${fmtDate(a.date)}</span><span>HSG Attorneys</span></p><h1 class="h1 mt-1">`)}
<section class="section">
  <div class="wrap article-layout">
    <article data-reveal>
      ${a.image && hasImage(a.image) ? `<div class="article-hero mb-2">${img(a.image, { alt: a.imageAlt || '', sizes: '(max-width: 960px) 100vw, 860px' })}</div>` : ''}
      <div class="prose">${a.body.join('')}</div>
      ${a.gallery.length ? `<div class="gallery">${a.gallery.map(g => img(g, { alt: '', sizes: '(max-width: 600px) 100vw, 400px' })).join('')}</div>` : ''}
      <p class="mt-3"><a class="link" href="/insights/">${arrowLeft()}<span>All insights</span></a></p>
    </article>
    <aside class="aside" data-reveal style="--i:2">
      <div class="aside-block"><h3>More insights</h3><ul class="aside-list">${others.map(x => `<li><a href="/insights/${x.slug}/">${esc(x.title)}${arrow()}</a></li>`).join('')}</ul></div>
      ${contactCard('Need advice on this?')}
    </aside>
  </div>
</section>`;
    write(`/insights/${a.slug}/`, page({ title: a.title, description: a.excerpt || a.title, path: `/insights/${a.slug}/`, body, lastmod: a.date, ogImage: a.image && hasImage(a.image) ? `/images/${a.image.replace(/\.[a-z]+$/, '')}-960.webp` : undefined, jsonld: [breadcrumbLd([['Home', '/'], ['Insights', '/insights/'], [a.title, `/insights/${a.slug}/`]]), { '@context': 'https://schema.org', '@type': 'Article', headline: a.title, datePublished: a.date, author: { '@id': site.url + '/#organization' }, publisher: { '@id': site.url + '/#organization' }, ...(a.image && hasImage(a.image) ? { image: site.url + `/images/${a.image.replace(/\.[a-z]+$/, '')}-960.webp` } : {}) }] }));
  }
}


/* ---------- calculators ---------- */
function renderCalculators() {
  const c = calculators;
  // Fields start empty; `hint` is only a placeholder, so nothing is calculated until
  // the visitor enters their own figures.
  const field = f => {
    const attrs = f.kind === 'money'
      ? `type="text" inputmode="numeric" autocomplete="off" data-kind="money"`
      : `type="number" inputmode="decimal" step="${f.step || 1}" min="0"`;
    const unit = f.kind === 'money' ? 'R' : f.kind === 'percent' ? '%' : 'years';
    return `<div class="field calc-field"><label for="${f.name}-${f.id}">${esc(f.label)}</label>
      <div class="calc-input" data-unit="${unit}"><input id="${f.name}-${f.id}" name="${f.name}" ${attrs} placeholder="${attr(f.hint ?? '')}"${f.required ? ' data-required' : ''}></div></div>`;
  };
  const body = `
${pageHead({ crumbs: [['Home', '/'], ['Calculators']], eyebrow: 'Calculators', title: c.title, lead: c.lead })}
<section class="section">
  <div class="wrap calculators">
    <div class="calc-tabs" role="tablist" aria-label="Calculators">
      ${c.calculators.map((x, i) => `<button class="calc-tab chip" role="tab" id="tab-${x.id}" aria-controls="panel-${x.id}" aria-selected="${i === 0}">${esc(x.label)}</button>`).join('')}
    </div>
    ${c.calculators.map((x, i) => `<div class="calc-panel" role="tabpanel" id="panel-${x.id}" aria-labelledby="tab-${x.id}" data-calc="${x.id}" data-headline="${attr(x.headline)}" data-secondary="${attr(x.secondary)}"${i ? ' hidden' : ''}>
      <div class="calc-grid">
        <div class="calc-inputs">
          <h2 class="h3">${esc(x.title)}</h2>
          <p class="calc-intro">${esc(x.intro)}</p>
          ${x.fields.map(f => field({ ...f, id: x.id })).join('')}
          <p class="fine muted calc-note">${esc(c.note)}</p>
        </div>
        <div class="calc-result">
          <div class="calc-headline">
            <span class="calc-headline-label">${esc(x.headline)}</span>
            <span class="calc-headline-value">—</span>
            <span class="calc-secondary"></span>
          </div>
          <table class="calc-table" hidden></table>
          <div class="btn-row calc-actions">
            <a class="btn calc-quote" href="/contact/#enquire">${esc(c.quoteLabel)}${arrow()}</a>
            <a class="btn btn-ghost" href="${site.calculatorsUrl}" rel="noopener">${esc(c.appLabel)}</a>
          </div>
        </div>
      </div>
    </div>`).join('')}
    <div class="disclaimer" data-reveal>
      <h2 class="h3">${esc(c.disclaimerTitle)}</h2>
      <ul>${c.disclaimer.map(d => `<li>${esc(d)}</li>`).join('')}</ul>
    </div>
  </div>
</section>
${contactBand()}`;
  write('/calculators/', page({
    title: c.title, description: c.lead, path: '/calculators/', body,
    module: '/js/calculators.js',
    jsonld: [breadcrumbLd([['Home', '/'], ['Calculators', '/calculators/']])],
  }));
}

/* ---------- contact ---------- */
function renderContact() {
  const body = `
${pageHead({ crumbs: [['Home', '/'], ['Contact']], eyebrow: 'Contact', title: 'Get in touch', lead: 'Two offices. Call, write, WhatsApp, or send the form and we will come back to you.' })}
<section class="section">
  <div class="wrap">
    <div class="offices" data-reveal>
      ${site.offices.map(o => `<div class="office" id="${o.id}">
        <h3>${esc(o.city)}</h3><div class="region">${esc(o.region)}</div>
        <dl>
          <div><dt>Telephone</dt><dd>${o.phones.map(t => `<a href="${telHref(t)}">${esc(t)}</a>`).join('<br>')}</dd></div>
          <div><dt>Email</dt><dd><a href="mailto:${site.email}">${site.email}</a></dd></div>
          <div><dt>Physical address</dt><dd>${o.address.map(esc).join('<br>')}</dd></div>
          ${o.postal.length ? `<div><dt>Postal</dt><dd>${o.postal.map(esc).join('<br>')}</dd></div>` : ''}
        </dl>
        <div class="btn-row"><a class="btn btn-sm" href="${mapHref(o.mapQuery)}" rel="noopener">Directions${arrow()}</a><a class="btn btn-ghost btn-sm" href="${waHref(site.whatsapp)}" rel="noopener">WhatsApp</a></div>
      </div>`).join('')}
    </div>
  </div>
</section>
<section class="section ruled" id="enquire">
  <div class="wrap split">
    <div data-reveal>
      <p class="eyebrow">Send an enquiry</p>
      <h2 class="h2">Tell us where the matter stands</h2>
      <p class="lead">A short description is enough to start. Every enquiry is treated as confidential.</p>
    </div>
    <form class="form" id="contact-form" action="/contact.php" method="post" novalidate data-reveal style="--i:2" data-mailto="${site.email}">
      <div class="hp" aria-hidden="true"><label for="hsg_leave_blank">Leave this field blank</label><input id="hsg_leave_blank" name="hsg_leave_blank" type="text" tabindex="-1" autocomplete="off"></div>
      <div class="form-row">
        <div class="field"><label for="name">Full name</label><input id="name" name="name" type="text" autocomplete="name" required><span class="error">Please enter your name.</span></div>
        <div class="field"><label for="phone">Phone <span class="req">(optional)</span></label><input id="phone" name="phone" type="tel" autocomplete="tel" inputmode="tel"></div>
      </div>
      <div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required><span class="error">Please enter a valid email address.</span></div>
      <div class="field"><label for="subject">What is the matter about? <span class="req">(optional)</span></label><select id="subject" name="subject"><option value="">Choose an area of practice</option>${services.map(s => `<option value="${attr(s.title)}">${esc(s.title)}</option>`).join('')}<option value="Other">Something else</option></select></div>
      <div class="field"><label for="message">How can we help?</label><textarea id="message" name="message" required></textarea><span class="error">Please tell us a little about the matter.</span></div>
      <label class="check"><input id="consent" name="consent" type="checkbox" value="yes" required><span>I consent to HSG Attorneys processing the personal information I provide here in order to respond to my enquiry, as described in the <a href="/privacy/">privacy policy</a> (Protection of Personal Information Act 4 of 2013).</span></label>
      <div class="form-status" role="status" aria-live="polite"></div>
      <div class="btn-row"><button class="btn" type="submit">Send enquiry${arrow()}</button><span class="fine muted">Or email <a href="mailto:${site.email}">${site.email}</a></span></div>
    </form>
  </div>
</section>
<section class="section-tight">
  <div class="wrap grid cols-2">
    ${site.offices.map(o => `<div data-reveal><h3 class="h3 mb-2">${esc(o.city)} office</h3><div class="map-facade" data-q="${attr(o.mapQuery)}"><button class="btn btn-ghost btn-sm" type="button">Load map</button></div></div>`).join('')}
  </div>
</section>`;
  write('/contact/', page({ title: 'Contact', description: `Contact HSG Attorneys in Durban (${site.offices[0].phones[0]}) or Cape Town (${site.offices[1].phones[0]}), email ${site.email}, or send an enquiry online.`, path: '/contact/', body, jsonld: [breadcrumbLd([['Home', '/'], ['Contact', '/contact/']])] }));
}

/* ---------- legal ---------- */
function renderLegal() {
  for (const [id, doc] of Object.entries(legal)) {
    const title = id === 'privacy' ? 'Privacy policy' : 'Terms and conditions';
    const body = `
${pageHead({ crumbs: [['Home', '/'], [title]], eyebrow: 'Legal', title, lead: `Last updated ${fmtDate(doc.modified)}.` })}
<section class="section"><div class="wrap-narrow prose">${doc.body.join('')}</div></section>`;
    write(`/${id}/`, page({ title, description: `${title} for the HSG Attorneys website.`, path: `/${id}/`, body, lastmod: doc.modified }));
  }
}

/* ---------- 404 ---------- */
function renderNotFound() {
  const body = `<section class="section notfound"><div class="wrap"><p class="eyebrow" style="justify-content:center">404</p><h1 class="h1">That page has moved or never existed</h1><p class="lead" style="margin:1.5rem auto 0">Try the areas of practice, our people, or get in touch.</p><div class="btn-row mt-3" style="justify-content:center"><a class="btn" href="/">Home${arrow()}</a><a class="btn btn-ghost" href="/contact/">Contact</a></div></div></section>`;
  write('/404.html', page({ title: 'Page not found', description: 'The page you were looking for has moved or never existed. Find HSG Attorneys’ areas of practice, people and contact details from here.', path: '/404.html', body, noindex: true }), { sitemap: false });
}

/* ---------- static files, server files, sitemap ---------- */
async function copyStatic() {
  cpSync('src/css', 'dist/css', { recursive: true });
  cpSync('src/js', 'dist/js', { recursive: true });
  cpSync('src/fonts', 'dist/fonts', { recursive: true });
  cpSync('images/src/brand/favicon.svg', 'dist/favicon.svg');
  cpSync('tariffs.json', 'dist/tariffs.json');
  await sharp('images/src/brand/favicon.svg', { density: 384 }).resize(180, 180, { fit: 'contain', background: '#121212' }).png().toFile('dist/apple-touch-icon.png');
  // Open Graph default: the directors photo, greyscale, 1200x630.
  await sharp('images/src/scenes/directors-plans.jpg').resize(1200, 630, { fit: 'cover', position: 'attention' }).greyscale().jpeg({ quality: 80 }).toFile('dist/images/og-default.jpg');
  // Server-side: .htaccess (with generated redirects) + the PHP mail stack.
  // Anchored regexes: a plain `Redirect` matches by prefix (/team-summary would also catch /team-summary-2/).
  const rx = p => p.replace(/\/$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rules = redirects.map(([from, to]) => `RedirectMatch 301 ^${rx(from)}/?$ ${to}`).join('\n');
  let ht = readFileSync('server/.htaccess', 'utf8').replace('# {{REDIRECTS}}', rules);
  if (STAGING) {
    const tag = ['<IfModule mod_headers.c>', '  Header always set X-Robots-Tag "noindex, nofollow"'].join('\n');
    ht = ht.replace('<IfModule mod_headers.c>', tag, 1);
  }
  writeFileSync('dist/.htaccess', ht);
  for (const f of readdirSync('server')) if (f.endsWith('.php')) cpSync(join('server', f), join('dist', f));
  // robots + sitemap
  writeFileSync('dist/robots.txt', STAGING
    ? ['User-agent: *', 'Disallow: /', ''].join('\n')
    : `User-agent: *\nAllow: /\nDisallow: /contact.php\nSitemap: ${site.url}/sitemap.xml\n`);
  const today = new Date().toISOString().slice(0, 10);
  const sm = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(([p, lm]) => `  <url><loc>${site.url}${p}</loc><lastmod>${lm || today}</lastmod></url>`).join('\n')}\n</urlset>\n`;
  writeFileSync('dist/sitemap.xml', sm);
}

/* ---------- run ---------- */
if (!existsSync('build/images.json')) { console.error('build/images.json missing — run `node scripts/images.mjs` first'); process.exit(1); }
mkdirSync('dist', { recursive: true });
renderHome(); renderPractice(); renderAbout(); renderTeam(); renderInsights(); renderCalculators(); renderContact(); renderLegal(); renderNotFound();
await copyStatic();
console.log(`built ${written} pages → dist/ (css ${assets.css}, js ${assets.js})${STAGING ? ' — STAGING: noindex' : ''}`);
