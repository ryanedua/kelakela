# Flight Policy Desk

Astro + Sveltia CMS + Tailwind, deployed on Cloudflare Pages.
English, US-targeted. Airline policy and booking guides.

Everything named `example.com` / `YOUR-USER` is a placeholder. Search for both.

## Why it's built this way

**Numbers live in `src/data/airlines/*.json`, not in articles.**
A baggage fee appears on the Delta policy page, three guides, and a comparison
page. Written into the prose, a fee change is five edits and you will miss one.
Written once in JSON, it's one edit. This is the whole reason the site has a
CMS instead of a folder of Markdown.

**Every number renders through `PolicyData.astro`.**
That component will not render a figure without a `verified` date and a link to
the airline's own page. After 90 days it flags itself stale in red, on the live
page, to the reader. This is deliberate: a fee with no date is a rumour, and the
component makes publishing one structurally impossible.

**Two collections, two URL shapes.**
- `policies` → `/airlines/alaska/baggage/` — reference, thin prose, airline-first
- `guides` → `/guides/missed-connection-different-airline/` — narrative, topic-first

Airline-first builds topical authority per carrier. Topic-first is what ranks for
cross-airline queries. You need both, so the URLs are separate.

## About ranking

Head terms are not winnable. For "Delta baggage fees," delta.com owns the SERP
and AI Overviews answer above the fold. Building for those queries is building
for zero clicks.

What is winnable, and what the schema is shaped around:

- **Cross-airline and scenario queries.** Separate tickets, interline handoffs,
  connections that break across carriers. Airline sites cannot answer these
  because the answer involves their competitors. `guides` with empty `airlines[]`.
- **Change-driven confusion.** Alaska's Sabre cutover, the Hawaiian merger, the
  Atmos rebrand. Official pages lagged; the gap is real and it's why Alaska is
  outperforming Delta for you. `policyEffective` exists for exactly this.
- **Problem-based long-tail.** Your existing PAA research already maps this.

`targetQuery` is a required field on both collections. If you cannot name the
one query a page is built to win, the page should not exist. It is not decoration.

## Honesty as a ranking strategy

The `verifiedAgainstSource` date, the mandatory `sources` array on policy pages,
and the stale flag are not compliance theater. They are what a site competing
against airline.com has that airline.com doesn't: a visible, checkable claim to
being current.

Two things to hold to:

- **Only bump `updated` when the content actually changed.** Mass date bumps to
  fake freshness are detectable and they cost you.
- **FAQ markup must match visible page text.** The schema in frontmatter is not
  a shortcut around writing the answers into the body. Marking up FAQs that
  aren't on the page is a manual action risk.

## Setup

```bash
npm create astro@latest . -- --template minimal --typescript strict
npx astro add tailwind sitemap
npm install
npm run dev
```

CMS auth needs a GitHub OAuth app; Sveltia's docs cover the Cloudflare Worker
route, which is what you want if you're not on Netlify.

## What's here vs. what's next

Built: content schema, SEO/schema-markup component, PolicyData component,
CMS config, one airline data file (Alaska), one sample guide.

Not yet: layouts, page routes, the type scale and Tailwind theme, the homepage,
`astro.config.mjs`, remaining airline data files.

## Design notes

Palette is gate-signage, not the default AI-design cream-and-terracotta:
navy `#0B1F3A`, paper `#F7F5F0`, amber `#E8B33D`, signal red `#C4403A`,
slate `#7A8FA6`, green `#1A6B54`.

Numbers are set in the monospace utility face with tabular figures, because in
policy content numbers are data and setting them as data is an honesty move as
much as a typographic one.

The Policy Data Block is the signature element. Everything else stays quiet.

## Content integrity checks

Three validators. All run on pre-commit and in CI; the first two also gate `npm run build`.

```bash
npm run check          # all three
npm run accept         # record current state after intentional changes
```

**`check-freshness.mjs`** — hashes each file's body (frontmatter excluded) against
`.freshness-lock.json`. Fails on:

- body changed, `updated` not bumped → stale date on changed content
- `updated` bumped, body byte-identical → fake freshness
- `updated` in the future, or before `published`

The second case is the one worth having. Mass date-bumps to look fresh are
visible from outside — a `dateModified` move with no content delta, sitewide,
reads as exactly what it is. If only a fee in the JSON changed, bump
`verifiedAgainstSource`, not `updated`.

**`check-faq-visibility.mjs`** — asserts every `faq[].q` in frontmatter appears
in the rendered body. FAQPage markup describing invisible content is the most
common way content sites earn a manual action.

**`check-stale.mjs`** — walks `verified` dates in `src/data/airlines/*.json`.
Over 90 days, `PolicyData` flags itself to readers in red. Over 180, the pages
using that data should be noindexed. A weekly CI job opens (and updates) a
`stale-data` issue listing what needs re-checking.

## What we took from other sites, and what we didn't

Looked at MIT OCW's head markup as a reference point. Worth taking: self-referencing
canonical, `hreflang` en + `x-default`, complete OG tags with `og:image:alt`.

Deliberately not taken:

- `<meta name="keywords">` — dead since 2009, ignored by every major engine
- `WebPage` schema — the most generic type available; we use Article/HowTo
- No `dateModified` at all — fine for a course catalogue where Fall 2022 material
  never changes, fatal for policy content whose entire value is currency

That last one is the whole point. Copying a static archive's SEO posture onto a
site whose only edge over delta.com is freshness would throw away the edge.

## Adding an airline

Two files per carrier. Both are scaffolded for you; neither ships until filled in.

```bash
node scripts/scaffold-airline.mjs           # all missing carriers
node scripts/scaffold-airline.mjs delta     # just one
```

**1. `src/data/airlines/<slug>.json`** — the figures. Every `verified` is `null`
and every `value` is `""` on purpose. Open the `sourceUrl`, read the numbers off
the carrier's page, type them in, set `verified` to the date you actually looked.

The `sourceUrl` values are starting points. Airlines reorganise constantly —
open each one and correct it if it redirects.

**2. `src/content/policies/<slug>-baggage.md`** — the page. Dates are set to
`1970-01-01`: schema-valid so the build doesn't break, impossible to mistake for
real. `draft: true` keeps it off the site until you flip it.

Astro validates frontmatter *before* the draft filter runs, so a template with a
non-date placeholder in a date field breaks the entire build, not just its own
page. Hence 1970.

### What happens if you don't fill them in

Nothing bad, which is the point:

- The carrier gets no page. `/airlines/<slug>/` is not generated at all — an
  empty hub is a thin page Google indexes and holds against the site.
- `/airlines/` lists it under **Not yet checked**, named but unlinked. Showing
  the gap costs nothing; implying coverage you don't have costs trust.
- `npm run check:stale` reports it as `never checked` rather than skipping it
  silently. A to-do you can't see is a to-do that becomes permanent.

### Why the figures aren't pre-filled

They were, once, for Alaska — and they were invented. A fee written from memory
and stamped with a verification date is worse than no page: it's a lie told
confidently, and someone pays it at the counter.

The only figure worth publishing is one a human read off the carrier's page on
a date they can name. Structure from a script, numbers from a person.
