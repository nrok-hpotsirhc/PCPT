// PWA Scan screen - live camera feed with auto-detect (no shutter button needed)

import { useState, useRef, useEffect, useCallback } from 'react';
import { Icons } from './icons';
import { CardThumb, GhostButton, GradientButton } from './ui';
import { fmtMoney, getCardPrice } from './utils';
import { searchCardsApi } from '@/lib/pokemon-api';
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

export function PwaScan({ currency, t, onCardDetected, onManual }: ScanProps) {
  const [phase, setPhase]             = useState<Phase>('permission');
  const [searchResults, setSearchResults] = useState<Card[]>([]);
  const [detectedName, setDetectedName] = useState('');
  const [error, setError]             = useState<string | null>(null);
  const [scanCount, setScanCount]     = useState(0);

  const videoRef       = useRef<HTMLVideoElement>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const phaseRef       = useRef<Phase>('permission');
  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingStreamRef = useRef<MediaStream | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workerRef      = useRef<any>(null);
  const isBusyRef      = useRef(false);

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Once the video element enters the DOM (phase -> viewfinder), attach the pending stream
  useEffect(() => {
    if (phase !== 'viewfinder') return;
    const stream = pendingStreamRef.current;
    const video  = videoRef.current;
    if (!stream || !video) return;
    pendingStreamRef.current = null;
    video.srcObject = stream;
    video.setAttribute('autoplay', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.playsInline = true;
    video.muted = true;
    void (async () => {
      try {
        await waitForVideoReady(video);
        try { await video.play(); } catch { await new Promise(r => setTimeout(r, 120)); await video.play(); }
        if (video.paused || video.videoWidth === 0) throw new Error('preview unavailable');
        startAutoScan();
      } catch {
        setError(t('pwa.cameraPermBody'));
        setPhase('permission');
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const waitForVideoReady = useCallback(async (video: HTMLVideoElement) => {
    if (video.readyState >= 2 && video.videoWidth > 0) return;
    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error('video metadata failed'));
      };
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error('video metadata timeout'));
      }, 3500);

      const cleanup = () => {
        window.clearTimeout(timeout);
        video.removeEventListener('loadedmetadata', onLoaded);
        video.removeEventListener('error', onError);
      };

      video.addEventListener('loadedmetadata', onLoaded, { once: true });
      video.addEventListener('error', onError, { once: true });
    });
  }, []);

  const stopCamera = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    streamRef.current?.getTracks().forEach(tr => tr.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => {
    stopCamera();
    workerRef.current?.terminate?.().catch(() => {});
    workerRef.current = null;
  }, [stopCamera]);

  async function enableCamera() {
    setError(null);
    try {
      // In iOS PWA standalone mode, getUserMedia may not be on navigator.mediaDevices
      // if the page was not loaded over HTTPS or there's a permissions issue.
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Kamera wird auf diesem Gerät/Browser nicht unterstützt.');
        return;
      }

      // Try progressively simpler constraints – iOS PWA can be picky
      const constraintSets: MediaStreamConstraints[] = [
        { video: { facingMode: { exact: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        { video: { facingMode: 'environment' }, audio: false },
        { video: { facingMode: 'user' }, audio: false },
        { video: true, audio: false },
      ];

      let stream: MediaStream | null = null;
      let lastErr: unknown = null;
      for (const constraints of constraintSets) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          break;
        } catch (e) {
          lastErr = e;
        }
      }

      if (!stream) {
        const msg = lastErr instanceof DOMException && lastErr.name === 'NotAllowedError'
          ? 'Kamerazugriff verweigert. Bitte unter Einstellungen → Safari → Kamera erlauben.'
          : t('pwa.cameraPermBody');
        setError(msg);
        return;
      }

      streamRef.current = stream;
      // Store stream; the useEffect below will attach it once the video element is in DOM
      pendingStreamRef.current = stream;
      setPhase('viewfinder');
      // startAutoScan() is called from the phase-change useEffect after stream is attached
    } catch (e) {
      setError(e instanceof DOMException && e.name === 'NotAllowedError'
        ? 'Kamerazugriff verweigert. Bitte unter Einstellungen → Safari → Kamera erlauben.'
        : t('pwa.cameraPermBody'));
    }
  }

  function startAutoScan() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (phaseRef.current === 'viewfinder') void runScan();
    }, 3500);
  }

  // ── Image preprocessing (scale 4x + grayscale + contrast) ──────────────────
  function preprocessForOcr(src: HTMLCanvasElement, scale = 4): HTMLCanvasElement {
    const out = document.createElement('canvas');
    out.width  = Math.max(1, src.width  * scale);
    out.height = Math.max(1, src.height * scale);
    const ctx = out.getContext('2d');
    if (!ctx) return src;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, out.width, out.height);
    const img = ctx.getImageData(0, 0, out.width, out.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
      const c = Math.min(255, Math.max(0, (gray - 118) * 2.4 + 118));
      d[i] = d[i + 1] = d[i + 2] = c;
    }
    ctx.putImageData(img, 0, 0);
    return out;
  }

  // ── Parse card number from OCR text ────────────────────────────────────────
  // Pokémon cards always print "NNN/NNN" at the bottom; that's the most reliable signal
  function parseCardNumber(text: string): string | null {
    // Standard: 025/198, 12/130, 1/30 etc.
    const m1 = text.match(/\b(\d{1,3})\s*[\/\\|l]\s*\d{2,4}\b/);
    if (m1 && m1[1]) return m1[1].replace(/^0+/, '') || '0';
    // Promo/special: SWSH001, SV001, PR-SW001 etc.
    const m2 = text.match(/\b(SWSH|SV[PEH]?|SM|BW|XY|DP|PL|PR)\s*[-]?\s*(\d{1,4})\b/i);
    if (m2 && m2[1] && m2[2]) return `${m2[1].toUpperCase()}${m2[2]}`;
    return null;
  }

  // ── Get or lazily init the Tesseract worker (singleton) ────────────────────
  async function getWorker() {
    if (!workerRef.current) {
      const { createWorker } = await import('tesseract.js');
      workerRef.current = await createWorker('eng');
    }
    return workerRef.current;
  }

  async function runScan() {
    if (phaseRef.current !== 'viewfinder' || isBusyRef.current) return;
    isBusyRef.current = true;
    setPhase('matching');
    setScanCount(c => c + 1);
    try {
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) throw new Error('no refs');

      const vw = video.videoWidth  || 640;
      const vh = video.videoHeight || 480;
      canvas.width  = vw;
      canvas.height = vh;
      canvas.getContext('2d')?.drawImage(video, 0, 0);

      // Match the ScanTarget visual overlay (width=64%, centered, top at 38%-halfH)
      const boxW = Math.round(vw * 0.64);
      const boxH = Math.round(boxW / 0.71);
      const boxX = Math.round((vw - boxW) / 2);
      const boxY = Math.max(0, Math.round(vh * 0.38 - boxH / 2));

      function cropRegion(rx: number, ry: number, rw: number, rh: number): HTMLCanvasElement {
        const c = document.createElement('canvas');
        c.width  = Math.max(1, Math.round(rw));
        c.height = Math.max(1, Math.round(rh));
        c.getContext('2d')?.drawImage(canvas!, rx, Math.max(0, ry), rw, rh, 0, 0, rw, rh);
        return c;
      }

      // Region A: card name — top 22% of card box (where name text appears)
      const nameRoi = preprocessForOcr(cropRegion(boxX, boxY, boxW, boxH * 0.22));

      // Region B: card number — bottom 15%, right 55% (where "NNN/NNN" is printed)
      const numW = boxW * 0.55;
      const numH = boxH * 0.15;
      const numRoi = preprocessForOcr(cropRegion(boxX + boxW - numW, boxY + boxH - numH, numW, numH));

      const worker = await getWorker();

      // OCR name region (psm=7: single line of text)
      await worker.setParameters({ tessedit_pageseg_mode: '7' });
      const nameResult = await worker.recognize(nameRoi);
      const nameText: string = nameResult.data.text;

      // OCR number region (digits + slash)
      await worker.setParameters({ tessedit_pageseg_mode: '7', tessedit_char_whitelist: '0123456789/\\|ABCDEFGHIJKLMNOPQRSTUVWXYZ- ' });
      const numResult = await worker.recognize(numRoi);
      const numText: string = numResult.data.text;
      // Reset whitelist
      await worker.setParameters({ tessedit_char_whitelist: '' });

      let results: Card[] = [];
      let searchTerm = '';

      // Strategy 1: card number (most reliable — fixed format on every card)
      const cardNum = parseCardNumber(numText);
      if (cardNum) {
        const r = await searchCardsApi(cardNum, 12);
        if (r.cards.length > 0) { results = r.cards; searchTerm = cardNum; }
      }

      // Strategy 2: card name OCR (fallback)
      if (results.length === 0) {
        const name = extractNameFromOcr(nameText);
        if (name && name.length >= 3) {
          const r = await searchCardsApi(name, 12);
          if (r.cards.length > 0) { results = r.cards; searchTerm = name; }
        }
      }

      isBusyRef.current = false;

      if (results.length === 0) { setPhase('viewfinder'); return; }

      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      setDetectedName(searchTerm);
      setSearchResults(results);
      setPhase('review');
    } catch {
      isBusyRef.current = false;
      setPhase('viewfinder');
    }
  }

  function retry() {
    setSearchResults([]);
    setDetectedName('');
    setPhase('viewfinder');
    startAutoScan();
  }

  /** Extract a plausible card name from raw OCR text */
  function extractNameFromOcr(raw: string): string | null {
    const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length >= 2);
    for (const line of lines) {
      const cleaned = line
        .replace(/[|_{}[\]<>~`@#$%^&*()+=\d]/g, ' ')
        .replace(/\b(hp|kp|stage|basic|stufe|basis|evolution|energy)\b/gi, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
      if (cleaned.length < 3) continue;
      const words = cleaned.split(/\s+/).slice(0, 3).join(' ');
      if (words.length >= 3) return words;
    }
    return null;
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
            Wird automatisch erkannt – kein Knopf nötig
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
      <div style={{ height: '100%', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '16px 16px 10px', borderBottom: '1px solid var(--card-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-solid)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Karten gefunden
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)', marginTop: 1 }}>
                "{detectedName}"
              </div>
            </div>
            <GhostButton onClick={retry}>
              <Icons.RotateCw size={14}/> Neu scannen
            </GhostButton>
          </div>
        </div>

        {/* Card list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px 24px' }}>
          {searchResults.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg-muted)' }}>
              <Icons.AlertTriangle size={28} style={{ marginBottom: 10 }}/>
              <div>Keine Karten gefunden</div>
              <button onClick={retry} style={{ marginTop: 12, padding: '10px 20px', borderRadius: 10, background: 'var(--accent-grad)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                Nochmal versuchen
              </button>
            </div>
          ) : searchResults.map(card => {
            const price = getCardPrice(card);
            return (
              <button
                key={card.id}
                onClick={() => { stopCamera(); onCardDetected(card); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                  background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                  borderRadius: 14, padding: '12px 14px', marginBottom: 10,
                  cursor: 'pointer', textAlign: 'left',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                }}
              >
                <CardThumb img={card.images.small} name={card.name} w={48} radius={6} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg)' }}>{card.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>
                    {card.set.name} · {card.number}
                  </div>
                  {price !== null && (
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-solid)', marginTop: 2 }}>
                      {fmtMoney(price, currency)}
                    </div>
                  )}
                </div>
                <Icons.ChevronRight size={16} style={{ color: 'var(--fg-muted)', flexShrink: 0 }}/>
              </button>
            );
          })}
        </div>

        {/* Manual fallback */}
        <div style={{ padding: '0 16px 20px' }}>
          <button onClick={onManual} style={{
            width: '100%', padding: '12px 0', borderRadius: 12,
            background: 'var(--pill-bg)', border: '1px solid var(--card-border)',
            color: 'var(--fg-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            Manuell suchen
          </button>
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
          {isScanning ? 'OCR läuft – bitte warten…' : 'Karte in Rahmen halten · auto oder "Jetzt scannen"'}
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
        position: 'absolute', bottom: 90, left: 0, right: 0, zIndex: 5,
        display: 'flex', justifyContent: 'center', gap: 10,
      }}>
        <button
          onClick={() => { if (!isBusyRef.current) void runScan(); }}
          style={{
            padding: '12px 28px', borderRadius: 999,
            background: 'var(--accent-grad)',
            border: 'none',
            color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 7,
            boxShadow: '0 6px 20px var(--accent-shadow)',
          }}>
          <Icons.Scan size={15}/>
          Jetzt scannen
        </button>
        <button onClick={onManual} style={{
          padding: '12px 20px', borderRadius: 999,
          background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid rgba(255,255,255,0.18)',
          color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 7,
        }}>
          <Icons.Search size={15}/>
          Manuell
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


