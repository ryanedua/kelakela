#!/usr/bin/env node
/**
 * Generates blank airline data templates.
 *
 * Every value is deliberately empty and every `verified` is null. This is not
 * laziness — a fee written from memory or guesswork, stamped with a
 * verification date, is worse than no page at all. The whole site rests on the
 * claim "we read this off the carrier's page on this date," and a made-up
 * number with a date next to it is a lie told confidently.
 *
 * So: structure from a script, figures from a human with the airline's page open.
 *
 * The `sourceUrl` values below are STARTING POINTS ONLY. Airlines reorganise
 * their sites constantly. Open each one, confirm it loads and shows the fee
 * table, and correct it if it redirects.
 *
 *   node scripts/scaffold-airline.mjs            # all missing carriers
 *   node scripts/scaffold-airline.mjs delta      # one
 */

import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.cwd(), 'src/data/airlines');
const GRN = '\x1b[32m', YEL = '\x1b[33m', DIM = '\x1b[2m', OFF = '\x1b[0m';

/** Identity only. Names and IATA codes are stable public facts; everything
 *  that can change — every fee, every limit — is left blank on purpose. */
const CARRIERS = {
  delta: {
    name: 'Delta Air Lines',
    iata: 'DL',
    officialSite: 'https://www.delta.com',
    baggageUrl: 'https://www.delta.com/us/en/baggage/overview',
    changesUrl: 'https://www.delta.com/us/en/change-cancel/overview',
  },
  united: {
    name: 'United Airlines',
    iata: 'UA',
    officialSite: 'https://www.united.com',
    baggageUrl: 'https://www.united.com/en/us/fly/baggage/checked-bags.html',
    changesUrl: 'https://www.united.com/en/us/fly/travel/tickets/change.html',
  },
  american: {
    name: 'American Airlines',
    iata: 'AA',
    officialSite: 'https://www.aa.com',
    baggageUrl: 'https://www.aa.com/i18n/travel-info/baggage/checked-baggage-policy.jsp',
    changesUrl: 'https://www.aa.com/i18n/travel-info/change-cancel-trip.jsp',
  },
  jetblue: {
    name: 'JetBlue',
    iata: 'B6',
    officialSite: 'https://www.jetblue.com',
    baggageUrl: 'https://www.jetblue.com/help/baggage',
    changesUrl: 'https://www.jetblue.com/help/change-cancel',
  },
  southwest: {
    name: 'Southwest Airlines',
    iata: 'WN',
    officialSite: 'https://www.southwest.com',
    baggageUrl: 'https://www.southwest.com/help/baggage',
    changesUrl: 'https://www.southwest.com/help/changes-and-cancellations',
    // Southwest's bag policy changed in 2025 and is the one most likely to be
    // misremembered — do not fill this from what you think you know.
    note: 'Bags-fly-free ended in 2025. Confirm the current schedule; a great deal of published material still describes the old policy.',
  },
};

const BAGGAGE_ROWS = [
  'First checked bag',
  'Second checked bag',
  'Max weight per bag',
  'Max linear dimensions',
  'Overweight fee',
];

const CHANGE_ROWS = [
  'Change fee (standard fares)',
  'Change fee (basic economy)',
  '24-hour risk-free cancellation',
  'Fare difference owed on change',
];

const template = (slug, c) => ({
  slug,
  name: c.name,
  iata: c.iata,
  officialSite: c.officialSite,
  note: c.note ?? '',

  baggage: {
    label: 'Checked bags',
    // null blocks the build. Fill this the day you read the figures, not the
    // day you intend to.
    verified: null,
    sourceUrl: c.baggageUrl,
    policyEffective: null,
    rows: BAGGAGE_ROWS.map((item) => ({ item, value: '', unit: '' })),
    caveats: [],
  },

  changesCancellations: {
    label: 'Changes and cancellations',
    verified: null,
    sourceUrl: c.changesUrl,
    policyEffective: null,
    rows: CHANGE_ROWS.map((item) => ({ item, value: '', unit: '' })),
    caveats: [],
  },
});

if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });

const only = process.argv[2];
const targets = only ? { [only]: CARRIERS[only] } : CARRIERS;

if (only && !CARRIERS[only]) {
  console.error(`Unknown carrier "${only}". Known: ${Object.keys(CARRIERS).join(', ')}`);
  process.exit(1);
}

let made = 0;
for (const [slug, c] of Object.entries(targets)) {
  const path = join(DIR, `${slug}.json`);
  if (existsSync(path)) {
    console.log(`${DIM}skip   ${slug}.json (exists)${OFF}`);
    continue;
  }
  writeFileSync(path, JSON.stringify(template(slug, c), null, 2) + '\n');
  console.log(`${GRN}create${OFF} ${slug}.json`);
  made++;
}

if (made) {
  console.log(`
${YEL}These files will not build until you fill them in.${OFF}
${DIM}Every 'verified' is null and every 'value' is empty — that's the point.
For each carrier: open sourceUrl, read the figures off the page, type them in,
and set 'verified' to the date you actually looked.

Then: npm run check${OFF}
`);
}
