import type { Card, UserCard, PriceSnapshot, PriceHistoryFile } from './types';

const BASE = import.meta.env.BASE_URL;

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

export function loadCards(): Promise<Card[]> {
  return fetchJson<Card[]>('cards.json');
}

export function loadUserCards(): Promise<UserCard[]> {
  return fetchJson<UserCard[]>('user-cards.json');
}

export function loadLatestPrices(): Promise<PriceSnapshot> {
  return fetchJson<PriceSnapshot>('prices-latest.json');
}

export function loadPriceHistory(): Promise<PriceHistoryFile> {
  return fetchJson<PriceHistoryFile>('price-history.json')
    .catch(() => ({ updatedAt: '', history: {} } as PriceHistoryFile));
}

export function loadPriceSnapshot(date: string): Promise<PriceSnapshot | null> {
  return fetchJson<PriceSnapshot>(`prices/${date}.json`).catch(() => null);
}

export function findClosestSnapshot(
  targetDate: string,
  availableDates: string[],
): string | null {
  const target = new Date(targetDate).getTime();
  let closest: string | null = null;
  let minDiff = Infinity;

  for (const d of availableDates) {
    const diff = Math.abs(new Date(d).getTime() - target);
    if (diff < minDiff) {
      minDiff = diff;
      closest = d;
    }
  }

  return closest;
}

export async function loadAvailablePriceDates(): Promise<string[]> {
  // In a static setup we hardcode known dates or use a manifest.
  // For now, try common dates relative to today.
  const today = new Date();
  const dates: string[] = [];
  // Check last 400 days at daily granularity is impractical;
  // we'll use a manifest file approach. For MVP, return known seed dates.
  const candidates = [
    formatDate(today),
    formatDate(addDays(today, -1)),
    formatDate(addDays(today, -7)),
    formatDate(addDays(today, -30)),
    formatDate(addDays(today, -365)),
  ];

  for (const date of candidates) {
    try {
      const res = await fetch(`${BASE}prices/${date}.json`, { method: 'HEAD' });
      if (res.ok) dates.push(date);
    } catch {
      // skip
    }
  }

  return dates;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}
