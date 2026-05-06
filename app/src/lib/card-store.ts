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
  type DemoEntry = {
    cardId: string;
    condition: UserCard['condition'];
    variant: UserCard['variant'];
    quantity: number;
    purchasePrice: number;
    purchaseDate: string;
    grade?: UserCard['grade'];
  };
  const demoCards: DemoEntry[] = [
    // Expensive vintage — Charizard Base Set (PSA 7)
    { cardId: 'base1-4',       condition: 'LP', variant: 'holofoil',        quantity: 1, purchasePrice: 220, purchaseDate: '2022-08-12', grade: { service: 'PSA', score: 7 } },
    // Modern chase — Charizard ex Paldea Evolved Special Illustration Rare
    { cardId: 'sv3pt5-197',    condition: 'NM', variant: 'holofoil',        quantity: 1, purchasePrice: 85,  purchaseDate: '2023-10-05' },
    // Modern mid — Gardevoir ex Special Illustration Rare
    { cardId: 'sv4-228',       condition: 'NM', variant: 'holofoil',        quantity: 1, purchasePrice: 42,  purchaseDate: '2024-01-20' },
    // SWSH alt art — Umbreon VMAX Alternate Art
    { cardId: 'swsh12pt5-160', condition: 'NM', variant: 'holofoil',        quantity: 1, purchasePrice: 55,  purchaseDate: '2023-05-18' },
    // Cheap common — Pikachu Base Set (2 copies)
    { cardId: 'base1-58',      condition: 'NM', variant: 'normal',          quantity: 2, purchasePrice: 4,   purchaseDate: '2021-06-01' },
    // Mid retro — Lugia BREAKthrough reverse holo
    { cardId: 'xy7-54',        condition: 'NM', variant: 'reverseHolofoil', quantity: 1, purchasePrice: 11,  purchaseDate: '2024-03-10' },
  ];

  const cards: UserCard[] = demoCards.map((d, i) => ({
    id:            `demo-${i}`,
    cardId:        d.cardId,
    owner:         'Trainer',
    condition:     d.condition,
    variant:       d.variant,
    quantity:      d.quantity,
    purchasePrice: d.purchasePrice,
    purchaseDate:  d.purchaseDate,
    ...(d.grade ? { grade: d.grade } : {}),
    addedAt:       new Date().toISOString(),
  }));

  // Set demo profile name so the UI shows "Trainer" on first open
  localStorage.setItem('pwa-profile-name', 'Trainer');
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
