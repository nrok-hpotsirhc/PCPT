// PWA Dashboard screen — matches the UIUX design exactly

import { useState, useMemo } from 'react';
import { Icons } from './icons';
import { Pill, PwaCard, Sparkline, CardThumb, TopBar, SectionLabel } from './ui';
import { fmtMoney, fmtMoneySigned, fmtPct, type PwaRow } from './utils';
import type { TranslationFn } from './types';

interface DashboardProps {
  rows: PwaRow[];
  currency: string;
  t: TranslationFn;
  onRowClick: (row: PwaRow) => void;
}

export function PwaDashboard({ rows, currency, t, onRowClick }: DashboardProps) {
  const [scrolled, setScrolled] = useState(false);

  const total        = rows.reduce((s, r) => s + r.value, 0);
  const totalCost    = rows.reduce((s, r) => s + r.cost, 0);
  const change24h    = rows.reduce((s, r) => s + r.price.change24h * r.uc.quantity, 0);
  const cardCount    = rows.reduce((s, r) => s + r.uc.quantity, 0);
  const allTimePnl   = total - totalCost;
  const allTimePct   = totalCost > 0 ? (allTimePnl / totalCost) * 100 : 0;

  // 30-day total history
  const totalHistory = useMemo(() => {
    const len = 31;
    const series = Array<number>(len).fill(0);
    rows.forEach(r => {
      r.history.forEach((p, i) => { if (i < len) series[i] = (series[i] ?? 0) + p * r.uc.quantity; });
    });
    return series;
  }, [rows]);

  const sortedByCh = [...rows].sort((a, b) => b.price.change24h - a.price.change24h);
  const cotd     = sortedByCh[0] ?? null;
  const cotdPct  = cotd ? (cotd.price.change24h / (cotd.price.trend || 1)) * 100 : 0;
  const gainers  = [...rows].filter(r => r.price.change24h > 0).sort((a, b) => b.price.change24h - a.price.change24h).slice(0, 3);
  const losers   = [...rows].filter(r => r.price.change24h < 0).sort((a, b) => a.price.change24h - b.price.change24h).slice(0, 3);
  const topCards = [...rows].sort((a, b) => b.value - a.value).slice(0, 4);

  return (
    <div
      onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 8)}
      style={{ height: '100%', overflow: 'auto' }}
    >
      <TopBar title={t('pwa.dashboard')} scrolled={scrolled}/>

      <div style={{ padding: '4px 16px 100px' }}>
        {/* Hero total */}
        <HeroTotal
          total={total} change24h={change24h} pnl={allTimePnl}
          pct={allTimePct} cardCount={cardCount}
          totalHistory={totalHistory} currency={currency} t={t}
        />

        {/* Card of the day */}
        {cotd && (
          <CardOfDay row={cotd} pct={cotdPct} currency={currency} t={t} onClick={() => onRowClick(cotd)}/>
        )}

        {/* Today's movers */}
        <SectionLabel>{t('pwa.todayMovers')}</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <MoverCard label={t('pwa.gainers')} rows={gainers} up currency={currency} onClick={onRowClick}/>
          <MoverCard label={t('pwa.losers')} rows={losers} currency={currency} onClick={onRowClick}/>
        </div>

        {/* Most valuable */}
        <SectionLabel style={{ marginTop: 22 }}>{t('pwa.mostValuable')}</SectionLabel>
        {topCards.length > 0 && (
          <PwaCard padding={6} style={{ overflow: 'hidden' }}>
            {topCards.map((r, i) => (
              <ValueRow
                key={r.uc.id} row={r} rank={i + 1} currency={currency}
                onClick={() => onRowClick(r)} last={i === topCards.length - 1}
              />
            ))}
          </PwaCard>
        )}

        {/* Activity ticker */}
        <SectionLabel style={{ marginTop: 22 }}>{t('pwa.activity')}</SectionLabel>
        <PwaCard padding={14}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <ActivityRow
              icon={<Icons.TrendingUp size={14}/>} tone="up"
              text="Daily price sync completed"
              time="6h ago"
            />
            <ActivityRow
              icon={<Icons.Spark size={14}/>} tone="accent"
              text={`${cardCount} ${t('pwa.cards')} in portfolio`}
              time="now"
            />
          </div>
        </PwaCard>
      </div>
    </div>
  );
}

// ── Hero Total ─────────────────────────────────────────────────────────────────

function HeroTotal({
  total, change24h, pnl, pct, cardCount, totalHistory, currency, t,
}: {
  total: number; change24h: number; pnl: number; pct: number;
  cardCount: number; totalHistory: number[]; currency: string; t: TranslationFn;
}) {
  const up = change24h >= 0;
  return (
    <div style={{
      borderRadius: 22, padding: 20, marginBottom: 16,
      background: 'var(--accent-grad)',
      color: 'white', position: 'relative', overflow: 'hidden',
      boxShadow: '0 12px 32px var(--accent-shadow)',
    }}>
      {/* Decorative blob */}
      <div style={{
        position: 'absolute', right: -40, top: -40, width: 180, height: 180,
        borderRadius: 999, background: 'rgba(255,255,255,0.12)', filter: 'blur(20px)',
      }}/>
      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.85, letterSpacing: 0.3, textTransform: 'uppercase' }}>
          {t('pwa.totalValue')}
        </div>
        <div style={{ fontSize: 38, fontWeight: 800, marginTop: 4, letterSpacing: -0.8, lineHeight: 1 }}>
          {fmtMoney(total, currency)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13, fontWeight: 600 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            background: 'rgba(255,255,255,0.22)', padding: '3px 8px', borderRadius: 999,
          }}>
            {up ? <Icons.ArrowUp size={12} stroke={2.5}/> : <Icons.ArrowDown size={12} stroke={2.5}/>}
            {fmtMoneySigned(change24h, currency)}
          </span>
          <span style={{ opacity: 0.85 }}>{t('pwa.today')}</span>
          <span style={{ marginLeft: 'auto', opacity: 0.85, fontSize: 12 }}>
            {cardCount} {t('pwa.cards')}
          </span>
        </div>

        {/* Sparkline */}
        <div style={{ marginTop: 14, marginLeft: -4, marginRight: -4 }}>
          <Sparkline
            data={totalHistory} w={342} h={56}
            color="rgba(255,255,255,0.95)"
            fillFrom="rgba(255,255,255,0.5)"
            fillTo="rgba(255,255,255,0)"
            dot={false}
          />
        </div>

        {/* Footer stats */}
        <div style={{
          marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.18)',
          display: 'flex', gap: 24, fontSize: 12,
        }}>
          <div>
            <div style={{ opacity: 0.75 }}>{t('pwa.allTime')}</div>
            <div style={{ fontWeight: 700, fontSize: 14, marginTop: 2 }}>
              {fmtMoneySigned(pnl, currency)} <span style={{ opacity: 0.85 }}>({fmtPct(pct)})</span>
            </div>
          </div>
          <div>
            <div style={{ opacity: 0.75 }}>{t('pwa.range30d')}</div>
            <div style={{ fontWeight: 700, fontSize: 14, marginTop: 2 }}>
              {fmtMoney(Math.min(...totalHistory.filter(v => v > 0), total), currency)} –{' '}
              {fmtMoney(Math.max(...totalHistory, total), currency)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Card of the Day ────────────────────────────────────────────────────────────

function CardOfDay({ row, pct, currency, t, onClick }: {
  row: PwaRow; pct: number; currency: string; t: TranslationFn; onClick: () => void;
}) {
  return (
    <PwaCard onClick={onClick} padding={14} style={{ marginBottom: 22, position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(circle at 88% 35%, var(--accent-soft), transparent 60%)',
        pointerEvents: 'none',
      }}/>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icons.Sparkle size={14} style={{ color: 'var(--accent-solid)' }}/>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--accent-solid)' }}>
            {t('pwa.cardOfDay')}
          </div>
        </div>
        <Pill tone="up">▲ {pct.toFixed(1)}%</Pill>
      </div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', position: 'relative' }}>
        <CardThumb img={row.card.img} name={row.card.name} w={72} radius={8} glow/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)', letterSpacing: -0.2 }}>
            {row.card.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2 }}>
            {row.card.set} · #{row.card.number}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--fg)', letterSpacing: -0.5 }}>
              {fmtMoney(row.price.trend, currency)}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--up)' }}>
              {fmtMoneySigned(row.price.change24h, currency)}
            </div>
          </div>
        </div>
      </div>
    </PwaCard>
  );
}

// ── Mover Card ─────────────────────────────────────────────────────────────────

function MoverCard({ label, rows, up, currency, onClick }: {
  label: string; rows: PwaRow[]; up?: boolean; currency: string; onClick: (r: PwaRow) => void;
}) {
  return (
    <PwaCard padding={12} style={{ minHeight: 158 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        {up
          ? <Icons.TrendingUp size={13} style={{ color: 'var(--up)' }}/>
          : <Icons.TrendingDown size={13} style={{ color: 'var(--down)' }}/>
        }
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg)' }}>{label}</div>
      </div>
      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>—</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map(r => (
            <div
              key={r.uc.id}
              onClick={() => onClick(r)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
            >
              <CardThumb img={r.card.img} name={r.card.name} w={28} radius={4}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: 'var(--fg)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{r.card.name}</div>
                <div style={{ fontSize: 10, color: r.price.change24h >= 0 ? 'var(--up)' : 'var(--down)', fontWeight: 700 }}>
                  {fmtMoneySigned(r.price.change24h, currency)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </PwaCard>
  );
}

// ── Value Row ──────────────────────────────────────────────────────────────────

function ValueRow({ row, rank, currency, onClick, last }: {
  row: PwaRow; rank: number; currency: string; onClick: () => void; last: boolean;
}) {
  const up = row.pnl >= 0;
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 10px',
        borderBottom: last ? 'none' : '1px solid var(--card-border)',
        cursor: 'pointer',
      }}
    >
      <div style={{
        width: 22, height: 22, borderRadius: 7, fontSize: 11, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--pill-bg)', color: 'var(--fg-muted)',
      }}>{rank}</div>
      <CardThumb img={row.card.img} name={row.card.name} w={36} radius={5}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {row.card.name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 1 }}>
          {row.card.set} · {row.uc.condition} · ×{row.uc.quantity}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg)' }}>{fmtMoney(row.value, currency)}</div>
        <div style={{ fontSize: 11, color: up ? 'var(--up)' : 'var(--down)', fontWeight: 600 }}>{fmtPct(row.pnlPct)}</div>
      </div>
    </div>
  );
}

// ── Activity Row ───────────────────────────────────────────────────────────────

type ActivityTone = 'up' | 'down' | 'accent' | 'default';

function ActivityRow({ icon, tone, text, time }: { icon: React.ReactNode; tone: ActivityTone; text: string; time: string }) {
  const tones: Record<ActivityTone, { bg: string; fg: string }> = {
    up:      { bg: 'rgba(34,197,94,0.16)',  fg: 'var(--up)' },
    down:    { bg: 'rgba(239,68,68,0.16)',  fg: 'var(--down)' },
    accent:  { bg: 'var(--accent-soft)',    fg: 'var(--accent-solid)' },
    default: { bg: 'var(--pill-bg)',        fg: 'var(--fg-muted)' },
  };
  const t = tones[tone];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 9, flexShrink: 0,
        background: t.bg, color: t.fg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{icon}</div>
      <div style={{ flex: 1, fontSize: 13, color: 'var(--fg)' }}>{text}</div>
      <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{time}</div>
    </div>
  );
}
