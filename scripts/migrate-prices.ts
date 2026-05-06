/**
 * One-time migration: reads all data/prices/YYYY-MM-DD.json daily files
 * and builds data/price-history.json with compact per-card history arrays.
 *
 * Run: npx tsx scripts/migrate-prices.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR   = path.resolve(__dirname, '../data');
const PRICES_DIR = path.join(DATA_DIR, 'prices');
const HIST_PATH  = path.join(DATA_DIR, 'price-history.json');

interface DailySnapshot {
  syncedAt: string;
  prices: Record<string, {
    cardmarket?: { url?: string; prices?: { trendPrice?: number } };
    tcgplayer?:  { url?: string; prices?: Record<string, { market?: number }> };
  }>;
}

interface HistoryEntry {
  url: string;
  d: string[];   // ISO dates, sorted oldest → newest
  p: number[];   // trendPrice (EUR) for each date
}

async function main() {
  // Load existing history if present (idempotent re-runs)
  const history: Record<string, HistoryEntry> = {};
  if (fs.existsSync(HIST_PATH)) {
    const existing = JSON.parse(fs.readFileSync(HIST_PATH, 'utf-8')) as { history?: Record<string, HistoryEntry> };
    if (existing.history) Object.assign(history, existing.history);
  }

  if (!fs.existsSync(PRICES_DIR)) {
    console.log('No daily prices directory found, nothing to migrate.');
    return;
  }

  const files = fs.readdirSync(PRICES_DIR)
    .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();

  console.log(`Found ${files.length} daily price files.`);

  for (const file of files) {
    const date = file.replace('.json', '');
    const daily = JSON.parse(
      fs.readFileSync(path.join(PRICES_DIR, file), 'utf-8'),
    ) as DailySnapshot;

    for (const [cardId, entry] of Object.entries(daily.prices)) {
      const trend = entry.cardmarket?.prices?.trendPrice;
      if (!trend || trend <= 0) continue;

      const url = entry.cardmarket?.url ?? '';

      if (!history[cardId]) {
        history[cardId] = { url, d: [], p: [] };
      }

      // Skip if this date already recorded (idempotent)
      if (history[cardId].d.includes(date)) continue;

      history[cardId].d.push(date);
      history[cardId].p.push(trend);
      history[cardId].url = url; // keep URL updated
    }
  }

  // Sort each card's history oldest → newest
  for (const entry of Object.values(history)) {
    const pairs = entry.d.map((d, i) => [d, entry.p[i]!] as [string, number]);
    pairs.sort((a, b) => a[0].localeCompare(b[0]));
    entry.d = pairs.map(p => p[0]);
    entry.p = pairs.map(p => p[1]);
  }

  const cardCount  = Object.keys(history).length;
  const pointCount = Object.values(history).reduce((s, e) => s + e.d.length, 0);

  fs.writeFileSync(HIST_PATH, JSON.stringify({ updatedAt: new Date().toISOString(), history }, null, 2));

  console.log(`Done! ${files.length} files → ${cardCount} cards, ${pointCount} data points`);
  console.log(`Written: ${HIST_PATH}`);
}

main().catch(err => { console.error(err); process.exit(1); });
