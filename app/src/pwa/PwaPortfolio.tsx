// PWA Portfolio screen — searchable sortable list + floating FABs

import { useState, useMemo } from 'react';
import { Icons } from './icons';
import {
  PwaCard, CardThumb, TopBar, EmptyState, BottomSheet, inputStyle,
} from './ui';
import { fmtMoney, fmtMoneySigned, type PwaRow } from './utils';
import type { TranslationFn } from './types';

type SortKey = 'value' | 'change' | 'name' | 'price' | 'qty' | 'set';

interface PortfolioProps {
  rows: PwaRow[];
  currency: string;
  t: TranslationFn;
  onRowClick: (row: PwaRow) => void;
}

export function PwaPortfolio({ rows, currency, t, onRowClick }: PortfolioProps) {
  const [scrolled, setScrolled]     = useState(false);
  const [query, setQuery]           = useState('');
  const [sortBy, setSortBy]         = useState<SortKey>('value');
  const [sortDir, setSortDir]       = useState<'asc' | 'desc'>('desc');
  const [sortOpen, setSortOpen]     = useState(false);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    let r = rows;
    if (q) {
      r = r.filter(row =>
        row.card.name.toLowerCase().includes(q) ||
        row.card.set.toLowerCase().includes(q) ||
        row.card.setCode.toLowerCase().includes(q),
      );
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...r].sort((a, b) => {
      let av: string | number, bv: string | number;
      switch (sortBy) {
        case 'name':   av = a.card.name; bv = b.card.name; break;
        case 'set':    av = a.card.set;  bv = b.card.set;  break;
        case 'qty':    av = a.uc.quantity; bv = b.uc.quantity; break;
        case 'price':  av = a.price.trend; bv = b.price.trend; break;
        case 'change': av = a.price.change24h; bv = b.price.change24h; break;
        default:       av = a.value; bv = b.value;
      }
      if (typeof av === 'string') return av.localeCompare(bv as string) * dir;
      return ((av as number) - (bv as number)) * dir;
    });
  }, [rows, query, sortBy, sortDir]);

  const totalValue = filtered.reduce((s, r) => s + r.value, 0);

  const sortOptions: { k: SortKey; l: string }[] = [
    { k: 'value',  l: t('pwa.sort.value') },
    { k: 'change', l: t('pwa.sort.change') },
    { k: 'name',   l: t('pwa.sort.name') },
    { k: 'price',  l: t('pwa.sort.price') },
    { k: 'qty',    l: t('pwa.sort.qty') },
    { k: 'set',    l: t('pwa.sort.set') },
  ];

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      <div
        onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 8)}
        style={{ height: '100%', overflow: 'auto' }}
      >
        <TopBar
          title={t('pwa.portfolio')}
          scrolled={scrolled}
          subtitle={`${filtered.length} ${t('pwa.cards')} · ${fmtMoney(totalValue, currency)}`}
        />

        {/* Sticky search + sort bar */}
        <div style={{
          position: 'sticky', top: 48, zIndex: 15,
          display: 'flex', gap: 8, padding: '8px 16px',
          background: 'var(--bg)',
        }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Icons.Search size={14} style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--fg-muted)', pointerEvents: 'none',
            }}/>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('pwa.searchPlaceholder')}
              style={{ ...inputStyle, paddingLeft: 32, paddingRight: query ? 32 : 12, fontSize: 13, padding: '10px 12px 10px 32px' }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                width: 20, height: 20, borderRadius: 999, border: 'none',
                background: 'var(--pill-bg)', color: 'var(--fg-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
              }}><Icons.Close size={11}/></button>
            )}
          </div>
          <button onClick={() => setSortOpen(true)} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '10px 12px',
            borderRadius: 12, border: '1px solid var(--card-border)',
            background: (sortBy !== 'value' || sortDir !== 'desc') ? 'var(--accent-soft)' : 'var(--card-bg)',
            color: (sortBy !== 'value' || sortDir !== 'desc') ? 'var(--accent-solid)' : 'var(--fg-muted)',
            cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
          }}>
            <Icons.Sort size={14}/>
            {sortOptions.find(s => s.k === sortBy)?.l}
            {sortDir === 'asc' ? <Icons.ChevronUp size={11}/> : <Icons.ChevronDown size={11}/>}
          </button>
        </div>

          <div style={{ padding: '4px 16px 24px' }}>
          {/* Active filter chips — only query chip remains */}
          {false && null /* filter chips moved to sticky bar */}

          {/* List */}
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Icons.Search size={22}/>}
              title={t('pwa.noResults')}
              body={t('pwa.noResultsBody')}
            />
          ) : (
            <PwaCard padding={4} style={{ overflow: 'hidden' }}>
              {filtered.map((row, i) => (
                <PortfolioRow
                  key={row.uc.id} row={row} currency={currency}
                  onClick={() => onRowClick(row)} last={i === filtered.length - 1}
                />
              ))}
            </PwaCard>
          )}
        </div>
      </div>

      {/* No floating FABs — search/sort moved to sticky bar above list */}

      {/* Sort sheet */}
      {sortOpen && (
        <BottomSheet onClose={() => setSortOpen(false)} title="Sort">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {sortOptions.map(o => {
              const active = sortBy === o.k;
              return (
                <button
                  key={o.k}
                  onClick={() => {
                    if (active) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                    else { setSortBy(o.k); setSortDir('desc'); }
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px', borderRadius: 12,
                    background: active ? 'var(--accent-soft)' : 'transparent',
                    color: active ? 'var(--accent-solid)' : 'var(--fg)',
                    border: '1px solid ' + (active ? 'var(--accent-solid)' : 'var(--card-border)'),
                    fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <span>{o.l}</span>
                  {active && (sortDir === 'asc'
                    ? <Icons.ArrowUp size={16} stroke={2.4}/>
                    : <Icons.ArrowDown size={16} stroke={2.4}/>
                  )}
                </button>
              );
            })}
          </div>
        </BottomSheet>
      )}
    </div>
  );
}

// ── Portfolio Row ─────────────────────────────────────────────────────────────

function PortfolioRow({ row, currency, onClick, last }: {
  row: PwaRow; currency: string; onClick: () => void; last: boolean;
}) {
  const up = row.price.change24h >= 0;
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 12px',
        borderBottom: last ? 'none' : '1px solid var(--card-border)',
        cursor: 'pointer',
      }}
    >
      <CardThumb img={row.card.img} name={row.card.name} w={40} radius={5}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {row.card.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, fontSize: 11, color: 'var(--fg-muted)' }}>
          <span>{row.card.set}</span>
          <span style={{ width: 2, height: 2, borderRadius: 999, background: 'var(--fg-muted)', opacity: 0.5 }}/>
          <span>×{row.uc.quantity}</span>
          <span style={{ width: 2, height: 2, borderRadius: 999, background: 'var(--fg-muted)', opacity: 0.5 }}/>
          <span>{row.uc.condition}</span>
          {row.uc.grade && (
            <>
              <span style={{ width: 2, height: 2, borderRadius: 999, background: 'var(--fg-muted)', opacity: 0.5 }}/>
              <span style={{ color: 'var(--accent-solid)', fontWeight: 600 }}>
                {row.uc.grade.service} {row.uc.grade.score}
              </span>
            </>
          )}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg)' }}>{fmtMoney(row.value, currency)}</div>
        <div style={{
          fontSize: 11, color: up ? 'var(--up)' : 'var(--down)', fontWeight: 600,
          display: 'inline-flex', alignItems: 'center', gap: 2,
        }}>
          {up ? <Icons.ArrowUp size={10} stroke={2.6}/> : <Icons.ArrowDown size={10} stroke={2.6}/>}
          {fmtMoneySigned(row.price.change24h, currency)}
        </div>
      </div>
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────
