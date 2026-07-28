#!/usr/bin/env node
/**
 * IndexNow bulk submitter.
 *
 * Reads the built sitemap and submits every URL to IndexNow in one request,
 * which pings Bing, Yandex and the other participating engines at once.
 * Google does not participate — this does nothing for your Google traffic,
 * which is most of it. It's a low-effort nudge for the engines that do listen,
 * not a ranking lever. Run it after a deploy, or wire it into `npm run ship`.
 *
 * The key and host are read from what's actually on disk and in the sitemap,
 * so this can't drift out of sync with the site the way a hardcoded origin would.
 *
 * Usage:  node scripts/indexnow.mjs           submit everything in the sitemap
 *         node scripts/indexnow.mjs --dry-run  print what it would send, send nothing
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIST = join(process.cwd(), 'dist');
const DRY = process.argv.includes('--dry-run');
const GRN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m', OFF = '\x1b[0m';

/** The key file is public/<key>.txt whose contents equal its own name.
 *  Finding it on disk means we never hardcode the key in two places. */
function findKey() {
  const pub = join(process.cwd(), 'public');
  const txt = readdirSync(pub).find(
    (f) => /^[a-f0-9]{8,128}\.txt$/.test(f)
  );
  if (!txt) {
    console.error(`${RED}No IndexNow key file found in public/.${OFF}`);
    console.error(`${DIM}Expected a file like public/<hexkey>.txt containing that key.${OFF}`);
    process.exit(1);
  }
  const key = readFileSync(join(pub, txt), 'utf8').trim();
  if (`${key}.txt` !== txt) {
    console.error(`${RED}Key file contents don't match its filename.${OFF}`);
    console.error(`${DIM}${txt} must contain exactly: ${txt.replace('.txt', '')}${OFF}`);
    process.exit(1);
  }
  return key;
}

/** Pull every <loc> from the built sitemap. Reads sitemap-0.xml directly
 *  rather than parsing the index — one file, no XML library needed. */
function readUrls() {
  let xml;
  try {
    xml = readFileSync(join(DIST, 'sitemap-0.xml'), 'utf8');
  } catch {
    console.error(`${RED}No dist/sitemap-0.xml. Run the build first.${OFF}`);
    process.exit(1);
  }
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  if (!urls.length) {
    console.error(`${RED}Sitemap has no URLs.${OFF}`);
    process.exit(1);
  }
  return urls;
}

const key = findKey();
const urls = readUrls();

// Host comes from the sitemap's own URLs, so a stale local site.ts can't
// point this at the wrong domain.
const host = new URL(urls[0]).host;

if (host === 'example.com') {
  console.error(`${RED}Sitemap still points at example.com.${OFF}`);
  console.error(`${DIM}Set SITE.origin in src/data/site.ts to https://sarinlab.stanford.edu and rebuild.${OFF}`);
  process.exit(1);
}

const payload = {
  host,
  key,
  keyLocation: `https://${host}/${key}.txt`,
  urlList: urls,
};

console.log(`${DIM}host:${OFF} ${host}`);
console.log(`${DIM}urls:${OFF} ${urls.length}`);
console.log(`${DIM}key: ${OFF} ${key.slice(0, 8)}…`);

if (DRY) {
  console.log(`\n${DIM}--dry-run: nothing sent. URLs that would go:${OFF}`);
  urls.forEach((u) => console.log(`  ${u}`));
  process.exit(0);
}

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(payload),
});

// IndexNow returns 200 or 202 on success. 422 means a URL didn't match the
// host; 403 means the key file couldn't be verified.
if (res.status === 200 || res.status === 202) {
  console.log(`\n${GRN}✓${OFF} Submitted ${urls.length} URLs (HTTP ${res.status})`);
} else {
  const body = await res.text().catch(() => '');
  console.error(`\n${RED}✗ IndexNow returned HTTP ${res.status}${OFF}`);
  if (res.status === 403) {
    console.error(`${DIM}403 = key file not reachable. Is https://${host}/${key}.txt live yet?${OFF}`);
  } else if (res.status === 422) {
    console.error(`${DIM}422 = a URL didn't match the host, or the key format was rejected.${OFF}`);
  }
  if (body) console.error(`${DIM}${body.slice(0, 300)}${OFF}`);
  process.exit(1);
}
