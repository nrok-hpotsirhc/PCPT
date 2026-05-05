// PWA Card Detail bottom sheet — price chart, stats, edit/delete
// Swipe down to close · swipe left/right to navigate between cards

import { useState, useRef, useCallback } from 'react';
import { Icons } from './icons';
import { Pill, Sparkline, CardThumb, GhostButton } from './ui';
import { fmtMoney, fmtMoneySigned, fmtPct, typeToPillTone, type PwaRow } from './utils';
import type { TranslationFn } from './types';

interface CardDetailProps {
  rows: PwaRow[];        // all portfolio rows for prev/next nav
  initialIndex: number;  // which row to show first
  currency: string;
  t: TranslationFn;
  onClose: () => void;
  onEdit: (row: PwaRow) => void;
  onDelete: (id: string) => void;
}

type Range = '7d' | '30d' | '90d';
const RANGES: Range[] = ['7d', '30d', '90d'];
const RANGE_DAYS: Record<Range, number> = { '7d': 7, '30d': 30, '90d': 30 };

export function PwaCardDetail({ rows, initialIndex, currency, t, onClose, onEdit, onDelete }: CardDetailProps) {
  const [idx, setIdx]     = useState(initialIndex);
  const [range, setRange] = useState<Range>('30d');
  const touchStart  = useRef<{ x: number; y: number } | null>(null);
  const [dragY, setDragY] = useState(0);

  const row = rows[idx];
  if (!row) return null;

  const days   = RANGE_DAYS[range];
  const values = row.history.slice(-days - 1);
  const start  = values[0] ?? 0;
  const end    = values[values.length - 1] ?? 0;
  const delta  = end - start;
  const pct    = start > 0 ? (delta / start) * 100 : 0;
  const up     = delta >= 0;
  const pillTone = typeToPillTone(row.card.type);

  function goPrev() { if (idx > 0) setIdx(idx - 1); }
  function goNext() { if (idx < rows.length - 1) setIdx(idx + 1); }

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t0 = e.touches[0];
    if (!t0) return;
    touchStart.current = { x: t0.clientX, y: t0.clientY };
    setDragY(0);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t0 = e.touches[0];
    if (!t0) return;
    const dy = t0.clientY - touchStart.current.y;
    if (dy > 0) setDragY(dy);
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t0 = e.changedTouches[0];
    if (!t0) return;
    const dx = t0.clientX - touchStart.current.x;
    const dy = t0.clientY - touchStart.current.y;
    touchStart.current = null;
    setDragY(0);
    if (Math.abs(dy) > 80 && Math.abs(dy) > Math.abs(dx)) {
      onClose();
    } else if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) goNext(); else goPrev();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, rows.length, onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: `rgba(0,0,0,${0.45 + Math.min(dragY / 1000, 0.1)})`,
        display: 'flex', alignItems: 'flex-end',
        animation: 'fadeIn 0.2s',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          width: '100%', background: 'var(--bg)',
          borderTopLeftRadius: 22, borderTopRightRadius: 22,
          maxHeight: '92%', display: 'flex', flexDirection: 'column',
          animation: dragY > 0 ? 'none' : 'slideUp 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)',
          transform: dragY > 0 ? `translateY(${dragY}px)` : 'none',
          transition: dragY === 0 ? 'transform 0.2s' : 'none',
          touchAction: 'pan-y',  // allow vertical scroll; prevent horizontal browser pan/nav
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 4, flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--card-border)' }}/>
        </div>

        {/* Nav arrows */}
        {rows.length > 1 && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '0 14px 6px', flexShrink: 0,
          }}>
            <button onClick={goPrev} disabled={idx === 0} style={navBtnStyle(idx === 0)}>
              <Icons.ChevronLeft size={16}/>
            </button>
            <span style={{ fontSize: 11, color: 'var(--fg-muted)', fontWeight: 600 }}>
              {idx + 1} / {rows.length}
            </span>
            <button onClick={goNext} disabled={idx === rows.length - 1} style={navBtnStyle(idx === rows.length - 1)}>
              <Icons.ChevronRight size={16}/>
            </button>
          </div>
        )}

        {/* Scrollable content */}
        <div style={{ overflow: 'auto', padding: '0 18px 12px', flex: 1, minHeight: 0 }}>
          {/* Header */}
          <div style={{ display: 'flex', gap: 14, marginTop: 4 }}>
            <CardThumb img={row.card.img} name={row.card.name} w={92} radius={9} glow/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--accent-solid)', fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                {row.card.set} · #{row.card.number}
              </div>
              <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--fg)', marginTop: 4, letterSpacing: -0.4, lineHeight: 1.15 }}>
                {row.card.name}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {/* @ts-expect-error dynamic tone */}
                <Pill tone={pillTone}>{row.card.type}</Pill>
                {row.card.rarity && <Pill>{row.card.rarity}</Pill>}
              </div>
            </div>
          </div>

          {/* Price card */}
          <div style={{
            marginTop: 16, padding: 14, borderRadius: 14,
            background: 'var(--card-bg)', border: '1px solid var(--card-border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--fg)', letterSpacing: -0.6 }}>
                {fmtMoney(row.price.trend, currency)}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: up ? 'var(--up)' : 'var(--down)' }}>
                {fmtMoneySigned(delta, currency)} ({fmtPct(pct)})
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>
              {t('pwa.cardmarketTrend')} · {range}
            </div>

            <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
              {RANGES.map(r => (
                <button key={r} onClick={() => setRange(r)} style={{
                  flex: 1, padding: '6px 0', fontSize: 12, fontWeight: 600,
                  borderRadius: 8, border: '1px solid var(--card-border)',
                  background: range === r ? 'var(--accent-soft)' : 'transparent',
                  color: range === r ? 'var(--accent-solid)' : 'var(--fg-muted)',
                  cursor: 'pointer',
                }}>{r.toUpperCase()}</button>
              ))}
            </div>

            <div style={{ marginTop: 14, marginLeft: -4, marginRight: -4 }}>
              <Sparkline
                data={values} w={310} h={104}
                color="var(--accent-solid)"
                fillFrom="var(--accent-solid)"
                fillTo="var(--accent-solid)"
                dot={false}
              />
            </div>

            <div style={{
              marginTop: 6, paddingTop: 12, borderTop: '1px solid var(--card-border)',
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
            }}>
              <Stat label={t('pwa.low')} value={fmtMoney(row.price.low, currency)}/>
              <Stat label={t('pwa.avg7')} value={fmtMoney(row.price.avg7, currency)}/>
              <Stat label={t('pwa.high30d')} value={fmtMoney(Math.max(...values, row.price.trend), currency)}/>
            </div>
          </div>

          {/* Your copy */}
          <div style={{
            marginTop: 12, padding: 14, borderRadius: 14,
            background: 'var(--card-bg)', border: '1px solid var(--card-border)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 10 }}>
              {t('pwa.yourCopy')}
            </div>
            {row.uc.owner && <DetailRow label={t('pwa.owner')} value={row.uc.owner}/>}
            <DetailRow label={t('pwa.condition')} value={row.uc.condition}/>
            {row.uc.grade && (
              <DetailRow
                label={t('pwa.grade')}
                value={<span style={{ color: 'var(--accent-solid)', fontWeight: 700 }}>
                  {row.uc.grade.service} {row.uc.grade.score}
                </span>}
              />
            )}
            <DetailRow label={t('pwa.quantity')} value={`×${row.uc.quantity}`}/>
            {row.uc.purchasePrice !== undefined && (
              <DetailRow
                label={t('pwa.purchasedFor')}
                value={
                  <span>
                    {fmtMoney(row.uc.purchasePrice, currency)}
                    {row.uc.purchaseDate && (
                      <span style={{ color: 'var(--fg-muted)', fontWeight: 500 }}> · {row.uc.purchaseDate}</span>
                    )}
                  </span>
                }
              />
            )}
            <DetailRow
              last
              label={t('pwa.pnl')}
              value={
                <span style={{ color: row.pnl >= 0 ? 'var(--up)' : 'var(--down)', fontWeight: 700 }}>
                  {fmtMoneySigned(row.pnl, currency)} ({fmtPct(row.pnlPct)})
                </span>
              }
            />
          </div>
        </div>

        {/* Bottom action bar */}
        <div style={{
          display: 'flex', gap: 8, padding: '12px 16px',
          paddingBottom: 'max(env(safe-area-inset-bottom), 16px)',
          borderTop: '1px solid var(--card-border)',
          background: 'var(--bg)', flexShrink: 0,
        }}>
          <GhostButton onClick={() => onEdit(row)} full>
            <Icons.Edit size={15}/>{t('pwa.edit')}
          </GhostButton>
          <GhostButton onClick={() => onDelete(row.uc.id)} full style={{ color: 'var(--down)' }}>
            <Icons.Trash size={15}/>{t('pwa.delete')}
          </GhostButton>
          <GhostButton onClick={onClose} style={{ minWidth: 48, padding: '13px 14px' }}>
            <Icons.Close size={16}/>
          </GhostButton>
        </div>
      </div>
    </div>
  );
}

const navBtnStyle = (disabled: boolean): React.CSSProperties => ({
  width: 32, height: 32, borderRadius: 999,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--pill-bg)', color: disabled ? 'var(--card-border)' : 'var(--fg)',
  border: 'none', cursor: disabled ? 'default' : 'pointer', padding: 0,
});

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)', marginTop: 2 }}>{value}</div>
    </div>
  );
}

function DetailRow({ label, value, last }: { label: string; value: React.ReactNode; last?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 0',
      borderBottom: last ? 'none' : '1px solid var(--card-border)',
      fontSize: 13,
    }}>
      <span style={{ color: 'var(--fg-muted)' }}>{label}</span>
      <span style={{ color: 'var(--fg)', fontWeight: 600 }}>{value}</span>
    </div>
  );
}
