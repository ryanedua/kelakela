#!/usr/bin/env node
/**
 * Internal link checker.
 *
 * Walks dist/ and asserts every internal href resolves to a built page.
 * Catches the failure mode that hurts most: a nav or board link pointing at a
 * page that was never generated. Those 404 silently — nobody clicks their own
 * nav — and Google finds them before you do.
 *
 * Uses node:fs rather than shelling out to `find`. Windows does ship a
 * find.exe, but it searches file *contents*, so the call fails with an error
 * that looks nothing like a path problem. Portable beats clever here.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

const DIST = join(process.cwd(), 'dist');
const RED = '\x1b[31m', GRN = '\x1b[32m', DIM = '\x1b[2m', OFF = '\x1b[0m';

if (!existsSync(DIST)) {
  console.error('No dist/ directory. Run the build first.');
  process.exit(1);
}

/** Recursive walk; absolute paths of every .html file. */
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

/** dist/a/b/index.html -> /a/b/ — forward slashes always, including on Windows. */
const toUrl = (abs) =>
  abs.slice(DIST.length).split(sep).join('/').replace(/index\.html$/, '') || '/';

const pages = walk(DIST);
const built = new Set(pages.map(toUrl));

const broken = new Set();

for (const abs of pages) {
  const from = toUrl(abs);
  const html = readFileSync(abs, 'utf8');

  for (const m of html.matchAll(/href="(\/[^"#]*)"/g)) {
    const href = m[1];

    // Assets and the CMS mount aren't pages.
    if (href.startsWith('/_astro') || href.startsWith('/admin')) continue;
    if (/\.(xml|css|js|png|jpe?g|svg|webp|ico|woff2?|txt)$/i.test(href)) continue;

    const target = href.endsWith('/') ? href : href + '/';
    if (built.has(target)) continue;

    // Could be a real file rather than a directory-style page.
    if (existsSync(join(DIST, href.split('/').join(sep)))) continue;

    broken.add(`${from}  ->  ${href}`);
  }
}

if (broken.size) {
  console.log(`\n${RED}Broken internal links${OFF}\n`);
  [...broken].sort().forEach((b) => console.log(`  ${RED}✗${OFF} ${b}`));
  console.log(`\n${DIM}Either build the missing page, or stop linking to it.${OFF}\n`);
  process.exit(1);
}

console.log(`${GRN}✓${OFF} All internal links resolve ${DIM}(${built.size} pages)${OFF}`);
