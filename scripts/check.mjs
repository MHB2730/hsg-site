// Offline QA for dist/: every script parses, every internal link and image resolves,
// every page has one <h1>, a <title> and a meta description, and no template
// placeholders leaked.
//   npm run check
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const DIST = 'dist';
const walk = dir => readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
// The admin (/admin, Sveltia CMS) is an app shell, not a page of the site.
const pages = walk(DIST).filter(f => f.endsWith('.html') && !/[\\/]admin[\\/]/.test(f));
const resolves = href => {
  const p = href.split('#')[0].split('?')[0];
  if (!p || p === '/') return existsSync(join(DIST, 'index.html'));
  const file = join(DIST, p);
  return existsSync(file) && (statSync(file).isFile() || existsSync(join(file, 'index.html')));
};
let problems = 0;
const bad = (page, ...msg) => { problems++; console.log(`✗ ${page.replace(/\\/g, '/').replace('dist/', '/')}: ${msg.join(' ')}`); };

// Every shipped script must parse. A broken one is silent in the markup checks but
// takes the whole page's behaviour down in the browser.
// (package.json sets "type": "module", so --check parses these as ES modules, which
// accepts both the module scripts and the classic ones.)
for (const js of walk(DIST).filter(f => f.endsWith('.js'))) {
  try {
    execFileSync(process.execPath, ['--check', js], { stdio: 'pipe' });
  } catch (e) {
    bad(js, 'does not parse —', String(e.stderr || e).split('\n').find(l => /SyntaxError/.test(l)) || 'syntax error');
  }
}

for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  const h1 = (html.match(/<h1\b/g) || []).length;
  if (h1 !== 1) bad(page, `${h1} <h1> elements`);
  if (!/<title>[^<]{3,}<\/title>/.test(html)) bad(page, 'missing <title>');
  if (!/<meta name="description" content="[^"]{20,}"/.test(html)) bad(page, 'missing/short meta description');
  if (/\$\{|undefined|\[object Object\]|NaN/.test(html.replace(/<script[\s\S]*?<\/script>/g, ''))) bad(page, 'template leak (undefined / ${ / [object Object])');
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const u = m[1];
    if (/^(https?:|mailto:|tel:|data:|#)/.test(u)) continue;
    if (!resolves(u)) bad(page, 'broken', u);
  }
  for (const m of html.matchAll(/<img\b[^>]*>/g)) if (!/\balt=/.test(m[0])) bad(page, 'img without alt', m[0].slice(0, 80));
}
// Sample testimonials are written to show the design. A staging build shows them with a
// label; a live build must never contain them.
const staging = /^Disallow: \/\s*$/m.test(readFileSync(join(DIST, 'robots.txt'), 'utf8'));
const withSamples = pages.filter(p => readFileSync(p, 'utf8').includes('class="reviews-flag"'));
if (withSamples.length && !staging) for (const p of withSamples) bad(p, 'sample testimonials on a live build');
else if (withSamples.length) console.log(`note: sample testimonials are shown on ${withSamples.length} page(s) — fine on this staging build, never on the live one.`);

const size = walk(DIST).reduce((a, f) => a + statSync(f).size, 0);
console.log(`${pages.length} pages checked, ${problems} problem(s), dist/ = ${(size / 1048576).toFixed(1)} MB`);
process.exit(problems ? 1 : 0);
