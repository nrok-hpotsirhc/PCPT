import { createContext, useContext, useState, type ReactNode } from 'react';

export type Locale = 'de' | 'en';

const translations = {
  de: {
    // Header
    'app.title': 'Pokémon Karten Tracker',
    'app.subtitle': 'Portfolio-Wertübersicht',
    'app.cards': 'Karten',
    'app.synced': 'synchronisiert',
    'app.noSync': 'keine Sync-Daten',

    // Tabs
    'tab.dashboard': 'Dashboard',
    'tab.portfolio': 'Portfolio',
    'tab.add': 'Karte hinzufügen',
    'tab.import': 'Import / Export',
    'tab.scan': 'Scan',

    // Dashboard
    'dash.portfolioValue': 'Portfolio-Wert',
    'dash.totalCards': 'Karten gesamt',
    'dash.unique': 'verschiedene',
    'dash.mostValuable': 'Wertvollste',
    'dash.avgValue': 'Ø Kartenwert',
    'dash.topGainers': 'Top Gewinner (vs Ø 30d)',
    'dash.topLosers': 'Top Verlierer (vs Ø 30d)',
    'dash.mostValuableCards': 'Wertvollste Karten',
    'dash.noData': 'Keine Daten verfügbar',

    // Table
    'table.card': 'Karte',
    'table.owner': 'Besitzer',
    'table.rarity': 'Seltenheit',
    'table.condition': 'Zustand',
    'table.qty': 'Anz.',
    'table.price': 'Preis',
    'table.search': 'Karten suchen...',
    'table.cardsCount': 'Karten',
    'table.page': 'Seite',
    'table.of': 'von',
    'table.previous': 'Zurück',
    'table.next': 'Weiter',

    // Card Form
    'form.addTitle': 'Karte zur Sammlung hinzufügen',
    'form.editTitle': 'Karte bearbeiten',
    'form.card': 'Karte',
    'form.searchPlaceholder': 'Nach Kartenname oder Nummer suchen...',
    'form.condition': 'Zustand',
    'form.variant': 'Variante',
    'form.quantity': 'Anzahl',
    'form.owner': 'Besitzer',
    'form.purchasePrice': 'Kaufpreis',
    'form.currency': 'Währung',
    'form.purchaseDate': 'Kaufdatum',
    'form.gradingService': 'Grading-Service',
    'form.grade': 'Bewertung',
    'form.none': 'Keinen',
    'form.notes': 'Notizen',
    'form.notesPlaceholder': 'Optionale Notizen...',
    'form.add': 'Karte hinzufügen',
    'form.update': 'Aktualisieren',
    'form.cancel': 'Abbrechen',
    'form.noResults': 'Keine Karten gefunden',
    'form.moreResults': 'weitere Ergebnisse – klicken um alle zu sehen',
    'form.searchHint': 'Suche nach deutschem oder englischem Namen (z.B. "Glurak", "Pikachu") oder Set-Code + Nr. (z.B. "PAL 072")',
    'form.allResults': 'Alle Ergebnisse',
    'form.close': 'Schließen',
    'form.loadingAll': 'Lade alle Ergebnisse...',
    'form.gradePlaceholder': 'z.B. 9.5',

    // Conditions
    'condition.NM': 'Nahezu Neuwertig',
    'condition.LP': 'Leicht Bespielt',
    'condition.MP': 'Mäßig Bespielt',
    'condition.HP': 'Stark Bespielt',
    'condition.DMG': 'Beschädigt',

    // Variants
    'variant.normal': 'Normal',
    'variant.holofoil': 'Holo',
    'variant.reverseHolofoil': 'Reverse Holo',
    'variant.1stEditionHolofoil': '1. Edition Holo',
    'variant.1stEditionNormal': '1. Edition Normal',

    // Rarities
    'rarity.Common': 'Häufig',
    'rarity.Uncommon': 'Ungewöhnlich',
    'rarity.Rare': 'Selten',
    'rarity.Rare Holo': 'Selten Holo',
    'rarity.Rare Holo EX': 'Selten Holo EX',
    'rarity.Rare Holo GX': 'Selten Holo GX',
    'rarity.Rare Holo V': 'Selten Holo V',
    'rarity.Rare VMAX': 'Selten VMAX',
    'rarity.Rare VSTAR': 'Selten VSTAR',
    'rarity.Rare Ultra': 'Ultra Selten',
    'rarity.Rare Secret': 'Geheim Selten',
    'rarity.Rare Rainbow': 'Regenbogen Selten',
    'rarity.Rare Shiny': 'Shiny Selten',
    'rarity.Rare Holo Star': 'Selten Holo Star',
    'rarity.Rare Prime': 'Selten Prime',
    'rarity.Rare ACE': 'Selten ACE',
    'rarity.Rare BREAK': 'Selten BREAK',
    'rarity.Rare Prism Star': 'Selten Prisma-Stern',
    'rarity.Amazing Rare': 'Erstaunlich Selten',
    'rarity.LEGEND': 'LEGENDE',
    'rarity.Promo': 'Promo',
    'rarity.Double Rare': 'Doppelt Selten',
    'rarity.Ultra Rare': 'Ultra Selten',
    'rarity.Illustration Rare': 'Illustration Selten',
    'rarity.Special Illustration Rare': 'Spezial-Illustration Selten',
    'rarity.Hyper Rare': 'Hyper Selten',
    'rarity.Shiny Rare': 'Schillernd Selten',
    'rarity.Shiny Ultra Rare': 'Schillernd Ultra Selten',
    'rarity.ACE SPEC Rare': 'ACE SPEC Selten',
    'rarity.Radiant Rare': 'Strahlend Selten',
    'rarity.Classic Collection': 'Klassische Sammlung',
    'rarity.Trainer Gallery Rare Holo': 'Trainer-Galerie Selten Holo',

    // Detail panel
    'detail.priceTrend': 'Preistrend',
    'detail.priceFrom': 'Ab',
    'detail.avg1': 'Ø 1 Tag',
    'detail.avg7': 'Ø 7 Tage',
    'detail.avg30': 'Ø 30 Tage',
    'detail.qty': 'Anz.',
    'detail.purchaseInfo': 'Kaufinformationen',
    'detail.boughtFor': 'Gekauft f\u00fcr',
    'detail.on': 'am',
    'detail.roi': 'ROI',

    // Table columns
    'table.from': 'Ab',
    'table.trend': 'Trend',
    'table.avg1': '\u00d8 1d',
    'table.avg7': '\u00d8 7d',
    'table.avg30': '\u00d8 30d',

    // Import
    'import.title': 'Import / Export',
    'import.drop': 'Excel/CSV-Datei hierhin ziehen oder',
    'import.browse': 'durchsuchen',
    'import.formats': 'Unterstützt .xlsx, .xls, .csv',
    'import.template': 'Import-Vorlage herunterladen',
    'import.export': 'Sammlung exportieren',
    'import.exportHint': 'Exportiert deine Sammlung als Excel-Datei mit Karten- und Portfoliodaten.',
    'import.exportEmpty': 'Zum Export sind noch keine Karten in der Sammlung vorhanden.',
    'import.success': 'Karte(n) erfolgreich importiert',
    'import.errors': 'Fehler beim Import:',

    // Scan
    'scan.title': 'Karte scannen (OCR)',
    'scan.idle': 'Scanne eine Pokémon-Karte mit deiner Kamera',
    'scan.position': 'Karte hochkant (Hochformat) im Rahmen positionieren',
    'scan.analyzing': 'Karte wird analysiert...',
    'scan.startCamera': 'Kamera starten',
    'scan.capture': 'Aufnehmen & Scannen',
    'scan.cancel': 'Abbrechen',
    'scan.again': 'Erneut scannen',
    'scan.ocrText': 'OCR-Text:',
    'scan.noText': 'Kein Text erkannt',
    'scan.matches': 'Mögliche Treffer:',
    'scan.noMatch': 'Keine passenden Karten gefunden. Versuche ein klareres Bild.',
    'scan.select': 'Auswählen',
    'scan.cameraError': 'Kamerazugriff verweigert. Bitte Kameraberechtigungen erlauben.',

    // Empty State
    'empty.title': 'Noch keine Karten in deiner Sammlung.',
    'empty.addCard': 'Karte hinzufügen',
    'empty.orImport': 'oder eine Excel-Datei importieren.',

    // Detail
    'detail.priceHistory': 'Preisverlauf',
    'detail.edit': 'Bearbeiten',
    'detail.delete': 'Löschen',

    // Loading
    'loading': 'Portfolio wird geladen...',
    'error': 'Fehler',

    // Footer
    'footer': 'Preise von TCGPlayer via pokemontcg.io · Nicht affiliiert mit The Pokémon Company · Nur für den persönlichen Gebrauch',

    // ── PWA-specific keys ──────────────────────────────────────────────────────
    'pwa.dashboard': 'Übersicht',
    'pwa.portfolio': 'Sammlung',
    'pwa.add': 'Hinzufügen',
    'pwa.scan': 'Scan',
    'pwa.settings': 'Einstellungen',
    'pwa.cards': 'Karten',
    'pwa.today': 'heute',
    'pwa.totalValue': 'Gesamtwert',
    'pwa.allTime': 'Insgesamt',
    'pwa.range30d': 'Spanne 30T',
    'pwa.cardOfDay': 'Karte des Tages',
    'pwa.todayMovers': 'Tagesveränderung',
    'pwa.gainers': 'Gewinner',
    'pwa.losers': 'Verlierer',
    'pwa.mostValuable': 'Wertvollste Karten',
    'pwa.activity': 'Aktivität',
    'pwa.searchPlaceholder': 'Name, Set oder Code…',
    'pwa.noResults': 'Keine Treffer',
    'pwa.noResultsBody': 'Versuche einen anderen Suchbegriff.',
    'pwa.sort.value': 'Wert',
    'pwa.sort.change': 'Veränderung',
    'pwa.sort.name': 'Name',
    'pwa.sort.price': 'Preis',
    'pwa.sort.qty': 'Anzahl',
    'pwa.sort.set': 'Set',
    'pwa.cardmarketTrend': 'Cardmarket Trend',
    'pwa.low': 'Tief',
    'pwa.avg7': 'Ø 7T',
    'pwa.high30d': 'Hoch 30T',
    'pwa.yourCopy': 'Dein Exemplar',
    'pwa.owner': 'Besitzer',
    'pwa.condition': 'Zustand',
    'pwa.grade': 'Grading',
    'pwa.quantity': 'Anzahl',
    'pwa.purchasedFor': 'Gekauft für',
    'pwa.pnl': 'Gewinn / Verlust',
    'pwa.edit': 'Bearbeiten',
    'pwa.delete': 'Löschen',
    'pwa.searchCard': 'Karte suchen',
    'pwa.searchCardPlaceholder': 'Glurak oder „BS 4"…',
    'pwa.searchHint': 'Name oder Set-Code + Nummer (z.B. „PAL 072")',
    'pwa.variant': 'Variante',
    'pwa.purchasePrice': 'Kaufpreis',
    'pwa.purchaseDate': 'Kaufdatum',
    'pwa.addToPortfolio': 'Zur Sammlung hinzufügen',
    'pwa.matchFound': 'Treffer',
    'pwa.confidence': 'Genauigkeit',
    'pwa.retry': 'Erneut',
    'pwa.useMatch': 'Übernehmen',
    'pwa.cantScan': 'Scan klappt nicht? Manuell suchen',
    'pwa.alignCard': 'Karte mittig ausrichten',
    'pwa.cameraPermTitle': 'Kamera freigeben',
    'pwa.cameraPermBody': 'Die Kamera wird nur lokal auf deinem Gerät verwendet — keine Bilder werden hochgeladen.',
    'pwa.enableCamera': 'Kamera aktivieren',
    'pwa.holdSteady': 'Ruhig halten…',
    'pwa.flash': 'Blitz',
    'pwa.help': 'Hilfe',
    'pwa.capture': 'Aufnehmen',
    'pwa.importExport': 'Import / Export',
    'pwa.dropFile': 'Excel oder CSV hier ablegen',
    'pwa.dropFileHint': '.xlsx, .csv – max. 5 MB',
    'pwa.browse': 'Datei wählen',
    'pwa.exportXlsx': 'Sammlung als Excel exportieren',
    'pwa.downloadTemplate': 'Vorlage herunterladen',
    'pwa.preferences': 'Einstellungen',
    'pwa.language': 'Sprache',
    'pwa.theme': 'Design',
    'pwa.dark': 'Dunkel',
    'pwa.light': 'Hell',
    'pwa.currency': 'Währung',
    'pwa.profile': 'Profil',
    'pwa.profileName': 'Name',
    'pwa.save': 'Speichern',
    'pwa.cancel': 'Abbrechen',
    'pwa.resetProfile': 'Profil zurücksetzen',
    'pwa.resetConfirm': 'Wirklich zurücksetzen?',
  },
  en: {
    'app.title': 'Pokémon Card Tracker',
    'app.subtitle': 'Portfolio value overview',
    'app.cards': 'cards',
    'app.synced': 'synced',
    'app.noSync': 'no sync data',

    'tab.dashboard': 'Dashboard',
    'tab.portfolio': 'Portfolio',
    'tab.add': 'Add Card',
    'tab.import': 'Import / Export',
    'tab.scan': 'Scan',

    'dash.portfolioValue': 'Portfolio Value',
    'dash.totalCards': 'Total Cards',
    'dash.unique': 'unique',
    'dash.mostValuable': 'Most Valuable',
    'dash.avgValue': 'Avg Card Value',
    'dash.topGainers': 'Top Gainers (vs Ø 30d)',
    'dash.topLosers': 'Top Losers (vs Ø 30d)',
    'dash.mostValuableCards': 'Most Valuable Cards',
    'dash.noData': 'No data available',

    'table.card': 'Card',
    'table.owner': 'Owner',
    'table.rarity': 'Rarity',
    'table.condition': 'Condition',
    'table.qty': 'Qty',
    'table.price': 'Price',
    'table.search': 'Search cards...',
    'table.cardsCount': 'cards',
    'table.page': 'Page',
    'table.of': 'of',
    'table.previous': 'Previous',
    'table.next': 'Next',

    'form.addTitle': 'Add Card to Collection',
    'form.editTitle': 'Edit Card',
    'form.card': 'Card',
    'form.searchPlaceholder': 'Search by card name or number...',
    'form.condition': 'Condition',
    'form.variant': 'Variant',
    'form.quantity': 'Quantity',
    'form.owner': 'Owner',
    'form.purchasePrice': 'Purchase Price',
    'form.currency': 'Currency',
    'form.purchaseDate': 'Purchase Date',
    'form.gradingService': 'Grading Service',
    'form.grade': 'Grade',
    'form.none': 'None',
    'form.notes': 'Notes',
    'form.notesPlaceholder': 'Optional notes...',
    'form.add': 'Add Card',
    'form.update': 'Update Card',
    'form.cancel': 'Cancel',
    'form.noResults': 'No cards found',
    'form.moreResults': 'more results – click to show all',
    'form.searchHint': 'Search by name (e.g. "Pikachu") or set code + no. (e.g. "PAL 072")',
    'form.allResults': 'All Results',
    'form.close': 'Close',
    'form.loadingAll': 'Loading all results...',
    'form.gradePlaceholder': 'e.g. 9.5',

    // Conditions
    'condition.NM': 'Near Mint',
    'condition.LP': 'Lightly Played',
    'condition.MP': 'Moderately Played',
    'condition.HP': 'Heavily Played',
    'condition.DMG': 'Damaged',

    // Variants
    'variant.normal': 'Normal',
    'variant.holofoil': 'Holofoil',
    'variant.reverseHolofoil': 'Reverse Holofoil',
    'variant.1stEditionHolofoil': '1st Edition Holofoil',
    'variant.1stEditionNormal': '1st Edition Normal',

    // Detail panel
    'detail.priceTrend': 'Price Trend',
    'detail.priceFrom': 'From',
    'detail.avg1': '\u00d8 1 Day',
    'detail.avg7': '\u00d8 7 Days',
    'detail.avg30': '\u00d8 30 Days',
    'detail.qty': 'Qty',
    'detail.purchaseInfo': 'Purchase Info',
    'detail.boughtFor': 'Bought for',
    'detail.on': 'on',
    'detail.roi': 'ROI',

    // Table columns
    'table.from': 'From',
    'table.trend': 'Trend',
    'table.avg1': '\u00d8 1d',
    'table.avg7': '\u00d8 7d',
    'table.avg30': '\u00d8 30d',

    'import.title': 'Import / Export',
    'import.drop': 'Drag & drop an Excel/CSV file here, or',
    'import.browse': 'browse',
    'import.formats': 'Supports .xlsx, .xls, .csv',
    'import.template': 'Download import template',
    'import.export': 'Export collection',
    'import.exportHint': 'Exports your collection as an Excel file with card and portfolio data.',
    'import.exportEmpty': 'There are no cards in the collection to export yet.',
    'import.success': 'card(s) successfully imported',
    'import.errors': 'error(s) during import:',

    'scan.title': 'Scan Card (OCR)',
    'scan.idle': 'Scan a Pokémon card with your camera',
    'scan.position': 'Position the card upright (portrait) within the frame',
    'scan.analyzing': 'Analyzing card...',
    'scan.startCamera': 'Start Camera',
    'scan.capture': 'Capture & Scan',
    'scan.cancel': 'Cancel',
    'scan.again': 'Scan Again',
    'scan.ocrText': 'OCR Text:',
    'scan.noText': 'No text detected',
    'scan.matches': 'Possible matches:',
    'scan.noMatch': 'No matching cards found. Try a clearer image.',
    'scan.select': 'Select',
    'scan.cameraError': 'Camera access denied. Please allow camera permissions.',

    'empty.title': 'No cards in your collection yet.',
    'empty.addCard': 'Add a card',
    'empty.orImport': 'or import an Excel file.',

    'detail.priceHistory': 'Price History',
    'detail.edit': 'Edit',
    'detail.delete': 'Delete',

    'loading': 'Loading portfolio...',
    'error': 'Error',

    'footer': 'Prices from TCGPlayer via pokemontcg.io · Not affiliated with The Pokémon Company · For personal use only',

    // ── PWA-specific keys ──────────────────────────────────────────────────────
    'pwa.dashboard': 'Dashboard',
    'pwa.portfolio': 'Portfolio',
    'pwa.add': 'Add',
    'pwa.scan': 'Scan',
    'pwa.settings': 'Settings',
    'pwa.cards': 'cards',
    'pwa.today': 'today',
    'pwa.totalValue': 'Total Value',
    'pwa.allTime': 'All Time',
    'pwa.range30d': '30d Range',
    'pwa.cardOfDay': 'Card of the Day',
    'pwa.todayMovers': "Today's Movers",
    'pwa.gainers': 'Gainers',
    'pwa.losers': 'Losers',
    'pwa.mostValuable': 'Most Valuable',
    'pwa.activity': 'Activity',
    'pwa.searchPlaceholder': 'Name, set or code…',
    'pwa.noResults': 'No results',
    'pwa.noResultsBody': 'Try a different search term.',
    'pwa.sort.value': 'Value',
    'pwa.sort.change': 'Change',
    'pwa.sort.name': 'Name',
    'pwa.sort.price': 'Price',
    'pwa.sort.qty': 'Quantity',
    'pwa.sort.set': 'Set',
    'pwa.cardmarketTrend': 'Cardmarket Trend',
    'pwa.low': 'Low',
    'pwa.avg7': 'Ø 7d',
    'pwa.high30d': 'High 30d',
    'pwa.yourCopy': 'Your Copy',
    'pwa.owner': 'Owner',
    'pwa.condition': 'Condition',
    'pwa.grade': 'Grade',
    'pwa.quantity': 'Quantity',
    'pwa.purchasedFor': 'Purchased for',
    'pwa.pnl': 'Profit / Loss',
    'pwa.edit': 'Edit',
    'pwa.delete': 'Delete',
    'pwa.searchCard': 'Search card',
    'pwa.searchCardPlaceholder': 'Charizard or "BS 4"…',
    'pwa.searchHint': 'Name or set code + number (e.g. "PAL 072")',
    'pwa.variant': 'Variant',
    'pwa.purchasePrice': 'Purchase Price',
    'pwa.purchaseDate': 'Purchase Date',
    'pwa.addToPortfolio': 'Add to Portfolio',
    'pwa.matchFound': 'Match Found',
    'pwa.confidence': 'Confidence',
    'pwa.retry': 'Retry',
    'pwa.useMatch': 'Use Match',
    'pwa.cantScan': "Can't scan? Search manually",
    'pwa.alignCard': 'Align card in frame',
    'pwa.cameraPermTitle': 'Enable Camera',
    'pwa.cameraPermBody': 'Camera is only used locally on your device — no images are uploaded.',
    'pwa.enableCamera': 'Enable Camera',
    'pwa.holdSteady': 'Hold steady…',
    'pwa.flash': 'Flash',
    'pwa.help': 'Help',
    'pwa.capture': 'Capture',
    'pwa.importExport': 'Import / Export',
    'pwa.dropFile': 'Drop Excel or CSV here',
    'pwa.dropFileHint': '.xlsx, .csv – max. 5 MB',
    'pwa.browse': 'Browse file',
    'pwa.exportXlsx': 'Export collection as Excel',
    'pwa.downloadTemplate': 'Download template',
    'pwa.preferences': 'Preferences',
    'pwa.language': 'Language',
    'pwa.theme': 'Theme',
    'pwa.dark': 'Dark',
    'pwa.light': 'Light',
    'pwa.currency': 'Currency',
    'pwa.profile': 'Profile',
    'pwa.profileName': 'Name',
    'pwa.save': 'Save',
    'pwa.cancel': 'Cancel',
    'pwa.resetProfile': 'Reset Profile',
    'pwa.resetConfirm': 'Really reset?',
  },
} as const;

type TranslationKey = keyof typeof translations.de;

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey) => string;
  /** Translate a dynamic key with prefix. Falls back to raw value if key not found. */
  tr: (prefix: string, value: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'de',
  setLocale: () => {},
  t: (key) => key,
  tr: (_prefix, value) => value,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => {
    const saved = localStorage.getItem('pokemon-tracker-locale');
    return (saved === 'en' || saved === 'de') ? saved : 'de';
  });

  function handleSetLocale(l: Locale) {
    setLocale(l);
    localStorage.setItem('pokemon-tracker-locale', l);
  }

  function t(key: TranslationKey): string {
    return (translations[locale] as Record<string, string>)[key] ?? key;
  }

  function tr(prefix: string, value: string): string {
    const fullKey = `${prefix}.${value}`;
    return (translations[locale] as Record<string, string>)[fullKey] ?? value;
  }

  return (
    <I18nContext value={{ locale, setLocale: handleSetLocale, t, tr }}>
      {children}
    </I18nContext>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
