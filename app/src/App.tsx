import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePortfolioData } from '@/hooks/usePortfolioData';
import { PwaDashboard, TotalChartScreen } from '@/pwa/PwaDashboard';
import { PwaPortfolio } from '@/pwa/PwaPortfolio';
import { PwaAddCard } from '@/pwa/PwaAddCard';
import { PwaCardDetail } from '@/pwa/PwaCardDetail';
import { PwaSettings } from '@/pwa/PwaSettings';
import { PwaInstallBanner } from '@/pwa/PwaInstallBanner';
import { toPwaRows, type PwaRow } from '@/pwa/utils';
import { addUserCard, updateUserCard, deleteUserCard } from '@/lib/card-store';
import { useI18n } from '@/lib/i18n';
import { Icons } from '@/pwa/icons';
import type { TranslationFn } from '@/pwa/types';
import type { Card, UserCard } from '@/lib/types';

type Tab = 'dashboard' | 'portfolio' | 'add' | 'settings';

const ACCENT = {
  from: '#6366F1', to: '#A855F7', solid: '#7C5CFF',
  soft: 'rgba(124,92,255,0.15)', shadow: 'rgba(124,92,255,0.35)',
};

function applyTheme(dark: boolean) {
  const r = document.documentElement;
  if (dark) {
    r.style.setProperty('--bg',             '#0B0816');
    r.style.setProperty('--fg',             '#F5F3FF');
    r.style.setProperty('--fg-muted',       'rgba(232,228,255,0.55)');
    r.style.setProperty('--card-bg',        '#15102A');
    r.style.setProperty('--card-border',    'rgba(255,255,255,0.07)');
    r.style.setProperty('--input-bg',       '#1A142F');
    r.style.setProperty('--pill-bg',        'rgba(255,255,255,0.06)');
    r.style.setProperty('--pill-fg',        'rgba(232,228,255,0.7)');
    r.style.setProperty('--ghost-bg',       'rgba(255,255,255,0.04)');
    r.style.setProperty('--icon-btn-bg',    'rgba(255,255,255,0.05)');
    r.style.setProperty('--topbar-scrolled','rgba(11,8,22,0.78)');
    r.style.setProperty('--tabbar-bg',      'rgba(11,8,22,0.85)');
    r.style.setProperty('--sidebar-bg',     'rgba(13,9,24,0.6)');
  } else {
    r.style.setProperty('--bg',             '#F0EEF8');
    r.style.setProperty('--fg',             '#12102A');
    r.style.setProperty('--fg-muted',       'rgba(12,10,30,0.5)');
    r.style.setProperty('--card-bg',        '#FFFFFF');
    r.style.setProperty('--card-border',    'rgba(0,0,0,0.08)');
    r.style.setProperty('--input-bg',       '#FAFAFE');
    r.style.setProperty('--pill-bg',        'rgba(0,0,0,0.06)');
    r.style.setProperty('--pill-fg',        'rgba(12,10,30,0.65)');
    r.style.setProperty('--ghost-bg',       'rgba(0,0,0,0.04)');
    r.style.setProperty('--icon-btn-bg',    'rgba(0,0,0,0.05)');
    r.style.setProperty('--topbar-scrolled','rgba(240,238,248,0.85)');
    r.style.setProperty('--tabbar-bg',      'rgba(240,238,248,0.92)');
    r.style.setProperty('--sidebar-bg',     'rgba(240,238,248,0.7)');
  }
  r.style.setProperty('--up',            '#34D399');
  r.style.setProperty('--down',          '#F87171');
  r.style.setProperty('--card-shadow',   '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.3)');
  r.style.setProperty('--accent-from',   ACCENT.from);
  r.style.setProperty('--accent-to',     ACCENT.to);
  r.style.setProperty('--accent-solid',  ACCENT.solid);
  r.style.setProperty('--accent-soft',   ACCENT.soft);
  r.style.setProperty('--accent-grad',   `linear-gradient(135deg, ${ACCENT.from} 0%, ${ACCENT.to} 100%)`);
  r.style.setProperty('--accent-shadow', ACCENT.shadow);
  // Body background fallback
  document.body.style.background = dark ? '#0B0816' : '#F0EEF8';
}

// ─── Desktop Sidebar ──────────────────────────────────────────────────────────
const NAV: Array<{ id: Tab; icon: React.ComponentType<{ size?: number; stroke?: number }>; de: string; en: string }> = [
  { id: 'dashboard', icon: Icons.Home,     de: 'Übersicht',        en: 'Dashboard' },
  { id: 'portfolio', icon: Icons.Wallet,   de: 'Sammlung',         en: 'Collection' },
  { id: 'add',       icon: Icons.Plus,     de: 'Karte hinzufügen', en: 'Add Card' },
];

function SidebarBtn({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 14px', borderRadius: 12, border: 'none', cursor: 'pointer',
        textAlign: 'left', fontSize: 14, fontWeight: 600, width: '100%',
        background: active ? 'var(--accent-soft)' : hov ? 'var(--pill-bg)' : 'transparent',
        color: active ? 'var(--accent-solid)' : 'var(--fg)',
        transition: 'background 0.12s',
      }}
    >
      {icon}
      <span style={{ flex: 1 }}>{label}</span>
      {active && <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent-solid)', flexShrink: 0 }} />}
    </button>
  );
}

function Sidebar({ tab, onChange, isDark, onTheme, locale, onLocale, totalValue, currency, cardCount }: {
  tab: Tab; onChange: (t: Tab) => void;
  isDark: boolean; onTheme: () => void;
  locale: string; onLocale: () => void;
  totalValue: number; currency: string; cardCount: number;
}) {
  const profileName = localStorage.getItem('pwa-profile-name') || 'Christoph';
  const fmtMoney = (v: number) => {
    const sym = currency === 'USD' ? '$' : '€';
    return v >= 1000
      ? `${sym}${v.toLocaleString('de-DE', { maximumFractionDigits: 0 })}`
      : `${sym}${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <aside style={{
      width: 272, flexShrink: 0,
      background: 'var(--sidebar-bg)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      display: 'flex', flexDirection: 'column', padding: '24px 16px 20px', gap: 4,
      borderRight: '1px solid var(--card-border)',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px 20px' }}>
        <svg viewBox="0 0 512 512" width={36} height={36} style={{ flexShrink: 0 }}>
          <circle cx="256" cy="256" r="232" fill="#C8DCFA"/>
          <path d="M24 256 A232 232 0 0 1 488 256 Z" fill="#A8C8F5"/>
          <rect x="24" y="238" width="464" height="36" fill="white"/>
          <clipPath id="pball-clip"><rect x="0" y="0" width="512" height="238"/></clipPath>
          <circle cx="256" cy="256" r="155" stroke="#1A6BFF" strokeWidth="16" fill="none" clipPath="url(#pball-clip)"/>
          <circle cx="256" cy="256" r="60" fill="white"/>
          <circle cx="256" cy="256" r="44" fill="#C8DCFA"/>
          <circle cx="256" cy="256" r="24" fill="#A8C8F5"/>
          <circle cx="256" cy="256" r="232" stroke="#1A6BFF" strokeWidth="22" fill="none"/>
          <line x1="24" y1="256" x2="488" y2="256" stroke="#1A6BFF" strokeWidth="22"/>
          <circle cx="256" cy="256" r="60" stroke="#1A6BFF" strokeWidth="18" fill="none"/>
        </svg>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)' }}>PCPT</div>
          <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>Card Portfolio</div>
        </div>
      </div>

      {/* Total value card */}
      <div style={{
        padding: '16px 16px 14px', borderRadius: 16, marginBottom: 12,
        background: 'var(--accent-grad)', color: 'white',
        boxShadow: '0 8px 24px var(--accent-shadow)',
      }}>
        <div style={{ fontSize: 10, opacity: 0.8, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
          Gesamtwert
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4, letterSpacing: -0.5 }}>
          {fmtMoney(totalValue)}
        </div>
        <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4 }}>
          {cardCount} Karten
        </div>
      </div>

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map(({ id, icon: Icon, de, en }) => {
          const active = tab === id;
          return (
            <SidebarBtn
              key={id} active={active} onClick={() => onChange(id)}
              icon={<Icon size={18} stroke={active ? 2.4 : 1.9} />}
              label={locale === 'de' ? de : en}
            />
          );
        })}
      </nav>

      <div style={{ flex: 1 }} />

      {/* Settings */}
      <SidebarBtn
        active={tab === 'settings'} onClick={() => onChange('settings')}
        icon={<Icons.Settings size={18} stroke={tab === 'settings' ? 2.4 : 1.9} />}
        label={locale === 'de' ? 'Einstellungen' : 'Settings'}
      />

      {/* Theme + Language toggles */}
      <div style={{ display: 'flex', gap: 8, padding: '8px 4px 4px' }}>
        <button onClick={onTheme} style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          padding: '9px 0', borderRadius: 10, border: '1px solid var(--card-border)',
          background: 'var(--pill-bg)', color: 'var(--fg)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>
          {isDark ? <Icons.Sun size={14}/> : <Icons.Moon size={14}/>}
          {isDark ? 'Hell' : 'Dunkel'}
        </button>
        <button onClick={onLocale} style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          padding: '9px 0', borderRadius: 10, border: '1px solid var(--card-border)',
          background: 'var(--pill-bg)', color: 'var(--fg)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>
          <Icons.Globe size={14}/>
          {locale === 'de' ? 'EN' : 'DE'}
        </button>
      </div>

      {/* Profile */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 8px 0',
        borderTop: '1px solid var(--card-border)',
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 999, background: 'var(--accent-grad)',
          color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 13,
        }}>{profileName.charAt(0).toUpperCase()}</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>{profileName}</div>
          <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>Personal</div>
        </div>
      </div>
    </aside>
  );
}

// ─── Mobile bottom tab bar ────────────────────────────────────────────────────
const MOBILE_TABS: Array<{ id: Tab; icon: React.ComponentType<{ size?: number; stroke?: number }>; de: string; en: string; primary?: boolean }> = [
  { id: 'dashboard', icon: Icons.Home,     de: 'Übersicht', en: 'Dashboard' },
  { id: 'portfolio', icon: Icons.Wallet,   de: 'Sammlung',  en: 'Collection' },
  { id: 'add',       icon: Icons.Plus,     de: 'Hinzufügen', en: 'Add', primary: true },
  { id: 'settings',  icon: Icons.Settings, de: 'Einst.', en: 'Settings' },
];

function MobileTabBar({ tab, onChange, locale }: { tab: Tab; onChange: (t: Tab) => void; locale: string }) {
  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 0,
      paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
      paddingTop: 6, paddingLeft: 8, paddingRight: 8,
      background: 'var(--tabbar-bg)',
      backdropFilter: 'blur(20px) saturate(160%)',
      WebkitBackdropFilter: 'blur(20px) saturate(160%)',
      borderTop: '1px solid var(--card-border)', zIndex: 70,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around',
    }}>
      {MOBILE_TABS.map(({ id, icon: Icon, de, en, primary }) => {
        const active = tab === id;
        const lbl = locale === 'de' ? de : en;
        if (primary) return (
          <button key={id} onClick={() => onChange(id)} aria-label={lbl} style={{
            width: 54, height: 54, borderRadius: 18, background: 'var(--accent-grad)',
            border: 'none', cursor: 'pointer', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 20px var(--accent-shadow)', marginTop: -14,
          }}><Icon size={24} stroke={2.4} /></button>
        );
        return (
          <button key={id} onClick={() => onChange(id)} aria-label={lbl} style={{
            flex: 1, padding: '6px 4px', background: 'transparent', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            color: active ? 'var(--accent-solid)' : 'var(--fg-muted)',
          }}>
            <Icon size={22} stroke={active ? 2.4 : 1.9} />
            <span style={{ fontSize: 10, fontWeight: 600 }}>{lbl}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export function App() {
  const { rows: rawRows, cards, userCards, loading, setUserCards } = usePortfolioData();
  const { t, locale, setLocale } = useI18n();
  const [tab, setTab]               = useState<Tab>('dashboard');
  const [detailRow, setDetailRow]   = useState<PwaRow | null>(null);
  const [detailIdx, setDetailIdx]   = useState(0);
  const [editCard, setEditCard]     = useState<UserCard | null>(null);
  const [prefilledCard, setPrefilledCard] = useState<Card | null>(null);
  const [showTotalChart, setShowTotalChart] = useState(false);
  const [isDark, setIsDark]         = useState(() => {
    const saved = localStorage.getItem('pcpt-theme');
    return saved ? saved === 'dark' : true;
  });
  const [isDesktop, setIsDesktop]   = useState(() => window.innerWidth >= 900);
  const [activeCurrency, setActiveCurrency] = useState(() => localStorage.getItem('pwa-currency') ?? 'EUR');
  const [profileName, setProfileName] = useState(() => localStorage.getItem('pwa-profile-name') ?? 'Christoph');

  const rows = toPwaRows(rawRows);

  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const cardCount  = rows.reduce((s, r) => s + r.uc.quantity, 0);

  // Persist & apply theme
  useEffect(() => {
    applyTheme(isDark);
    localStorage.setItem('pcpt-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    const fn = () => setIsDesktop(window.innerWidth >= 900);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

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

  const openDetail = useCallback((row: PwaRow) => {
    const idx = rows.findIndex(r => r.uc.id === row.uc.id);
    setDetailIdx(idx >= 0 ? idx : 0);
    setDetailRow(row);
  }, [rows]);

  const handleImport = useCallback((imported: UserCard[]) => {
    let updated = [...userCards];
    for (const c of imported) updated = addUserCard(updated, c);
    setUserCards(updated);
  }, [userCards, setUserCards]);

  const totalChartData = useMemo(() => {
    const total = rows.reduce((s, r) => s + r.value, 0);
    const totalCost = rows.reduce((s, r) => s + r.cost, 0);
    const pnl = total - totalCost;
    const pct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
    const len = 90;
    const history = Array<number>(len).fill(0);
    rows.forEach(r => {
      r.history.forEach((p, i) => { if (i < len) history[i] = (history[i] ?? 0) + p * r.uc.quantity; });
    });
    return { total, pnl, pct, totalHistory: history };
  }, [rows]);

  const screen = useMemo(() => {
    if (loading) return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--fg-muted)' }}>
        <div style={{ width: 22, height: 22, borderRadius: 999, border: '2.5px solid var(--accent-soft)', borderTopColor: 'var(--accent-solid)', animation: 'spin 0.8s linear infinite' }} />
        Laden...
      </div>
    );

    switch (tab) {
      case 'dashboard':
        return (
          <PwaDashboard
            rows={rows} currency={activeCurrency} t={t as TranslationFn}
            onRowClick={openDetail}
            onTotalClick={() => setShowTotalChart(true)}
          />
        );
      case 'portfolio':
        return (
          <PwaPortfolio
            rows={rows} currency={activeCurrency} t={t as TranslationFn}
            onRowClick={openDetail}
          />
        );
      case 'add':
        return (
          <PwaAddCard
            currency={activeCurrency} t={t as TranslationFn}
            prefilledCard={prefilledCard}
            editCard={editCard}
            onSave={handleSave}
            onCancel={() => { setEditCard(null); setPrefilledCard(null); setTab('portfolio'); }}
          />
        );
      case 'settings':
        return (
          <PwaSettings
            rows={rows} cards={cards} userCards={userCards}
            currency={activeCurrency} locale={locale} t={t as TranslationFn}
            onImport={handleImport}
            onLocaleToggle={() => setLocale(locale === 'de' ? 'en' : 'de')}
            isDark={isDark} onThemeToggle={() => setIsDark(d => !d)}
            activeCurrency={activeCurrency}
            onCurrencyToggle={() => {
              const next = activeCurrency === 'EUR' ? 'USD' : 'EUR';
              setActiveCurrency(next);
              localStorage.setItem('pwa-currency', next);
            }}
            profileName={profileName}
            onNameChange={(n) => { setProfileName(n); localStorage.setItem('pwa-profile-name', n); }}
            onReset={() => { localStorage.clear(); window.location.reload(); }}
          />
        );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, rows, loading, activeCurrency, locale, editCard, prefilledCard, isDark]);

  const modals = (
    <>
      {detailRow && (
        <PwaCardDetail
          rows={rows}
          initialIndex={detailIdx}
          currency={activeCurrency} t={t as TranslationFn}
          onClose={() => setDetailRow(null)}
          onEdit={(row) => {
            setEditCard(row.uc);
            setDetailRow(null);
            setTab('add');
          }}
          onDelete={(id) => { handleDelete(id); setDetailRow(null); }}
        />
      )}
      {showTotalChart && (
        <TotalChartScreen
          {...totalChartData} currency={activeCurrency} t={t as TranslationFn}
          onClose={() => setShowTotalChart(false)}
        />
      )}
      <PwaInstallBanner />
    </>
  );

  // ─── Desktop layout ──────────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <div style={{ height: '100vh', width: '100vw', display: 'flex', background: 'var(--bg)', color: 'var(--fg)', overflow: 'hidden' }}>
        <Sidebar
          tab={tab} onChange={setTab}
          isDark={isDark} onTheme={() => setIsDark(d => !d)}
          locale={locale} onLocale={() => setLocale(locale === 'de' ? 'en' : 'de')}
          totalValue={totalValue} currency={activeCurrency} cardCount={cardCount}
        />
        <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {screen}
        </main>
        {modals}
      </div>
    );
  }

  // ─── Mobile layout ───────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100vh', width: '100vw', background: 'var(--bg)', color: 'var(--fg)', position: 'relative', overflow: 'hidden' }}>
      {screen}
      <MobileTabBar tab={tab} onChange={setTab} locale={locale} />
      {modals}
    </div>
  );
}
