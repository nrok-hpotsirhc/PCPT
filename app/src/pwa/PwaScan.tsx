// PWA Scan screen â€” live camera feed with auto-detect (no shutter button needed)

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
  const [phase, setPhase]         = useState<Phase>('permission');
  const [match, setMatch]         = useState<{ card: Card; confidence: number } | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [scanCount, setScanCount] = useState(0);

  const videoRef    = useRef<HTMLVideoElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const phaseRef    = useRef<Phase>('permission');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const stopCamera = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    streamRef.current?.getTracks().forEach(tr => tr.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  async function enableCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.play().catch(() => {/* autoPlay handles it */});
      }
      setPhase('viewfinder');
      startAutoScan();
    } catch {
      setError(t('pwa.cameraPermBody'));
    }
  }

  function startAutoScan() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (phaseRef.current === 'viewfinder') void runScan();
    }, 2500);
  }

  async function runScan() {
    if (phaseRef.current !== 'viewfinder') return;
    setPhase('matching');
    setScanCount(c => c + 1);
    try {
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) throw new Error('no refs');
      canvas.width  = video.videoWidth  || 640;
      canvas.height = video.videoHeight || 480;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      const { data: { text } } = await worker.recognize(canvas);
      await worker.terminate();
      const found = findBestMatch(text, cards);
      if (found) {
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        setMatch({ card: found, confidence: 0.85 });
        setPhase('review');
        return;
      }
    } catch { /* silent */ }
    setPhase('viewfinder');
  }

  function findBestMatch(ocrText: string, cardList: Card[]): Card | null {
    const lines = ocrText.toLowerCase().split('\n').map(l => l.trim()).filter(Boolean);
    let bestCard: Card | null = null;
    let bestScore = 0;
    for (const card of cardList) {
      const name  = card.name.toLowerCase();
      const score = lines.reduce((s, line) => s + (line.includes(name) ? 1 : 0), 0);
      if (score > bestScore) { bestScore = score; bestCard = card; }
    }
    return bestScore > 0 ? bestCard : null;
  }

  function retry() {
    setMatch(null);
    setPhase('viewfinder');
    startAutoScan();
  }

  // â”€â”€ PERMISSION GATE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  if (phase === 'permission') {
    return (
      <div style={{ height: '100%', background: 'var(--bg)', color: 'var(--fg)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 28px', textAlign: 'center' }}>
          <div style={{
            width: 88, height: 88, borderRadius: 26, background: 'var(--accent-grad)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', marginBottom: 22, boxShadow: '0 18px 40px var(--accent-shadow)',
          }}>
            <Icons.Scan size={38} stroke={2.2}/>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3, marginBottom: 8 }}>
            {t('pwa.cameraPermTitle')}
          </div>
          <div style={{ fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.55, maxWidth: 280 }}>
            {t('pwa.cameraPermBody')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--accent-solid)', marginTop: 10, fontWeight: 600 }}>
            Wird automatisch erkannt â€” kein Knopf nÃ¶tig
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

  // â”€â”€ REVIEW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg)', marginBottom: 8 }}>Keine Karte erkannt</div>
              <div style={{ fontSize: 13, color: 'var(--fg-muted)', marginBottom: 16 }}>Karte besser ausrichten und nochmal versuchen</div>
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

  // â”€â”€ CAMERA VIEWFINDER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const isScanning = phase === 'matching';

  return (
    <div style={{ height: '100%', position: 'relative', overflow: 'hidden', background: '#000' }}>
      {/* Live camera feed â€” autoPlay + playsInline for iOS */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <canvas ref={canvasRef} style={{ display: 'none' }}/>

      {/* Top gradient */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 120,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.65), transparent)',
        pointerEvents: 'none', zIndex: 2,
      }}/>

      {/* Status pill */}
      <div style={{ position: 'absolute', top: 22, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 3 }}>
        <div style={{
          padding: '8px 16px', borderRadius: 999,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
          fontSize: 12, fontWeight: 600, color: 'white',
          border: '1px solid rgba(255,255,255,0.12)',
          display: 'inline-flex', alignItems: 'center', gap: 7,
        }}>
          <span key={scanCount} style={{
            width: 7, height: 7, borderRadius: 999,
            background: isScanning ? 'var(--accent-solid)' : '#22c55e',
            boxShadow: isScanning ? '0 0 8px var(--accent-solid)' : '0 0 6px #22c55e',
          }} className={isScanning ? 'pulse-dot' : ''}/>
          {isScanning ? 'Erkenne Karteâ€¦' : 'Karte im Rahmen halten'}
        </div>
      </div>

      {/* Scan target */}
      <ScanTarget matching={isScanning}/>

      {/* Bottom gradient */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 180,
        background: 'linear-gradient(to top, rgba(0,0,0,0.78), transparent)',
        pointerEvents: 'none', zIndex: 2,
      }}/>

      {/* Manual search button */}
      <div style={{
        position: 'absolute', bottom: 80, left: 0, right: 0, zIndex: 5,
        display: 'flex', justifyContent: 'center',
      }}>
        <button onClick={onManual} style={{
          padding: '12px 28px', borderRadius: 999,
          background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid rgba(255,255,255,0.18)',
          color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 7,
        }}>
          <Icons.Search size={15}/>
          Manuell suchen
        </button>
      </div>

      {/* Scan progress dots */}
      <div style={{
        position: 'absolute', bottom: 48, left: 0, right: 0, zIndex: 5,
        display: 'flex', justifyContent: 'center', gap: 5,
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 5, height: 5, borderRadius: 999,
            background: isScanning && (scanCount % 3) === i ? 'white' : 'rgba(255,255,255,0.3)',
            transition: 'background 0.3s',
          }}/>
        ))}
      </div>
    </div>
  );
}

// â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ScanTarget({ matching }: { matching: boolean }) {
  return (
    <div style={{
      position: 'absolute', left: '50%', top: '38%',
      transform: 'translate(-50%, -50%)',
      width: '64%', aspectRatio: '0.71 / 1', zIndex: 3, pointerEvents: 'none',
    }}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 14,
        border: matching ? '2px solid var(--accent-solid)' : '2px solid rgba(255,255,255,0.5)',
        boxShadow: matching ? '0 0 24px var(--accent-shadow)' : 'none',
        transition: 'all 0.3s',
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
    tl: { ...base, top: off, left: off,    borderWidth: `${thickness}px 0 0 ${thickness}px` },
    tr: { ...base, top: off, right: off,   borderWidth: `${thickness}px ${thickness}px 0 0` },
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
            {match.card.set.name} Â· {match.card.set.ptcgoCode ?? match.card.set.id} {match.card.number}
          </div>
          {price !== null && (
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)', marginTop: 4 }}>
              {fmtMoney(price, currency)}
            </div>
          )}
        </div>
      </div>

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

