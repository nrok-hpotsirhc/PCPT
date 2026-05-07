import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Card, UserCard, PriceSnapshot, PortfolioRow, PriceHistoryFile } from '@/lib/types';
import {
  loadUserCards,
  loadLatestPrices,
  loadPriceHistory,
} from '@/lib/data-loader';
import { loadUserCardsLocal, saveUserCardsLocal, isFirstLaunch, seedDemoPortfolio } from '@/lib/card-store';
import { fetchCardsByIds } from '@/lib/pokemon-api';
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
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  const cardsRef = useRef<Card[]>([]);
  cardsRef.current = cards;

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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLastSynced(new Date());
        setLoading(false);
      }
    }

    void load();
  }, []);

  /**
   * Public setter — persists to localStorage and fetches API metadata
   * for any card IDs not yet loaded into the cards state.
   */
  const setUserCards = useCallback((newUserCards: UserCard[]) => {
    setUserCardsState(newUserCards);
    saveUserCardsLocal(newUserCards);

    const existingIds = new Set(cardsRef.current.map((c) => c.id));
    const missingIds = [...new Set(newUserCards.map((uc) => uc.cardId))].filter(
      (id) => !existingIds.has(id),
    );
    if (missingIds.length > 0) {
      fetchCardsByIds(missingIds)
        .then((fetched) => setCards((prev) => [...prev, ...fetched]))
        .catch(() => { /* card shows without metadata until next load */ });
    }
  }, []);

  const rows = useMemo(
    () => buildPortfolioRows(userCards, cards, latestPrices),
    [userCards, cards, latestPrices],
  );

  return {
    rows,
    cards,
    userCards,
    setUserCards,
    latestPrices,
    priceHistory,
    loading,
    isSyncing: false,
    error,
    lastSynced,
  };
}