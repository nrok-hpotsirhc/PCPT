import { useState, useEffect } from 'react';
import type { Card, UserCard, PriceSnapshot, PortfolioRow } from '@/lib/types';
import {
  loadUserCards,
  loadLatestPrices,
} from '@/lib/data-loader';
import { loadUserCardsLocal, isFirstLaunch, seedDemoPortfolio } from '@/lib/card-store';
import { fetchCardsByIds } from '@/lib/pokemon-api';
import { buildPortfolioRows } from '@/lib/price-utils';

interface PortfolioData {
  rows: PortfolioRow[];
  cards: Card[];
  userCards: UserCard[];
  setUserCards: (cards: UserCard[]) => void;
  latestPrices: PriceSnapshot | null;
  loading: boolean;
  error: string | null;
  lastSynced: string | null;
}

export function usePortfolioData(): PortfolioData {
  const [cards, setCards] = useState<Card[]>([]);
  const [userCards, setUserCards] = useState<UserCard[]>([]);
  const [latestPrices, setLatestPrices] = useState<PriceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [userCardsData, latestData] = await Promise.all([
          loadUserCards(),
          loadLatestPrices(),
        ]);

        // Prefer localStorage user cards; seed demo on first launch
        const localCards = loadUserCardsLocal();
        let resolvedUserCards: typeof userCardsData;
        if (localCards !== null) {
          resolvedUserCards = localCards;
        } else if (isFirstLaunch()) {
          resolvedUserCards = seedDemoPortfolio();
        } else {
          resolvedUserCards = userCardsData;
        }
        setUserCards(resolvedUserCards);
        setLatestPrices(latestData);

        // Fetch card data from pokemontcg.io API based on user's card IDs
        const uniqueCardIds = [...new Set(resolvedUserCards.map((uc) => uc.cardId))];
        if (uniqueCardIds.length > 0) {
          const cardsData = await fetchCardsByIds(uniqueCardIds);
          setCards(cardsData);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const rows = buildPortfolioRows(userCards, cards, latestPrices);

  return {
    rows,
    cards,
    userCards,
    setUserCards,
    latestPrices,
    loading,
    error,
    lastSynced: latestPrices?.syncedAt ?? null,
  };
}
