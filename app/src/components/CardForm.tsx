import { useState, useEffect, useRef, useCallback } from 'react';
import type { Card, Condition, CardVariant } from '@/lib/types';
import { formatSetNumber, getCardmarketPrice } from '@/lib/types';
import { searchCardsApi, fetchCardById, type SearchResult } from '@/lib/pokemon-api';
import { generateId, getAvailableVariants } from '@/lib/card-store';
import { useI18n } from '@/lib/i18n';
import type { UserCard } from '@/lib/types';
import { Loader2, Search, X } from 'lucide-react';

interface CardFormProps {
  cards: Card[];
  onSubmit: (card: UserCard) => void;
  onCancel: () => void;
  editCard?: UserCard | null;
}

const MAX_VISIBLE = 5;

export function CardForm({ cards, onSubmit, onCancel, editCard }: CardFormProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Card[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [searching, setSearching] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showAllModal, setShowAllModal] = useState(false);
  const [allResults, setAllResults] = useState<Card[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [condition, setCondition] = useState<Condition>('NM');
  const [variant, setVariant] = useState<CardVariant>('holofoil');
  const [quantity, setQuantity] = useState(1);
  const [owner, setOwner] = useState('default');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseCurrency, setPurchaseCurrency] = useState('EUR');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [gradingService, setGradingService] = useState('');
  const [gradingScore, setGradingScore] = useState('');
  const [notes, setNotes] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const { t, tr } = useI18n();

  const todayStr = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (editCard) {
      // For edit mode: look up card in passed cards array or fetch from API
      const card = cards.find((c) => c.id === editCard.cardId);
      if (card) {
        setSelectedCard(card);
        setQuery(card.name);
      } else {
        void fetchCardById(editCard.cardId).then((c) => {
          if (c) {
            setSelectedCard(c);
            setQuery(c.name);
          }
        });
      }
      setCondition(editCard.condition);
      setVariant(editCard.variant);
      setQuantity(editCard.quantity);
      setOwner(editCard.owner);
      setPurchasePrice(editCard.purchasePrice?.toString() ?? '');
      setPurchaseCurrency(editCard.purchaseCurrency ?? 'EUR');
      setPurchaseDate(editCard.purchaseDate ?? todayStr);
      setGradingService(editCard.grade?.service ?? '');
      setGradingScore(editCard.grade?.score?.toString() ?? '');
      setNotes(editCard.notes ?? '');
    }
  }, [editCard, cards]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.length < 2) {
      setResults([]);
      setTotalCount(0);
      setShowDropdown(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(() => {
      void searchCardsApi(value, MAX_VISIBLE + 1).then((result: SearchResult) => {
        setResults(result.cards.slice(0, MAX_VISIBLE));
        setTotalCount(result.totalCount);
        setShowDropdown(true);
        setSearching(false);
      }).catch(() => {
        setSearching(false);
      });
    }, 350);
  }, []);

  function handleSelectCard(card: Card) {
    setSelectedCard(card);
    setQuery(`${card.name} (${formatSetNumber(card.set, card.number)})`);
    setShowDropdown(false);
    setShowAllModal(false);
    const variants = getAvailableVariants(card);
    if (variants[0]) setVariant(variants[0] as CardVariant);
    // Set default purchase date to today if not editing
    if (!editCard) setPurchaseDate(todayStr);
  }

  async function handleShowAll() {
    setShowDropdown(false);
    setShowAllModal(true);
    setLoadingAll(true);
    try {
      const limit = Math.min(totalCount, 50);
      const result = await searchCardsApi(query, limit);
      setAllResults(result.cards);
    } catch {
      setAllResults(results);
    } finally {
      setLoadingAll(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCard) return;

    const userCard: UserCard = {
      id: editCard?.id ?? generateId(),
      cardId: selectedCard.id,
      owner,
      condition,
      variant,
      quantity: Math.max(1, quantity),
      purchasePrice: purchasePrice ? parseFloat(purchasePrice) : undefined,
      purchaseCurrency: purchaseCurrency || undefined,
      purchaseDate: purchaseDate || undefined,
      notes: notes || undefined,
      grade: gradingService && gradingScore
        ? { service: gradingService as 'PSA' | 'BGS' | 'CGC', score: parseFloat(gradingScore) }
        : undefined,
      addedAt: editCard?.addedAt ?? new Date().toISOString(),
    };

    onSubmit(userCard);
  }

  const availableVariants = selectedCard ? getAvailableVariants(selectedCard) : ['normal'];

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Card Search */}
      <div className="relative" ref={dropdownRef}>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('form.card')} *</label>
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          placeholder={t('form.searchPlaceholder')}
          className="w-full pl-9 pr-3 py-2.5 border border-slate-200 dark:border-slate-600 dark:bg-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        <Search className="absolute left-3 top-9 w-4 h-4 text-slate-400 pointer-events-none" />
        <p className="text-xs text-slate-400 mt-1">{t('form.searchHint')}</p>
        {searching && (
          <div className="absolute right-3 top-9">
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
          </div>
        )}
        {showDropdown && results.length > 0 && (
          <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-80 overflow-y-auto">
            {results.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => handleSelectCard(card)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-950 text-left transition-colors"
              >
                <img src={card.images.small} alt="" className="w-8 h-11 object-contain rounded" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{card.name}</div>
                  <div className="text-xs text-slate-500">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{formatSetNumber(card.set, card.number)}</span> · {card.set.name} · {tr('rarity', card.rarity ?? '')}
                  </div>
                </div>
                {(() => {
                  const price = getCardmarketPrice(card);
                  return price != null ? (
                    <span className="text-sm font-semibold text-green-700 dark:text-green-400 whitespace-nowrap">
                      {price.toFixed(2)} €
                    </span>
                  ) : null;
                })()}
              </button>
            ))}
            {totalCount > MAX_VISIBLE && (
              <button
                type="button"
                onClick={handleShowAll}
                className="w-full px-3 py-2 text-center text-xs text-blue-600 dark:text-blue-400 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 hover:bg-blue-50 dark:hover:bg-blue-950 cursor-pointer font-medium"
              >
                +{totalCount - MAX_VISIBLE} {t('form.moreResults')}
              </button>
            )}
          </div>
        )}
        {showDropdown && !searching && results.length === 0 && query.length >= 2 && (
          <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-sm text-gray-500">
            {t('form.noResults')}
          </div>
        )}
        {selectedCard && (
          <div className="mt-2 flex items-center gap-3 p-2 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <img src={selectedCard.images.small} alt="" className="w-12 h-16 object-contain" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{selectedCard.name}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                <span className="font-semibold">{formatSetNumber(selectedCard.set, selectedCard.number)}</span> · {selectedCard.set.name} · {tr('rarity', selectedCard.rarity ?? '')}
              </div>
            </div>
            {(() => {
              const price = getCardmarketPrice(selectedCard);
              return price != null ? (
                <span className="text-sm font-bold text-green-700 dark:text-green-400 whitespace-nowrap">
                  {price.toFixed(2)} €
                </span>
              ) : null;
            })()}
          </div>
        )}
      </div>

      {/* Row 1: Condition + Variant */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('form.condition')} *</label>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value as Condition)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm"
          >
            <option value="NM">{t('condition.NM')}</option>
            <option value="LP">{t('condition.LP')}</option>
            <option value="MP">{t('condition.MP')}</option>
            <option value="HP">{t('condition.HP')}</option>
            <option value="DMG">{t('condition.DMG')}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('form.variant')}</label>
          <select
            value={variant}
            onChange={(e) => setVariant(e.target.value as CardVariant)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm"
          >
            {availableVariants.map((v) => (
              <option key={v} value={v}>{tr('variant', v)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2: Quantity + Owner */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('form.quantity')}</label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('form.owner')}</label>
          <input
            type="text"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm"
          />
        </div>
      </div>

      {/* Row 3: Purchase */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('form.purchasePrice')}</label>
          <input
            type="number"
            step="0.01"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('form.currency')}</label>
          <select
            value={purchaseCurrency}
            onChange={(e) => setPurchaseCurrency(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm"
          >
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
            <option value="JPY">JPY</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('form.purchaseDate')}</label>
          <input
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm"
          />
        </div>
      </div>

      {/* Row 4: Grading */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('form.gradingService')}</label>
          <select
            value={gradingService}
            onChange={(e) => setGradingService(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm"
          >
            <option value="">{t('form.none')}</option>
            <option value="PSA">PSA</option>
            <option value="BGS">BGS / Beckett</option>
            <option value="CGC">CGC</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('form.grade')}</label>
          <input
            type="number"
            step="0.5"
            min={1}
            max={10}
            value={gradingScore}
            onChange={(e) => setGradingScore(e.target.value)}
            placeholder={t('form.gradePlaceholder')}
            disabled={!gradingService}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm disabled:bg-gray-100 dark:disabled:bg-gray-900"
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('form.notes')}</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm resize-none"
          placeholder={t('form.notesPlaceholder')}
        />
      </div>

      {/* Buttons */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={!selectedCard}
          className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed transition-colors"
        >
          {editCard ? t('form.update') : t('form.add')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          {t('form.cancel')}
        </button>
      </div>
    </form>

    {/* All Results Modal */}
    {showAllModal && (
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAllModal(false)}>
        <div className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">{t('form.allResults')}</h3>
            <button type="button" onClick={() => setShowAllModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-y-auto flex-1 p-2">
            {loadingAll ? (
              <div className="flex items-center justify-center py-12 gap-2">
                <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                <span className="text-sm text-slate-500">{t('form.loadingAll')}</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 divide-y divide-slate-100 dark:divide-slate-800">
                {allResults.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => handleSelectCard(card)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-950 text-left transition-colors"
                  >
                    <img src={card.images.small} alt="" className="w-10 h-14 object-contain rounded" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">{card.name}</div>
                      <div className="text-xs text-slate-500">
                        <span className="font-medium text-slate-700 dark:text-slate-300">{formatSetNumber(card.set, card.number)}</span> · {card.set.name} · {tr('rarity', card.rarity ?? '')}
                      </div>
                    </div>
                    {(() => {
                      const price = getCardmarketPrice(card);
                      return price != null ? (
                        <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                          {price.toFixed(2)} €
                        </span>
                      ) : null;
                    })()}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
}
