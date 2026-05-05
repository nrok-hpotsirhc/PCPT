// PWA Scan screen — camera viewfinder with card detection phases
// Wraps the existing OcrScanner logic with the new UIUX design

import { useState, useRef, useEffect, useCallback } from 'react';
import { Icons } from './icons';
import { PwaCard, CardThumb, GradientButton, GhostButton } from './ui';
import { fmtMoney, getCardPrice } from './utils';
import type { TranslationFn } from './types';
import type { Card } from '@/lib/types';

type Phase = 'permission' | 'viewfinder' | 'matching' | 'review';

interface ScanProps {
  cards: Card[];
  currency: string;
  t: TranslationFn;
  onCardDetected: (card: Card) => void;
  onManual: () => void;
}

export function PwaScan({ cards, currency, t, onCardDetected, onManual }: ScanProps) {
  const [phase, setPhase]     = useState<Phase>('permission');
  const [match, setMatch]     = useState<{ card: Card; confidence: number } | null>(null);
  const [flash, setFlash]     = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const videoRef   = useRef<HTMLVideoElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  async function enableCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPhase('viewfinder');
    } catch {
      setError(t('pwa.cameraPermBody'));
    }
  }

  async function capture() {
    if (phase !== 'viewfinder') return;
    setPhase('matching');

    try {
      // Draw frame to canvas for OCR
      const video  = videoRef.current!;
      const canvas = canvasRef.current!;
      canvas.width  = video.videoWidth  || 640;
      canvas.height = video.videoHeight || 480;
      canvas.getContext('2d')?.drawImage(video, 0, 0);

      // Load Tesseract lazily
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      const { data: { text } } = await worker.recognize(canvas);
      await worker.terminate();

      const matched = findBestMatch(text, cards);
      if (matched) {
        setMatch({ card: matched, confidence: 0.85 });
      } else {
        setMatch(null);
      }
    } catch {
      setMatch(null);
    }

    setPhase('review');
  }

  function findBestMatch(ocrText: string, cards: Card[]): Card | null {
    const lines = ocrText.toLowerCase().split('\n').map(l => l.trim()).filter(Boolean);
    let bestCard: Card | null = null;
    let bestScore = 0;
    for (const card of cards) {
      const name = card.name.toLowerCase();
      const score = lines.reduce((s, line) => s + (line.includes(name) ? 1 : 0), 0);
      if (score > bestScore) { bestScore = score; bestCard = card; }
    }
    return bestScore > 0 ? bestCard : null;
  }

  function retry() {
    setPhase('viewfinder');
    setMatch(null);
  }

  // ── PERMISSION GATE ────────────────────────────────────────────────────────

  if (phase === 'permission') {
    return (
      <div style={{ height: '100%', background: 'var(--bg)', color: 'var(--fg)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 28px', textAlign: 'center' }}>
          <div style={{
            width: 88, height: 88, borderRadius: 26,
            background: 'var(--accent-grad)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', marginBottom: 22,
            boxShadow: '0 18px 40px var(--accent-shadow)',
          }}>
            <Icons.Scan size={38} stroke={2.2}/>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3, marginBottom: 8 }}>
            {t('pwa.cameraPermTitle')}
          </div>
          <div style={{ fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.55, maxWidth: 280 }}>
            {t('pwa.cameraPermBody')}
          </div>
          {error && (
            <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.12)', color: 'var(--down)', fontSize: 12 }}>
              <Icons.AlertTriangle size={14} style={{ marginRight: 6 }}/>{error}
            </div>
          )}
        </div>
        <div style={{ padding: '0 18px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <GradientButton full onClick={enableCamera}>
            <Icons.Scan size={16}/>{t('pwa.enableCamera')}
          </GradientButton>
          <button onClick={onManual} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--fg-muted)', fontSize: 13, fontWeight: 600, padding: '10px 0',
          }}>{t('pwa.cantScan')}</button>
        </div>
      </div>
    );
  }

  // ── REVIEW ────────────────────────────────────────────────────────────────

  if (phase === 'review') {
    return (
      <div style={{ height: '100%', background: 'var(--bg)', overflow: 'auto' }}>
        <div style={{ padding: '60px 16px 24px' }}>
          {match ? (
            <ReviewMatch
              match={match} currency={currency} t={t}
              onAccept={() => { stopCamera(); onCardDetected(match.card); }}
              onRetry={retry}
            />
          ) : (
            <PwaCard padding={20} style={{ textAlign: 'center' }}>
              <Icons.AlertTriangle size={32} style={{ color: 'var(--down)', marginBottom: 12 }}/>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)', marginBottom: 8 }}>No match found</div>
              <div style={{ fontSize: 13, color: 'var(--fg-muted)', marginBottom: 16 }}>Try again with a clearer image</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <GhostButton onClick={retry} full><Icons.RotateCw size={15}/>{t('pwa.retry')}</GhostButton>
                <GhostButton onClick={onManual} full><Icons.Search size={15}/>{t('pwa.cantScan')}</GhostButton>
              </div>
            </PwaCard>
          )}
        </div>
      </div>
    );
  }

  // ── CAMERA VIEWFINDER ─────────────────────────────────────────────────────

  return (
    <div style={{ height: '100%', position: 'relative', overflow: 'hidden', background: '#000' }}>
      {/* Live camera feed */}
      <video
        ref={videoRef}
        playsInline
        muted
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <canvas ref={canvasRef} style={{ display: 'none' }}/>

      {/* Top gradient */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 100,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)',
        pointerEvents: 'none', zIndex: 2,
      }}/>

      {/* Hint pill */}
      <div style={{ position: 'absolute', top: 18, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 3 }}>
        <div style={{
          padding: '7px 14px', borderRadius: 999,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
          fontSize: 12, fontWeight: 600, color: 'white',
          border: '1px solid rgba(255,255,255,0.12)',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: 999,
            background: phase === 'matching' ? 'var(--accent-solid)' : '#22c55e',
            boxShadow: phase === 'matching' ? '0 0 8px var(--accent-solid)' : '0 0 6px #22c55e',
          }} className={phase === 'matching' ? 'pulse-dot' : ''}/>
          {phase === 'matching' ? t('pwa.holdSteady') : t('pwa.alignCard')}
        </div>
      </div>

      {/* Card-shaped scan target */}
      <ScanTarget matching={phase === 'matching'}/>

      {/* Bottom gradient */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 220,
        background: 'linear-gradient(to top, rgba(0,0,0,0.78), transparent)',
        pointerEvents: 'none', zIndex: 2,
      }}/>

      {/* Controls */}
      <div style={{
        position: 'absolute', bottom: 110, left: 0, right: 0, zIndex: 5,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px',
      }}>
        <CamRound active={flash} onClick={() => setFlash(f => !f)} label={t('pwa.flash')}>
          <Icons.Flash size={20}/>
        </CamRound>

        {/* Shutter */}
        <button
          onClick={capture}
          disabled={phase === 'matching'}
          aria-label={t('pwa.capture')}
          style={{
            width: 78, height: 78, borderRadius: 999,
            background: 'transparent',
            border: '4px solid rgba(255,255,255,0.95)',
            cursor: phase === 'matching' ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
          }}
        >
          <div style={{
            width: 60, height: 60, borderRadius: 999,
            background: phase === 'matching' ? 'var(--accent-solid)' : 'white',
            boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
            transition: 'all 0.2s',
          }}/>
        </button>

        <CamRound onClick={onManual} label={t('pwa.help')}>
          <Icons.Search size={20}/>
        </CamRound>
      </div>

      {/* Manual hint */}
      <div style={{ position: 'absolute', bottom: 200, left: 0, right: 0, textAlign: 'center', zIndex: 5 }}>
        <button onClick={onManual} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 500, padding: '4px 12px',
        }}>{t('pwa.cantScan')}</button>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function CamRound({ children, onClick, active, label }: { children: React.ReactNode; onClick: () => void; active?: boolean; label: string }) {
  return (
    <button onClick={onClick} aria-label={label} style={{
      width: 48, height: 48, borderRadius: 999,
      background: active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.14)',
      backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      border: '1px solid rgba(255,255,255,0.18)',
      color: active ? '#111' : 'white',
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{children}</button>
  );
}

function ScanTarget({ matching }: { matching: boolean }) {
  return (
    <div style={{
      position: 'absolute', left: '50%', top: '38%',
      transform: 'translate(-50%, -50%)',
      width: '64%', aspectRatio: '0.71 / 1', zIndex: 3, pointerEvents: 'none',
    }}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 14,
        border: matching ? '2px solid var(--accent-solid)' : '1px solid rgba(255,255,255,0.18)',
        boxShadow: matching ? '0 0 24px var(--accent-shadow)' : 'none',
        transition: 'all 0.2s',
      }}/>
      <Corner pos="tl"/><Corner pos="tr"/><Corner pos="bl"/><Corner pos="br"/>
      {matching && (
        <div className="scanline" style={{
          position: 'absolute', left: 6, right: 6, top: 6, height: 2, borderRadius: 999,
          background: 'linear-gradient(to right, transparent, var(--accent-solid), transparent)',
          boxShadow: '0 0 14px var(--accent-solid)',
        }}/>
      )}
    </div>
  );
}

function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const len = 26, thickness = 3, off = -1;
  const base: React.CSSProperties = { position: 'absolute', width: len, height: len, borderColor: 'white', borderStyle: 'solid', borderRadius: 4 };
  const styles: Record<string, React.CSSProperties> = {
    tl: { ...base, top: off, left: off,   borderWidth: `${thickness}px 0 0 ${thickness}px` },
    tr: { ...base, top: off, right: off,  borderWidth: `${thickness}px ${thickness}px 0 0` },
    bl: { ...base, bottom: off, left: off,  borderWidth: `0 0 ${thickness}px ${thickness}px` },
    br: { ...base, bottom: off, right: off, borderWidth: `0 ${thickness}px ${thickness}px 0` },
  };
  return <div style={styles[pos]}/>;
}

function ReviewMatch({ match, currency, t, onAccept, onRetry }: {
  match: { card: Card; confidence: number };
  currency: string;
  t: TranslationFn;
  onAccept: () => void;
  onRetry: () => void;
}) {
  const conf = Math.round(match.confidence * 100);
  const confColor = conf >= 80 ? 'var(--up)' : conf >= 60 ? '#FB923C' : 'var(--down)';
  const price = getCardPrice(match.card);
  return (
    <PwaCard padding={16}>
      <div style={{ display: 'flex', gap: 14 }}>
        <CardThumb img={match.card.images.small} name={match.card.name} w={72} radius={7} glow/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-solid)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            {t('pwa.matchFound')}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{match.card.name}</div>
          <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2 }}>
            {match.card.set.name} · {match.card.set.ptcgoCode ?? match.card.set.id} {match.card.number}
          </div>
          {price !== null && (
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)', marginTop: 4 }}>
              {fmtMoney(price, currency)}
            </div>
          )}
        </div>
      </div>

      {/* Confidence bar */}
      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', marginBottom: 6 }}>
          <span>{t('pwa.confidence')}</span>
          <span style={{ color: confColor, fontWeight: 700 }}>{conf}%</span>
        </div>
        <div style={{ height: 6, background: 'var(--pill-bg)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${conf}%`, background: confColor, borderRadius: 999 }}/>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <GhostButton onClick={onRetry} full><Icons.RotateCw size={15}/>{t('pwa.retry')}</GhostButton>
        <GradientButton onClick={onAccept} full><Icons.Check size={16}/>{t('pwa.useMatch')}</GradientButton>
      </div>
    </PwaCard>
  );
}
