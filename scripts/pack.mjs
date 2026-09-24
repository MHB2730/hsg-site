// Zips dist/ into hsg-site.zip for upload to the host's document root.
//   npm run pack
// The zip contains the site root (index.html, .htaccess, contact.php, ...). It never
// contains mail-config.php — that file is uploaded once, by hand, and left in place.
import { execSync } from 'node:child_process';
import { existsSync, rmSync, statSync, readFileSync } from 'node:fs';

if (!existsSync('dist/index.html')) { console.error('dist/ is empty — run `npm run build` first'); process.exit(1); }
if (existsSync('dist/mail-config.php')) { console.error('dist/mail-config.php must not be packaged'); process.exit(1); }
const out = process.argv.includes('--staging') ? 'hsg-site-staging.zip' : 'hsg-site.zip';
// The live zip must hold a live build. dist/ is whatever was built last, so straight after
// `npm run pack:staging` it holds the staging copy — noindex on every page, and sample
// testimonials on show — and uploading that as the live site would take it out of Google.
if (out === 'hsg-site.zip' && /^Disallow: \/\s*$/m.test(readFileSync('dist/robots.txt', 'utf8'))) {
  console.error('dist/ holds a staging build. Run `npm run build` first, then `npm run pack`.');
  process.exit(1);
}
if (existsSync(out)) rmSync(out);
if (process.platform === 'win32') {
  // Compress-Archive skips dot-files, so .htaccess is added with .NET directly.
  execSync(`powershell -NoProfile -Command "Add-Type -A System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory((Resolve-Path dist), (Join-Path (Get-Location) '${out}'))"`, { stdio: 'inherit' });
} else {
  execSync(`cd dist && zip -qr ../${out} .`, { stdio: 'inherit' });
}
console.log(`${out}: ${(statSync(out).size / 1048576).toFixed(1)} MB`);
