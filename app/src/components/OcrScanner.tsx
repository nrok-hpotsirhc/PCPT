import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { Card } from '@/lib/types';
import { formatSetNumber, getCardmarketPrice } from '@/lib/types';
import { translateGermanName } from '@/lib/german-pokemon-names';
import { searchCardsApi } from '@/lib/pokemon-api';
import { useI18n } from '@/lib/i18n';
import { loadCards } from '@/lib/data-loader';
import {
  Camera,
  X,
  RotateCcw,
  Loader2,
  ScanLine,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ListFilter,
} from 'lucide-react';

interface OcrScannerProps {
  cards: Card[];
  onCardDetected: (card: Card) => void;
}

/** Pokemon card aspect ratio: 63mm × 88mm ≈ 5:7 */
const CARD_RATIO = 5 / 7;
const MAX_VISIBLE_MATCHES = 5;
const MIN_MODAL_FETCH = 50;
const MAX_MODAL_FETCH = 250;
const MAX_NAME_WORDS = 4;
const MIN_NAME_LETTERS = 3;

const NON_NAME_PREFIXES = new Set(['basis', 'basic', 'stage', 'stufe', 'evolution']);
const NON_NAME_WORDS = new Set([...NON_NAME_PREFIXES, 'hp', 'kp', 'pokemon']);

const NAME_ROI = { x: 0.04, y: 0.01, w: 0.92, h: 0.15 };

function captureCardCanvas(video: HTMLVideoElement, canvas: HTMLCanvasElement): boolean {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return false;

  let cropW: number, cropH: number, cropX: number, cropY: number;
  if (vw / vh > CARD_RATIO) {
    cropH = vh;
    cropW = Math.round(vh * CARD_RATIO);
    cropX = Math.round((vw - cropW) / 2);
    cropY = 0;
  } else {
    cropW = vw;
    cropH = Math.round(vw / CARD_RATIO);
    cropX = 0;
    cropY = Math.round((vh - cropH) / 2);
  }

  canvas.width = cropW;
  canvas.height = cropH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  return true;
}

interface ROIOptions {
  scale?: number;
}

function extractROI(
  src: HTMLCanvasElement,
  roi: { x: number; y: number; w: number; h: number },
  opts: ROIOptions = {},
): HTMLCanvasElement {
  const { scale = 3 } = opts;

  const sx = Math.round(roi.x * src.width);
  const sy = Math.round(roi.y * src.height);
  const sw = Math.round(roi.w * src.width);
  const sh = Math.round(roi.h * src.height);

  const roiCanvas = document.createElement('canvas');
  roiCanvas.width = sw * scale;
  roiCanvas.height = sh * scale;
  const ctx = roiCanvas.getContext('2d')!;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, roiCanvas.width, roiCanvas.height);

  const imageData = ctx.getImageData(0, 0, roiCanvas.width, roiCanvas.height);
  const d = imageData.data;

  const pixelCount = d.length / 4;
  let grayMin = 255;
  let grayMax = 0;
  let graySum = 0;

  for (let i = 0; i + 3 < d.length; i += 4) {
    const gray = Math.round(0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!);
    d[i] = d[i + 1] = d[i + 2] = gray;
    if (gray < grayMin) grayMin = gray;
    if (gray > grayMax) grayMax = gray;
    graySum += gray;
  }

  const range = grayMax - grayMin;
  const meanGray = graySum / pixelCount;
  const needsInvert = meanGray < 128;

  if (range > 0) {
    const scaleFactor = 255 / range;
    for (let i = 0; i + 3 < d.length; i += 4) {
      let stretched = Math.round((d[i]! - grayMin) * scaleFactor);
      if (needsInvert) stretched = 255 - stretched;
      d[i] = d[i + 1] = d[i + 2] = stretched;
    }
  } else if (needsInvert) {
    for (let i = 0; i + 3 < d.length; i += 4) {
      d[i] = d[i + 1] = d[i + 2] = 255 - d[i]!;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return roiCanvas;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to convert canvas to blob'));
    }, 'image/png');
  });
}

function normalizeNameLookup(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function countLetters(value: string): number {
  const matches = value.match(/\p{L}/gu);
  return matches ? matches.length : 0;
}

function isIgnoredNameWord(word: string): boolean {
  return NON_NAME_WORDS.has(normalizeNameLookup(word));
}

function mergeCards(primary: Card[], secondary: Card[]): Card[] {
  const merged = new Map<string, Card>();
  for (const card of primary) merged.set(card.id, card);
  for (const card of secondary) merged.set(card.id, card);
  return Array.from(merged.values());
}

function extractNameCandidatesFromROI(raw: string): string[] {
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length >= 2);

  const candidates = new Map<string, { lineIndex: number; wordCount: number; letters: number }>();

  for (const [lineIndex, line] of lines.entries()) {
    let cleaned = line
      .replace(/[|_{}[\]<>~`@#$%^&*()+=]/g, ' ')
      .replace(/\b(?:(?:hp|kp)\s*\d+|\d+\s*(?:hp|kp))\b/gi, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (cleaned.length < 2) continue;
    if (/^\d+\s*(?:HP|KP)$/i.test(cleaned)) continue;
    if (/^(?:HP|KP)\s*\d+$/i.test(cleaned)) continue;
    if (/^\d+$/.test(cleaned)) continue;

    const words = cleaned
      .split(/\s+/)
      .map((word) => word.replace(/^[^0-9A-Za-zÀ-ÿ]+|[^0-9A-Za-zÀ-ÿ'.-]+$/g, ''))
      .filter((word) => word.length > 0);

    while (words.length > 0) {
      const firstWord = words[0];
      if (!firstWord || !isIgnoredNameWord(firstWord)) break;
      words.shift();
    }

    for (let length = Math.min(words.length, MAX_NAME_WORDS); length >= 1; length--) {
      for (let start = 0; start + length <= words.length; start++) {
        const phraseWords = words.slice(start, start + length);
        if (phraseWords.some((word) => isIgnoredNameWord(word))) continue;

        const phrase = phraseWords.join(' ').trim();
        if (phrase.length < 2) continue;
        if (/^\d+$/.test(phrase)) continue;
        const letters = countLetters(phrase);
        if (letters < MIN_NAME_LETTERS) continue;
        if (!candidates.has(phrase)) {
          candidates.set(phrase, { lineIndex, wordCount: phraseWords.length, letters });
        }
      }
    }
  }

  return Array.from(candidates.entries())
    .sort((a, b) => {
      const lineDiff = a[1].lineIndex - b[1].lineIndex;
      if (lineDiff !== 0) return lineDiff;
      const wordDiff = b[1].wordCount - a[1].wordCount;
      if (wordDiff !== 0) return wordDiff;
      return b[1].letters - a[1].letters;
    })
    .map(([phrase]) => phrase);
}

function findCardsForDetectedName(
  raw: string,
  cardsByName: Map<string, Card[]>,
): { matchedName: string; cards: Card[]; candidates: string[] } | null {
  if (cardsByName.size === 0) return null;

  const candidates = extractNameCandidatesFromROI(raw);

  for (const candidate of candidates) {
    const variants = [candidate, translateGermanName(candidate)]
      .filter((value): value is string => Boolean(value))
      .filter((value, index, array) => array.indexOf(value) === index);

    for (const variant of variants) {
      const hits = cardsByName.get(normalizeNameLookup(variant));
      if (hits && hits.length > 0) {
        return { matchedName: variant, cards: hits, candidates };
      }
    }
  }

  return candidates.length > 0 ? { matchedName: '', cards: [], candidates } : null;
}

export function OcrScanner({ cards, onCardDetected }: OcrScannerProps) {
  const [status, setStatus] = useState<'idle' | 'camera' | 'processing' | 'result'>('idle');
  const [ocrText, setOcrText] = useState('');
  const [matchedCards, setMatchedCards] = useState<Card[]>([]);
  const [allResults, setAllResults] = useState<Card[]>([]);
  const [catalogCards, setCatalogCards] = useState<Card[]>([]);
  const [ocrQuery, setOcrQuery] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [showAllModal, setShowAllModal] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { t } = useI18n();

  const handleSelectCard = useCallback(
    (card: Card) => {
      setShowAllModal(false);
      onCardDetected(card);
    },
    [onCardDetected],
  );

  const searchPool = useMemo(() => mergeCards(catalogCards, cards), [catalogCards, cards]);

  const cardsByName = useMemo(() => {
    const mappedCards = new Map<string, Card[]>();
    for (const card of searchPool) {
      const key = normalizeNameLookup(card.name);
      const existing = mappedCards.get(key);
      if (existing) existing.push(card);
      else mappedCards.set(key, [card]);
    }
    return mappedCards;
  }, [searchPool]);

  useEffect(() => {
    let mounted = true;
    void loadCards()
      .then((loadedCards) => {
        if (mounted) {
          setCatalogCards(loadedCards);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        console.error('Failed to load local card catalog for OCR scan.', err);
        if (mounted) {
          setCatalogCards([]);
          if (cards.length === 0) {
            setError('Card catalog could not be loaded. Please reload the page.');
          }
        }
      });
    return () => { mounted = false; };
  }, [cards.length]);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 720 },
          height: { ideal: 1280 },
          aspectRatio: { ideal: CARD_RATIO },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus('camera');
    } catch {
      setError(t('scan.cameraError'));
    }
  }, [t]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const captureAndScan = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const ok = captureCardCanvas(videoRef.current, canvasRef.current);
    if (!ok) return;
    stopCamera();
    setStatus('processing');

    try {
      const { createWorker, PSM } = await import('tesseract.js');
      const nameCanvas = extractROI(canvasRef.current, NAME_ROI, { scale: 3 });
      const nameBlob = await canvasToBlob(nameCanvas);
      const nameWorker = await createWorker('deu+eng');
      await nameWorker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
      const nameResult = await nameWorker.recognize(nameBlob);
      await nameWorker.terminate();

      const nameRaw = nameResult.data.text.trim();
      const detectedMatch = findCardsForDetectedName(nameRaw, cardsByName);
      const candidatePreview = detectedMatch?.candidates.join(' | ') ?? '–';
      const debugText = [
        `[Top ROI] ${nameRaw}`,
        `→ Kandidaten: ${candidatePreview}`,
        `→ Gültiger Name: ${detectedMatch?.matchedName || '–'}`,
      ].join('\n');
      setOcrText(debugText);
      setShowAllModal(false);

      if (detectedMatch && detectedMatch.matchedName) {
        const query = detectedMatch.matchedName;
        setOcrQuery(query);
        if (detectedMatch.cards.length > 0) {
          setMatchedCards(detectedMatch.cards.slice(0, MAX_VISIBLE_MATCHES));
          setAllResults(detectedMatch.cards);
          setTotalCount(detectedMatch.cards.length);
        }
        setStatus('result');
        try {
          const initial = await searchCardsApi(query, MAX_VISIBLE_MATCHES + 1);
          const apiCards = initial.cards;
          const apiTotal = initial.totalCount;
          if (apiCards.length > 0) {
            setMatchedCards(apiCards.slice(0, MAX_VISIBLE_MATCHES));
            setTotalCount(apiTotal);
          } else if (detectedMatch.cards.length > 0) {
            setMatchedCards(detectedMatch.cards.slice(0, MAX_VISIBLE_MATCHES));
            setAllResults(detectedMatch.cards);
            setTotalCount(detectedMatch.cards.length);
          }
        } catch (e) {
          console.error('API search failed for OCR-detected name, using local results', e);
          if (detectedMatch.cards.length > 0) {
            setMatchedCards(detectedMatch.cards.slice(0, MAX_VISIBLE_MATCHES));
            setAllResults(detectedMatch.cards);
            setTotalCount(detectedMatch.cards.length);
          }
        }
      } else {
        setOcrQuery('');
        setMatchedCards([]);
        setAllResults([]);
        setTotalCount(0);
        setStatus('result');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OCR failed');
      setStatus('idle');
    }
  }, [cardsByName, stopCamera, t]);

  const handleShowAll = useCallback(async () => {
    if (!ocrQuery) return;
    setShowAllModal(true);
    setLoadingAll(true);
    try {
      const limit = Math.min(Math.max(totalCount, MIN_MODAL_FETCH), MAX_MODAL_FETCH);
      const result = await searchCardsApi(ocrQuery, limit);
      setAllResults(result.cards);
      setTotalCount(result.totalCount);
    } catch (e) {
      console.error('Failed to load full OCR results from API', e);
    } finally {
      setLoadingAll(false);
    }
  }, [ocrQuery, totalCount]);

  const reset = useCallback(() => {
    stopCamera();
    setStatus('idle');
    setOcrText('');
    setMatchedCards([]);
    setAllResults([]);
    setOcrQuery('');
    setTotalCount(0);
    setShowAllModal(false);
    setLoadingAll(false);
    setError(null);
  }, [stopCamera]);

  return (
    <div className="space-y-4">
      {/* Camera viewfinder */}
      <div className="relative bg-slate-900 rounded-2xl overflow-hidden mx-auto aspect-[5/7] max-w-xs shadow-lg">
        <video
          ref={videoRef}
          className={`w-full h-full object-cover ${status !== 'camera' ? 'hidden' : ''}`}
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Idle state */}
        {status === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white bg-slate-900">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center border-2 border-slate-600">
              <Camera className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-sm text-slate-400 text-center px-6">{t('scan.idle')}</p>
          </div>
        )}

        {/* Processing state */}
        {status === 'processing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white bg-slate-900/90">
            <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
            <p className="text-sm text-slate-300">{t('scan.analyzing')}</p>
          </div>
        )}

        {/* Camera active overlay */}
        {status === 'camera' && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Corner guide brackets */}
            <div className="absolute inset-6">
              {/* Top-left */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white/80 rounded-tl-lg" />
              {/* Top-right */}
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white/80 rounded-tr-lg" />
              {/* Bottom-left */}
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white/80 rounded-bl-lg" />
              {/* Bottom-right */}
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white/80 rounded-br-lg" />
            </div>

            {/* Name ROI highlight */}
            <div
              className="absolute border border-blue-400/60 bg-blue-400/10 rounded"
              style={{
                left: `${NAME_ROI.x * 100}%`,
                top: `${NAME_ROI.y * 100}%`,
                width: `${NAME_ROI.w * 100}%`,
                height: `${NAME_ROI.h * 100}%`,
              }}
            />
            <span
              className="absolute text-blue-300 text-[9px] font-bold tracking-wider"
              style={{ left: `${(NAME_ROI.x + 0.02) * 100}%`, top: `${(NAME_ROI.y + 0.015) * 100}%` }}
            >
              NAME
            </span>

            {/* Animated scan line */}
            <div
              className="absolute left-6 right-6 h-px bg-blue-400/70"
              style={{
                top: `${(NAME_ROI.y + NAME_ROI.h / 2) * 100}%`,
                animation: 'scanline 2s ease-in-out infinite',
              }}
            />

            <p className="absolute bottom-3 left-0 right-0 text-center text-white/70 text-xs">
              {t('scan.position')}
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        {status === 'idle' && (
          <button
            onClick={() => void startCamera()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 active:scale-95 transition-all shadow"
          >
            <Camera className="w-4 h-4" />
            {t('scan.startCamera')}
          </button>
        )}
        {status === 'camera' && (
          <>
            <button
              onClick={() => void captureAndScan()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 active:scale-95 transition-all shadow"
            >
              <ScanLine className="w-4 h-4" />
              {t('scan.capture')}
            </button>
            <button
              onClick={reset}
              className="px-4 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        )}
        {(status === 'result' || status === 'processing') && (
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            {t('scan.again')}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Result */}
      {status === 'result' && (
        <div className="space-y-3">
          {/* OCR debug info – collapsible */}
          {ocrText && (
            <details className="bg-slate-100 dark:bg-slate-800 rounded-xl">
              <summary className="px-3 py-2.5 text-xs font-medium text-slate-500 cursor-pointer select-none">
                {t('scan.ocrText')}
              </summary>
              <pre className="px-3 pb-3 text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                {ocrText}
              </pre>
            </details>
          )}

          {matchedCards.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {t('scan.matches')}
                </p>
              </div>
              <div className="space-y-2">
                {matchedCards.map((card: Card) => (
                  <button
                    key={card.id}
                    onClick={() => handleSelectCard(card)}
                    className="w-full flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950 hover:border-blue-300 text-left transition-colors"
                  >
                    <img src={card.images.small} alt="" className="w-10 h-14 object-contain rounded" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">{card.name}</div>
                      <div className="text-xs text-slate-500">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {formatSetNumber(card.set, card.number)}
                        </span>
                        {' · '}{card.set.name}
                      </div>
                    </div>
                    {(() => {
                      const price = getCardmarketPrice(card);
                      return price != null ? (
                        <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                          {price.toFixed(2)} €
                        </span>
                      ) : null;
                    })()}
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>
                ))}
              </div>

              {totalCount > MAX_VISIBLE_MATCHES && (
                <button
                  type="button"
                  onClick={handleShowAll}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-950 font-medium transition-colors"
                >
                  <ListFilter className="w-3.5 h-3.5" />
                  +{totalCount - MAX_VISIBLE_MATCHES} {t('form.moreResults')}
                </button>
              )}
            </div>
          )}

          {matchedCards.length === 0 && ocrText && (
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 py-2">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              {t('scan.noMatch')}
            </div>
          )}
        </div>
      )}

      {/* All Results Modal */}
      {showAllModal && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowAllModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {t('form.allResults')}
              </h3>
              <button
                type="button"
                onClick={() => setShowAllModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-2">
              {loadingAll ? (
                <div className="flex items-center justify-center py-12 gap-2">
                  <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                  <span className="text-sm text-slate-500">{t('form.loadingAll')}</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 divide-y divide-slate-100 dark:divide-slate-800">
                  {allResults.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => handleSelectCard(card)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-950 text-left transition-colors"
                    >
                      <img src={card.images.small} alt="" className="w-10 h-14 object-contain rounded" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">{card.name}</div>
                        <div className="text-xs text-slate-500">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {formatSetNumber(card.set, card.number)}
                          </span>
                          {' · '}{card.set.name}
                        </div>
                      </div>
                      {(() => {
                        const price = getCardmarketPrice(card);
                        return price != null ? (
                          <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                            {price.toFixed(2)} €
                          </span>
                        ) : null;
                      })()}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Scan line animation */}
      <style>{`
        @keyframes scanline {
          0%, 100% { transform: translateY(-8px); opacity: 0.4; }
          50% { transform: translateY(8px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
