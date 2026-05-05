// PwaApp — full standalone PWA experience with the new UIUX design
// Only rendered when the app is installed as a PWA (display-mode: standalone)

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Icons } from './pwa/icons';
import { PwaDashboard, TotalChartScreen } from './pwa/PwaDashboard';
import { PwaPortfolio } from './pwa/PwaPortfolio';
import { PwaAddCard } from './pwa/PwaAddCard';
import { PwaScan } from './pwa/PwaScan';
import { PwaCardDetail } from './pwa/PwaCardDetail';
import { PwaSettings } from './pwa/PwaSettings';
import { toPwaRows, type PwaRow } from './pwa/utils';
import { usePortfolioData } from '@/hooks/usePortfolioData';
import { addUserCard, updateUserCard, deleteUserCard, markLaunched } from '@/lib/card-store';
import { useI18n } from '@/lib/i18n';
import type { Card, UserCard } from '@/lib/types';

type Tab = 'dashboard' | 'portfolio' | 'add' | 'scan' | 'settings';

const ACCENT = {
  from:   '#6366F1',
  to:     '#A855F7',
  solid:  '#7C5CFF',
  soft:   'rgba(124,92,255,0.15)',
  shadow: 'rgba(124,92,255,0.35)',
};

export function PwaApp() {
  const { rows: rawRows, cards, userCards, loading, setUserCards } = usePortfolioData();
  const { t, locale, setLocale } = useI18n();
  const [tab, setTab]             = useState<Tab>('dashboard');
  const [detailRow, setDetailRow] = useState<PwaRow | null>(null);
  const [editCard, setEditCard]   = useState<UserCard | null>(null);
  const [prefilledCard, setPrefilledCard] = useState<Card | null>(null);
  const [isDark, setIsDark]       = useState(true);
  const [activeCurrency, setActiveCurrency] = useState<string>(() => localStorage.getItem('pwa-currency') ?? 'EUR');
  const [profileName, setProfileName] = useState<string>(() => localStorage.getItem('pwa-profile-name') ?? '');
  const [showTotalChart, setShowTotalChart] = useState(false);

  const rows    = toPwaRows(rawRows);
  const currency = activeCurrency;

  // Compute total chart data
  const totalChartData = useMemo(() => {
    const total     = rows.reduce((s, r) => s + r.value, 0);
    const totalCost = rows.reduce((s, r) => s + r.cost, 0);
    const pnl       = total - totalCost;
    const pct       = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
    const len = 31;
    const history = Array<number>(len).fill(0);
    rows.forEach(r => {
      r.history.forEach((p, i) => { if (i < len) history[i] = (history[i] ?? 0) + p * r.uc.quantity; });
    });
    return { total, pnl, pct, totalHistory: history };
  }, [rows]);

  // Lock app height once on mount so the keyboard never pushes the layout
  useEffect(() => {
    const h = window.innerHeight;
    document.documentElement.style.setProperty('--app-height', `${h}px`);
  }, []);

  // Apply PWA CSS variables on mount
  useEffect(() => {
    const root = document.documentElement;
    const applyDarkTheme = (dark: boolean) => {
      if (dark) {
        root.style.setProperty('--bg',           '#0B0816');
        root.style.setProperty('--fg',           '#F5F3FF');
        root.style.setProperty('--fg-muted',     'rgba(232,228,255,0.55)');
        root.style.setProperty('--card-bg',      '#15102A');
        root.style.setProperty('--card-border',  'rgba(255,255,255,0.07)');
        root.style.setProperty('--input-bg',     '#1A142F');
        root.style.setProperty('--pill-bg',      'rgba(255,255,255,0.06)');
        root.style.setProperty('--pill-fg',      'rgba(232,228,255,0.7)');
        root.style.setProperty('--ghost-bg',     'rgba(255,255,255,0.04)');
        root.style.setProperty('--icon-btn-bg',  'rgba(255,255,255,0.05)');
        root.style.setProperty('--topbar-scrolled','rgba(11,8,22,0.78)');
        root.style.setProperty('--tabbar-bg',    'rgba(11,8,22,0.85)');
      } else {
        root.style.setProperty('--bg',           '#F0EEF8');
        root.style.setProperty('--fg',           '#12102A');
        root.style.setProperty('--fg-muted',     'rgba(12,10,30,0.5)');
        root.style.setProperty('--card-bg',      '#FFFFFF');
        root.style.setProperty('--card-border',  'rgba(0,0,0,0.08)');
        root.style.setProperty('--input-bg',     '#FAFAFE');
        root.style.setProperty('--pill-bg',      'rgba(0,0,0,0.06)');
        root.style.setProperty('--pill-fg',      'rgba(12,10,30,0.65)');
        root.style.setProperty('--ghost-bg',     'rgba(0,0,0,0.04)');
        root.style.setProperty('--icon-btn-bg',  'rgba(0,0,0,0.05)');
        root.style.setProperty('--topbar-scrolled','rgba(240,238,248,0.85)');
        root.style.setProperty('--tabbar-bg',    'rgba(240,238,248,0.92)');
      }
    };
    applyDarkTheme(isDark);
    root.style.setProperty('--card-shadow',  '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.3)');
    root.style.setProperty('--up',           '#34D399');
    root.style.setProperty('--down',         '#F87171');
    root.style.setProperty('--accent-from',  ACCENT.from);
    root.style.setProperty('--accent-to',    ACCENT.to);
    root.style.setProperty('--accent-solid', ACCENT.solid);
    root.style.setProperty('--accent-soft',  ACCENT.soft);
    root.style.setProperty('--accent-grad',  `linear-gradient(135deg, ${ACCENT.from} 0%, ${ACCENT.to} 100%)`);
    root.style.setProperty('--accent-shadow',ACCENT.shadow);
  }, [isDark]);

  const handleSave = useCallback((card: UserCard) => {
    if (editCard?.id) {
      setUserCards(updateUserCard(userCards, card));
      setEditCard(null);
    } else {
      setUserCards(addUserCard(userCards, card));
    }
    setPrefilledCard(null);
    setTab('portfolio');
  }, [editCard, userCards, setUserCards]);

  const handleDelete = useCallback((id: string) => {
    setUserCards(deleteUserCard(userCards, id));
    setDetailRow(null);
  }, [userCards, setUserCards]);

  const handleImport = useCallback((imported: UserCard[]) => {
    let updated = [...userCards];
    for (const card of imported) updated = addUserCard(updated, card);
    setUserCards(updated);
  }, [userCards, setUserCards]);

  const handleScanDetected = useCallback((card: Card) => {
    setPrefilledCard(card);
    setEditCard(null);
    setTab('add');
  }, []);

  function handleEdit(row: PwaRow) {
    const uc = userCards.find(c => c.id === row.uc.id);
    if (uc) setEditCard(uc);
    const card = cards.find(c => c.id === row.uc.cardId);
    if (card) setPrefilledCard(card);
    setDetailRow(null);
    setTab('add');
  }

  const tf = (key: string) => t(key as Parameters<typeof t>[0]);

  if (loading) {
    return (
      <div style={{
        height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', color: 'var(--fg-muted)', flexDirection: 'column', gap: 12,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: 'var(--accent-grad)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'pulse-soft 1.5s ease-in-out infinite',
        }}>
          <Icons.Spark size={22} style={{ color: 'white' }}/>
        </div>
        <span style={{ fontSize: 13 }}>Loading…</span>
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--bg)',
      height: 'var(--app-height, 100dvh)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      paddingTop: 'env(safe-area-inset-top)',
    }}>
      {/* Screens — flex-1 so tab bar is always pushed to bottom */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        <div style={{ height: '100%', display: tab === 'dashboard' ? 'block' : 'none' }}>
          <PwaDashboard rows={rows} currency={currency} t={tf} onRowClick={setDetailRow}
            onTotalClick={() => setShowTotalChart(true)}
          />
        </div>
        <div style={{ height: '100%', display: tab === 'portfolio' ? 'block' : 'none' }}>
          <PwaPortfolio rows={rows} currency={currency} t={tf} onRowClick={setDetailRow}/>
        </div>
        {tab === 'add' && (
          <div style={{ height: '100%' }}>
            <PwaAddCard
              cards={cards} currency={currency} t={tf}
              prefilledCard={prefilledCard}
              editCard={editCard}
              onSave={handleSave}
              onCancel={() => { setEditCard(null); setPrefilledCard(null); setTab('portfolio'); }}
            />
          </div>
        )}
        {tab === 'scan' && (
          <div style={{ height: '100%' }}>
            <PwaScan
              cards={cards} currency={currency} t={tf}
              onCardDetected={handleScanDetected}
              onManual={() => setTab('add')}
            />
          </div>
        )}
        {tab === 'settings' && (
          <div style={{ height: '100%' }}>
            <PwaSettings
              rows={rows} cards={cards} userCards={userCards}
              currency={currency} locale={locale} t={tf}
              onImport={handleImport}
              onLocaleToggle={() => setLocale(locale === 'de' ? 'en' : 'de')}
              isDark={isDark}
              onThemeToggle={() => setIsDark(d => !d)}
              activeCurrency={activeCurrency}
              onCurrencyToggle={() => setActiveCurrency(c => {
                const next = c === 'EUR' ? 'USD' : 'EUR';
                localStorage.setItem('pwa-currency', next);
                return next;
              })}
              profileName={profileName}
              onNameChange={(n) => { setProfileName(n); localStorage.setItem('pwa-profile-name', n); }}
              onReset={() => {
                setUserCards([]);
                setProfileName('');
                localStorage.removeItem('pwa-profile-name');
                markLaunched(); // prevent re-seeding demo
              }}
            />
          </div>
        )}

        {/* Total chart fullscreen (within content area, above tab bar) */}
        {showTotalChart && (
          <TotalChartScreen
            {...totalChartData}
            currency={currency} t={tf}
            onClose={() => setShowTotalChart(false)}
          />
        )}
      </div>

      {/* Tab bar — normal flow, always at bottom */}
      <PwaTabBar tab={tab} onChange={setTab} t={tf}/>

      {/* Detail sheet */}
      {detailRow && (() => {
        const idx = rows.findIndex(r => r.uc.id === detailRow.uc.id);
        if (idx < 0) return null;
        return (
          <PwaCardDetail
            rows={rows} initialIndex={idx} currency={currency} t={tf}
            onClose={() => setDetailRow(null)}
            onEdit={handleEdit}
            onDelete={(id) => handleDelete(id)}
          />
        );
      })()}
    </div>
  );
}

// ── Tab Bar ───────────────────────────────────────────────────────────────────

function PwaTabBar({ tab, onChange, t }: { tab: Tab; onChange: (t: Tab) => void; t: (k: string) => string }) {
  const TABS: { id: Tab; Icon: typeof Icons.Home; label: string; primary?: boolean }[] = [
    { id: 'dashboard', Icon: Icons.Home,     label: t('pwa.dashboard') },
    { id: 'portfolio', Icon: Icons.Wallet,   label: t('pwa.portfolio') },
    { id: 'add',       Icon: Icons.Plus,     label: t('pwa.add'), primary: true },
    { id: 'scan',      Icon: Icons.Scan,     label: t('pwa.scan') },
    { id: 'settings',  Icon: Icons.Settings, label: t('pwa.settings') },
  ];

  return (
    <div style={{
        paddingBottom: 'max(env(safe-area-inset-bottom), 10px)',
      paddingTop: 6, paddingLeft: 8, paddingRight: 8,
      background: 'var(--tabbar-bg)',
      backdropFilter: 'blur(20px) saturate(160%)',
      WebkitBackdropFilter: 'blur(20px) saturate(160%)',
      borderTop: '1px solid var(--card-border)',
      zIndex: 70,
      flexShrink: 0,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around',
    }}>
      {TABS.map(({ id, Icon, label, primary }) => {
        const active = tab === id;
        if (primary) {
          return (
            <button key={id} onClick={() => onChange(id)} aria-label={label} style={{
              width: 52, height: 52, borderRadius: 18,
              background: 'var(--accent-grad)',
              border: 'none', cursor: 'pointer',
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 20px var(--accent-shadow)',
              marginTop: -10,
            }}>
              <Icon size={22} stroke={2.4}/>
            </button>
          );
        }
        return (
          <button key={id} onClick={() => onChange(id)} aria-label={label} style={{
            flex: 1, padding: '6px 4px', background: 'transparent', border: 'none',
            cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            color: active ? 'var(--accent-solid)' : 'var(--fg-muted)',
          }}>
            <Icon size={20} stroke={active ? 2.4 : 1.9}/>
            <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: 0.1 }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
