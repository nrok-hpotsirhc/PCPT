// Shared PWA UI primitives — matches the UIUX design exactly

import type { CSSProperties, ReactNode } from 'react';
import { Icons } from './icons';

// ── Pill ──────────────────────────────────────────────────────────────────────

type PillTone =
  | 'default' | 'accent' | 'up' | 'down' | 'warm' | 'fire' | 'water'
  | 'grass' | 'lightning' | 'psychic' | 'darkness' | 'colorless' | 'trainer';

const PILL_TONES: Record<PillTone, { bg: string; color: string }> = {
  default:   { bg: 'var(--pill-bg)',              color: 'var(--pill-fg)' },
  accent:    { bg: 'var(--accent-soft)',           color: 'var(--accent-solid)' },
  up:        { bg: 'rgba(34,197,94,0.16)',         color: 'var(--up)' },
  down:      { bg: 'rgba(239,68,68,0.16)',         color: 'var(--down)' },
  warm:      { bg: 'rgba(251,146,60,0.16)',        color: '#FB923C' },
  fire:      { bg: 'rgba(249,115,22,0.18)',        color: '#F97316' },
  water:     { bg: 'rgba(56,189,248,0.18)',        color: '#0EA5E9' },
  grass:     { bg: 'rgba(34,197,94,0.18)',         color: '#16A34A' },
  lightning: { bg: 'rgba(250,204,21,0.22)',        color: '#CA8A04' },
  psychic:   { bg: 'rgba(168,85,247,0.18)',        color: '#A855F7' },
  darkness:  { bg: 'rgba(71,85,105,0.22)',         color: '#64748B' },
  colorless: { bg: 'rgba(148,163,184,0.18)',       color: '#64748B' },
  trainer:   { bg: 'rgba(236,72,153,0.18)',        color: '#EC4899' },
};

interface PillProps {
  children: ReactNode;
  tone?: PillTone;
  size?: 'sm' | 'md';
  style?: CSSProperties;
}

export function Pill({ children, tone = 'default', size = 'sm', style }: PillProps) {
  const t = PILL_TONES[tone] ?? PILL_TONES.default;
  const padY = size === 'sm' ? 2 : 4;
  const padX = size === 'sm' ? 8 : 10;
  const fs   = size === 'sm' ? 11 : 12;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: `${padY}px ${padX}px`, borderRadius: 999,
      background: t.bg, color: t.color, fontSize: fs, fontWeight: 600,
      letterSpacing: 0.1, whiteSpace: 'nowrap',
      ...style,
    }}>{children}</span>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

interface CardProps {
  children: ReactNode;
  style?: CSSProperties;
  onClick?: () => void;
  padding?: number;
}

export function PwaCard({ children, style, onClick, padding = 16 }: CardProps) {
  return (
    <div onClick={onClick} style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--card-border)',
      borderRadius: 18, padding,
      boxShadow: 'var(--card-shadow)',
      cursor: onClick ? 'pointer' : 'default',
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

interface SparklineProps {
  data: number[];
  w?: number;
  h?: number;
  color?: string;
  fillFrom?: string;
  fillTo?: string;
  dot?: boolean;
}

export function Sparkline({ data, w = 80, h = 28, color, fillFrom, fillTo, dot = true }: SparklineProps) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = w / (data.length - 1);
  const pts = data.map((v, i) => [i * stepX, h - ((v - min) / range) * (h - 4) - 2] as [number, number]);
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const dArea = `${d} L${w} ${h} L0 ${h} Z`;
  const c = color || 'var(--accent-solid)';
  const uid = `sg-${Math.round((data[0] ?? 0) * 100)}-${data.length}`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: h, overflow: 'visible', display: 'block' }}
    >
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={fillFrom || c} stopOpacity="0.32"/>
          <stop offset="1" stopColor={fillTo || c} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={dArea} fill={`url(#${uid})`}/>
      <path d={d} fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      {dot && pts.length > 0 && (() => { const last = pts[pts.length - 1]; return last ? <circle cx={last[0]} cy={last[1]} r="2.5" fill={c}/> : null; })()}
    </svg>
  );
}

// ── CardThumb ─────────────────────────────────────────────────────────────────

interface CardThumbProps {
  img: string;
  name: string;
  w?: number;
  radius?: number;
  glow?: boolean;
}

export function CardThumb({ img, name, w = 44, radius = 6, glow = false }: CardThumbProps) {
  const h = Math.round(w * 1.395);
  return (
    <div style={{
      width: w, height: h, borderRadius: radius,
      background: 'linear-gradient(135deg, #1e1b3a, #0f0b1f)',
      overflow: 'hidden', position: 'relative', flexShrink: 0,
      boxShadow: glow ? '0 8px 24px rgba(124,92,255,0.45)' : '0 2px 6px rgba(0,0,0,0.18)',
    }}>
      <img src={img} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy"/>
    </div>
  );
}

// ── TopBar ────────────────────────────────────────────────────────────────────

interface TopBarProps {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  scrolled?: boolean;
}

export function TopBar({ title, subtitle, leading, trailing, scrolled = false }: TopBarProps) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 20,
      padding: '6px 16px 12px',
      background: scrolled ? 'var(--topbar-scrolled)' : 'transparent',
      backdropFilter: scrolled ? 'blur(18px) saturate(140%)' : 'none',
      WebkitBackdropFilter: scrolled ? 'blur(18px) saturate(140%)' : 'none',
      borderBottom: scrolled ? '1px solid var(--card-border)' : '1px solid transparent',
      transition: 'all 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 36 }}>
        <div style={{ width: 36, display: 'flex', justifyContent: 'flex-start' }}>{leading}</div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 1 }}>{subtitle}</div>}
        </div>
        <div style={{ width: 36, display: 'flex', justifyContent: 'flex-end' }}>{trailing}</div>
      </div>
    </div>
  );
}

// ── IconBtn ───────────────────────────────────────────────────────────────────

interface IconBtnProps {
  children: ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
  label?: string;
}

export function IconBtn({ children, onClick, style, label }: IconBtnProps) {
  return (
    <button onClick={onClick} aria-label={label} style={{
      width: 36, height: 36, borderRadius: 999,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--icon-btn-bg)', color: 'var(--fg)',
      border: '1px solid var(--card-border)',
      cursor: 'pointer', padding: 0, ...style,
    }}>
      {children}
    </button>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--fg-muted)' }}>
      <div style={{
        width: 56, height: 56, margin: '0 auto 16px',
        borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--accent-soft)', color: 'var(--accent-solid)',
      }}>{icon}</div>
      <div style={{ color: 'var(--fg)', fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{title}</div>
      {body && <div style={{ fontSize: 13, lineHeight: 1.5 }}>{body}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

// ── GradientButton ────────────────────────────────────────────────────────────

interface GradBtnProps {
  children: ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
  full?: boolean;
  disabled?: boolean;
}

export function GradientButton({ children, onClick, style, full, disabled }: GradBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: full ? '100%' : undefined,
        padding: '14px 20px', borderRadius: 14,
        background: 'var(--accent-grad)',
        color: 'white', fontSize: 15, fontWeight: 700,
        border: 'none', cursor: disabled ? 'default' : 'pointer',
        boxShadow: '0 8px 24px var(--accent-shadow)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        opacity: disabled ? 0.4 : 1,
        ...style,
      }}
    >{children}</button>
  );
}

// ── GhostButton ───────────────────────────────────────────────────────────────

interface GhostBtnProps {
  children: ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
  full?: boolean;
}

export function GhostButton({ children, onClick, style, full }: GhostBtnProps) {
  return (
    <button onClick={onClick} style={{
      width: full ? '100%' : undefined,
      padding: '13px 16px', borderRadius: 14,
      background: 'var(--ghost-bg)', border: '1px solid var(--card-border)',
      color: 'var(--fg)', fontSize: 14, fontWeight: 600,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      cursor: 'pointer', ...style,
    }}>{children}</button>
  );
}

// ── Section (form sections) ───────────────────────────────────────────────────

interface SectionProps {
  label: string;
  children: ReactNode;
  style?: CSSProperties;
}

export function Section({ label, children, style }: SectionProps) {
  return (
    <div style={{ marginBottom: 14, ...style }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: 0.4,
        textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 6,
      }}>{label}</div>
      {children}
    </div>
  );
}

// ── SectionLabel ──────────────────────────────────────────────────────────────

export function SectionLabel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
      color: 'var(--fg-muted)', marginBottom: 10, marginTop: 6, ...style,
    }}>{children}</div>
  );
}

// ── BottomSheet ───────────────────────────────────────────────────────────────

interface BottomSheetProps {
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function BottomSheet({ onClose, title, children }: BottomSheetProps) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute', inset: 0, zIndex: 80,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', background: 'var(--card-bg)',
          borderTopLeftRadius: 22, borderTopRightRadius: 22,
          padding: '20px 16px 32px',
          animation: 'slideUp 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)',
        }}
      >
        {title && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)' }}>{title}</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)', padding: 4 }}>
              <Icons.Close size={18}/>
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// ── Input style ───────────────────────────────────────────────────────────────

export const inputStyle: CSSProperties = {
  width: '100%', padding: '13px 14px', borderRadius: 12,
  border: '1px solid var(--card-border)', background: 'var(--input-bg)',
  color: 'var(--fg)', fontSize: 14, fontFamily: 'inherit', outline: 'none',
  boxSizing: 'border-box',
};
