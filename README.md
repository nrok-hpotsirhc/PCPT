<div align="center">

# Pokémon Card Portfolio Tracker (PCPT)

Track your Pokémon card collection's market value with live Cardmarket (EUR) prices — in the browser **and** as an installable PWA.

![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646cff?logo=vite&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-ready-5c6bc0?logo=googlechrome&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

**Live demo:** https://demokritAtom.github.io/PCPT/

</div>

---

## What is this?

A **zero-cost**, serverless web app for tracking Pokémon TCG card portfolios. It runs entirely as a static site on GitHub Pages with daily automated price updates via GitHub Actions.

The app has **two modes** depending on how you open it:

| Mode | When | UI |
|------|------|----|
| **Desktop / Browser** | Opened in a regular browser tab | Full table-based view with sorting, filtering, dashboard |
| **PWA / Mobile** | Installed on a phone home screen (`Add to Home Screen`) | New mobile-first design: tab bar, card grid, camera scanner, bottom sheets |

---

## Features

### Both modes
- Live card search via [pokemontcg.io](https://pokemontcg.io/) (17 000+ cards)
- Cardmarket prices in EUR (trend, average, low)
- Search by card name **or** set code + number (e.g. `PAL 072`, `BS 4`)
- Excel / CSV import & export
- Bilingual UI: 🇩🇪 German (default) · 🇺🇸 English
- Runs 100 % offline after first load (service worker)

### Desktop browser
- Sortable / filterable portfolio table
- Dashboard with total portfolio value, top gainers & losers
- Dark mode (auto-detected from OS)

### PWA (installed on phone)
- **Dashboard** — hero total card with 30-day sparkline, Card of the Day, today's movers
- **Portfolio** — searchable card list with sort & filter bottom sheets
- **Add card** — live search with card preview, condition / variant grid, quantity stepper
- **Scan** — camera viewfinder with Tesseract.js OCR + match confidence bar
- **Card detail** — price chart with 7d / 30d / 90d range selector, stats, edit / delete
- **Settings** — drag-and-drop import, export, language toggle

---

## Prerequisites

- [Node.js](https://nodejs.org/) **>= 20**
- npm >= 10
- A [GitHub](https://github.com/) account

---

## Deploy your own instance

### 1. Fork the repository

Click **Fork** on https://github.com/DemokritAtom/PCPT, then clone your fork:

```bash
git clone https://github.com/<YOUR_USERNAME>/PCPT.git
cd PCPT
```

### 2. Install dependencies & verify locally

```bash
cd app
npm install
npm run dev
```

Open `http://localhost:5173/` in your browser.

To test the PWA design locally: open Chrome DevTools → Application → Manifest → "Add to home screen", or open the URL in a standalone window.

### 3. Enable GitHub Pages

1. Go to your repo → **Settings** → **Pages**
2. Under **Source**, select **GitHub Actions**
3. Push to `main` — the included `.github/workflows/deploy.yml` will build and deploy automatically

Your site will be live at `https://<YOUR_USERNAME>.github.io/PCPT/`.

### 4. Enable daily price sync (optional)

`.github/workflows/price-sync.yml` updates card prices daily at 06:00 UTC.

- Runs automatically once GitHub Actions is enabled on your fork
- Trigger manually: **Actions** → **Daily Price Sync** → **Run workflow**
- Prices are committed to `data/prices-latest.json`

---

## Usage guide

### Adding cards

1. **Browser:** Click **+ Add card** in the top navigation
2. **PWA:** Tap the **+** button in the center of the tab bar
3. Type a card name (e.g. `Charizard`) or a **set code + number** (e.g. `PAL 072`)
4. Set condition, variant, quantity, owner, and optional purchase info
5. Save

### Scanning a card (PWA only)

1. Tap the **Scan** tab (camera icon)
2. Grant camera permission — the camera only runs locally, nothing is uploaded
3. Hold the card steady in the frame and tap the shutter
4. Tesseract.js reads the card name via OCR and finds the best match
5. Confirm or retry — the card opens directly in the Add screen

### Search syntax

| Input | Effect |
|-------|--------|
| `Pikachu` | Searches by card name |
| `PAL 072` | Searches by set code (PTCGO code) + collector number |
| `BS 4` | Base Set card #4 |

### Excel import

- Drag & drop an `.xlsx` or `.csv` file onto the Import/Export section
- Download the template first for the expected column format
- Browser: Import / Export tab · PWA: Settings screen

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19, TypeScript 5.8, Vite 6 |
| Styling (desktop) | Tailwind CSS 4 |
| Styling (PWA) | CSS custom properties (inline styles, no framework) |
| Table | TanStack Table v8 |
| Prices | [pokemontcg.io](https://pokemontcg.io/) API (Cardmarket EUR) |
| OCR | Tesseract.js (WASM, browser-only) |
| Import / Export | SheetJS (xlsx) |
| PWA | Vite PWA plugin + custom service worker |
| Hosting | GitHub Pages (free) |
| CI / CD | GitHub Actions |

---

## License

MIT — see [LICENSE](LICENSE).

> Pokémon and all related trademarks are property of The Pokémon Company. Prices are sourced from Cardmarket via pokemontcg.io. This project is not officially affiliated.

</div>
