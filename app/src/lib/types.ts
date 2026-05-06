// ── Card Stammdaten (von pokemontcg.io) ──

export interface CardSet {
  id: string;
  name: string;
  series: string;
  releaseDate: string;
  ptcgoCode?: string;
  images: {
    symbol: string;
    logo: string;
  };
}

/** Format set code + number, e.g. "PAL 032" or "BS 4" */
export function formatSetNumber(set: CardSet, number: string): string {
  const code = set.ptcgoCode ?? set.id.toUpperCase();
  return `${code} ${number}`;
}

export interface CardPrices {
  low?: number;
  mid?: number;
  high?: number;
  market?: number;
}

export interface CardmarketPrices {
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

export interface Card {
  id: string;
  name: string;
  supertype: string;
  subtypes?: string[];
  hp?: string;
  types?: string[];
  set: CardSet;
  number: string;
  rarity?: string;
  artist?: string;
  images: {
    small: string;
    large: string;
  };
  tcgplayer?: {
    url: string;
    prices: {
      holofoil?: CardPrices;
      reverseHolofoil?: CardPrices;
      normal?: CardPrices;
      '1stEditionHolofoil'?: CardPrices;
      '1stEditionNormal'?: CardPrices;
    };
  };
  cardmarket?: {
    url: string;
    prices: CardmarketPrices;
  };
}

// ── Zustand & Grading ──

export type Condition = 'NM' | 'LP' | 'MP' | 'HP' | 'DMG';
export type GradingService = 'PSA' | 'BGS' | 'CGC';
export type CardVariant = 'holofoil' | 'reverseHolofoil' | 'normal' | '1stEditionHolofoil' | '1stEditionNormal';

// ── Nutzer-Sammlung ──

export interface UserCard {
  id: string;
  cardId: string;
  owner: string;
  condition: Condition;
  variant: CardVariant;
  grade?: {
    service: GradingService;
    score: number;
  };
  quantity: number;
  purchasePrice?: number;
  purchaseCurrency?: string;
  purchaseDate?: string;
  notes?: string;
  addedAt: string;
}

// ── Preis-Snapshots ──

export interface PriceSourceData {
  url: string;
  currency: string;
  prices: {
    holofoil?: CardPrices;
    reverseHolofoil?: CardPrices;
    normal?: CardPrices;
    '1stEditionHolofoil'?: CardPrices;
    '1stEditionNormal'?: CardPrices;
  };
}

export interface PriceSnapshot {
  syncedAt: string;
  prices: Record<string, {
    tcgplayer?: PriceSourceData;
    cardmarket?: {
      url: string;
      currency: string;
      prices: CardmarketPrices;
    };
  }>;
}

// ── Berechnete Tabellenzeile ──

export interface PortfolioRow {
  userCard: UserCard;
  card: Card;
  currentPrice: number | null;   // trendPrice (or reverseHoloTrend)
  lowPrice: number | null;       // "From" price
  avg1: number | null;           // 1-day average
  avg7: number | null;           // 7-day average
  avg30: number | null;          // 30-day average
  currency: string;
  sourceUrl: string | null;
}

/** Get the Cardmarket trend price from a Card (for display in dropdowns etc.) */
export function getCardmarketPrice(card: Card, variant: CardVariant = 'normal'): number | null {
  const cm = card.cardmarket?.prices;
  if (!cm) return null;
  if (variant === 'reverseHolofoil') {
    return cm.reverseHoloTrend ?? cm.reverseHoloSell ?? null;
  }
  return cm.trendPrice ?? cm.averageSellPrice ?? null;
}

// ── Preisverlauf (kompaktes Format) ──

export interface PriceHistoryEntry {
  url: string;
  d: string[];    // ISO-Daten, älteste zuerst
  p: number[];    // trendPrice (EUR) pro Datum
}

export interface PriceHistoryFile {
  updatedAt: string;
  history: Record<string, PriceHistoryEntry>;
}
