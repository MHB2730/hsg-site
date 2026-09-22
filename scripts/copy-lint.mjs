// Copy consistency lint for dist/: headings never end in a full stop, eyebrows carry
// no punctuation, leads end with a full stop, and no double spaces slip through.
//   node scripts/copy-lint.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.html') ? [p] : []; });
const text = h => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const issues = new Map();
for (const f of walk('dist')) {
  const h = readFileSync(f, 'utf8');
  const main = h.split('<main')[1]?.split('</main>')[0] || h;
  for (const m of main.matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/g)) {
    const t = text(m[2]);
    if (/\.$/.test(t)) issues.set(`H${m[1]} ends with a full stop: "${t}"`, f);
    if (/\s{2,}/.test(m[2].replace(/<[^>]+>/g, ''))) issues.set(`double space in heading: "${t}"`, f);
  }
  for (const m of main.matchAll(/<p class="eyebrow"[^>]*>([\s\S]*?)<\/p>/g)) { const t = text(m[1]); if (/[.:;]$/.test(t)) issues.set(`eyebrow punctuation: "${t}"`, f); }
  for (const m of main.matchAll(/<p class="lead"[^>]*>([\s\S]*?)<\/p>/g)) { const t = text(m[1]); if (t && !/[.!?…]$/.test(t)) issues.set(`lead without a full stop: "${t.slice(0, 80)}"`, f); }
  for (const m of main.matchAll(/<p(?: class="[^"]*")?>([\s\S]*?)<\/p>/g)) { const t = text(m[1]); if (/ {2,}/.test(m[1].replace(/<[^>]+>/g, ''))) issues.set(`double space: "${t.slice(0, 60)}"`, f); }
}
if (issues.size) { for (const [k, v] of issues) console.log(`✗ ${k}  (${v.replace(/\\/g, '/')})`); process.exit(1); }
console.log('copy lint: no inconsistencies');
