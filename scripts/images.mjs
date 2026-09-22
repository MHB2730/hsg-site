// Image pipeline: images/src/** -> dist/images/** (responsive WebP) + build/images.json.
//
// Folder rules (see RULES): headshots are square-cropped, scene / project / article
// photography is rendered in greyscale (the brand is strictly black, white and grey),
// SVG icons are normalised to currentColor and inlined by the page builder, brand
// files and documents are copied as-is. Outputs are only regenerated when the source
// is newer, so re-runs are quick.
import sharp from 'sharp';
import { readdirSync, statSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { join, basename, extname, relative, sep } from 'node:path';

const SRC = 'images/src', OUT = 'dist/images', MANIFEST = 'build/images.json';
const RULES = {
  team:      { widths: [320, 640, 960],   square: true,  grey: false, quality: 80 },
  scenes:    { widths: [720, 1280, 1920], square: false, grey: true,  quality: 74, colourToo: true },
  projects:  { widths: [480, 960, 1400],  square: false, grey: true,  quality: 74 },
  articles:  { widths: [480, 960, 1400],  square: false, grey: true,  quality: 74 },
};
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
let made = 0, kept = 0;

function walk(dir) { return readdirSync(dir).flatMap(f => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; }); }
const newer = (src, out) => !existsSync(out) || statSync(src).mtimeMs > statSync(out).mtimeMs;

for (const file of walk(SRC)) {
  const rel = relative(SRC, file).split(sep).join('/');
  const [folder] = rel.split('/');
  const name = basename(rel, extname(rel));
  const ext = extname(rel).toLowerCase();
  const key = `${folder}/${name}`;
  const outDir = join(OUT, folder);
  mkdirSync(outDir, { recursive: true });

  if (ext === '.svg') {
    let svg = readFileSync(file, 'utf8');
    if (folder === 'services') {
      // Line icons exported from Illustrator: keep their internal <style> and inline
      // styles (the white fills are masks), but scope every class and id to the icon
      // so several can be inlined on one page, and map the colours to CSS.
      svg = svg.replace(/<\?xml[^>]*>/, '').replace(/<!DOCTYPE[^>]*>/, '')
        .replace(/\s(x|y)="0px"/g, '').replace(/\sxml:space="preserve"/, '').replace(/\sid="Layer_1"/, '')
        .replace(/enable-background:new [^;"]*;?/g, '').replace(/\sstyle=""/g, '')
        .replace(/\.st(\d+)/g, `.${name}-st$1`)
        .replace(/class="([^"]+)"/g, (m, c) => `class="${c.split(/\s+/).map(x => /^st\d+$/.test(x) ? `${name}-${x}` : x).join(' ')}"`)
        .replace(/id="([^"]+)"/g, (m, id) => `id="${name}-${id}"`).replace(/url\(#([^)]+)\)/g, (m, id) => `url(#${name}-${id})`).replace(/xlink:href="#([^"]+)"/g, (m, id) => `xlink:href="#${name}-${id}"`)
        .replace(/stroke:#231F20/gi, 'stroke:currentColor').replace(/fill:#231F20/gi, 'fill:currentColor')
        .replace(/fill:#FFFFFF/gi, 'fill:var(--icon-bg,#fff)')
        .replace(/stroke-miterlimit:10;/g, 'stroke-miterlimit:10;stroke-width:1.15;')
        .replace(/<svg /, '<svg aria-hidden="true" focusable="false" ')
        .replace(/\s+/g, ' ').replace(/>\s+</g, '><');
      manifest[key] = { type: 'inline-svg', svg };
    } else {
      const out = join(outDir, `${name}.svg`);
      if (newer(file, out)) { writeFileSync(out, svg); made++; } else kept++;
      manifest[key] = { type: 'file', src: `/images/${folder}/${name}.svg` };
    }
    continue;
  }
  if (!RULES[folder]) {
    // brand PNGs, PDFs: copy through untouched.
    const out = join(outDir, basename(rel));
    if (newer(file, out)) { copyFileSync(file, out); made++; } else kept++;
    const meta = /\.(png|jpe?g|webp)$/.test(ext) ? await sharp(file).metadata() : {};
    manifest[key] = { type: 'file', src: `/images/${folder}/${basename(rel)}`, width: meta.width, height: meta.height };
    continue;
  }

  const rule = RULES[folder];
  const meta = await sharp(file).metadata();
  const srcW = meta.width, srcH = meta.height;
  const side = Math.min(srcW, srcH);
  const ratio = rule.square ? 1 : srcH / srcW;
  const variants = [];
  const maxW = rule.square ? side : srcW;
  // Never upscale: a width beyond the source becomes one final variant at the native size.
  const widths = [...new Set(rule.widths.map(w => Math.min(w, maxW)))];
  const colour = [];
  for (const w of widths) {
    // Greyscale (or plain) variant, plus a colour twin for greyscale folders so a
    // page can reveal colour on interaction without a second source image.
    const passes = rule.grey && rule.colourToo ? [['', true], ['-colour', false]] : [['', rule.grey]];
    for (const [suffix, grey] of passes) {
      const out = join(outDir, `${name}-${w}${suffix}.webp`);
      (suffix ? colour : variants).push({ w, src: `/images/${folder}/${name}-${w}${suffix}.webp` });
      if (!newer(file, out)) { kept++; continue; }
      let img = sharp(file).rotate();
      if (rule.square) img = img.resize({ width: side, height: side, fit: 'cover', position: 'attention' });
      img = img.resize({ width: w, withoutEnlargement: true });
      if (grey) img = img.greyscale().linear(1.06, -6).modulate({ brightness: 1.02 });
      await img.webp({ quality: rule.quality, effort: 5 }).toFile(out);
      made++;
    }
  }
  const largest = variants[variants.length - 1].w;
  manifest[key] = { type: 'photo', variants, ...(colour.length ? { colour } : {}), width: largest, height: Math.round(largest * ratio), ratio: +ratio.toFixed(4) };
}

mkdirSync('build', { recursive: true });
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
console.log(`images: ${made} written, ${kept} up to date, ${Object.keys(manifest).length} entries`);
