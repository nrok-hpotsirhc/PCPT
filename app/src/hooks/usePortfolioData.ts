import { useState, useEffect, useCallback, useRef } from 'react';
import type { Card, UserCard, PriceSnapshot, PortfolioRow, PriceHistoryFile } from '@/lib/types';
import {
  loadUserCards,
  loadLatestPrices,
  loadPriceHistory,
} from '@/lib/data-loader';
import { loadUserCardsLocal, saveUserCardsLocal, isFirstLaunch, seedDemoPortfolio } from '@/lib/card-store';
import { fetchCardsByIds, evictFromCache } from '@/lib/pokemon-api';
import { buildPortfolioRows } from '@/lib/price-utils';

interface PortfolioData {
  rows: PortfolioRow[];
  cards: Card[];
  userCards: UserCard[];
  setUserCards: (cards: UserCard[]) => void;
  latestPrices: PriceSnapshot | null;
  priceHistory: PriceHistoryFile | null;
  loading: boolean;
  isSyncing: boolean;
  error: string | null;
  lastSynced: Date | null;
}

export function usePortfolioData(): PortfolioData {
  const [cards, setCards] = useState<Card[]>([]);
  const [userCards, setUserCardsState] = useState<UserCard[]>([]);
  const [latestPrices, setLatestPrices] = useState<PriceSnapshot | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  // Keep refs so callbacks always see latest values
  const cardsRef = useRef<Card[]>([]);
  cardsRef.current = cards;
  const userCardsRef = useRef<UserCard[]>([]);
  userCardsRef.current = userCards;

  useEffect(() => {
    async function load() {
      try {
        const [latestData, historyData] = await Promise.all([
          loadLatestPrices(),
          loadPriceHistory(),
        ]);

        // Always prefer localStorage; seed demo on first launch
        const localCards = loadUserCardsLocal();
        let resolvedUserCards: UserCard[];
        if (localCards !== null) {
          resolvedUserCards = localCards;
        } else if (isFirstLaunch()) {
          resolvedUserCards = seedDemoPortfolio();
        } else {
          resolvedUserCards = await loadUserCards();
        }
        setUserCardsState(resolvedUserCards);
        setLatestPrices(latestData);
        setPriceHistory(historyData);

        const uniqueCardIds = [...new Set(resolvedUserCards.map((uc) => uc.cardId))];
        if (uniqueCardIds.length > 0) {
          const cardsData = await fetchCardsByIds(uniqueCardIds);
          setCards(cardsData);
        }
        setLastSynced(new Date());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLastSynced(prev => prev ?? new Date());
        setLoading(false);
      }
    }

    void load();
  }, []);

  // ── Periodic price refresh ──────────────────────────────────────────────────
  const refreshPrices = useCallback(async () => {
    const ids = [...new Set(userCardsRef.current.map((uc) => uc.cardId))];
    if (ids.length === 0) return;
    setIsSyncing(true);
    evictFromCache(ids);
    try {
      const fresh = await fetchCardsByIds(ids);
      setCards(fresh);
      setLastSynced(new Date());
    } catch { /* silently ignore – stale data stays */ } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    // Refresh every 5 minutes
    const interval = setInterval(() => { void refreshPrices(); }, 5 * 60 * 1000);
    // Refresh when tab / PWA becomes visible again
    const onVisible = () => { if (document.visibilityState === 'visible') void refreshPrices(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshPrices]);

  /**
   * Public setter — persists to localStorage and fetches API metadata
   * for any card IDs not yet loaded into the cards state.
   */
  const setUserCards = useCallback((newUserCards: UserCard[]) => {
    setUserCardsState(newUserCards);
    // Persist on-device (addUserCard/updateUserCard already call this,
    // but calling again here is safe and ensures the hook always saves)
    saveUserCardsLocal(newUserCards);

    // Fetch metadata for newly added card IDs not yet in cards state
    const existingIds = new Set(cardsRef.current.map((c) => c.id));
    const missingIds = [...new Set(newUserCards.map((uc) => uc.cardId))].filter(
      (id) => !existingIds.has(id),
    );
    if (missingIds.length > 0) {
      fetchCardsByIds(missingIds)
        .then((fetched) => setCards((prev) => [...prev, ...fetched]))
        .catch(() => {/* ignore – card will just show without price data */});
    }
  }, []);

  const rows = buildPortfolioRows(userCards, cards, latestPrices);

  return {
    rows,
    cards,
    userCards,
    setUserCards,
    latestPrices,
    priceHistory,
    loading,
    isSyncing,
    error,
    lastSynced,
  };
}
