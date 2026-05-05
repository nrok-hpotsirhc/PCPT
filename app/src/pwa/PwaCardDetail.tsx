// PWA Card Detail bottom sheet — price chart, stats, edit/delete

import { useState } from 'react';
import { Icons } from './icons';
import { Pill, Sparkline, CardThumb, IconBtn, GhostButton } from './ui';
import { fmtMoney, fmtMoneySigned, fmtPct, typeToPillTone, type PwaRow } from './utils';
import type { TranslationFn } from './types';

interface CardDetailProps {
  row: PwaRow;
  currency: string;
  t: TranslationFn;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

type Range = '7d' | '30d' | '90d';
const RANGES: Record<Range, number> = { '7d': 7, '30d': 30, '90d': 30 }; // 90d uses same 30 pts but labeled

export function PwaCardDetail({ row, currency, t, onClose, onEdit, onDelete }: CardDetailProps) {
  const [range, setRange] = useState<Range>('30d');

  const days   = RANGES[range];
  const values = row.history.slice(-days - 1);
  const start  = values[0] ?? 0;
  const end    = values[values.length - 1] ?? 0;
  const delta  = end - start;
  const pct    = start > 0 ? (delta / start) * 100 : 0;
  const up     = delta >= 0;
  const pillTone = typeToPillTone(row.card.type);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'flex-end',
        animation: 'fadeIn 0.2s',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', background: 'var(--bg)',
          borderTopLeftRadius: 22, borderTopRightRadius: 22,
          maxHeight: '90%', display: 'flex', flexDirection: 'column',
          animation: 'slideUp 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
          <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--card-border)' }}/>
        </div>

        {/* Close button */}
        <div style={{ position: 'absolute', top: 14, right: 14 }}>
          <IconBtn label="Close" onClick={onClose}><Icons.Close size={16}/></IconBtn>
        </div>

        <div style={{ overflow: 'auto', padding: '8px 18px 24px' }}>
          {/* Header */}
          <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
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
            marginTop: 18, padding: 14, borderRadius: 14,
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

            {/* Range chips */}
            <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
              {(Object.keys(RANGES) as Range[]).map(r => (
                <button key={r} onClick={() => setRange(r)} style={{
                  flex: 1, padding: '6px 0', fontSize: 12, fontWeight: 600,
                  borderRadius: 8, border: '1px solid var(--card-border)',
                  background: range === r ? 'var(--accent-soft)' : 'transparent',
                  color: range === r ? 'var(--accent-solid)' : 'var(--fg-muted)',
                  cursor: 'pointer',
                }}>{r.toUpperCase()}</button>
              ))}
            </div>

            {/* Chart */}
            <div style={{ marginTop: 14, marginLeft: -4, marginRight: -4 }}>
              <Sparkline
                data={values} w={310} h={104}
                color="var(--accent-solid)"
                fillFrom="var(--accent-solid)"
                fillTo="var(--accent-solid)"
                dot={false}
              />
            </div>

            {/* Stats */}
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

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <GhostButton onClick={onEdit} full>
              <Icons.Edit size={15}/>{t('pwa.edit')}
            </GhostButton>
            <GhostButton onClick={onDelete} full style={{ color: 'var(--down)' }}>
              <Icons.Trash size={15}/>{t('pwa.delete')}
            </GhostButton>
          </div>
        </div>
      </div>
    </div>
  );
}

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
