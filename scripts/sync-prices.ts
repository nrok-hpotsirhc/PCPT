/**
 * Price Sync Script
 * Runs via GitHub Actions to fetch latest prices from pokemontcg.io
 * and write them to /data/prices-latest.json + /data/prices/YYYY-MM-DD.json
 */

import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.resolve(__dirname, '../data');
const API_BASE = 'https://api.pokemontcg.io/v2';
const API_KEY = process.env['POKEMON_TCG_API_KEY'] ?? '';

interface TcgPlayerPriceSet {
  low?: number;
  mid?: number;
  high?: number;
  market?: number;
}

interface TcgPlayerData {
  url?: string;
  prices?: Record<string, TcgPlayerPriceSet>;
}

interface CardmarketPriceSet {
  averageSellPrice?: number;
  lowPrice?: number;
  trendPrice?: number;
  germanProLow?: number;
  suggestedPrice?: number;
  reverseHoloSell?: number;
  reverseHoloLow?: number;
  reverseHoloTrend?: number;
  lowPriceExPlus?: number;
  avg1?: number;
  avg7?: number;
  avg30?: number;
  reverseHoloAvg1?: number;
  reverseHoloAvg7?: number;
  reverseHoloAvg30?: number;
}

interface CardmarketData {
  url?: string;
  prices?: CardmarketPriceSet;
}

interface ApiCard {
  id: string;
  tcgplayer?: TcgPlayerData;
  cardmarket?: CardmarketData;
}

interface PriceEntry {
  tcgplayer?: {
    url: string;
    currency: string;
    prices: Record<string, TcgPlayerPriceSet>;
  };
  cardmarket?: {
    url: string;
    currency: string;
    prices: CardmarketPriceSet;
  };
}

async function fetchCardPrices(cardIds: string[]): Promise<Map<string, PriceEntry>> {
  const results = new Map<string, PriceEntry>();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (API_KEY) {
    headers['X-Api-Key'] = API_KEY;
  }

  // Batch by 250 IDs per request (API limit)
  const batchSize = 250;
  for (let i = 0; i < cardIds.length; i += batchSize) {
    const batch = cardIds.slice(i, i + batchSize);
    const query = batch.map((id) => `id:"${id}"`).join(' OR ');
    const url = `${API_BASE}/cards?q=${encodeURIComponent(query)}&select=id,tcgplayer,cardmarket&pageSize=${batchSize}`;

    console.log(`Fetching batch ${Math.floor(i / batchSize) + 1}...`);
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.error(`API error: ${res.status} ${res.statusText}`);
      continue;
    }

    const data = (await res.json()) as { data: ApiCard[] };
    for (const card of data.data) {
      const entry: PriceEntry = {};

      if (card.tcgplayer?.prices) {
        entry.tcgplayer = {
          url: card.tcgplayer.url ?? '',
          currency: 'USD',
          prices: card.tcgplayer.prices,
        };
      }

      if (card.cardmarket?.prices) {
        entry.cardmarket = {
          url: card.cardmarket.url ?? '',
          currency: 'EUR',
          prices: card.cardmarket.prices,
        };
      }

      if (entry.tcgplayer || entry.cardmarket) {
        results.set(card.id, entry);
      }
    }
  }

  return results;
}

interface HistoryEntry {
  url: string;
  d: string[];
  p: number[];
}

interface PriceHistoryFile {
  updatedAt: string;
  history: Record<string, HistoryEntry>;
}

function loadPriceHistory(): PriceHistoryFile {
  const histPath = path.join(DATA_DIR, 'price-history.json');
  if (fs.existsSync(histPath)) {
    return JSON.parse(fs.readFileSync(histPath, 'utf-8')) as PriceHistoryFile;
  }
  return { updatedAt: '', history: {} };
}

async function main() {
  // Read current user-cards to know which card IDs to fetch
  const userCardsPath = path.join(DATA_DIR, 'user-cards.json');
  if (!fs.existsSync(userCardsPath)) {
    console.log('No user-cards.json found, nothing to sync.');
    return;
  }

  const userCards = JSON.parse(fs.readFileSync(userCardsPath, 'utf-8')) as { cardId: string }[];
  const cardIds = [...new Set(userCards.map((uc) => uc.cardId))];

  if (cardIds.length === 0) {
    console.log('No cards to sync.');
    return;
  }

  console.log(`Syncing prices for ${cardIds.length} cards...`);
  const prices = await fetchCardPrices(cardIds);

  const snapshot = {
    syncedAt: new Date().toISOString(),
    prices: Object.fromEntries(prices),
  };

  // Write prices-latest.json (still used by the app for full price detail)
  const latestPath = path.join(DATA_DIR, 'prices-latest.json');
  fs.writeFileSync(latestPath, JSON.stringify(snapshot, null, 2));
  console.log(`Written ${latestPath}`);

  // Append today's trendPrice to price-history.json (single file, no daily archives)
  const today = new Date().toISOString().slice(0, 10);
  const phFile = loadPriceHistory();

  for (const [cardId, entry] of prices) {
    const trend = entry.cardmarket?.prices?.trendPrice;
    if (!trend || trend <= 0) continue;

    const url = entry.cardmarket?.url ?? '';

    if (!phFile.history[cardId]) {
      phFile.history[cardId] = { url, d: [], p: [] };
    }

    const hist = phFile.history[cardId]!;
    const existing = hist.d.indexOf(today);
    if (existing >= 0) {
      // Update today's point (re-run same day)
      hist.p[existing] = trend;
    } else {
      hist.d.push(today);
      hist.p.push(trend);
    }
    hist.url = url;
  }

  phFile.updatedAt = new Date().toISOString();
  const histPath = path.join(DATA_DIR, 'price-history.json');
  fs.writeFileSync(histPath, JSON.stringify(phFile, null, 2));
  console.log(`Updated ${histPath} (${Object.keys(phFile.history).length} cards)`);

  console.log(`Done! Synced ${prices.size}/${cardIds.length} cards.`);
}

main().catch((err) => {
  console.error('Price sync failed:', err);
  process.exit(1);
});
