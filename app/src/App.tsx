import { Suspense, lazy, useId, useState, useCallback, useMemo } from 'react';
import { usePortfolioData } from '@/hooks/usePortfolioData';
import { CardTable } from '@/components/CardTable';
import { Dashboard } from '@/components/Dashboard';
import { CardForm } from '@/components/CardForm';
import { CardDetail } from '@/components/CardDetail';
import { formatCurrency, totalPortfolioValue } from '@/lib/price-utils';
import { addUserCard, updateUserCard, deleteUserCard } from '@/lib/card-store';
import { useI18n } from '@/lib/i18n';
import type { UserCard, Card, PortfolioRow } from '@/lib/types';
import {
  LayoutDashboard,
  BookOpen,
  Plus,
  FileUp,
  ScanLine,
  Globe,
  Zap,
  AlertTriangle,
} from 'lucide-react';

type Tab = 'dashboard' | 'portfolio' | 'add' | 'import' | 'scan';

const ExcelImport = lazy(() =>
  import('@/components/ExcelImport').then((mod) => ({ default: mod.ExcelImport })),
);

const OcrScanner = lazy(() =>
  import('@/components/OcrScanner').then((mod) => ({ default: mod.OcrScanner })),
);

const TAB_ICONS: Record<Tab, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  portfolio: BookOpen,
  add: Plus,
  import: FileUp,
  scan: ScanLine,
};

export function App() {
  const { rows, cards, userCards, loading, error, lastSynced, setUserCards } = usePortfolioData();
  const { t, locale, setLocale } = useI18n();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [detailRow, setDetailRow] = useState<PortfolioRow | null>(null);
  const [editCard, setEditCard] = useState<UserCard | null>(null);

  const TABS: { id: Tab; label: string }[] = useMemo(
    () => [
      { id: 'dashboard', label: t('tab.dashboard') },
      { id: 'portfolio', label: t('tab.portfolio') },
      { id: 'add', label: t('tab.add') },
      { id: 'import', label: t('tab.import') },
      { id: 'scan', label: t('tab.scan') },
    ],
    [t],
  );

  const total = totalPortfolioValue(rows);
  const currency = rows[0]?.currency ?? 'EUR';

  const handleAddCard = useCallback(
    (card: UserCard) => {
      setUserCards(addUserCard(userCards, card));
      setTab('portfolio');
    },
    [userCards, setUserCards],
  );

  const handleUpdateCard = useCallback(
    (card: UserCard) => {
      setUserCards(updateUserCard(userCards, card));
      setEditCard(null);
      setDetailRow(null);
    },
    [userCards, setUserCards],
  );

  const handleDeleteCard = useCallback(
    (id: string) => {
      setUserCards(deleteUserCard(userCards, id));
      setDetailRow(null);
    },
    [userCards, setUserCards],
  );

  const handleImport = useCallback(
    (imported: UserCard[]) => {
      let updated = [...userCards];
      for (const card of imported) {
        updated = addUserCard(updated, card);
      }
      setUserCards(updated);
    },
    [userCards, setUserCards],
  );

  const handleScanDetected = useCallback((card: Card) => {
    setEditCard({
      id: '',
      cardId: card.id,
      owner: '',
      condition: 'NM',
      variant: 'holofoil',
      quantity: 1,
      addedAt: new Date().toISOString(),
    });
    setTab('add');
  }, []);

  const handleRowClick = useCallback((row: PortfolioRow) => setDetailRow(row), []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 dark:text-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  {t('app.title')}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-none hidden sm:block">
                  {t('app.subtitle')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setLocale(locale === 'de' ? 'en' : 'de')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300"
                title={locale === 'de' ? 'Switch to English' : 'Auf Deutsch wechseln'}
              >
                <Globe className="w-3.5 h-3.5" />
                {locale === 'de' ? 'EN' : 'DE'}
              </button>
              <div className="text-right">
                <div className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {formatCurrency(total, currency)}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 leading-none">
                  {rows.length} {t('app.cards')}
                  {lastSynced
                    ? ` · ${t('app.synced')} ${new Date(lastSynced).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-US')}`
                    : ''}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Desktop Tab Nav */}
      <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 hidden sm:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-0 -mb-px">
            {TABS.map((tabItem) => {
              const Icon = TAB_ICONS[tabItem.id];
              return (
                <button
                  key={tabItem.id}
                  onClick={() => setTab(tabItem.id)}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    tab === tabItem.id
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tabItem.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-5 sm:px-6 lg:px-8 pb-24 sm:pb-6">
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <span className="ml-3 text-slate-500 dark:text-slate-400">{t('loading')}</span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div><strong>{t('error')}:</strong> {error}</div>
          </div>
        )}

        {!loading && !error && (
          <>
            {tab === 'dashboard' && <Dashboard rows={rows} />}
            {tab === 'portfolio' &&
              (rows.length > 0 ? (
                <CardTable rows={rows} onRowClick={handleRowClick} />
              ) : (
                <EmptyState onAdd={() => setTab('add')} />
              ))}
            {tab === 'add' && (
              <div className="max-w-xl mx-auto">
                <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">
                  {editCard ? t('form.editTitle') : t('form.addTitle')}
                </h2>
                <CardForm
                  cards={cards}
                  onSubmit={editCard?.id ? handleUpdateCard : handleAddCard}
                  onCancel={() => { setEditCard(null); setTab('portfolio'); }}
                  editCard={editCard}
                />
              </div>
            )}
            {tab === 'import' && (
              <div className="max-w-xl mx-auto">
                <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">
                  {t('import.title')}
                </h2>
                <Suspense fallback={<SectionLoader label={t('loading')} />}>
                  <ExcelImport onImport={handleImport} userCards={userCards} cards={cards} />
                </Suspense>
              </div>
            )}
            {tab === 'scan' && (
              <div className="max-w-md mx-auto">
                <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">
                  {t('scan.title')}
                </h2>
                <Suspense fallback={<SectionLoader label={t('loading')} />}>
                  <OcrScanner cards={cards} onCardDetected={handleScanDetected} />
                </Suspense>
              </div>
            )}
          </>
        )}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-30">
        <div className="flex">
          {TABS.map((tabItem) => {
            const Icon = TAB_ICONS[tabItem.id];
            const isActive = tab === tabItem.id;
            return (
              <button
                key={tabItem.id}
                onClick={() => setTab(tabItem.id)}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                {tabItem.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Card Detail Modal */}
      {detailRow && (
        <CardDetail
          row={detailRow}
          onClose={() => setDetailRow(null)}
          onEdit={() => {
            setEditCard(detailRow.userCard);
            setDetailRow(null);
            setTab('add');
          }}
          onDelete={() => handleDeleteCard(detailRow.userCard.id)}
        />
      )}

      {/* Footer */}
      <footer className="hidden sm:block border-t border-slate-200 dark:border-slate-800 mt-2">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8 text-xs text-slate-400 text-center">
          {t('footer')}
        </div>
      </footer>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  const { t } = useI18n();
  return (
    <div className="text-center py-24 text-slate-500 dark:text-slate-400">
      <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
      <p className="text-lg font-medium text-slate-700 dark:text-slate-300">{t('empty.title')}</p>
      <p className="text-sm mt-2">
        <button onClick={onAdd} className="text-blue-600 hover:underline font-medium">
          {t('empty.addCard')}
        </button>{' '}
        {t('empty.orImport')}
      </p>
    </div>
  );
}

function SectionLoader({ label }: { label: string }) {
  const labelId = useId();
  return (
    <div
      role="status"
      aria-live="polite"
      aria-labelledby={labelId}
      className="flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-10 text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
    >
      <div aria-hidden="true" className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
      <span id={labelId} className="ml-3">{label}</span>
    </div>
  );
}
