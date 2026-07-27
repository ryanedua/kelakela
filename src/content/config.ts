import { defineCollection, z, reference } from 'astro:content';

const AIRLINES = [
  'delta',
  'united',
  'american',
  'southwest',
  'alaska',
  'jetblue',
  'frontier',
  'aeroflot',
  'air-china',
  'copa',
  'emirates',
  'iberia',
  'klm',
  'qantas',
  'singapore',
  'vietnam',
  'aerolineas-argentinas',
  'air-france',
  'british',
  'ethiopian',
  'indigo',
  'kenya',
  'qatar',
  'tui',
  'virgin-atlantic',
  'aeromexico',
  'air-new-zealand',
  'cathay-pacific',
  'el-al',
  'flydubai',
  'japan',
  'korean-air',
  'royal-air-maroc',
  'turkish',
  'xiamen',
  'air-canada',
  'all-nippon',
  'china-southern',
  'eva-air',
  'hainan',
  'jeju-air',
  'lufthansa',
  'swiss',
  'avianca',
  'spirit',
] as const;

/**
 * GUIDES — narrative how-to content.
 * Topic-first URLs: /guides/<slug>/
 * These are the cross-airline and scenario pages. This is where the
 * real ranking opportunity is, because airline.com answers these badly.
 */
const guides = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string().max(130),
    // Distinct from title. Title is for SERP, h1 is for the page.
    heading: z.string().optional(),
    description: z.string().min(70).max(311),

    // Which airlines this guide touches. Empty = cross-airline / general.
    airlines: z.array(z.enum(AIRLINES)).default([]),

    topic: z.enum([
      'baggage',
      'booking',
      'changes-cancellations',
      'refunds',
      'delays-compensation',
      'check-in',
      'seating',
      'loyalty',
      'special-assistance',
      'pets',
      'international',
    ]),

    // The query this page is actually built to win. Keep yourself honest.
    targetQuery: z.string(),

    /**
     * The short answer, stated plainly, before any prose.
     *
     * Most people arriving from a search for "missed connection different
     * airline" want to know if they're covered — not to read 900 words first.
     * Give them the answer at the top. This costs some scroll depth and it is
     * worth it: a page that answers fast earns the return visit, and burying
     * the answer to farm dwell time is the kind of thing readers notice.
     *
     * Also what an AI Overview will lift. Better it lifts an accurate
     * sentence you wrote than one it assembles from your hedging.
     */
    verdict: z.string().min(40).max(1000),

    published: z.date(),
    // The freshness signal. Only bump when content actually changed.
    updated: z.date(),
    // Set when you last verified claims against the airline's own source.
    verifiedAgainstSource: z.date().optional(),

    // Renders as HowTo schema only when steps are a real sequence.
    isHowTo: z.boolean().default(false),

    faq: z
      .array(z.object({ q: z.string(), a: z.string() }))
      .default([]),

    // Cite the airline's own policy page. Non-negotiable for trust.
    sources: z
      .array(
        z.object({
          label: z.string(),
          url: z.string().url(),
          retrieved: z.date(),
        })
      )
      .default([]),

    related: z.array(reference('guides')).default([]),
    policyRefs: z.array(reference('policies')).default([]),

    draft: z.boolean().default(false),
    noindex: z.boolean().default(false),
    canonical: z.string().url().optional(),
  }),
});

/**
 * POLICIES — reference pages, one per airline+topic.
 * Airline-first URLs: /airlines/<airline>/<topic>/
 * Prose here is thin by design. The numbers come from src/data/airlines/*.json
 * so a fee change is one edit, not forty.
 */
const policies = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string().max(300),
    heading: z.string().optional(),
    description: z.string().min(70).max(311),

    airline: z.enum(AIRLINES),
    topic: z.enum([
      'baggage',
      'changes-cancellations',
      'refunds',
      'delays-compensation',
      'check-in',
      'seating',
      'pets',
    ]),

    targetQuery: z.string(),

    // Which key in src/data/airlines/<airline>.json to pull the data block from.
    dataKey: z.string(),

    published: z.date(),
    updated: z.date(),
    verifiedAgainstSource: z.date(),

    // When the AIRLINE's policy took effect — not when you wrote about it.
    // These are different dates and conflating them is how you end up wrong.
    policyEffective: z.date().optional(),

    faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),

    sources: z
      .array(
        z.object({
          label: z.string(),
          url: z.string().url(),
          retrieved: z.date(),
        })
      )
      .min(1, 'A policy page without a source is a liability.'),

    related: z.array(reference('guides')).default([]),

    draft: z.boolean().default(false),
    noindex: z.boolean().default(false),
    canonical: z.string().url().optional(),
  }),
});

export const collections = { guides, policies };
