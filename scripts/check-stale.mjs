#!/usr/bin/env node
/**
 * Stale audit.
 *
 * Every fee in src/data/airlines/*.json carries a `verified` date. This walks
 * them and reports age. Thresholds:
 *
 *   > 90 days   WARN     — PolicyData renders a visible stale flag to readers
 *   > 180 days  CRITICAL — pages consuming this data should be noindexed
 *
 * The reasoning: a site whose whole pitch is "we checked, and here's the date"
 * has no business serving figures it hasn't checked in six months. A missing
 * page costs a little traffic. A wrong baggage fee costs the reader money at
 * the counter and costs you the one thing you have that delta.com doesn't.
 *
 *   node scripts/check-stale.mjs            # report, exit 0
 *   node scripts/check-stale.mjs --ci       # exit 1 on critical (CI gate)
 *   node scripts/check-stale.mjs --json     # machine-readable, for issue bot
 */

import { readFileSync, existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const DIR = join(process.cwd(), 'src/data/airlines');
const WARN_DAYS = 90;
const CRIT_DAYS = 180;
const CI = process.argv.includes('--ci');
const JSON_OUT = process.argv.includes('--json');

const RED = '\x1b[31m', YEL = '\x1b[33m', GRN = '\x1b[32m', DIM = '\x1b[2m', OFF = '\x1b[0m';

const daysSince = (d) => Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);

if (!existsSync(DIR)) {
  console.error(`No such directory: ${DIR}`);
  process.exit(1);
}

const rows = [];

for (const file of (await readdir(DIR)).filter((f) => f.endsWith('.json'))) {
  const data = JSON.parse(readFileSync(join(DIR, file), 'utf8'));

  // Any object holding a `verified` key is a data block worth auditing.
  for (const [key, block] of Object.entries(data)) {
    if (!block || typeof block !== 'object' || Array.isArray(block)) continue;
    if (!('verified' in block)) continue;

    // Scaffolded but never filled in. Reported, not skipped: a carrier sitting
    // unverified for months is a fact about the site, and silence about it is
    // how a to-do quietly becomes permanent.
    if (!block.verified) {
      rows.push({
        airline: data.name ?? file.replace('.json', ''),
        slug: data.slug ?? file.replace('.json', ''),
        block: key,
        verified: null,
        age: null,
        sourceUrl: block.sourceUrl ?? null,
        status: 'unverified',
      });
      continue;
    }

    const age = daysSince(block.verified);
    rows.push({
      airline: data.name ?? file.replace('.json', ''),
      slug: data.slug ?? file.replace('.json', ''),
      block: key,
      verified: block.verified,
      age,
      sourceUrl: block.sourceUrl ?? null,
      status: age > CRIT_DAYS ? 'critical' : age > WARN_DAYS ? 'warn' : 'ok',
    });
  }
}

// Unverified first (they need work), then oldest-checked.
rows.sort((a, b) => {
  if (a.status === 'unverified' && b.status !== 'unverified') return -1;
  if (b.status === 'unverified' && a.status !== 'unverified') return 1;
  return (b.age ?? 0) - (a.age ?? 0);
});

if (JSON_OUT) {
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

const crit = rows.filter((r) => r.status === 'critical');
const warn = rows.filter((r) => r.status === 'warn');
const ok = rows.filter((r) => r.status === 'ok');
const unver = rows.filter((r) => r.status === 'unverified');

console.log('');
for (const r of rows) {
  const mark =
    r.status === 'critical' ? `${RED}✗${OFF}`
    : r.status === 'warn' ? `${YEL}!${OFF}`
    : r.status === 'unverified' ? `${DIM}·${OFF}`
    : `${GRN}✓${OFF}`;
  const label = `${r.airline} / ${r.block}`.padEnd(38);
  const age = r.age === null ? '   —' : `${r.age}d`.padStart(5);
  const when = r.verified ?? 'never checked';
  console.log(`  ${mark} ${label} ${age}  ${DIM}${when}${OFF}`);
}

console.log('');
if (crit.length) {
  console.log(`  ${RED}${crit.length} critical${OFF} — over ${CRIT_DAYS} days. Re-verify or noindex the pages using this data.`);
  for (const r of crit) {
    if (r.sourceUrl) console.log(`      ${DIM}${r.sourceUrl}${OFF}`);
  }
}
if (warn.length) {
  console.log(`  ${YEL}${warn.length} stale${OFF} — over ${WARN_DAYS} days. Already flagged to readers on the live page.`);
}
if (unver.length) {
  console.log(`  ${DIM}${unver.length} never checked${OFF} — scaffolded, not published. These carriers do not appear on the site.`);
}
if (ok.length) console.log(`  ${GRN}${ok.length} current${OFF}`);
console.log('');

if (CI && crit.length) process.exit(1);
