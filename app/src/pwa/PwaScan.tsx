// PWA Scan screen - document-scanner style card detection

import { useState, useRef, useEffect, useCallback } from 'react';
import { Icons } from './icons';
import { CardThumb, GhostButton, GradientButton } from './ui';
import { fmtMoney, getCardPrice } from './utils';
import { searchCardsApi } from '@/lib/pokemon-api';
import type { TranslationFn } from './types';
import type { Card } from '@/lib/types';

type Phase = 'permission' | 'viewfinder' | 'analyzing' | 'review';
type RoiStatus = 'pending' | 'active' | 'ok' | 'fail';

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
  const [capturedFrame, setCapturedFrame] = useState<string | null>(null);
  const [cardGuideRect, setCardGuideRect] = useState<DOMRect | null>(null);
  const [roiStatuses, setRoiStatuses] = useState<Record<string, RoiStatus>>({});
  const [analysisMsg, setAnalysisMsg] = useState('');
  const [cardDetected, setCardDetected] = useState(false);

  const videoRef       = useRef<HTMLVideoElement>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const phaseRef       = useRef<Phase>('permission');
  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const detectRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingStreamRef = useRef<MediaStream | null>(null);
  const cardGuideRef   = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workerRef      = useRef<any>(null);
  const isBusyRef      = useRef(false);
  const presenceCountRef = useRef(0);

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Attach (or re-attach) stream whenever the viewfinder becomes active.
  // pendingStreamRef holds a fresh stream (first open); streamRef holds the running stream
  // (returned from analyzing back to viewfinder — video element was unmounted so we re-attach).
  useEffect(() => {
    if (phase !== 'viewfinder') return;
    const video = videoRef.current;
    if (!video) return;
    const stream = pendingStreamRef.current ?? streamRef.current;
    if (!stream) return;
    pendingStreamRef.current = null;
    // Only re-attach if the video element doesn't already have this stream
    if (video.srcObject !== stream) {
      video.srcObject = stream;
      video.setAttribute('autoplay', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.playsInline = true;
      video.muted = true;
    }
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
    if (detectRef.current)  { clearInterval(detectRef.current);  detectRef.current  = null; }
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

  /**
   * Convert the card guide element's screen rect → video pixel crop box.
   * The video is displayed with objectFit:cover so we must account for scaling + offset.
   */
  function guideToVideoBox(
    guideEl: HTMLElement | null,
    vw: number, vh: number,
  ): { boxX: number; boxY: number; boxW: number; boxH: number } {
    if (guideEl) {
      const gr = guideEl.getBoundingClientRect();
      const sw = window.innerWidth  || document.documentElement.clientWidth;
      const sh = window.innerHeight || document.documentElement.clientHeight;
      // objectFit:cover scale: how many screen px per video px
      const coverScale = Math.max(sw / vw, sh / vh);
      // Top-left of video in screen coords (negative = video extends beyond screen)
      const vOffX = (sw - vw * coverScale) / 2;
      const vOffY = (sh - vh * coverScale) / 2;
      const bx = Math.max(0, Math.round((gr.left   - vOffX) / coverScale));
      const by = Math.max(0, Math.round((gr.top    - vOffY) / coverScale));
      const bw = Math.min(vw - bx, Math.round(gr.width  / coverScale));
      const bh = Math.min(vh - by, Math.round(gr.height / coverScale));
      if (bw > 10 && bh > 10) return { boxX: bx, boxY: by, boxW: bw, boxH: bh };
    }
    // Fallback (should rarely hit): centre 64% of video width, card ratio
    const bw = Math.round(vw * 0.64);
    const bh = Math.round(bw / 0.71);
    return {
      boxX: Math.round((vw - bw) / 2),
      boxY: Math.max(0, Math.round(vh * 0.38 - bh / 2)),
      boxW: bw, boxH: bh,
    };
  }

  function startAutoScan() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (detectRef.current)  clearInterval(detectRef.current);
    presenceCountRef.current = 0;

    // Fast presence check every 900 ms — only triggers full OCR when card is stable
    detectRef.current = setInterval(() => {
      if (phaseRef.current !== 'viewfinder' || isBusyRef.current) return;
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.videoWidth === 0) return;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      canvas.width  = vw;
      canvas.height = vh;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);
      // Use the actual guide element to get the correct crop box in video pixel space
      const { boxX, boxY, boxW, boxH } = guideToVideoBox(cardGuideRef.current, vw, vh);
      const present = detectCardPresence(ctx, boxX, boxY, boxW, boxH);
      if (present) {
        presenceCountRef.current++;
        setCardDetected(true);
        if (presenceCountRef.current >= 2) {
          presenceCountRef.current = 0;
          void runScan();
        }
      } else {
        presenceCountRef.current = 0;
        setCardDetected(false);
      }
    }, 900);
  }

  // ── Card presence detection (pixel variance in center of card box) ──────────
  function detectCardPresence(
    ctx: CanvasRenderingContext2D,
    boxX: number, boxY: number, boxW: number, boxH: number
  ): boolean {
    const sw = Math.max(1, Math.round(boxW * 0.5));
    const sh = Math.max(1, Math.round(boxH * 0.35));
    const sx = Math.round(boxX + boxW * 0.25);
    const sy = Math.round(boxY + boxH * 0.3);
    try {
      const { data } = ctx.getImageData(sx, sy, sw, sh);
      let sum = 0, sumSq = 0;
      const n = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        const gray = (data[i]! + data[i + 1]! + data[i + 2]!) / 3;
        sum += gray; sumSq += gray * gray;
      }
      const mean = sum / n;
      const variance = sumSq / n - mean * mean;
      return variance > 350; // blank wall ~< 100, card > 400
    } catch { return false; }
  }

  // ── Rotate a canvas 90 / 180 / 270 degrees ────────────────────────────────
  function rotateCanvas(src: HTMLCanvasElement, deg: 90 | 180 | 270): HTMLCanvasElement {
    const isOdd = deg === 90 || deg === 270;
    const out = document.createElement('canvas');
    out.width  = isOdd ? src.height : src.width;
    out.height = isOdd ? src.width  : src.height;
    const ctx = out.getContext('2d');
    if (!ctx) return src;
    ctx.translate(out.width / 2, out.height / 2);
    ctx.rotate((deg * Math.PI) / 180);
    ctx.drawImage(src, -src.width / 2, -src.height / 2);
    return out;
  }

  // ── Crop a sub-region from an existing canvas ─────────────────────────────
  function cropFrom(src: HTMLCanvasElement, rx: number, ry: number, rw: number, rh: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width  = Math.max(1, Math.round(rw));
    c.height = Math.max(1, Math.round(rh));
    c.getContext('2d')?.drawImage(src, rx, ry, rw, rh, 0, 0, c.width, c.height);
    return c;
  }

  // ── Image preprocessing (scale 3x + grayscale + contrast) ──────────────────
  function preprocessForOcr(src: HTMLCanvasElement, scale = 3): HTMLCanvasElement {
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

    try {
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) throw new Error('no refs');

      const vw = video.videoWidth  || 640;
      const vh = video.videoHeight || 480;
      canvas.width  = vw;
      canvas.height = vh;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no ctx');
      ctx.drawImage(video, 0, 0);

      // Capture guide rect BEFORE switching phase (while guide div is still in DOM)
      const guideRect = cardGuideRef.current?.getBoundingClientRect() ?? null;

      // Capture frozen frame for analysis view
      const frameUrl = canvas.toDataURL('image/jpeg', 0.88);
      setCapturedFrame(frameUrl);
      setCardGuideRect(guideRect);
      setScanCount(c => c + 1);
      setRoiStatuses({ number: 'pending', name: 'pending' });
      setAnalysisMsg('Starte Analyse…');
      setPhase('analyzing');

      // Convert guide screen rect → video pixel crop box (objectFit:cover transform)
      const { boxX, boxY, boxW, boxH } = guideToVideoBox(cardGuideRef.current, vw, vh);

      // Crop just the card area from the full video frame
      const cardCanvas = cropFrom(canvas, boxX, boxY, boxW, boxH);

      // Orientations to try: portrait (0°), landscape-CW (90°), landscape-CCW (270°)
      // Each rotation transforms the card so the "bottom" of the card is always at the canvas bottom.
      const orientations: HTMLCanvasElement[] = [
        cardCanvas,
        rotateCanvas(cardCanvas, 90),
        rotateCanvas(cardCanvas, 270),
        rotateCanvas(cardCanvas, 180),
      ];

      const worker = await getWorker();
      let results: Card[] = [];
      let searchTerm = '';

      // ── Strategy 1: number in full-width bottom strip, all orientations ─────────
      // The card number (NNN/NNN) appears at the bottom of the card on EVERY Pokémon card.
      // We scan the full width so left-side OR right-side positions are both covered.
      setRoiStatuses(s => ({ ...s, number: 'active' }));
      setAnalysisMsg('Suche Kartennummer…');

      for (const oriented of orientations) {
        if (results.length > 0) break;
        const stripH = Math.round(oriented.height * 0.30); // bottom 30%
        const strip = preprocessForOcr(cropFrom(oriented, 0, oriented.height - stripH, oriented.width, stripH), 3);
        await worker.setParameters({
          tessedit_pageseg_mode: '6', // sparse text block — handles multi-item strip
          tessedit_char_whitelist: '0123456789/\\|ABCDEFGHIJKLMNOPQRSTUVWXYZ- ',
        });
        const r = await worker.recognize(strip);
        await worker.setParameters({ tessedit_char_whitelist: '' });
        const cardNum = parseCardNumber(r.data.text);
        if (cardNum) {
          const apiR = await searchCardsApi(cardNum, 12);
          if (apiR.cards.length > 0) {
            results = apiR.cards;
            searchTerm = cardNum;
            setRoiStatuses(s => ({ ...s, number: 'ok' }));
          }
        }
      }
      if (results.length === 0) setRoiStatuses(s => ({ ...s, number: 'fail' }));

      // ── Strategy 2: name in full-width top strip, all orientations ──────────────
      if (results.length === 0) {
        setRoiStatuses(s => ({ ...s, name: 'active' }));
        setAnalysisMsg('Suche Kartenname…');

        for (const oriented of orientations) {
          if (results.length > 0) break;
          const nameH = Math.round(oriented.height * 0.22); // top 22%
          const nameStrip = preprocessForOcr(cropFrom(oriented, 0, 0, oriented.width, nameH), 3);
          await worker.setParameters({ tessedit_pageseg_mode: '7' });
          const r = await worker.recognize(nameStrip);
          const name = extractNameFromOcr(r.data.text);
          if (name && name.length >= 3) {
            const apiR = await searchCardsApi(name, 12);
            if (apiR.cards.length > 0) {
              results = apiR.cards;
              searchTerm = name;
              setRoiStatuses(s => ({ ...s, name: 'ok' }));
            }
          }
        }
        if (results.length === 0) setRoiStatuses(s => ({ ...s, name: 'fail' }));
      }

      isBusyRef.current = false;

      if (results.length === 0) {
        setAnalysisMsg('Nichts gefunden – nochmal versuchen');
        await new Promise(r => setTimeout(r, 900));
        presenceCountRef.current = 0;
        setCardDetected(false);
        setPhase('viewfinder');
        return;
      }

      setDetectedName(searchTerm);
      setSearchResults(results);
      setPhase('review');
    } catch {
      isBusyRef.current = false;
      presenceCountRef.current = 0;
      setPhase('viewfinder');
    }
  }

  function retry() {
    setSearchResults([]);
    setDetectedName('');
    setCapturedFrame(null);
    setCardGuideRect(null);
    presenceCountRef.current = 0;
    isBusyRef.current = false;
    setCardDetected(false);
    // Clear detection interval — the viewfinder useEffect will re-attach stream + call startAutoScan
    if (detectRef.current) { clearInterval(detectRef.current); detectRef.current = null; }
    setPhase('viewfinder');
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

  // ─── PERMISSION GATE ──────────────────────────────────────────────────────

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
            Karte in Rahmen halten – wird automatisch erkannt
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

  // ─── ANALYZING ────────────────────────────────────────────────────────────────

  if (phase === 'analyzing' && capturedFrame) {
    const gr = cardGuideRect;
    // ROI boxes: full-width strips matching the actual scan regions
    const roiDefs: { id: string; label: string; style: React.CSSProperties }[] = gr ? [
      {
        id: 'number',
        label: 'Kartennummer (volle Breite)',
        style: {
          left:   gr.left,
          top:    gr.top  + gr.height * 0.70,  // bottom 30% of card
          width:  gr.width,
          height: gr.height * 0.30,
        },
      },
      {
        id: 'name',
        label: 'Kartenname',
        style: {
          left:   gr.left,
          top:    gr.top,
          width:  gr.width,
          height: gr.height * 0.22,             // top 22% of card
        },
      },
    ] : [];

    return (
      <div style={{ height: '100%', position: 'relative', overflow: 'hidden', background: '#000' }}>
        {/* Frozen frame */}
        <img
          src={capturedFrame}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
        {/* Dark overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.42)', zIndex: 1 }}/>

        {/* ROI highlight boxes */}
        {roiDefs.map(({ id, label, style }) => {
          const st = roiStatuses[id] ?? 'pending';
          const color = st === 'active' ? '#60a5fa'
            : st === 'ok'   ? '#22c55e'
            : st === 'fail' ? '#ef4444'
            : 'rgba(255,255,255,0.22)';
          const glow = st === 'active' ? `0 0 20px ${color}66, 0 0 6px ${color}` : 'none';
          return (
            <div key={id} style={{
              position: 'absolute', zIndex: 3,
              left: style.left as number, top: style.top as number,
              width: style.width as number, height: style.height as number,
              border: `2px solid ${color}`,
              borderRadius: 7,
              boxShadow: glow,
              transition: 'border-color 0.25s, box-shadow 0.25s',
            }}>
              {/* Label badge above the box */}
              <div style={{
                position: 'absolute', bottom: '100%', left: 0, marginBottom: 5,
                background: color, color: '#000',
                fontSize: 10, fontWeight: 800,
                padding: '2px 8px', borderRadius: 5, whiteSpace: 'nowrap',
                opacity: st === 'pending' ? 0.45 : 1,
                transition: 'opacity 0.2s, background 0.25s',
              }}>
                {st === 'active' ? '⏳ ' : st === 'ok' ? '✓ ' : st === 'fail' ? '✗ ' : ''}{label}
              </div>
              {/* Active pulse fill */}
              {st === 'active' && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: `${color}22`,
                  borderRadius: 5,
                  animation: 'pulse-bg 1s ease-in-out infinite',
                }}/>
              )}
            </div>
          );
        })}

        {/* Status pill */}
        <div style={{
          position: 'absolute', bottom: 88, left: 0, right: 0, zIndex: 5,
          display: 'flex', justifyContent: 'center',
        }}>
          <div style={{
            padding: '10px 20px', borderRadius: 999,
            background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            fontSize: 13, fontWeight: 700, color: 'white',
            border: '1px solid rgba(255,255,255,0.14)',
            display: 'inline-flex', alignItems: 'center', gap: 9,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: 999,
              background: 'var(--accent-solid)',
              boxShadow: '0 0 8px var(--accent-solid)',
              display: 'inline-block',
              flexShrink: 0,
            }} className="pulse-dot"/>
            {analysisMsg}
          </div>
        </div>

        {/* Cancel button */}
        <button
          onClick={retry}
          style={{
            position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)', zIndex: 5,
            padding: '10px 24px', borderRadius: 999,
            background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Abbrechen
        </button>
      </div>
    );
  }

  // ─── REVIEW ───────────────────────────────────────────────────────────────────

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

  // ─── CAMERA VIEWFINDER ────────────────────────────────────────────────────────

  return (
    <div style={{ height: '100%', position: 'relative', overflow: 'hidden', background: '#000' }}>
      {/* Live camera feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <canvas ref={canvasRef} style={{ display: 'none' }}/>

      {/* Document-scanner spotlight: huge box-shadow darkens everything outside the card guide */}
      <div
        ref={cardGuideRef}
        style={{
          position: 'absolute', left: '50%', top: '38%',
          transform: 'translate(-50%, -50%)',
          width: '72%',
          aspectRatio: '0.71 / 1',
          zIndex: 3, pointerEvents: 'none',
          borderRadius: 16,
          boxShadow: cardDetected
            ? '0 0 0 9999px rgba(0,0,0,0.68), 0 0 0 3px #22c55e, 0 0 28px 4px rgba(34,197,94,0.55)'
            : '0 0 0 9999px rgba(0,0,0,0.68), 0 0 0 2px rgba(255,255,255,0.72)',
          transition: 'box-shadow 0.25s',
        }}
      >
        {/* Corner brackets */}
        <ScanCorner pos="tl" active={cardDetected}/>
        <ScanCorner pos="tr" active={cardDetected}/>
        <ScanCorner pos="bl" active={cardDetected}/>
        <ScanCorner pos="br" active={cardDetected}/>

        {/* Scanline when card detected */}
        {cardDetected && (
          <div className="scanline" style={{
            position: 'absolute', left: 8, right: 8, top: 6, height: 2, borderRadius: 999,
            background: 'linear-gradient(to right, transparent, #22c55e, transparent)',
            boxShadow: '0 0 14px #22c55e',
          }}/>
        )}

        {/* Hint text */}
        <div style={{
          position: 'absolute', bottom: -38, left: 0, right: 0,
          textAlign: 'center', fontSize: 12, fontWeight: 700,
          color: cardDetected ? '#22c55e' : 'rgba(255,255,255,0.72)',
          transition: 'color 0.25s',
        }}>
          {cardDetected ? 'Karte erkannt – analysiere…' : 'Karte hier positionieren'}
        </div>
      </div>

      {/* Status pill */}
      <div style={{ position: 'absolute', top: 18, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 10 }}>
        <div style={{
          padding: '7px 15px', borderRadius: 999,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
          fontSize: 12, fontWeight: 600, color: 'white',
          border: '1px solid rgba(255,255,255,0.12)',
          display: 'inline-flex', alignItems: 'center', gap: 7,
        }}>
          <span key={scanCount} style={{
            width: 7, height: 7, borderRadius: 999, display: 'inline-block', flexShrink: 0,
            background: cardDetected ? '#22c55e' : 'rgba(255,255,255,0.45)',
            boxShadow: cardDetected ? '0 0 7px #22c55e' : 'none',
            transition: 'background 0.25s, box-shadow 0.25s',
          }} className={cardDetected ? 'pulse-dot' : ''}/>
          {cardDetected ? 'Karte erkannt' : 'Warte auf Karte…'}
        </div>
      </div>

      {/* Bottom buttons */}
      <div style={{
        position: 'absolute', bottom: 60, left: 0, right: 0, zIndex: 5,
        display: 'flex', justifyContent: 'center', gap: 10,
      }}>
        <button
          onClick={() => { if (!isBusyRef.current) void runScan(); }}
          style={{
            padding: '12px 26px', borderRadius: 999,
            background: 'var(--accent-grad)', border: 'none',
            color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 7,
            boxShadow: '0 6px 20px var(--accent-shadow)',
          }}>
          <Icons.Scan size={15}/>
          Jetzt scannen
        </button>
        <button onClick={onManual} style={{
          padding: '12px 18px', borderRadius: 999,
          background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid rgba(255,255,255,0.18)',
          color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 7,
        }}>
          <Icons.Search size={15}/>
          Manuell
        </button>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScanCorner({ pos, active }: { pos: 'tl' | 'tr' | 'bl' | 'br'; active: boolean }) {
  const len = 30, thickness = 3, off = -1;
  const color = active ? '#22c55e' : 'white';
  const base: React.CSSProperties = {
    position: 'absolute', width: len, height: len,
    borderColor: color, borderStyle: 'solid', borderRadius: 5,
    transition: 'border-color 0.2s',
  };
  const styles: Record<string, React.CSSProperties> = {
    tl: { ...base, top: off, left: off,     borderWidth: `${thickness}px 0 0 ${thickness}px` },
    tr: { ...base, top: off, right: off,    borderWidth: `${thickness}px ${thickness}px 0 0` },
    bl: { ...base, bottom: off, left: off,  borderWidth: `0 0 ${thickness}px ${thickness}px` },
    br: { ...base, bottom: off, right: off, borderWidth: `0 ${thickness}px ${thickness}px 0` },
  };
  return <div style={styles[pos]}/>;
}
