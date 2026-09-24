// One-off importer: turns the WordPress REST harvest (pages/posts/team/media JSON +
// downloaded uploads) into this repo's content/*.json and images/src/* files.
//
//   node scripts/import-wordpress.mjs <harvest-dir>
//
// It is deliberately conservative: copy is carried over verbatim (only markup is
// cleaned), so anything the firm wrote stays the firm's words. Hand edits belong in
// content/ afterwards — re-running this script overwrites the *generated* files only.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

// Retired. This produced the site's first content, as single files (content/team.json,
// content/articles.json). People and articles now live one file per entry in
// content/team/ and content/articles/, edited through the admin, and the build no longer
// reads the single files — so running this would only write files nothing uses, next to
// the real ones. Kept for the record of how the WordPress content was carried over.
if (!process.argv.includes('--i-know-this-is-retired')) {
  console.error('import-wordpress.mjs is retired: content is now edited in the admin (/admin). See the note at the top of the file.');
  process.exit(1);
}

const harvest = process.argv[2];
if (!harvest) { console.error('usage: node scripts/import-wordpress.mjs <harvest-dir>'); process.exit(1); }
const J = n => JSON.parse(readFileSync(join(harvest, n), 'utf8'));
const pages = J('pages.json'), posts = J('posts.json'), media = J('media.json'), team = J('team-final.json');
const mediaById = Object.fromEntries(media.map(m => [m.id, m]));
const out = (rel, data) => { mkdirSync(join('content', rel, '..'), { recursive: true }); writeFileSync(join('content', rel), typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n'); };

/* ---------- HTML cleaning ---------- */
const decode = s => s
  .replace(/&#8217;|&rsquo;/g, '’').replace(/&#8216;|&lsquo;/g, '‘')
  .replace(/&#8220;|&ldquo;/g, '“').replace(/&#8221;|&rdquo;/g, '”')
  .replace(/&#8211;|&ndash;/g, '–').replace(/&#8212;|&mdash;/g, '—')
  .replace(/&#8230;|&hellip;/g, '…').replace(/&nbsp;|&#160;/g, ' ')
  .replace(/&#038;|&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'")
  .replace(/​/g, '');

const KEEP = new Set(['p', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'a', 'br', 'blockquote']);

function cleanHtml(html, { dropHeadings = false } = {}) {
  let h = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(style|script|svg|noscript|iframe|form)[\s\S]*?<\/\1>/gi, '')
    .replace(/<ul[^>]*\bid="menu-[\s\S]*?<\/ul>/gi, '')           // sidebar nav widgets
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<h1[\s\S]*?<\/h1>/gi, '')                             // page title is rendered by the template
    .replace(/<img[^>]*>/gi, '');
  // Whitelist tags; keep href on <a>.
  h = h.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (m, tag, attrs) => {
    tag = tag.toLowerCase();
    if (!KEEP.has(tag)) return tag === 'div' || tag === 'section' || tag === 'span' ? ' ' : ' ';
    if (m.startsWith('</')) return `</${tag === 'b' ? 'strong' : tag === 'i' ? 'em' : tag}>`;
    if (tag === 'a') { const href = (attrs.match(/href="([^"]*)"/) || [])[1] || ''; return href ? `<a href="${href}">` : '<a>'; }
    if (tag === 'br') return '<br>';
    return `<${tag === 'b' ? 'strong' : tag === 'i' ? 'em' : tag}>`;
  });
  h = decode(h).replace(/[ \t\r\n]+/g, ' ');
  h = h.replace(/(<br>\s*){2,}/g, '</p><p>');                        // "<br><br>" paragraph breaks
  h = h.replace(/<br>\s*(<\/li>|<\/p>)/g, '$1').replace(/(<li>|<p>)\s*<br>/g, '$1');
  h = h.replace(/<a>([\s\S]*?)<\/a>/g, '$1');                        // anchors without href
  h = h.replace(/<(p|li|h[2-4])>\s*<\/\1>/g, '');                    // empty blocks
  h = h.replace(/<p>\s*(<(?:ul|ol)>)/g, '$1').replace(/(<\/(?:ul|ol)>)\s*<\/p>/g, '$1');
  if (dropHeadings) h = h.replace(/<h[2-4]>[\s\S]*?<\/h[2-4]>/g, '');
  // Split into blocks and drop exact duplicates (Elementor renders desktop + mobile copies).
  const blocks = [];
  const seen = new Set();
  const re = /<(p|ul|ol|h2|h3|h4|blockquote)>[\s\S]*?<\/\1>/g;
  let m;
  while ((m = re.exec(h))) {
    const b = m[0].replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();
    const key = b.replace(/<[^>]+>/g, '').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key); blocks.push(b);
  }
  return blocks;
}
const text = html => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const slugOf = url => url.replace(/\/$/, '').split('/').pop();

/* ---------- images ---------- */
const copied = new Map();
function takeImage(url, folder, name) {
  if (!url) return null;
  const rel = url.split('/wp-content/uploads/')[1];
  if (!rel) return null;
  // Prefer the original over a "-1024x1024" resized variant.
  const orig = rel.replace(/-\d+x\d+(?=\.[a-z]+$)/i, '');
  // WordPress keeps very large originals as "<name>-scaled.<ext>"; try that too.
  const scaled = orig.replace(/(\.[a-z]+)$/i, '-scaled$1');
  const srcPath = [orig, scaled, rel].map(r => join(harvest, 'media', r)).find(existsSync);
  if (!srcPath) { console.warn('missing upload', rel); return null; }
  const file = `${name || basename(orig, extname(orig))}${extname(orig).toLowerCase()}`;
  const dest = join('images', 'src', folder, file);
  if (!copied.has(dest)) { mkdirSync(join('images', 'src', folder), { recursive: true }); copyFileSync(srcPath, dest); copied.set(dest, true); }
  return `${folder}/${file}`;
}

/* ---------- services ---------- */
const serviceMeta = {
  'general-conveyancing-is-a-service-of-hsg-attorneys':  { id: 'general-conveyancing',       pillar: 'property',  icon: 'general-conveyancing' },
  'project-related-conveyancing-is-a-service-of-hsg-attorneys': { id: 'project-conveyancing', pillar: 'property', icon: 'project-related-conveyancing' },
  'property-law-is-a-service-of-hsg-attorneys':          { id: 'property-law',               pillar: 'property',  icon: 'property-law' },
  'notarial-practice-is-a-service-of-hsg-attorneys':     { id: 'notarial-practice',          pillar: 'property',  icon: 'notarial-practice' },
  'land-legal-solutions-is-a-service-of-hsg-attorneys':  { id: 'land-legal-solutions',       pillar: 'land',      icon: 'land-legal-solutions' },
  'land-tenure-resolutions-is-a-service-of-hsg-attorneys': { id: 'land-tenure',              pillar: 'land',      icon: 'land-tenure-resolutions' },
  'property-management-is-a-service-of-hsg-attorneys':   { id: 'property-management',        pillar: 'land',      icon: 'property-management' },
  'planning-law-service':                                { id: 'planning-law',               pillar: 'planning',  icon: 'planning-law' },
  'environmental-law-is-a-service-of-hsg-attorneys':     { id: 'environmental-law',          pillar: 'planning',  icon: 'environmental-law' },
  'property-related-litigation-is-a-service-of-hsg-attorneys': { id: 'litigation',           pillar: 'disputes',  icon: 'property-related-litigation' },
  'arbitration-and-mediation-is-a-service-of-hsg-attorneys': { id: 'arbitration-mediation',  pillar: 'disputes',  icon: 'property-related-litigation' },
  'commercial-law-is-a-service-of-hsg-attorneys':        { id: 'commercial-law',             pillar: 'disputes',  icon: 'commercial-law' },
  'legal-costs-consulting':                              { id: 'legal-costs',                pillar: 'disputes',  icon: 'legal-costs-consulting' },
};
// Short blurbs come from the current homepage cards (two of which were copy-paste errors — fixed below).
const home = pages.find(p => p.id === 976);
const cards = [...home.content.rendered.matchAll(/elementor-image-box-title">([\s\S]*?)<\/h3>[\s\S]*?elementor-image-box-description">([\s\S]*?)<\/p>/g)].map(m => [text(m[1]), text(m[2])]);
const blurb = Object.fromEntries(cards);
blurb['Land Tenure Resolutions'] = 'We help landowners, developers and public bodies resolve the tenure impediments that stall development and delivery.';
blurb['Arbitration and Mediation'] = 'Qualified, accredited mediators and arbitrators who resolve disputes without the cost and delay of litigation.';

const services = [];
for (const p of pages) {
  const meta = serviceMeta[p.slug];
  if (!meta) continue;
  const yoast = p.yoast_head_json || {};
  services.push({
    id: meta.id, pillar: meta.pillar, icon: meta.icon,
    title: text(p.title.rendered),
    summary: blurb[text(p.title.rendered)] || yoast.description || '',
    metaDescription: yoast.description || '',
    body: cleanHtml(p.content.rendered),
    oldUrl: p.link.replace('https://hsgattorneys.co.za', ''),
  });
}
const pillarOrder = ['property', 'land', 'planning', 'disputes'];
services.sort((a, b) => pillarOrder.indexOf(a.pillar) - pillarOrder.indexOf(b.pillar) || Object.values(serviceMeta).findIndex(m => m.id === a.id) - Object.values(serviceMeta).findIndex(m => m.id === b.id));
out('services.json', {
  pillars: [
    { id: 'property', title: 'Property & Conveyancing', summary: 'Residential, commercial and sectional-title transfers, project-related conveyancing and notarial work — from development approval through to registered transfer.' },
    { id: 'land',     title: 'Land & Tenure',           summary: 'Resolving the tenure and land-legal impediments that stall development, and managing large public and private property portfolios.' },
    { id: 'planning', title: 'Planning & Environmental', summary: 'Practical, commercial planning-law solutions and holistic environmental expertise, backed by our own environmental specialists.' },
    { id: 'disputes', title: 'Disputes & Advisory',     summary: 'Litigation, arbitration and mediation when matters are contested — alongside commercial advice and legal-costs consulting.' },
  ],
  services,
});
// Service icons (line-art SVGs from the current site).
for (const m of media.filter(m => m.mime_type === 'image/svg+xml')) takeImage(m.source_url, 'services', basename(m.source_url, '.svg').replace(/-\d+$/, '') + (/-\d+\.svg$/.test(m.source_url) ? '-alt' : ''));

/* ---------- team ---------- */
const sectionMap = { 'Directors': 'directors', 'Associates': 'associates', 'Administration and Support': 'management', 'Other Professionals': 'professionals' };
const people = team.map(t => ({
  slug: t.slug, name: t.name, section: sectionMap[t.section] || 'professionals',
  position: t.position, qualifications: t.qualifications,
  email: t.email, linkedin: t.linkedin,
  membership: t.membership ? t.membership.replace(/^Membership:\s*/i, '').replace(/\n/g, ' ').trim() : null,
  projects: t.projects ? t.projects.replace(/^Projects:\s*/i, '').replace(/\n/g, ' ').trim() : null,
  bio: t.bio,
  photo: takeImage(t.photo, 'team', t.slug),
}));
out('team.json', people);

/* ---------- about ---------- */
const about = pages.find(p => p.id === 103);
const aboutBlocks = cleanHtml(about.content.rendered);
out('about.generated.json', { blocks: aboutBlocks, certificate: media.filter(m => m.mime_type === 'application/pdf').map(m => ({ file: m.source_url.split('/uploads/')[1], date: m.date.slice(0, 10) })) });
for (const m of media.filter(m => m.mime_type === 'application/pdf')) takeImage(m.source_url, 'documents');

/* ---------- projects (case studies) + articles ---------- */
const articles = [], projects = [];
for (const p of posts) {
  const yoast = p.yoast_head_json || {};
  const feat = mediaById[p.featured_media];
  const isProject = p.categories.includes(15);
  const rec = {
    slug: p.slug, title: text(p.title.rendered), date: p.date.slice(0, 10),
    excerpt: yoast.description || text(p.excerpt?.rendered || '').replace(/\s*…?\s*$/, ''),
    image: takeImage(feat?.source_url, isProject ? 'projects' : 'articles', p.slug),
    imageAlt: feat?.alt_text || '',
    body: cleanHtml(p.content.rendered),
    oldUrl: p.link.replace('https://hsgattorneys.co.za', ''),
  };
  // Every image referenced in the body, for galleries.
  rec.gallery = [...new Set([...p.content.rendered.matchAll(/<img[^>]*src="([^"]+)"/g)].map(m => m[1].replace(/-\d+x\d+(?=\.[a-z]+$)/i, '')))]
    .filter(u => !feat || u !== feat.source_url).map((u, i) => takeImage(u, isProject ? 'projects' : 'articles', `${p.slug}-${i + 1}`)).filter(Boolean);
  (isProject ? projects : articles).push(rec);
}
out('articles.json', articles);
out('projects.json', projects);

/* ---------- legal ---------- */
for (const [id, slug] of [['privacy', 'privacy-policy'], ['terms', 'terms-conditions']]) {
  const p = pages.find(p => p.slug === slug);
  out(`legal/${id}.json`, { title: text(p.title.rendered), modified: p.modified.slice(0, 10), body: cleanHtml(p.content.rendered) });
}

/* ---------- scene photography + brand ---------- */
for (const f of ['2021/10/home-e1679477903200.jpg', '2021/10/home2.jpg', '2021/10/home3.jpg', '2023/11/interior-designer-presenting-renovation-project.jpg']) takeImage('https://hsgattorneys.co.za/wp-content/uploads/' + f, 'scenes');
for (const m of media.filter(m => /logo|emblem|geoafrika/i.test(m.source_url))) takeImage(m.source_url, 'brand');

/* ---------- redirects: every old URL → new ---------- */
const redirects = [];
for (const s of services) redirects.push([s.oldUrl, `/practice/${s.id}/`]);
redirects.push(['/land-legal-sector/', '/practice/'], ['/team-summary/', '/team/'], ['/team-summary-2/', '/team/'], ['/our-team/', '/team/'],
  ['/news/', '/insights/'], ['/linkedin-news/', '/insights/'], ['/contact-us/', '/contact/'], ['/about-us/', '/about/'], ['/projects/', '/about/#projects'],
  ['/privacy-policy/', '/privacy/'], ['/terms-conditions/', '/terms/'], ['/landing-2025/', '/'], ['/conveyancing-calculator/', 'https://app.hsgattorneys.co.za/']);
for (const a of articles) redirects.push([a.oldUrl, `/insights/${a.slug}/`]);
for (const p of projects) redirects.push([p.oldUrl, `/about/projects/${p.slug}/`]);
for (const t of people) redirects.push([`/team/${t.slug}/`, `/team/${t.slug}/`]); // same path — kept for the record
out('redirects.json', redirects.filter(([a, b]) => a !== b));

console.log({ services: services.length, people: people.length, articles: articles.length, projects: projects.length, aboutBlocks: aboutBlocks.length, imagesCopied: copied.size, redirects: redirects.length });
