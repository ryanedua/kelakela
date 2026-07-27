#!/usr/bin/env node
/**
 * Freshness validator.
 *
 * dateModified is a ranking signal, and it only works if it's true.
 * This script makes lying structurally impossible by comparing a hash of
 * each file's BODY (frontmatter excluded) against the hash recorded at the
 * last `updated` bump.
 *
 * Two failures, both fatal:
 *   1. Body changed, `updated` didn't       → stale date on changed content
 *   2. `updated` bumped, body didn't        → fake freshness
 *
 * Case 2 is the one people rationalise. Mass date-bumps to look fresh are
 * detectable from the outside — Google sees a dateModified move with no
 * content delta across a whole site at once. It reads as exactly what it is.
 *
 * Hashes live in .freshness-lock.json, committed alongside content.
 *
 *   node scripts/check-freshness.mjs          # verify (CI + pre-commit)
 *   node scripts/check-freshness.mjs --accept # record current state
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const LOCK = join(ROOT, '.freshness-lock.json');
const DIRS = ['src/content/guides', 'src/content/policies'];
const ACCEPT = process.argv.includes('--accept');

const RED = '\x1b[31m', YEL = '\x1b[33m', GRN = '\x1b[32m', DIM = '\x1b[2m', OFF = '\x1b[0m';

async function walk(dir) {
  const out = [];
  const full = join(ROOT, dir);
  if (!existsSync(full)) return out;
  for (const e of await readdir(full, { withFileTypes: true })) {
    if (e.isDirectory()) out.push(...(await walk(join(dir, e.name))));
    else if (e.name.endsWith('.md')) out.push(join(dir, e.name));
  }
  return out;
}

/** Split frontmatter from body. Body hash must ignore frontmatter entirely,
 *  or bumping `updated` would itself change the hash and defeat the check. */
function parse(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return null;
  return { frontmatter: m[1], body: m[2] };
}

function field(fm, name) {
  const m = fm.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
}

const hash = (s) => createHash('sha256').update(s.trim()).digest('hex').slice(0, 16);

/** Parse "YYYY-MM-DD" by splitting manually — avoids UTC-midnight shift that
 *  makes new Date("2026-07-18") land on 2026-07-17 in UTC+7 environments. */
const day = (d) => {
  const [y, mo, dd] = String(d).split('-').map(Number);
  return Date.UTC(y, mo - 1, dd);
};

/** Return today's UTC day-stamp with a 1-day lookahead so that authors in
 *  UTC+7/+8/+9 can write tomorrow's date (their today) without failing CI.
 *  Netlify builds at ~3 AM UTC = still "yesterday" for WIB authors. */
const today = () => {
  const n = new Date();
  const tomorrow = new Date(n);
  tomorrow.setUTCDate(n.getUTCDate() + 1);
  return Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate());
};

const lock = existsSync(LOCK) ? JSON.parse(readFileSync(LOCK, 'utf8')) : {};
const next = {};
const errors = [];
const warnings = [];
let unchanged = 0;

for (const dir of DIRS) {
  for (const path of await walk(dir)) {
    const rel = relative(ROOT, join(ROOT, path));
    const parsed = parse(readFileSync(join(ROOT, path), 'utf8'));
    if (!parsed) {
      errors.push(`${rel}\n    No frontmatter block found.`);
      continue;
    }

    const updated = field(parsed.frontmatter, 'updated');
    const published = field(parsed.frontmatter, 'published');
    if (!updated) {
      errors.push(`${rel}\n    Missing 'updated'.`);
      continue;
    }
    if (published && day(updated) < day(published)) {
      errors.push(`${rel}\n    'updated' (${updated}) predates 'published' (${published}).`);
    }
    if (day(updated) > today()) {
      errors.push(`${rel}\n    'updated' (${updated}) is in the future.`);
    }

    const bodyHash = hash(parsed.body);
    next[rel] = { bodyHash, updated };

    const prev = lock[rel];
    if (!prev) continue; // new file, nothing to compare

    const bodyChanged = prev.bodyHash !== bodyHash;
    const dateChanged = prev.updated !== updated;

    if (bodyChanged && !dateChanged) {
      errors.push(
        `${rel}\n    Body changed but 'updated' is still ${updated}.\n` +
        `    ${DIM}Set it to today, or revert the body.${OFF}`
      );
    } else if (!bodyChanged && dateChanged) {
      errors.push(
        `${rel}\n    'updated' moved ${prev.updated} → ${updated} but the body is byte-identical.\n` +
        `    ${DIM}This is fake freshness. If only a fee in the JSON data changed,${OFF}\n` +
        `    ${DIM}bump 'verifiedAgainstSource' instead — that's what it's for.${OFF}`
      );
    } else if (!bodyChanged && !dateChanged) {
      unchanged++;
    }
  }
}

if (ACCEPT) {
  writeFileSync(LOCK, JSON.stringify(next, null, 2) + '\n');
  console.log(`${GRN}Recorded ${Object.keys(next).length} files to .freshness-lock.json${OFF}`);
  process.exit(0);
}

if (warnings.length) {
  console.log(`\n${YEL}Warnings${OFF}`);
  warnings.forEach((w) => console.log(`  ${w}`));
}

if (errors.length) {
  console.log(`\n${RED}Freshness check failed${OFF}\n`);
  errors.forEach((e) => console.log(`  ${RED}✗${OFF} ${e}\n`));
  console.log(`${DIM}After fixing, run: node scripts/check-freshness.mjs --accept${OFF}\n`);
  process.exit(1);
}

console.log(
  `${GRN}✓${OFF} Freshness OK — ${Object.keys(next).length} files ` +
  `${DIM}(${unchanged} unchanged)${OFF}`
);
writeFileSync(LOCK, JSON.stringify(next, null, 2) + '\n');