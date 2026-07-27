#!/usr/bin/env node
/**
 * FAQ visibility check.
 *
 * Google requires that FAQPage markup describe content actually visible on
 * the page. Frontmatter FAQ arrays make it trivially easy to ship structured
 * data for answers no reader can see — that's a manual action waiting to
 * happen, and it's the single most common way content sites get burned by
 * rich results.
 *
 * This asserts every faq[].q in frontmatter appears in the rendered body.
 *
 *   node scripts/check-faq-visibility.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const DIRS = ['src/content/guides', 'src/content/policies'];

const RED = '\x1b[31m', GRN = '\x1b[32m', DIM = '\x1b[2m', OFF = '\x1b[0m';

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

/** Strip markdown emphasis and collapse whitespace so a question written as
 *  `**Why?**` in the body still matches `Why?` in frontmatter. */
const normalise = (s) =>
  s.replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

const errors = [];
let checked = 0;
let withFaq = 0;

for (const dir of DIRS) {
  for (const path of await walk(dir)) {
    const rel = relative(ROOT, join(ROOT, path));
    const raw = readFileSync(join(ROOT, path), 'utf8');
    const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!m) continue;

    const [, fm, body] = m;
    checked++;

    // Pull `  - q: "..."` entries out of the faq block.
    const faqBlock = fm.match(/^faq:\r?\n([\s\S]*?)(?=^\w|\Z)/m);
    if (!faqBlock) continue;

    const questions = [...faqBlock[1].matchAll(/^\s*-\s*q:\s*(.+)$/gm)].map((x) =>
      x[1].trim().replace(/^["']|["']$/g, '')
    );
    if (!questions.length) continue;
    withFaq++;

    const haystack = normalise(body);
    const missing = questions.filter((q) => !haystack.includes(normalise(q)));

    if (missing.length) {
      errors.push(
        `${rel}\n` +
        missing.map((q) => `    Not in body: "${q}"`).join('\n') +
        `\n    ${DIM}FAQPage markup must describe visible content. Write these${OFF}\n` +
        `    ${DIM}into the body, or remove them from frontmatter.${OFF}`
      );
    }
  }
}

if (errors.length) {
  console.log(`\n${RED}FAQ visibility check failed${OFF}\n`);
  errors.forEach((e) => console.log(`  ${RED}✗${OFF} ${e}\n`));
  process.exit(1);
}

console.log(
  `${GRN}✓${OFF} FAQ visibility OK — ${withFaq} of ${checked} files carry FAQ markup, ` +
  `all questions present in body`
);
