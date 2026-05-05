import type { Card } from './types';
import { fuzzyTranslateGermanName } from './german-pokemon-names';

const API_BASE = 'https://api.pokemontcg.io/v2';
const CARD_CACHE_KEY = 'pokemon-tracker-card-cache';

// ── In-memory + localStorage cache ──

const memoryCache = new Map<string, Card>();

function loadCacheFromStorage(): void {
  if (memoryCache.size > 0) return;
  try {
    const raw = localStorage.getItem(CARD_CACHE_KEY);
    if (raw) {
      const cards = JSON.parse(raw) as Card[];
      for (const c of cards) memoryCache.set(c.id, c);
    }
  } catch { /* ignore corrupt cache */ }
}

function persistCache(): void {
  try {
    const cards = Array.from(memoryCache.values());
    localStorage.setItem(CARD_CACHE_KEY, JSON.stringify(cards));
  } catch { /* storage full – ignore */ }
}

function cacheCards(cards: Card[]): void {
  for (const c of cards) memoryCache.set(c.id, c);
  persistCache();
}

/** Remove specific IDs from cache so next fetch retrieves fresh data. */
export function evictFromCache(ids: string[]): void {
  for (const id of ids) memoryCache.delete(id);
  persistCache();
}

export function getCachedCard(id: string): Card | undefined {
  loadCacheFromStorage();
  return memoryCache.get(id);
}

// ── Set code lookup cache (ptcgoCode → set.id) ──

const setCodeCache = new Map<string, string>();

async function resolveSetCode(code: string): Promise<string | null> {
  const upper = code.toUpperCase();
  if (setCodeCache.has(upper)) return setCodeCache.get(upper)!;

  try {
    const res = await fetch(`${API_BASE}/sets?q=ptcgoCode:${upper}&select=id,ptcgoCode`);
    if (!res.ok) return null;
    const json = (await res.json()) as { data: { id: string; ptcgoCode: string }[] };
    for (const s of json.data) {
      setCodeCache.set(s.ptcgoCode.toUpperCase(), s.id);
    }
    return setCodeCache.get(upper) ?? null;
  } catch {
    return null;
  }
}

// ── API search ──

export interface SearchResult {
  cards: Card[];
  totalCount: number;
}

/** Pattern: "PAL 072", "SIT 33", "BS 4" etc. */
const SET_CODE_PATTERN = /^([A-Za-z]{2,6})\s+(\d{1,4})$/;

export async function searchCardsApi(
  query: string,
  pageSize = 10,
): Promise<SearchResult> {
  if (!query.trim()) return { cards: [], totalCount: 0 };

  // Translate German Pokémon name to English (with fuzzy prefix matching for OCR noise)
  const trimmed = fuzzyTranslateGermanName(query.trim()) ?? query.trim();
  let q: string;

  // Check if query matches "SET_CODE NUMBER" pattern (e.g. "PAL 072")
  const setMatch = SET_CODE_PATTERN.exec(trimmed);
  if (setMatch) {
    const code = setMatch[1]!;
    const num = setMatch[2]!;
    const setId = await resolveSetCode(code);
    if (setId) {
      // Exact search by set + number
      q = `set.id:${setId} number:${num.replace(/^0+/, '') || '0'}`;
    } else {
      // Code not found, fall back to name search
      const escaped = trimmed.replace(/"/g, '');
      q = `name:"${escaped}*"`;
    }
  } else {
    // Normal search: name or number
    const escaped = trimmed.replace(/"/g, '');
    q = `name:"${escaped}*" OR number:"${escaped}"`;
  }

  const SELECT = 'id,name,supertype,subtypes,hp,types,set,number,rarity,artist,images,tcgplayer,cardmarket';
  const url = `${API_BASE}/cards?q=${encodeURIComponent(q)}&pageSize=${pageSize}&select=${SELECT}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);

  const json = (await res.json()) as { data: Card[]; totalCount: number };
  cacheCards(json.data);

  // ── Fallback 1: strip suffixes (EX, GX, V, etc.) and retry with first word only ──
  if (json.data.length === 0 && !setMatch) {
    const firstWord = trimmed.split(/\s+/)[0]!;
    if (firstWord.length >= 3 && firstWord !== trimmed) {
      const escaped2 = firstWord.replace(/"/g, '');
      const res2 = await fetch(`${API_BASE}/cards?q=${encodeURIComponent(`name:"${escaped2}*"`)}&pageSize=${pageSize}&select=${SELECT}`);
      if (res2.ok) {
        const json2 = (await res2.json()) as { data: Card[]; totalCount: number };
        if (json2.data.length > 0) {
          cacheCards(json2.data);
          return { cards: json2.data, totalCount: json2.totalCount };
        }
      }
    }

    // ── Fallback 2: unquoted / broader wildcard (catches OCR partial reads) ──
    if (trimmed.length >= 3) {
      const base = trimmed.split(/\s+/)[0]!.replace(/"/g, '');
      const res3 = await fetch(`${API_BASE}/cards?q=${encodeURIComponent(`name:${base}*`)}&pageSize=${pageSize}&select=${SELECT}`);
      if (res3.ok) {
        const json3 = (await res3.json()) as { data: Card[]; totalCount: number };
        if (json3.data.length > 0) {
          cacheCards(json3.data);
          return { cards: json3.data, totalCount: json3.totalCount };
        }
      }
    }
  }

  return {
    cards: json.data,
    totalCount: json.totalCount,
  };
}

// ── Fetch single card by ID ──

export async function fetchCardById(id: string): Promise<Card | null> {
  const cached = getCachedCard(id);
  if (cached) return cached;

  try {
    const res = await fetch(`${API_BASE}/cards/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { data: Card };
    cacheCards([json.data]);
    return json.data;
  } catch {
    return null;
  }
}

// ── Fetch multiple cards by IDs (for portfolio loading) ──

export async function fetchCardsByIds(ids: string[]): Promise<Card[]> {
  loadCacheFromStorage();

  const missing = ids.filter((id) => !memoryCache.has(id));
  const cached = ids.map((id) => memoryCache.get(id)).filter((c): c is Card => c != null);

  if (missing.length === 0) return cached;

  // Batch fetch missing cards (API supports OR queries)
  // Split into chunks of 20 to avoid URL length limits
  const chunks: string[][] = [];
  for (let i = 0; i < missing.length; i += 20) {
    chunks.push(missing.slice(i, i + 20));
  }

  const fetched: Card[] = [];
  for (const chunk of chunks) {
    const q = chunk.map((id) => `id:"${id}"`).join(' OR ');
    const url = `${API_BASE}/cards?q=${encodeURIComponent(q)}&pageSize=${chunk.length}&select=id,name,supertype,subtypes,hp,types,set,number,rarity,artist,images,tcgplayer,cardmarket`;

    try {
      const res = await fetch(url);
      if (res.ok) {
        const json = (await res.json()) as { data: Card[] };
        fetched.push(...json.data);
      }
    } catch { /* skip failed chunks */ }
  }

  cacheCards(fetched);

  // Return all: cached + freshly fetched
  return ids.map((id) => memoryCache.get(id)).filter((c): c is Card => c != null);
}
