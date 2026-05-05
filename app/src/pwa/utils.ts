// Data utilities and type adapters for the PWA design

import type { PortfolioRow, Card, UserCard } from '@/lib/types';

// ── PWA Row (adapted from PortfolioRow for the new design) ────────────────────

export interface PwaCardInfo {
  id: string;
  name: string;
  set: string;
  setCode: string;
  number: string;
  img: string;
  type: string;
  rarity: string;
}

export interface PwaPriceInfo {
  trend: number;
  change24h: number;
  low: number;
  avg7: number;
  avg30: number;
}

export interface PwaRow {
  uc: UserCard;
  card: PwaCardInfo;
  price: PwaPriceInfo;
  value: number;
  cost: number;
  pnl: number;
  pnlPct: number;
  history: number[];
}

/** Generates a smooth 90-point price history (≈3 months) from avg30/avg7/current */
function generateHistory(current: number, avg7: number | null, avg30: number | null): number[] {
  const c   = current > 0 ? current : 0.01;
  const a7  = (avg7  ?? c) > 0 ? (avg7  ?? c) : c;
  const a30 = (avg30 ?? c) > 0 ? (avg30 ?? c) : c;
  // Synthetic 90-day history anchored at three known points:
  //   index  0 = 90 days ago  (~6% above avg30, extrapolated)
  //   index 60 = 30 days ago  (= avg30)
  //   index 83 = 7 days ago   (= avg7)
  //   index 89 = today        (= current)
  const N = 90;
  return Array.from({ length: N }, (_, i) => {
    let base: number;
    if (i <= 60) {
      const t = i / 60;
      base = a30 * (1 + 0.06 * (1 - t)); // 6% higher 90 days ago → avg30
    } else if (i <= 83) {
      const t = (i - 60) / 23;
      base = a30 + (a7 - a30) * t;
    } else {
      const t = (i - 83) / 6;
      base = a7 + (c - a7) * t;
    }
    // Deterministic noise for a realistic zigzag (no random so re-render is stable)
    const noise = base * 0.018 * (Math.sin(i * 2.3 + 1.2) * 0.7 + Math.cos(i * 0.8 + 0.4) * 0.3);
    return Math.max(0, base + noise);
  });
}

/** Convert a PCPT PortfolioRow into the PwaRow format */
export function toPwaRow(row: PortfolioRow): PwaRow {
  const { userCard: uc, card, currentPrice, lowPrice, avg1, avg7, avg30 } = row;
  const trend     = currentPrice ?? 0;
  const change24h = trend - (avg1 ?? trend);
  const price: PwaPriceInfo = {
    trend,
    change24h,
    low:  lowPrice ?? trend,
    avg7: avg7 ?? trend,
    avg30: avg30 ?? trend,
  };

  const value = trend * uc.quantity;
  const cost  = (uc.purchasePrice ?? 0) * uc.quantity;
  const pnl   = value - cost;
  const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;

  const cardInfo: PwaCardInfo = {
    id:      card.id,
    name:    card.name,
    set:     card.set.name,
    setCode: card.set.ptcgoCode ?? card.set.id.toUpperCase(),
    number:  card.number,
    img:     card.images.small,
    type:    card.types?.[0] ?? card.supertype ?? 'Trainer',
    rarity:  card.rarity ?? '',
  };

  return {
    uc,
    card: cardInfo,
    price,
    value,
    cost,
    pnl,
    pnlPct,
    history: generateHistory(trend, avg7, avg30),
  };
}

export function toPwaRows(rows: PortfolioRow[]): PwaRow[] {
  return rows.map(toPwaRow);
}

// ── Currency formatting ───────────────────────────────────────────────────────

const FX: Record<string, number> = { EUR: 1, USD: 1.08 };
const SYM: Record<string, string> = { EUR: '€', USD: '$' };

export function fmtMoney(eur: number, currency = 'EUR'): string {
  const rate = FX[currency] ?? 1;
  const sym  = SYM[currency] ?? currency;
  const v    = eur * rate;
  const abs  = Math.abs(v);
  let s: string;
  if (abs >= 100) s = v.toLocaleString('de-DE', { maximumFractionDigits: 0 });
  else s = v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sym}${s}`;
}

export function fmtMoneySigned(eur: number, currency = 'EUR'): string {
  const sign = eur >= 0 ? '+' : '−';
  return `${sign}${fmtMoney(Math.abs(eur), currency)}`;
}

export function fmtPct(p: number): string {
  const sign = p >= 0 ? '+' : '−';
  return `${sign}${Math.abs(p).toFixed(1)}%`;
}

// ── Card type → pill tone mapping ─────────────────────────────────────────────

export function typeToPillTone(type: string): string {
  const map: Record<string, string> = {
    fire: 'fire', water: 'water', grass: 'grass',
    lightning: 'lightning', psychic: 'psychic',
    darkness: 'darkness', colorless: 'colorless',
    trainer: 'trainer',
  };
  return map[type.toLowerCase()] ?? 'default';
}

// ── Card search helper ────────────────────────────────────────────────────────

export function searchCards(cards: Card[], query: string, limit = 6): Card[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const m = /^([a-z]+)\s+(\d+)$/i.exec(q);
  return cards.filter(c => {
    if (m) {
      const code = (c.set.ptcgoCode ?? c.set.id).toLowerCase();
      return code === (m[1] ?? '').toLowerCase() && c.number === (m[2] ?? '');
    }
    return c.name.toLowerCase().includes(q) || c.set.name.toLowerCase().includes(q);
  }).slice(0, limit);
}

export function getCardPrice(card: Card): number | null {
  return card.cardmarket?.prices?.trendPrice ?? card.cardmarket?.prices?.averageSellPrice ?? null;
}
