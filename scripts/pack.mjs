// Zips dist/ into hsg-site.zip for upload to the cPanel document root.
//   npm run pack
// The zip contains the site root (index.html, .htaccess, contact.php, ...). It never
// contains mail-config.php — that file is uploaded once, by hand, and left in place.
import { execSync } from 'node:child_process';
import { existsSync, rmSync, statSync } from 'node:fs';

if (!existsSync('dist/index.html')) { console.error('dist/ is empty — run `npm run build` first'); process.exit(1); }
if (existsSync('dist/mail-config.php')) { console.error('dist/mail-config.php must not be packaged'); process.exit(1); }
const out = process.argv.includes('--staging') ? 'hsg-site-staging.zip' : 'hsg-site.zip';
if (existsSync(out)) rmSync(out);
if (process.platform === 'win32') {
  // Compress-Archive skips dot-files, so .htaccess is added with .NET directly.
  execSync(`powershell -NoProfile -Command "Add-Type -A System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory((Resolve-Path dist), (Join-Path (Get-Location) '${out}'))"`, { stdio: 'inherit' });
} else {
  execSync(`cd dist && zip -qr ../${out} .`, { stdio: 'inherit' });
}
console.log(`${out}: ${(statSync(out).size / 1048576).toFixed(1)} MB`);
