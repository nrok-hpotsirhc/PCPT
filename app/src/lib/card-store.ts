import type { UserCard, Card } from './types';

const STORAGE_KEY      = 'pokemon-tracker-user-cards';
const LAUNCHED_KEY     = 'pwa-has-launched';

export function loadUserCardsLocal(): UserCard[] | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserCard[];
  } catch {
    return null;
  }
}

/** Returns true if this is the very first launch (no localStorage data). */
export function isFirstLaunch(): boolean {
  return !localStorage.getItem(LAUNCHED_KEY);
}

/** Mark as launched so we don't seed again. */
export function markLaunched(): void {
  localStorage.setItem(LAUNCHED_KEY, '1');
}

/** Seed a demo portfolio using well-known card IDs from the pokemontcg.io API. */
export function seedDemoPortfolio(): UserCard[] {
  // These are real card IDs on pokemontcg.io â€” they will be fetched live
  const demoCards: Array<{ cardId: string; purchasePrice: number; condition: UserCard['condition'] }> = [
    { cardId: 'base1-4',   purchasePrice: 420,  condition: 'LP' },  // Charizard Base Set
    { cardId: 'base1-58',  purchasePrice: 8,    condition: 'NM' },  // Pikachu Base Set
    { cardId: 'swsh4-25',  purchasePrice: 12,   condition: 'NM' },  // Pikachu SWSH
    { cardId: 'xy7-54',    purchasePrice: 18,   condition: 'NM' },  // Lugia BREAKthrough
    { cardId: 'base2-3',   purchasePrice: 95,   condition: 'LP' },  // Blastoise Jungle
  ];

  const cards: UserCard[] = demoCards.map((d, i) => ({
    id:            `demo-${i}-${Date.now()}`,
    cardId:        d.cardId,
    owner:         'Demo',
    condition:     d.condition,
    variant:       'holofoil',
    quantity:      1,
    purchasePrice: d.purchasePrice,
    purchaseDate:  '2024-01-01',
    addedAt:       new Date().toISOString(),
  }));

  saveUserCardsLocal(cards);
  markLaunched();
  return cards;
}

export function saveUserCardsLocal(cards: UserCard[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

export function addUserCard(cards: UserCard[], card: UserCard): UserCard[] {
  const updated = [...cards, card];
  saveUserCardsLocal(updated);
  return updated;
}

export function updateUserCard(cards: UserCard[], updated: UserCard): UserCard[] {
  const result = cards.map((c) => (c.id === updated.id ? updated : c));
  saveUserCardsLocal(result);
  return result;
}

export function deleteUserCard(cards: UserCard[], id: string): UserCard[] {
  const result = cards.filter((c) => c.id !== id);
  saveUserCardsLocal(result);
  return result;
}

export function generateId(): string {
  return `uc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function getAvailableVariants(card: Card): string[] {
  if (!card.tcgplayer?.prices) return ['normal'];
  return Object.keys(card.tcgplayer.prices);
}
