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

