import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { SITE } from './src/data/site';

/**
 * Real `lastmod`, read straight off the Markdown frontmatter.
 *
 * `astro:content` is a build-time virtual module and is NOT importable here —
 * the config is evaluated before it exists. So we parse the files ourselves.
 * Crude, but the alternative is @astrojs/sitemap's default: lastmod = build
 * time, which claims every page changed on every deploy. Google has discounted
 * that signal for years, and on a site whose entire pitch is "we checked, and
 * here's the date," shipping a fake lastmod would be self-defeating.
 *
 * The `updated` field this reads is the one check-freshness.mjs guarantees is
 * honest, so the sitemap inherits that guarantee.
 */
function readUpdated(dir, urlFor) {
  const map = new Map();
  const full = join(process.cwd(), dir);
  if (!existsSync(full)) return map;

  for (const file of readdirSync(full)) {
    if (!file.endsWith('.md')) continue;
    const raw = readFileSync(join(full, file), 'utf8');
    const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fm) continue;

    const get = (k) => {
      const m = fm[1].match(new RegExp(`^${k}:\\s*(.+)$`, 'm'));
      return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
    };

    if (get('draft') === 'true' || get('noindex') === 'true') continue;

    const updated = get('updated');
    if (!updated) continue;

    const url = urlFor(file.replace(/\.md$/, ''), get);
    if (url) map.set(url, new Date(updated).toISOString());
  }
  return map;
}

const lastmod = new Map([
  ...readUpdated('src/content/guides', (slug) => `/guides/${slug}/`),
  ...readUpdated('src/content/policies', (_slug, get) => {
    const airline = get('airline');
    const topic = get('topic');
    return airline && topic ? `/airlines/${airline}/${topic}/` : null;
  }),
]);

export default defineConfig({
  site: SITE.origin,
  trailingSlash: 'always',

  integrations: [
    sitemap({
      filter: (page) => !page.includes('/admin'),

      // changefreq and priority omitted deliberately: Google has said for years
      // it ignores both, and guessing at them only adds bytes.
      serialize(item) {
        const path = new URL(item.url).pathname;
        const d = lastmod.get(path);
        return d ? { ...item, lastmod: d } : item;
      },
    }),
  ],

  build: { format: 'directory' },
});
