// PWA Settings screen — import/export + language/theme preferences

import { useState, useRef } from 'react';
import { Icons } from './icons';
import { PwaCard, TopBar, GradientButton } from './ui';
import { fmtMoney } from './utils';
import type { TranslationFn } from './types';
import type { Card, UserCard } from '@/lib/types';
import type { PwaRow } from './utils';

interface SettingsProps {
  rows: PwaRow[];
  cards: Card[];
  userCards: UserCard[];
  currency: string;
  locale: string;
  t: TranslationFn;
  onImport: (cards: UserCard[]) => void;
  onLocaleToggle: () => void;
  // new
  isDark: boolean;
  onThemeToggle: () => void;
  activeCurrency: string;
  onCurrencyToggle: () => void;
  profileName: string;
  onNameChange: (name: string) => void;
  onReset: () => void;
}

export function PwaSettings({ rows, cards, userCards, currency, locale, t, onImport, onLocaleToggle, isDark, onThemeToggle, activeCurrency, onCurrencyToggle, profileName, onNameChange, onReset }: SettingsProps) {
  const [scrolled, setScrolled] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [importStatus, setImportStatus] = useState<{ success?: string; error?: string } | null>(null);
  const [editName, setEditName] = useState(profileName);
  const [nameDirty, setNameDirty] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalValue = rows.reduce((s, r) => s + r.value, 0);

  async function handleFile(file: File) {
    setImportStatus(null);
    try {
      const XLSX = await import('xlsx');
      const buf  = await file.arrayBuffer();
      const wb   = XLSX.read(buf);
      const firstSheet = wb.SheetNames[0] ?? '';
      const ws   = wb.Sheets[firstSheet];
      const raw  = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws ?? {});

      const imported: UserCard[] = raw.map((row) => ({
        id:            crypto.randomUUID(),
        cardId:        String(row['cardId'] ?? row['Card ID'] ?? ''),
        owner:         String(row['owner'] ?? row['Owner'] ?? ''),
        condition:     String(row['condition'] ?? row['Condition'] ?? 'NM') as UserCard['condition'],
        variant:       String(row['variant'] ?? row['Variant'] ?? 'holofoil') as UserCard['variant'],
        quantity:      Number(row['quantity'] ?? row['Quantity'] ?? 1),
        purchasePrice: row['purchasePrice'] ? Number(row['purchasePrice']) : undefined,
        purchaseDate:  row['purchaseDate'] ? String(row['purchaseDate']) : undefined,
        addedAt:       new Date().toISOString(),
      })).filter(c => c.cardId);

      onImport(imported);
      setImportStatus({ success: `${imported.length} ${t('pwa.cards')} importiert` });
    } catch (err) {
      setImportStatus({ error: String(err) });
    }
  }

  function handleExport() {
    import('xlsx').then(XLSX => {
      const data = userCards.map(uc => {
        const card = cards.find(c => c.id === uc.cardId);
        return {
          cardId:        uc.cardId,
          name:          card?.name ?? '',
          set:           card?.set?.name ?? '',
          number:        card?.number ?? '',
          owner:         uc.owner,
          condition:     uc.condition,
          variant:       uc.variant,
          quantity:      uc.quantity,
          purchasePrice: uc.purchasePrice ?? '',
          purchaseDate:  uc.purchaseDate ?? '',
        };
      });
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Portfolio');
      XLSX.writeFile(wb, 'pokemon-portfolio.xlsx');
    });
  }

  function handleDownloadTemplate() {
    import('xlsx').then(XLSX => {
      const ws = XLSX.utils.json_to_sheet([{
        cardId: 'xy7-54', owner: 'Max', condition: 'NM', variant: 'holofoil',
        quantity: 1, purchasePrice: 5.00, purchaseDate: '2024-01-01',
      }]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Template');
      XLSX.writeFile(wb, 'pokemon-import-template.xlsx');
    });
  }

  return (
    <div
      onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 8)}
      style={{ height: '100%', overflow: 'auto' }}
    >
      <TopBar title={t('pwa.settings')} scrolled={scrolled}/>

      <div style={{ padding: '4px 16px 24px' }}>
        {/* Profile section */}
        <SectionHeader label={t('pwa.profile')}/>
        <PwaCard padding={14} style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'var(--accent-grad)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 800, fontSize: 17, letterSpacing: -0.4,
            }}>{(editName || 'P').charAt(0).toUpperCase()}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)' }}>{editName || 'Pokémon Tracker'}</div>
              <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
                {rows.length} {t('pwa.cards')} · {fmtMoney(totalValue, currency)}
              </div>
            </div>
          </div>
          {/* Name edit */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={editName}
              onChange={(e) => { setEditName(e.target.value); setNameDirty(true); }}
              placeholder={t('pwa.profileName')}
              style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--fg)', fontSize: 13, outline: 'none' }}
            />
            {nameDirty && (
              <button
                onClick={() => { onNameChange(editName); setNameDirty(false); }}
                style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: 'var(--accent-grad)', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >{t('pwa.save')}</button>
            )}
          </div>
          {/* Reset */}
          <div style={{ marginTop: 12, borderTop: '1px solid var(--card-border)', paddingTop: 12 }}>
            {!resetConfirm ? (
              <button onClick={() => setResetConfirm(true)} style={{
                display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                padding: '10px 12px', borderRadius: 10,
                border: '1px solid rgba(248,113,113,0.35)',
                background: 'rgba(248,113,113,0.08)', color: 'var(--down)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                <Icons.Trash size={14}/>{t('pwa.resetProfile')}
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { onReset(); setResetConfirm(false); }} style={{
                  flex: 1, padding: '10px 12px', borderRadius: 10, border: 'none',
                  background: 'var(--down)', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}>{t('pwa.resetConfirm')}</button>
                <button onClick={() => setResetConfirm(false)} style={{
                  padding: '10px 14px', borderRadius: 10, border: '1px solid var(--card-border)',
                  background: 'transparent', color: 'var(--fg-muted)', fontSize: 13, cursor: 'pointer',
                }}>{t('pwa.cancel')}</button>
              </div>
            )}
          </div>
        </PwaCard>

        {/* Import/Export */}
        <SectionHeader label={t('pwa.importExport')}/>
        <PwaCard padding={14} style={{ marginBottom: 16 }}>
          {/* Drag zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault(); setDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--accent-solid)' : 'var(--card-border)'}`,
              borderRadius: 14, padding: '24px 16px',
              textAlign: 'center', cursor: 'pointer',
              background: dragOver ? 'var(--accent-soft)' : 'transparent',
              transition: 'all 0.15s',
              marginBottom: 12,
            }}
          >
            <Icons.Upload size={24} style={{ color: 'var(--accent-solid)', marginBottom: 8 }}/>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)', marginBottom: 4 }}>
              {t('pwa.dropFile')}
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{t('pwa.dropFileHint')}</div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />

          {importStatus?.success && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px', borderRadius: 10, background: 'rgba(34,197,94,0.12)', color: 'var(--up)', fontSize: 13, marginBottom: 10 }}>
              <Icons.Check size={14}/>{importStatus.success}
            </div>
          )}
          {importStatus?.error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.12)', color: 'var(--down)', fontSize: 13, marginBottom: 10 }}>
              <Icons.AlertTriangle size={14}/>{importStatus.error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <GradientButton full onClick={handleExport}>
              <Icons.Download size={16}/>{t('pwa.exportXlsx')}
            </GradientButton>
            <button onClick={handleDownloadTemplate} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '12px 16px', borderRadius: 12,
              background: 'transparent', border: '1px solid var(--card-border)',
              color: 'var(--fg-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              <Icons.FileText size={15}/>{t('pwa.downloadTemplate')}
            </button>
          </div>
        </PwaCard>

        {/* Preferences */}
        <SectionHeader label={t('pwa.preferences')}/>
        <PwaCard padding={0} style={{ overflow: 'hidden' }}>
          {/* Theme */}
          <button onClick={onThemeToggle} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', padding: '14px 16px',
            borderBottom: '1px solid var(--card-border)',
            background: 'transparent', border: 'none', borderTopLeftRadius: 0, borderTopRightRadius: 0,
            cursor: 'pointer', color: 'var(--fg)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-solid)' }}>
                {isDark ? <Icons.Moon size={16}/> : <Icons.Sun size={16}/>}
              </div>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{t('pwa.theme')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--fg-muted)', fontSize: 13 }}>
              <span>{isDark ? t('pwa.dark') : t('pwa.light')}</span>
              <Icons.ChevronRight size={14}/>
            </div>
          </button>

          {/* Currency */}
          <button onClick={onCurrencyToggle} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', padding: '14px 16px',
            borderBottom: '1px solid var(--card-border)',
            background: 'transparent', border: 'none',
            cursor: 'pointer', color: 'var(--fg)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-solid)' }}>
                <Icons.Sliders size={16}/>
              </div>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{t('pwa.currency')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--fg-muted)', fontSize: 13 }}>
              <span>{activeCurrency}</span>
              <Icons.ChevronRight size={14}/>
            </div>
          </button>

          {/* Language */}
          <button onClick={onLocaleToggle} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', padding: '14px 16px',
            borderBottom: '1px solid var(--card-border)',
            background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--fg)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-solid)' }}>
                <Icons.Globe size={16}/>
              </div>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{t('pwa.language')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--fg-muted)', fontSize: 13 }}>
              <span>{locale === 'de' ? '🇩🇪 Deutsch' : '🇺🇸 English'}</span>
              <Icons.ChevronRight size={14}/>
            </div>
          </button>

          {/* Version info */}
          <div style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--pill-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-muted)' }}>
                <Icons.Sparkle size={16}/>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)' }}>PCPT</div>
                <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>Pokémon Card Portfolio Tracker</div>
              </div>
            </div>
          </div>
        </PwaCard>
      </div>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
      color: 'var(--fg-muted)', marginBottom: 10, marginTop: 6,
    }}>{label}</div>
  );
}
