import type { PortfolioRow } from '@/lib/types';
import { formatSetNumber } from '@/lib/types';
import { formatCurrency, formatPct } from '@/lib/price-utils';
import { useI18n } from '@/lib/i18n';
import { PriceSparkline } from './PriceSparkline';
import { X, Pencil, Trash2, ExternalLink } from 'lucide-react';

interface CardDetailProps {
  row: PortfolioRow;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function CardDetail({ row, onClose, onEdit, onDelete }: CardDetailProps) {
  const { card, userCard, currentPrice, currency, sourceUrl } = row;
  const { t, tr } = useI18n();

  const priceRows = [
    { label: t('detail.priceFrom'), price: row.lowPrice },
    { label: t('detail.priceTrend'), price: currentPrice, highlight: true },
    { label: t('detail.avg30'), price: row.avg30 },
    { label: t('detail.avg7'), price: row.avg7 },
    { label: t('detail.avg1'), price: row.avg1 },
  ];

  const sparklineData = [row.avg30, row.avg7, row.avg1, currentPrice]
    .filter((p): p is number => p != null);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start gap-4 p-5 border-b border-slate-200 dark:border-slate-700">
          <img
            src={card.images.large}
            alt={card.name}
            className="w-28 rounded-xl shadow-md flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{card.name}</h2>
            <p className="text-sm text-slate-500 mt-1">
              {card.set.name} · {formatSetNumber(card.set, card.number)} · {tr('rarity', card.rarity ?? '')}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-xs font-medium text-slate-700 dark:text-slate-300">
                {tr('condition', userCard.condition)}
              </span>
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-xs font-medium text-slate-700 dark:text-slate-300">
                {tr('variant', userCard.variant)}
              </span>
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-xs font-medium text-slate-700 dark:text-slate-300">
                {t('detail.qty')}: {userCard.quantity}
              </span>
              {userCard.grade && (
                <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900 rounded-md text-xs font-semibold text-amber-700 dark:text-amber-300">
                  {userCard.grade.service} {userCard.grade.score}
                </span>
              )}
            </div>
            {/* Current Price */}
            <div className="mt-3">
              {sourceUrl && currentPrice != null ? (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-2xl font-bold text-blue-600 hover:underline"
                >
                  {formatCurrency(currentPrice, currency)}
                  <ExternalLink className="w-4 h-4" />
                </a>
              ) : (
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {formatCurrency(currentPrice, currency)}
                </span>
              )}
              <span className="text-sm text-slate-500 ml-2">{currency}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sparkline */}
        {sparklineData.length > 1 && (
          <div className="px-5 pt-4">
            <PriceSparkline data={sparklineData} height={80} />
          </div>
        )}

        {/* Cardmarket Prices */}
        <div className="p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">{t('detail.priceHistory')}</h3>
          <div className="space-y-0 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
            {priceRows.map((p) => (
              <div
                key={p.label}
                className={`flex items-center justify-between px-4 py-2.5 ${
                  p.highlight ? 'bg-blue-50 dark:bg-blue-950/50' : 'bg-white dark:bg-slate-900'
                }`}
              >
                <span className={`text-sm ${p.highlight ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>{p.label}</span>
                <span className={`text-sm ${p.highlight ? 'font-bold text-blue-600 dark:text-blue-400' : 'font-medium text-slate-800 dark:text-slate-200'}`}>
                  {formatCurrency(p.price, currency)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Purchase Info */}
        {(userCard.purchasePrice != null || userCard.notes) && (
          <div className="px-5 pb-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">{t('detail.purchaseInfo')}</h3>
            {userCard.purchasePrice != null && (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t('detail.boughtFor')} {formatCurrency(userCard.purchasePrice, userCard.purchaseCurrency ?? 'EUR')}
                {userCard.purchaseDate && ` ${t('detail.on')} ${userCard.purchaseDate}`}
                {currentPrice != null && (
                  <span className="ml-2 font-medium">
                    ({formatPct(((currentPrice - userCard.purchasePrice) / userCard.purchasePrice) * 100)} {t('detail.roi')})
                  </span>
                )}
              </p>
            )}
            {userCard.notes && (
              <p className="text-sm text-slate-400 mt-1 italic">{userCard.notes}</p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 p-5 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onEdit}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            {t('detail.edit')}
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 border border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800 rounded-xl text-sm font-semibold hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t('detail.delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
