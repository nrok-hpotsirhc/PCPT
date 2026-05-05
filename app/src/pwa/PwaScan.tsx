// PWA Scan screen - document-scanner style card detection

import { useState, useRef, useEffect, useCallback } from 'react';
import { Icons } from './icons';
import { CardThumb, GhostButton, GradientButton } from './ui';
import { fmtMoney, getCardPrice } from './utils';
import { searchCardsApi } from '@/lib/pokemon-api';
import type { TranslationFn } from './types';
import type { Card } from '@/lib/types';

// 'analyzing' is gone – we stay in 'viewfinder' and use scanState instead
type Phase     = 'permission' | 'viewfinder' | 'review';
type ScanState = 'idle' | 'scanning' | 'failed';
type RoiId     = 'number' | 'name';
type RoiStatus = 'active' | 'ok' | 'fail';

interface ScanProps {
  cards: Card[];
  currency: string;
  t: TranslationFn;
  onCardDetected: (card: Card) => void;
  onManual: () => void;
}

export function PwaScan({ currency, t, onCardDetected, onManual }: ScanProps) {
  const [phase, setPhase]               = useState<Phase>('permission');
  const [scanState, setScanState]       = useState<ScanState>('idle');
  const [currentRoi, setCurrentRoi]     = useState<{ id: RoiId; status: RoiStatus } | null>(null);
  const [analysisMsg, setAnalysisMsg]   = useState('');
  const [cardDetected, setCardDetected] = useState(false);
  const [searchResults, setSearchResults] = useState<Card[]>([]);
  const [detectedName, setDetectedName] = useState('');
  const [error, setError]               = useState<string | null>(null);
  const [scanCount, setScanCount]       = useState(0);

  const videoRef         = useRef<HTMLVideoElement>(null);
  const streamRef        = useRef<MediaStream | null>(null);
  const canvasRef        = useRef<HTMLCanvasElement>(null);
  const phaseRef         = useRef<Phase>('permission');
  const scanStateRef     = useRef<ScanState>('idle');
  const detectRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingStreamRef = useRef<MediaStream | null>(null);
  const cardGuideRef     = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workerRef        = useRef<any>(null);
  const isBusyRef        = useRef(false);
  const presenceCountRef = useRef(0);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { scanStateRef.current = scanState; }, [scanState]);

  // Attach (or re-attach) stream every time viewfinder becomes active
  useEffect(() => {
    if (phase !== 'viewfinder') return;
    const video = videoRef.current;
    if (!video) return;
    const stream = pendingStreamRef.current ?? streamRef.current;
    if (!stream) return;
    pendingStreamRef.current = null;
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
        startDetection();
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
      const timeout = window.setTimeout(() => { cleanup(); reject(new Error('timeout')); }, 3500);
      const cleanup = () => {
        window.clearTimeout(timeout);
        video.removeEventListener('loadedmetadata', onLoaded);
        video.removeEventListener('error', onErr);
      };
      const onLoaded = () => { cleanup(); resolve(); };
      const onErr    = () => { cleanup(); reject(new Error('error')); };
      video.addEventListener('loadedmetadata', onLoaded, { once: true });
      video.addEventListener('error', onErr, { once: true });
    });
  }, []);

  const stopCamera = useCallback(() => {
    if (detectRef.current) { clearInterval(detectRef.current); detectRef.current = null; }
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
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Kamera wird auf diesem Gerat/Browser nicht unterstuetzt.');
        return;
      }
      const constraintSets: MediaStreamConstraints[] = [
        { video: { facingMode: { exact: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        { video: { facingMode: 'environment' }, audio: false },
        { video: { facingMode: 'user' }, audio: false },
        { video: true, audio: false },
      ];
      let stream: MediaStream | null = null;
      let lastErr: unknown = null;
      for (const c of constraintSets) {
        try { stream = await navigator.mediaDevices.getUserMedia(c); break; }
        catch (e) { lastErr = e; }
      }
      if (!stream) {
        setError(lastErr instanceof DOMException && lastErr.name === 'NotAllowedError'
          ? 'Kamerazugriff verweigert. Bitte unter Einstellungen \u2192 Safari \u2192 Kamera erlauben.'
          : t('pwa.cameraPermBody'));
        return;
      }
      streamRef.current = stream;
      pendingStreamRef.current = stream;
      setPhase('viewfinder');
    } catch (e) {
      setError(e instanceof DOMException && e.name === 'NotAllowedError'
        ? 'Kamerazugriff verweigert. Bitte unter Einstellungen \u2192 Safari \u2192 Kamera erlauben.'
        : t('pwa.cameraPermBody'));
    }
  }

  // ── Coordinate helpers ──────────────────────────────────────────────────────

  /**
   * Convert the card guide div's screen rect to video pixel coords.
   * The video is displayed with objectFit:cover so we account for scale + offset.
   */
  function guideToVideoBox(guideEl: HTMLElement | null, vw: number, vh: number) {
    if (guideEl) {
      const gr = guideEl.getBoundingClientRect();
      const sw = window.innerWidth;
      const sh = window.innerHeight;
      const scale = Math.max(sw / vw, sh / vh);
      const offX  = (sw - vw * scale) / 2;
      const offY  = (sh - vh * scale) / 2;
      const bx = Math.max(0, Math.round((gr.left - offX) / scale));
      const by = Math.max(0, Math.round((gr.top  - offY) / scale));
      const bw = Math.min(vw - bx, Math.round(gr.width  / scale));
      const bh = Math.min(vh - by, Math.round(gr.height / scale));
      if (bw > 20 && bh > 20) return { boxX: bx, boxY: by, boxW: bw, boxH: bh };
    }
    // fallback
    const bw = Math.round(vw * 0.64);
    const bh = Math.round(bw / 0.71);
    return { boxX: Math.round((vw - bw) / 2), boxY: Math.max(0, Math.round(vh * 0.38 - bh / 2)), boxW: bw, boxH: bh };
  }

  // ── Detection loop ──────────────────────────────────────────────────────────

  function startDetection() {
    if (detectRef.current) clearInterval(detectRef.current);
    presenceCountRef.current = 0;
    setScanState('idle');
    setCurrentRoi(null);

    detectRef.current = setInterval(() => {
      if (phaseRef.current !== 'viewfinder' || isBusyRef.current) return;
      if (scanStateRef.current === 'scanning') return;
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
      const { boxX, boxY, boxW, boxH } = guideToVideoBox(cardGuideRef.current, vw, vh);
      if (detectCardPresence(ctx, boxX, boxY, boxW, boxH)) {
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

  function detectCardPresence(ctx: CanvasRenderingContext2D, bx: number, by: number, bw: number, bh: number): boolean {
    const sw = Math.max(1, Math.round(bw * 0.5));
    const sh = Math.max(1, Math.round(bh * 0.35));
    try {
      const { data } = ctx.getImageData(Math.round(bx + bw * 0.25), Math.round(by + bh * 0.3), sw, sh);
      let sum = 0, sumSq = 0;
      const n = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        const g = (data[i]! + data[i + 1]! + data[i + 2]!) / 3;
        sum += g; sumSq += g * g;
      }
      const mean = sum / n;
      return (sumSq / n - mean * mean) > 350;
    } catch { return false; }
  }

  // ── Image helpers ───────────────────────────────────────────────────────────

  function cropFrom(src: HTMLCanvasElement, rx: number, ry: number, rw: number, rh: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width  = Math.max(1, Math.round(rw));
    c.height = Math.max(1, Math.round(rh));
    c.getContext('2d')?.drawImage(src, rx, ry, rw, rh, 0, 0, c.width, c.height);
    return c;
  }

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

  /** Grayscale + contrast boost + upscale for OCR */
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
      // stronger contrast (factor 3) for small text
      const c = Math.min(255, Math.max(0, (gray - 128) * 3.0 + 128));
      d[i] = d[i + 1] = d[i + 2] = c;
    }
    ctx.putImageData(img, 0, 0);
    return out;
  }

  // ── Text parsers ────────────────────────────────────────────────────────────

  function parseCardNumber(text: string): string | null {
    // NNN/NNN format – the slash may be recognised as | or l
    const m1 = text.match(/(\d{1,3})\s*[\/\\|lI]\s*(\d{2,4})/);
    if (m1 && m1[1]) return m1[1].replace(/^0+/, '') || '0';
    // Promo codes
    const m2 = text.match(/\b(SWSH|SV[PEH]?|SM|BW|XY|DP|PL|PR)\s*[-]?\s*(\d{1,4})\b/i);
    if (m2 && m2[1] && m2[2]) return `${m2[1].toUpperCase()}${m2[2]}`;
    return null;
  }

  function extractNameFromOcr(raw: string): string | null {
    const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length >= 2);
    for (const line of lines) {
      const cleaned = line
        .replace(/[|_{}[\]<>~`@#$%^&*()+=\d]/g, ' ')
        .replace(/\b(hp|kp|stage|basic|stufe|basis|evolution|energy|basis-pokemon)\b/gi, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
      if (cleaned.length < 3) continue;
      const words = cleaned.split(/\s+/).slice(0, 2).join(' ');
      if (words.length >= 3) return words;
    }
    return null;
  }

  async function getWorker() {
    if (!workerRef.current) {
      const { createWorker } = await import('tesseract.js');
      workerRef.current = await createWorker('eng');
    }
    return workerRef.current;
  }

  // ── Main scan ───────────────────────────────────────────────────────────────

  async function runScan() {
    if (phaseRef.current !== 'viewfinder' || isBusyRef.current) return;
    isBusyRef.current = true;
    setScanState('scanning');
    setScanCount(c => c + 1);
    // Pause so the frame stays still during OCR
    videoRef.current?.pause();

    try {
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) throw new Error('no refs');

      const vw = video.videoWidth  || 640;
      const vh = video.videoHeight || 480;
      canvas.width  = vw;
      canvas.height = vh;
      canvas.getContext('2d')?.drawImage(video, 0, 0);

      const { boxX, boxY, boxW, boxH } = guideToVideoBox(cardGuideRef.current, vw, vh);
      const cardCanvas = cropFrom(canvas, boxX, boxY, boxW, boxH);

      // 4 orientations: portrait, CW90, CCW90, upside-down
      const orientations: HTMLCanvasElement[] = [
        cardCanvas,
        rotateCanvas(cardCanvas, 90),
        rotateCanvas(cardCanvas, 270),
        rotateCanvas(cardCanvas, 180),
      ];

      const worker = await getWorker();
      let results: Card[] = [];
      let searchTerm = '';

      // ── Strategy 1: number in bottom 12% strip (tight – less noise) ──────────
      // Pokemon cards print NNN/NNN in the very bottom strip.
      // We scan FULL WIDTH so left-position AND right-position are covered.
      setCurrentRoi({ id: 'number', status: 'active' });
      setAnalysisMsg('Suche Kartennummer\u2026');

      for (const oriented of orientations) {
        if (results.length > 0) break;
        const stripH = Math.round(oriented.height * 0.12);
        const strip  = preprocessForOcr(
          cropFrom(oriented, 0, oriented.height - stripH, oriented.width, stripH),
          4,
        );
        await worker.setParameters({
          tessedit_pageseg_mode: '11',  // sparse – find any text
          tessedit_char_whitelist: '0123456789/\\|lI ',
        });
        const r = await worker.recognize(strip);
        await worker.setParameters({ tessedit_char_whitelist: '' });
        const num = parseCardNumber(r.data.text);
        if (num) {
          const apiR = await searchCardsApi(num, 12);
          if (apiR.cards.length > 0) {
            results = apiR.cards;
            searchTerm = num;
            setCurrentRoi({ id: 'number', status: 'ok' });
          }
        }
      }
      if (results.length === 0) setCurrentRoi({ id: 'number', status: 'fail' });

      // ── Strategy 2: name in top 14% strip ────────────────────────────────────
      // Skip the leftmost ~18% (set/stage badge) – crop from 18% to 75% of width
      // to avoid KP / HP number on the right messing up name extraction.
      if (results.length === 0) {
        setCurrentRoi({ id: 'name', status: 'active' });
        setAnalysisMsg('Suche Kartenname\u2026');

        for (const oriented of orientations) {
          if (results.length > 0) break;
          const nameH = Math.round(oriented.height * 0.14);
          const nameX = Math.round(oriented.width  * 0.18);
          const nameW = Math.round(oriented.width  * 0.57);  // center portion
          const nameStrip = preprocessForOcr(
            cropFrom(oriented, nameX, 0, nameW, nameH),
            4,
          );
          await worker.setParameters({ tessedit_pageseg_mode: '7' });  // single line
          const r = await worker.recognize(nameStrip);
          const name = extractNameFromOcr(r.data.text);
          if (name && name.length >= 3) {
            const apiR = await searchCardsApi(name, 12);
            if (apiR.cards.length > 0) {
              results = apiR.cards;
              searchTerm = name;
              setCurrentRoi({ id: 'name', status: 'ok' });
            }
          }
        }
        if (results.length === 0) setCurrentRoi({ id: 'name', status: 'fail' });
      }

      isBusyRef.current = false;

      if (results.length === 0) {
        setAnalysisMsg('Nicht erkannt \u2013 Karte neu ausrichten');
        setScanState('failed');
        await new Promise(r => setTimeout(r, 1400));
        presenceCountRef.current = 0;
        setCardDetected(false);
        setCurrentRoi(null);
        setScanState('idle');
        setAnalysisMsg('');
        void videoRef.current?.play();
        return;
      }

      setDetectedName(searchTerm);
      setSearchResults(results);
      setCurrentRoi(null);
      setScanState('idle');
      setPhase('review');

    } catch {
      isBusyRef.current = false;
      presenceCountRef.current = 0;
      setCurrentRoi(null);
      setScanState('idle');
      void videoRef.current?.play();
    }
  }

  function retry() {
    setSearchResults([]);
    setDetectedName('');
    presenceCountRef.current = 0;
    isBusyRef.current = false;
    setCardDetected(false);
    setCurrentRoi(null);
    setScanState('idle');
    setAnalysisMsg('');
    if (detectRef.current) { clearInterval(detectRef.current); detectRef.current = null; }
    setPhase('viewfinder');
  }

  // ─── PERMISSION GATE ──────────────────────────────────────────────────────────

  if (phase === 'permission') {
    return (
      <div style={{ height: '100%', background: 'var(--bg)', color: 'var(--fg)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 28px', textAlign: 'center' }}>
          <div style={{ width: 88, height: 88, borderRadius: 26, background: 'var(--accent-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', marginBottom: 22, boxShadow: '0 18px 40px var(--accent-shadow)' }}>
            <Icons.Scan size={38} stroke={2.2}/>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3, marginBottom: 8 }}>{t('pwa.cameraPermTitle')}</div>
          <div style={{ fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.55, maxWidth: 280 }}>{t('pwa.cameraPermBody')}</div>
          <div style={{ fontSize: 12, color: 'var(--accent-solid)', marginTop: 10, fontWeight: 600 }}>Karte in Rahmen halten \u2013 wird automatisch erkannt</div>
          {error && (
            <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.12)', color: 'var(--down)', fontSize: 12 }}>
              <Icons.AlertTriangle size={14} style={{ marginRight: 6 }}/>{error}
            </div>
          )}
        </div>
        <div style={{ padding: '0 18px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <GradientButton full onClick={enableCamera}><Icons.Scan size={16}/>{t('pwa.enableCamera')}</GradientButton>
          <button onClick={onManual} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)', fontSize: 13, fontWeight: 600, padding: '10px 0' }}>{t('pwa.cantScan')}</button>
        </div>
      </div>
    );
  }

  // ─── REVIEW ───────────────────────────────────────────────────────────────────

  if (phase === 'review') {
    return (
      <div style={{ height: '100%', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 16px 10px', borderBottom: '1px solid var(--card-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-solid)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Karten gefunden</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)', marginTop: 1 }}>"{detectedName}"</div>
            </div>
            <GhostButton onClick={retry}><Icons.RotateCw size={14}/> Neu scannen</GhostButton>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px 24px' }}>
          {searchResults.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg-muted)' }}>
              <Icons.AlertTriangle size={28} style={{ marginBottom: 10 }}/>
              <div>Keine Karten gefunden</div>
              <button onClick={retry} style={{ marginTop: 12, padding: '10px 20px', borderRadius: 10, background: 'var(--accent-grad)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Nochmal versuchen</button>
            </div>
          ) : searchResults.map(card => {
            const price = getCardPrice(card);
            return (
              <button key={card.id} onClick={() => { stopCamera(); onCardDetected(card); }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 14, padding: '12px 14px', marginBottom: 10, cursor: 'pointer', textAlign: 'left', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
                <CardThumb img={card.images.small} name={card.name} w={48} radius={6}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg)' }}>{card.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>{card.set.name} \u00b7 {card.number}</div>
                  {price !== null && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-solid)', marginTop: 2 }}>{fmtMoney(price, currency)}</div>}
                </div>
                <Icons.ChevronRight size={16} style={{ color: 'var(--fg-muted)', flexShrink: 0 }}/>
              </button>
            );
          })}
        </div>
        <div style={{ padding: '0 16px 20px' }}>
          <button onClick={onManual} style={{ width: '100%', padding: '12px 0', borderRadius: 12, background: 'var(--pill-bg)', border: '1px solid var(--card-border)', color: 'var(--fg-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Manuell suchen</button>
        </div>
      </div>
    );
  }

  // ─── CAMERA VIEWFINDER ────────────────────────────────────────────────────────

  const isScanning = scanState === 'scanning';
  const isFailed   = scanState === 'failed';

  // Determine guide box border color
  const guideColor = isFailed ? '#ef4444' : isScanning ? 'var(--accent-solid)' : cardDetected ? '#22c55e' : 'rgba(255,255,255,0.72)';
  const guideGlow  = isFailed
    ? '0 0 0 9999px rgba(0,0,0,0.68), 0 0 0 3px #ef4444, 0 0 28px 4px rgba(239,68,68,0.45)'
    : isScanning
    ? '0 0 0 9999px rgba(0,0,0,0.68), 0 0 0 3px var(--accent-solid), 0 0 24px 4px var(--accent-shadow)'
    : cardDetected
    ? '0 0 0 9999px rgba(0,0,0,0.68), 0 0 0 3px #22c55e, 0 0 28px 4px rgba(34,197,94,0.45)'
    : '0 0 0 9999px rgba(0,0,0,0.68), 0 0 0 2px rgba(255,255,255,0.72)';

  const hintText = isFailed
    ? 'Nicht erkannt \u2013 Karte neu ausrichten'
    : isScanning ? analysisMsg
    : cardDetected ? 'Karte erkannt \u2013 analysiere\u2026'
    : 'Karte hier positionieren';

  const statusDotColor = isFailed ? '#ef4444' : isScanning ? 'var(--accent-solid)' : cardDetected ? '#22c55e' : 'rgba(255,255,255,0.4)';

  return (
    <div style={{ height: '100%', position: 'relative', overflow: 'hidden', background: '#000' }}>
      <video ref={videoRef} autoPlay playsInline muted
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}/>
      <canvas ref={canvasRef} style={{ display: 'none' }}/>

      {/* Document-scanner spotlight: box-shadow creates dark vignette outside card */}
      <div ref={cardGuideRef} style={{
        position: 'absolute', left: '50%', top: '38%',
        transform: 'translate(-50%, -50%)',
        width: '72%', aspectRatio: '0.71 / 1',
        zIndex: 3, pointerEvents: 'none',
        borderRadius: 16,
        boxShadow: guideGlow,
        transition: 'box-shadow 0.25s',
      }}>
        {/* Corner brackets */}
        <ScanCorner pos="tl" color={guideColor}/>
        <ScanCorner pos="tr" color={guideColor}/>
        <ScanCorner pos="bl" color={guideColor}/>
        <ScanCorner pos="br" color={guideColor}/>

        {/* Scanline */}
        {(isScanning || cardDetected) && !isFailed && (
          <div className="scanline" style={{
            position: 'absolute', left: 8, right: 8, top: 6, height: 2, borderRadius: 999,
            background: `linear-gradient(to right, transparent, ${isScanning ? 'var(--accent-solid)' : '#22c55e'}, transparent)`,
            boxShadow: `0 0 14px ${isScanning ? 'var(--accent-solid)' : '#22c55e'}`,
          }}/>
        )}

        {/* ── ROI boxes – percentage-positioned inside the guide, zero coordinate math ── */}

        {/* NUMBER region: bottom 12% of card, full width */}
        {currentRoi?.id === 'number' && (
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, height: '12%',
            border: `2px solid ${roiColor(currentRoi.status)}`,
            borderRadius: '0 0 14px 14px',
            background: `${roiColor(currentRoi.status)}1A`,
            transition: 'border-color 0.2s, background 0.2s',
          }}>
            <div style={{
              position: 'absolute', bottom: 'calc(100% + 5px)', left: 0, right: 0,
              display: 'flex', justifyContent: 'center',
            }}>
              <span style={{ background: roiColor(currentRoi.status), color: '#000', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 5, whiteSpace: 'nowrap' }}>
                {currentRoi.status === 'active' ? '\u23f3 Kartennummer' : currentRoi.status === 'ok' ? '\u2713 Nummer erkannt' : '\u2717 Nicht gefunden'}
              </span>
            </div>
          </div>
        )}

        {/* NAME region: top 14%, skipping ~18% badge on left and ~25% HP on right */}
        {currentRoi?.id === 'name' && (
          <div style={{
            position: 'absolute', top: 0, left: '18%', right: '25%', height: '14%',
            border: `2px solid ${roiColor(currentRoi.status)}`,
            borderRadius: '0 0 6px 6px',
            background: `${roiColor(currentRoi.status)}1A`,
            transition: 'border-color 0.2s, background 0.2s',
          }}>
            <div style={{
              position: 'absolute', top: 'calc(100% + 5px)', left: 0, right: 0,
              display: 'flex', justifyContent: 'center',
            }}>
              <span style={{ background: roiColor(currentRoi.status), color: '#000', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 5, whiteSpace: 'nowrap' }}>
                {currentRoi.status === 'active' ? '\u23f3 Kartenname' : currentRoi.status === 'ok' ? '\u2713 Name erkannt' : '\u2717 Nicht gefunden'}
              </span>
            </div>
          </div>
        )}

        {/* Hint text below the guide */}
        <div style={{
          position: 'absolute', top: 'calc(100% + 14px)', left: 0, right: 0,
          textAlign: 'center', fontSize: 12, fontWeight: 700,
          color: isFailed ? '#ef4444' : isScanning ? 'rgba(255,255,255,0.9)' : cardDetected ? '#22c55e' : 'rgba(255,255,255,0.7)',
          transition: 'color 0.25s',
        }}>
          {hintText}
        </div>
      </div>

      {/* Status pill */}
      <div style={{ position: 'absolute', top: 18, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 10 }}>
        <div style={{
          padding: '7px 15px', borderRadius: 999,
          background: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
          fontSize: 12, fontWeight: 600, color: 'white',
          border: '1px solid rgba(255,255,255,0.12)',
          display: 'inline-flex', alignItems: 'center', gap: 7,
        }}>
          <span key={scanCount} style={{
            width: 7, height: 7, borderRadius: 999, display: 'inline-block', flexShrink: 0,
            background: statusDotColor,
            boxShadow: (isScanning || cardDetected) && !isFailed ? `0 0 7px ${statusDotColor}` : 'none',
            transition: 'background 0.25s',
          }} className={(isScanning || cardDetected) && !isFailed ? 'pulse-dot' : ''}/>
          {isFailed ? 'Fehlgeschlagen' : isScanning ? 'Analysiere\u2026' : cardDetected ? 'Karte erkannt' : 'Warte auf Karte\u2026'}
        </div>
      </div>

      {/* Bottom buttons */}
      <div style={{ position: 'absolute', bottom: 60, left: 0, right: 0, zIndex: 5, display: 'flex', justifyContent: 'center', gap: 10 }}>
        <button
          disabled={isScanning}
          onClick={() => { if (!isBusyRef.current) void runScan(); }}
          style={{
            padding: '12px 26px', borderRadius: 999,
            background: isScanning ? 'rgba(255,255,255,0.18)' : 'var(--accent-grad)',
            border: 'none', color: 'white', fontSize: 13, fontWeight: 700,
            cursor: isScanning ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 7,
            boxShadow: isScanning ? 'none' : '0 6px 20px var(--accent-shadow)',
            opacity: isScanning ? 0.7 : 1,
          }}>
          <Icons.Scan size={15}/>
          {isScanning ? 'Analysiere\u2026' : 'Jetzt scannen'}
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

// ── Helpers ────────────────────────────────────────────────────────────────────

function roiColor(status: RoiStatus): string {
  if (status === 'active') return '#60a5fa';
  if (status === 'ok')     return '#22c55e';
  return '#ef4444';
}

function ScanCorner({ pos, color }: { pos: 'tl' | 'tr' | 'bl' | 'br'; color: string }) {
  const len = 30, t = 3, off = -1;
  const base: React.CSSProperties = { position: 'absolute', width: len, height: len, borderColor: color, borderStyle: 'solid', borderRadius: 5, transition: 'border-color 0.2s' };
  const styles: Record<string, React.CSSProperties> = {
    tl: { ...base, top: off, left: off,     borderWidth: `${t}px 0 0 ${t}px` },
    tr: { ...base, top: off, right: off,    borderWidth: `${t}px ${t}px 0 0` },
    bl: { ...base, bottom: off, left: off,  borderWidth: `0 0 ${t}px ${t}px` },
    br: { ...base, bottom: off, right: off, borderWidth: `0 ${t}px ${t}px 0` },
  };
  return <div style={styles[pos]}/>;
}
