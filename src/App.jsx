import React, { useState, useEffect, useMemo, useRef } from 'react';
import LZString from 'lz-string';

// ─── Simulation & Parsing ─────────────────────────────────────────────────────
import { monteCarlo } from './simulation/monteCarlo.js';
import { parseDeckList } from './parser/deckParser.js';

// ─── UI Utilities ─────────────────────────────────────────────────────────────
import {
  getManaSymbol,
  renderManaCost,
  getFetchSymbol,
  renderSequenceBody,
  prepareChartData,
} from './utils/uiHelpers.jsx';

// ─── Panel Components ─────────────────────────────────────────────────────────
import LandsPanel from './components/LandsPanel.jsx';
import ArtifactsPanel from './components/ArtifactsPanel.jsx';
import CreaturesPanel from './components/CreaturesPanel.jsx';
import ExplorationPanel from './components/ExplorationPanel.jsx';
import RampSpellsPanel from './components/RampSpellsPanel.jsx';
import RitualsPanel from './components/RitualsPanel.jsx';
import SpellsPanel from './components/SpellsPanel.jsx';
import SimulationSettingsPanel from './components/SimulationSettingsPanel.jsx';
import ResultsPanel from './components/ResultsPanel.jsx';
import ComparisonResultsPanel from './components/ComparisonResultsPanel.jsx';
import DeckStatisticsPanel from './components/DeckStatisticsPanel.jsx';
import ComparisonRow from './components/ComparisonRow.jsx';

// ─── html2canvas (lazy CDN loader) ────────────────────────────────────────────
const loadHtml2Canvas = () =>
  new Promise((resolve, reject) => {
    if (window.html2canvas) {
      resolve(window.html2canvas);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = () => resolve(window.html2canvas);
    script.onerror = reject;
    document.head.appendChild(script);
  });

// =============================================================================
// localStorage persistence helpers
// =============================================================================
const STORAGE_KEY = 'mtg_mca_state';

const getSaved = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

// =============================================================================
// Shareable URL — encode / decode the full app state via the URL hash
// =============================================================================

/** Compress a plain JS object into a URL-safe hash string. */
const encodeStateToHash = obj => LZString.compressToEncodedURIComponent(JSON.stringify(obj));

/** Read + decompress the current URL hash; returns null when absent/invalid. */
const decodeHashToState = () => {
  try {
    const hash = window.location.hash.slice(1);
    if (!hash) return null;
    const json = LZString.decompressFromEncodedURIComponent(hash);
    if (!json) return null;
    return JSON.parse(json);
  } catch {
    return null;
  }
};

/**
 * Resolved once at module evaluation time so that every useState initialiser
 * can consume it directly without extra effects.
 */
const _urlState = decodeHashToState();

// Remove the hash from the address bar immediately so that subsequent
// localStorage saves are not confused by a stale hash.
if (_urlState) {
  history.replaceState(null, '', window.location.pathname + window.location.search);
}

// =============================================================================
// Deck slot — all per-deck mutable state in one object
// =============================================================================
const defaultDeckSlot = (saved = {}) => ({
  deckText: saved.deckText ?? '',
  parsedDeck: null,
  selectedKeyCards: new Set(saved.selectedKeyCards ?? []),
  includeArtifacts: saved.includeArtifacts ?? true,
  disabledArtifacts: new Set(saved.disabledArtifacts ?? []),
  includeCreatures: saved.includeCreatures ?? true,
  disabledCreatures: new Set(saved.disabledCreatures ?? []),
  includeExploration: saved.includeExploration ?? true,
  disabledExploration: new Set(saved.disabledExploration ?? []),
  includeRampSpells: saved.includeRampSpells ?? true,
  disabledRampSpells: new Set(saved.disabledRampSpells ?? []),
  includeRituals: saved.includeRituals ?? true,
  disabledRituals: new Set(saved.disabledRituals ?? []),
  simulationResults: null,
});

const serializeDeckSlot = slot => ({
  deckText: slot.deckText,
  selectedKeyCards: [...slot.selectedKeyCards],
  includeArtifacts: slot.includeArtifacts,
  disabledArtifacts: [...slot.disabledArtifacts],
  includeCreatures: slot.includeCreatures,
  disabledCreatures: [...slot.disabledCreatures],
  includeExploration: slot.includeExploration,
  disabledExploration: [...slot.disabledExploration],
  includeRampSpells: slot.includeRampSpells,
  disabledRampSpells: [...slot.disabledRampSpells],
  includeRituals: slot.includeRituals,
  disabledRituals: [...slot.disabledRituals],
});

// =============================================================================
// hasCastables — true when a deck has any non-land spells to track
// =============================================================================
const hasCastables = deck =>
  deck &&
  (deck.spells.length > 0 ||
    deck.creatures.length > 0 ||
    deck.artifacts.length > 0 ||
    deck.rituals?.length > 0 ||
    deck.rampSpells?.length > 0 ||
    deck.exploration?.length > 0);

// Scryfall API usage limits per browser session.
// Cards already in the local cache never count against these.
const SCRYFALL_SOFT_LIMIT = 60; // show advisory warning
const SCRYFALL_HARD_LIMIT = 150; // block further API calls

// =============================================================================
const MTGMonteCarloAnalyzer = () => {
  // URL hash state takes priority over localStorage, read once at startup.
  const [_s] = useState(() => _urlState ?? getSaved());
  // ── Data source ────────────────────────────────────────────────────────────
  const [apiMode, setApiMode] = useState(() => _s.apiMode ?? 'local');
  const [cardsDatabase, setCardsDatabase] = useState(null);
  // Mutable lookup cache — intentionally a ref so updates don't trigger re-renders
  const lookupCacheRef = useRef(new Map());

  // ── Scryfall API rate limiting ─────────────────────────────────────────────
  // Count is state (for display in JSX) and also mirrored in sessionStorage
  // so it survives React re-renders but resets when the tab is closed.
  const [scryfallCallCount, setScryfallCallCount] = useState(() =>
    parseInt(sessionStorage.getItem('scryfall_call_count') || '0', 10)
  );

  // ── Comparison mode ────────────────────────────────────────────────────────
  const [comparisonMode, setComparisonMode] = useState(() => _s.comparisonMode ?? false);
  const [labelA, setLabelA] = useState(() => _s.labelA ?? 'Deck A');
  const [labelB, setLabelB] = useState(() => _s.labelB ?? 'Deck B');

  // ── Shared slot-setter factory ───────────────────────────────────────────
  const makeSetterForSlot = setSlot => key => valOrFn =>
    setSlot(prev => ({
      ...prev,
      [key]: typeof valOrFn === 'function' ? valOrFn(prev[key]) : valOrFn,
    }));

  // ── Deck Slot A ───────────────────────────────────────────────────────────
  const [deckSlotA, setDeckSlotA] = useState(() => defaultDeckSlot(_s.slotA ?? _s));
  const makeSlotSetterA = makeSetterForSlot(setDeckSlotA);

  const setDeckText = makeSlotSetterA('deckText');
  const setParsedDeck = makeSlotSetterA('parsedDeck');
  const setSelectedKeyCards = makeSlotSetterA('selectedKeyCards');
  const setIncludeArtifacts = makeSlotSetterA('includeArtifacts');
  const setDisabledArtifacts = makeSlotSetterA('disabledArtifacts');
  const setIncludeCreatures = makeSlotSetterA('includeCreatures');
  const setDisabledCreatures = makeSlotSetterA('disabledCreatures');
  const setIncludeExploration = makeSlotSetterA('includeExploration');
  const setDisabledExploration = makeSlotSetterA('disabledExploration');
  const setIncludeRampSpells = makeSlotSetterA('includeRampSpells');
  const setDisabledRampSpells = makeSlotSetterA('disabledRampSpells');
  const setIncludeRituals = makeSlotSetterA('includeRituals');
  const setDisabledRituals = makeSlotSetterA('disabledRituals');
  const setSimulationResults = makeSlotSetterA('simulationResults');

  const {
    deckText,
    parsedDeck,
    selectedKeyCards,
    includeArtifacts,
    disabledArtifacts,
    includeCreatures,
    disabledCreatures,
    includeExploration,
    disabledExploration,
    includeRampSpells,
    disabledRampSpells,
    includeRituals,
    disabledRituals,
    simulationResults,
  } = deckSlotA;

  // ── Deck Slot B ───────────────────────────────────────────────────────────
  const [deckSlotB, setDeckSlotB] = useState(() => defaultDeckSlot(_s.slotB ?? {}));
  const makeSlotSetterB = makeSetterForSlot(setDeckSlotB);

  const setDeckTextB = makeSlotSetterB('deckText');
  const setParsedDeckB = makeSlotSetterB('parsedDeck');
  const setSelectedKeyCardsB = makeSlotSetterB('selectedKeyCards');
  const setIncludeArtifactsB = makeSlotSetterB('includeArtifacts');
  const setDisabledArtifactsB = makeSlotSetterB('disabledArtifacts');
  const setIncludeCreaturesB = makeSlotSetterB('includeCreatures');
  const setDisabledCreaturesB = makeSlotSetterB('disabledCreatures');
  const setIncludeExplorationB = makeSlotSetterB('includeExploration');
  const setDisabledExplorationB = makeSlotSetterB('disabledExploration');
  const setIncludeRampSpellsB = makeSlotSetterB('includeRampSpells');
  const setDisabledRampSpellsB = makeSlotSetterB('disabledRampSpells');
  const setIncludeRitualsB = makeSlotSetterB('includeRituals');
  const setDisabledRitualsB = makeSlotSetterB('disabledRituals');
  const setSimulationResultsB = makeSlotSetterB('simulationResults');

  const {
    deckText: deckTextB,
    parsedDeck: parsedDeckB,
    selectedKeyCards: selectedKeyCardsB,
    includeArtifacts: includeArtifactsB,
    disabledArtifacts: disabledArtifactsB,
    includeCreatures: includeCreaturesB,
    disabledCreatures: disabledCreaturesB,
    includeExploration: includeExplorationB,
    disabledExploration: disabledExplorationB,
    includeRampSpells: includeRampSpellsB,
    disabledRampSpells: disabledRampSpellsB,
    includeRituals: includeRitualsB,
    disabledRituals: disabledRitualsB,
    simulationResults: simulationResultsB,
  } = deckSlotB;

  const [error, setError] = useState('');

  // ── Mulligan settings ──────────────────────────────────────────────────────
  const [enableMulligans, setEnableMulligans] = useState(() => _s.enableMulligans ?? false);
  const [mulliganRule, setMulliganRule] = useState(() => _s.mulliganRule ?? 'london');
  const [mulliganStrategy, setMulliganStrategy] = useState(() => _s.mulliganStrategy ?? 'balanced');
  const [customMulliganRules, setCustomMulliganRules] = useState(
    () =>
      _s.customMulliganRules ?? {
        mulligan0Lands: true,
        mulligan7Lands: true,
        mulliganNoPlaysByTurn: false,
        noPlaysTurnThreshold: 2,
        mulliganMinLands: false,
        minLandsThreshold: 1,
        mulliganMaxLands: false,
        maxLandsThreshold: 5,
      }
  );

  // ── Simulation settings ────────────────────────────────────────────────────
  const [iterations, setIterations] = useState(() => _s.iterations ?? 10000);
  const [turns, setTurns] = useState(() => _s.turns ?? 7);
  const [handSize, setHandSize] = useState(() => _s.handSize ?? 7);
  const [maxSequences, setMaxSequences] = useState(() => _s.maxSequences ?? 1);
  const [selectedTurnForSequences, setSelectedTurnForSequences] = useState(
    () => _s.selectedTurnForSequences ?? 3
  );
  const [commanderMode, setCommanderMode] = useState(() => _s.commanderMode ?? false);

  // ── Flood / screw thresholds ───────────────────────────────────────────────
  const [floodNLands, setFloodNLands] = useState(() => _s.floodNLands ?? 5);
  const [floodTurn, setFloodTurn] = useState(() => _s.floodTurn ?? 5);
  const [screwNLands, setScrewNLands] = useState(() => _s.screwNLands ?? 2);
  const [screwTurn, setScrewTurn] = useState(() => _s.screwTurn ?? 3);

  const [isSimulating, setIsSimulating] = useState(false);

  // ── Share URL ──────────────────────────────────────────────────────────────
  const [shareCopied, setShareCopied] = useState(false);

  const handleShareUrl = () => {
    const payload = {
      apiMode,
      comparisonMode,
      labelA,
      labelB,
      slotA: serializeDeckSlot(deckSlotA),
      slotB: serializeDeckSlot(deckSlotB),
      iterations,
      turns,
      handSize,
      maxSequences,
      selectedTurnForSequences,
      commanderMode,
      enableMulligans,
      mulliganRule,
      mulliganStrategy,
      customMulliganRules,
      floodNLands,
      floodTurn,
      screwNLands,
      screwTurn,
    };
    const hash = encodeStateToHash(payload);
    const url = `${window.location.origin}${window.location.pathname}#${hash}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    });
  };

  // ── Derived chart data ─────────────────────────────────────────────────────
  const chartData = useMemo(
    () => (simulationResults ? prepareChartData(simulationResults, turns) : null),
    [simulationResults, turns]
  );
  const chartDataB = useMemo(
    () => (simulationResultsB ? prepareChartData(simulationResultsB, turns) : null),
    [simulationResultsB, turns]
  );

  // ── Persist settings & deck text to localStorage ──────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          apiMode,
          comparisonMode,
          labelA,
          labelB,
          slotA: serializeDeckSlot(deckSlotA),
          slotB: serializeDeckSlot(deckSlotB),
          iterations,
          turns,
          handSize,
          maxSequences,
          selectedTurnForSequences,
          commanderMode,
          enableMulligans,
          mulliganRule,
          mulliganStrategy,
          customMulliganRules,
          floodNLands,
          floodTurn,
          screwNLands,
          screwTurn,
        })
      );
    } catch (err) {
      console.warn('localStorage save failed:', err);
    }
  }, [
    deckSlotA,
    deckSlotB,
    apiMode,
    comparisonMode,
    labelA,
    labelB,
    iterations,
    turns,
    handSize,
    maxSequences,
    selectedTurnForSequences,
    commanderMode,
    enableMulligans,
    mulliganRule,
    mulliganStrategy,
    customMulliganRules,
    floodNLands,
    floodTurn,
    screwNLands,
    screwTurn,
  ]);

  // ============================================================================
  // File upload — builds the lookup cache from a local Scryfall Default Cards JSON
  // ============================================================================
  const handleFileUpload = async event => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 1024 * 1024 * 1024) {
      setError(
        'File too large (max 1 GB). The Scryfall Default Cards file should be around 200-300 MB.'
      );
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!Array.isArray(data)) {
        setError('Invalid JSON format. Expected an array of card objects.');
        return;
      }

      setCardsDatabase(data);

      const lookupMap = new Map();

      data.forEach(card => {
        if (
          card.layout === 'token' ||
          card.layout === 'double_faced_token' ||
          card.set_type === 'token' ||
          card.type_line?.includes('Token')
        ) {
          return;
        }

        const name = card.name.toLowerCase();
        if (lookupMap.has(name)) {
          const existing = lookupMap.get(name);
          if ((card.cmc || 0) > (existing.cmc || 0)) lookupMap.set(name, card);
        } else {
          lookupMap.set(name, card);
        }
      });

      lookupCacheRef.current = lookupMap;
      setError('');
    } catch (err) {
      setError('Invalid JSON file. Please check the file format.');
      console.error(err);
    }
  };

  // ============================================================================
  // Card lookup (local map + optional Scryfall API fallback)
  // ============================================================================
  const lookupCard = async cardName => {
    const cache = lookupCacheRef.current;
    const searchName = cardName.toLowerCase().trim();

    if (cache.has(searchName)) return cache.get(searchName);

    for (const [name, card] of cache.entries()) {
      if (name.startsWith(searchName) || name.includes(searchName)) return card;
    }

    if (apiMode === 'scryfall') {
      // Hard limit — stop making API calls for the rest of this session
      if (scryfallCallCount >= SCRYFALL_HARD_LIMIT) return null;

      try {
        const response = await fetch(
          `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`
        );
        if (response.ok) {
          const data = await response.json();

          // Track every real API request made
          const newCount = scryfallCallCount + 1;
          sessionStorage.setItem('scryfall_call_count', newCount);
          setScryfallCallCount(newCount);

          if (
            data.layout === 'token' ||
            data.layout === 'double_faced_token' ||
            data.set_type === 'token' ||
            data.type_line?.includes('Token')
          ) {
            console.warn(`⚠️ Skipping token for: ${cardName}`);
            const searchResponse = await fetch(
              `https://api.scryfall.com/cards/search?q=!"${encodeURIComponent(cardName)}"+-is:token&unique=cards&order=released`
            );
            if (searchResponse.ok) {
              const searchData = await searchResponse.json();
              if (searchData.data && searchData.data.length > 0) {
                const nonToken = searchData.data[0];
                cache.set(searchName, nonToken);
                return nonToken;
              }
            }
            return null;
          }

          cache.set(searchName, data);
          return data;
        }
      } catch (err) {
        console.error('Scryfall API error:', err);
      }
    }

    return null;
  };

  // ============================================================================
  // Parse deck — calls the extracted parseDeckList module
  // text: deck list string; setDeck: slot setter; label: optional name for error msg
  // ============================================================================
  const handleParseDeck = async (text, setDeck, clearKeyCards, label) => {
    const deck = await parseDeckList(text, {
      cardLookupMap: lookupCacheRef.current,
      apiMode,
      lookupCard,
    });
    if (deck) {
      setDeck(deck);
      clearKeyCards(new Set());
      setError(deck.errors?.length > 0 ? deck.errors.join(', ') : '');
    } else {
      setDeck(null);
      setError(label ? `Parsing failed (${label})` : 'Parsing failed');
    }
  };

  // ============================================================================
  // Run Monte Carlo simulation — calls the extracted monteCarlo module
  // ============================================================================
  const buildSimConfig = slot => ({
    iterations,
    turns,
    handSize,
    maxSequences,
    commanderMode,
    enableMulligans,
    mulliganRule,
    mulliganStrategy,
    customMulliganRules,
    floodNLands,
    floodTurn,
    screwNLands,
    screwTurn,
    selectedKeyCards: slot.selectedKeyCards,
    includeExploration: slot.includeExploration,
    disabledExploration: slot.disabledExploration,
    includeRampSpells: slot.includeRampSpells,
    disabledRampSpells: slot.disabledRampSpells,
    includeArtifacts: slot.includeArtifacts,
    disabledArtifacts: slot.disabledArtifacts,
    includeCreatures: slot.includeCreatures,
    disabledCreatures: slot.disabledCreatures,
    includeRituals: slot.includeRituals,
    disabledRituals: slot.disabledRituals,
  });

  const runSimulation = () => {
    if (!parsedDeck) {
      setError('Please parse a deck first');
      return;
    }

    // In comparison mode require both decks to be parsed
    if (comparisonMode && !parsedDeckB) {
      setError('Please parse Deck B first');
      return;
    }

    setIsSimulating(true);
    setError('');

    setTimeout(() => {
      try {
        setSimulationResults(monteCarlo(parsedDeck, buildSimConfig(deckSlotA)));
        if (comparisonMode)
          setSimulationResultsB(monteCarlo(parsedDeckB, buildSimConfig(deckSlotB)));
        setIsSimulating(false);
      } catch (err) {
        setError('Simulation error: ' + err.message);
        setIsSimulating(false);
      }
    }, 100);
  };

  // ============================================================================
  // Export results as PNG (uses html2canvas CDN)
  // ============================================================================
  const exportResultsAsPNG = async event => {
    if (!simulationResults) return;
    try {
      const html2canvas = await loadHtml2Canvas();
      const resultsSection = document.getElementById('results-section');
      if (!resultsSection) {
        alert('Results section not found');
        return;
      }

      const button = event.target;
      const originalText = button.textContent;
      button.textContent = '📸 Capturing...';
      button.disabled = true;

      await new Promise(r => setTimeout(r, 500));

      const canvas = await html2canvas(resultsSection, {
        backgroundColor: '#f9fafb',
        scale: 2,
        logging: false,
        useCORS: true,
      });

      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mtg-simulation-results-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        button.textContent = originalText;
        button.disabled = false;
      });
    } catch (err) {
      console.error('Export error:', err);
      alert(
        'Failed to export. Please use your browser screenshot tool ' +
          '(Ctrl+Shift+S on Windows, Cmd+Shift+5 on Mac)'
      );
      if (event?.target) event.target.disabled = false;
    }
  };

  // ============================================================================
  // Export results as CSV — comparison-aware
  // ============================================================================
  const exportResultsAsCSV = () => {
    const buildRows = cd => {
      if (!cd) return [];
      const { landsData, manaByColorData, lifeLossData, keyCardsData } = cd;
      return Array.from({ length: landsData.length }, (_, i) => {
        const row = {
          Turn: landsData[i].turn,
          'Total Lands': landsData[i]['Total Lands'],
          'Untapped Lands': landsData[i]['Untapped Lands'],
          'Total Mana': manaByColorData[i]['Total Mana'],
          'W Mana': manaByColorData[i].W,
          'U Mana': manaByColorData[i].U,
          'B Mana': manaByColorData[i].B,
          'R Mana': manaByColorData[i].R,
          'G Mana': manaByColorData[i].G,
          'Life Loss': lifeLossData[i]['Life Loss'],
        };
        const keyRow = keyCardsData[i];
        Object.keys(keyRow).forEach(k => {
          if (k !== 'turn') row[k] = keyRow[k];
        });
        return row;
      });
    };

    const rowsA = buildRows(chartData);
    const rowsB = buildRows(chartDataB);

    if (!rowsA.length && !rowsB.length) return;

    let rows, headers;
    if (comparisonMode && rowsA.length && rowsB.length) {
      // Merge: prefix all columns with deck label
      const headersA = Object.keys(rowsA[0]).map(k => (k === 'Turn' ? 'Turn' : `${labelA}: ${k}`));
      const headersB = Object.keys(rowsB[0])
        .filter(k => k !== 'Turn')
        .map(k => `${labelB}: ${k}`);
      headers = [...headersA, ...headersB];
      rows = rowsA.map((ra, i) => {
        const rb = rowsB[i] || {};
        const merged = {};
        Object.keys(ra).forEach((k, j) => {
          merged[headersA[j]] = ra[k];
        });
        Object.keys(rb)
          .filter(k => k !== 'Turn')
          .forEach(k => {
            merged[`${labelB}: ${k}`] = rb[k];
          });
        return merged;
      });
    } else {
      rows = rowsA.length ? rowsA : rowsB;
      headers = Object.keys(rows[0]);
    }

    const escape = v => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const csv = [
      headers.map(escape).join(','),
      ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mtg-simulation-results-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ============================================================================
  // Render helpers — per-slot deck panels (reused for both A and B columns)
  // ============================================================================
  // ============================================================================
  // Render
  // ============================================================================
  return (
    <div className="app-root">
      {/* Header */}
      <div className="app-header">
        <div className="app-header__titles">
          <h1>🎲 MTG Monte Carlo Deck Analyzer</h1>
          <p>Simulation-based deck analysis for Magic: The Gathering</p>
        </div>
        <button
          className={`btn-share${shareCopied ? ' btn-share--copied' : ''}`}
          onClick={handleShareUrl}
          title="Copy a shareable link to this exact configuration"
        >
          {shareCopied ? '✓ Copied!' : '🔗 Share'}
        </button>
      </div>

      {/* Data Source */}
      <div className="panel">
        <h3>⚙️ Data Source</h3>
        <div className="radio-group" style={{ marginBottom: 12 }}>
          <label className="radio-label">
            <input
              type="radio"
              checked={apiMode === 'local'}
              onChange={() => setApiMode('local')}
            />
            Local JSON File
          </label>
          <label className="radio-label">
            <input
              type="radio"
              checked={apiMode === 'scryfall'}
              onChange={() => setApiMode('scryfall')}
            />
            Scryfall API (Fallback)
          </label>
        </div>

        {/* Scryfall usage warnings */}
        {apiMode === 'scryfall' &&
          scryfallCallCount >= SCRYFALL_SOFT_LIMIT &&
          scryfallCallCount < SCRYFALL_HARD_LIMIT && (
            <div className="scryfall-usage-warning">
              ⚠️ You&apos;ve made {scryfallCallCount} Scryfall API requests this session. For large
              or repeated imports, switch to the{' '}
              <button className="inline-link" onClick={() => setApiMode('local')}>
                Local JSON file
              </button>{' '}
              to avoid hitting rate limits.
            </div>
          )}
        {apiMode === 'scryfall' && scryfallCallCount >= SCRYFALL_HARD_LIMIT && (
          <div className="scryfall-usage-blocked">
            🚫 Scryfall API limit reached ({SCRYFALL_HARD_LIMIT} requests this session). Please{' '}
            <button className="inline-link" onClick={() => setApiMode('local')}>
              switch to Local JSON
            </button>{' '}
            for further lookups, or reload the page to reset the counter.{' '}
            <em>Tip: the local JSON file is faster and works offline.</em>
          </div>
        )}

        {apiMode === 'local' && (
          <div className="upload-section">
            <div className="upload-instructions">
              <p>📥 How to get cards.json:</p>
              <ol>
                <li>
                  Visit{' '}
                  <a
                    href="https://scryfall.com/docs/api/bulk-data"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Scryfall Bulk Data
                  </a>
                </li>
                <li>
                  Download <strong>&quot;Default Cards&quot;</strong> (not &quot;All Cards&quot; or
                  &quot;Oracle Cards&quot;)
                </li>
                <li>File size should be ~200-300 MB (compressed)</li>
                <li>Upload the JSON file below</li>
              </ol>
            </div>
            <input type="file" accept=".json" onChange={handleFileUpload} className="file-input" />
            {cardsDatabase && (
              <p className="loaded-success">
                ✓ Loaded {cardsDatabase.length.toLocaleString()} cards
              </p>
            )}
          </div>
        )}

        {/* Mode toggle */}
        <div style={{ marginTop: 16 }}>
          <div className="mode-toggle">
            <button
              className={`mode-toggle__btn${!comparisonMode ? ' mode-toggle__btn--active' : ''}`}
              onClick={() => setComparisonMode(false)}
            >
              🃏 Single Deck
            </button>
            <button
              className={`mode-toggle__btn${comparisonMode ? ' mode-toggle__btn--active' : ''}`}
              onClick={() => setComparisonMode(true)}
            >
              ⚔️ Compare Two Decks
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && <div className="error-banner">⚠️ {error}</div>}

      {/* ── Single-deck mode ─────────────────────────────────────────────── */}
      {!comparisonMode && (
        <>
          {/* Deck Input */}
          <div className="panel">
            <div className="panel-header-row">
              <h3>📝 Deck List</h3>
            </div>
            <div>
              <div className="deck-section-label">Deck</div>
              <textarea
                value={deckText}
                onChange={e => setDeckText(e.target.value)}
                placeholder={
                  'Paste your deck list here (MTG Arena format)\nExample:\n4 Lightning Bolt\n4 Island\n3 Counterspell'
                }
                className="deck-textarea"
              />
            </div>
            <button
              onClick={() => handleParseDeck(deckText, setParsedDeck, setSelectedKeyCards)}
              className="btn-primary"
            >
              Parse Deck
            </button>
          </div>

          {/* Parsed Deck panels */}
          {parsedDeck && (
            <div>
              <DeckStatisticsPanel parsedDeck={parsedDeck} />

              {/* Lands */}
              <div className="panel-grid">
                <LandsPanel
                  parsedDeck={parsedDeck}
                  getManaSymbol={getManaSymbol}
                  getFetchSymbol={getFetchSymbol}
                />
              </div>

              {parsedDeck.artifacts.length > 0 && (
                <div className="panel-grid">
                  <ArtifactsPanel
                    parsedDeck={parsedDeck}
                    includeArtifacts={includeArtifacts}
                    setIncludeArtifacts={setIncludeArtifacts}
                    disabledArtifacts={disabledArtifacts}
                    setDisabledArtifacts={setDisabledArtifacts}
                    getManaSymbol={getManaSymbol}
                  />
                </div>
              )}

              {parsedDeck.creatures.length > 0 && (
                <div className="panel-grid">
                  <CreaturesPanel
                    parsedDeck={parsedDeck}
                    includeCreatures={includeCreatures}
                    setIncludeCreatures={setIncludeCreatures}
                    disabledCreatures={disabledCreatures}
                    setDisabledCreatures={setDisabledCreatures}
                    getManaSymbol={getManaSymbol}
                  />
                </div>
              )}

              {parsedDeck.exploration?.length > 0 && (
                <div className="panel-grid">
                  <ExplorationPanel
                    parsedDeck={parsedDeck}
                    includeExploration={includeExploration}
                    setIncludeExploration={setIncludeExploration}
                    disabledExploration={disabledExploration}
                    setDisabledExploration={setDisabledExploration}
                  />
                </div>
              )}

              {parsedDeck.rampSpells?.length > 0 && (
                <div className="panel-grid">
                  <RampSpellsPanel
                    parsedDeck={parsedDeck}
                    includeRampSpells={includeRampSpells}
                    setIncludeRampSpells={setIncludeRampSpells}
                    disabledRampSpells={disabledRampSpells}
                    setDisabledRampSpells={setDisabledRampSpells}
                    renderManaCost={renderManaCost}
                  />
                </div>
              )}

              {parsedDeck.rituals?.length > 0 && (
                <div className="panel-grid">
                  <RitualsPanel
                    parsedDeck={parsedDeck}
                    includeRituals={includeRituals}
                    setIncludeRituals={setIncludeRituals}
                    disabledRituals={disabledRituals}
                    setDisabledRituals={setDisabledRituals}
                    renderManaCost={renderManaCost}
                  />
                </div>
              )}

              {(parsedDeck.spells.length > 0 ||
                parsedDeck.creatures.length > 0 ||
                parsedDeck.artifacts.length > 0 ||
                parsedDeck.rituals?.length > 0 ||
                parsedDeck.rampSpells?.length > 0 ||
                parsedDeck.exploration?.length > 0) && (
                <SpellsPanel
                  parsedDeck={parsedDeck}
                  selectedKeyCards={selectedKeyCards}
                  setSelectedKeyCards={setSelectedKeyCards}
                  renderManaCost={renderManaCost}
                />
              )}

              {/* Simulation Settings */}
              <SimulationSettingsPanel
                iterations={iterations}
                setIterations={setIterations}
                turns={turns}
                setTurns={setTurns}
                handSize={handSize}
                setHandSize={setHandSize}
                maxSequences={maxSequences}
                setMaxSequences={setMaxSequences}
                selectedTurnForSequences={selectedTurnForSequences}
                setSelectedTurnForSequences={setSelectedTurnForSequences}
                commanderMode={commanderMode}
                setCommanderMode={setCommanderMode}
                enableMulligans={enableMulligans}
                setEnableMulligans={setEnableMulligans}
                mulliganRule={mulliganRule}
                setMulliganRule={setMulliganRule}
                mulliganStrategy={mulliganStrategy}
                setMulliganStrategy={setMulliganStrategy}
                customMulliganRules={customMulliganRules}
                setCustomMulliganRules={setCustomMulliganRules}
                floodNLands={floodNLands}
                setFloodNLands={setFloodNLands}
                floodTurn={floodTurn}
                setFloodTurn={setFloodTurn}
                screwNLands={screwNLands}
                setScrewNLands={setScrewNLands}
                screwTurn={screwTurn}
                setScrewTurn={setScrewTurn}
                runSimulation={runSimulation}
                isSimulating={isSimulating}
              />
            </div>
          )}

          {/* Single-deck Results */}
          <ResultsPanel
            simulationResults={simulationResults}
            chartData={chartData}
            iterations={iterations}
            enableMulligans={enableMulligans}
            selectedKeyCards={selectedKeyCards}
            selectedTurnForSequences={selectedTurnForSequences}
            exportResultsAsPNG={exportResultsAsPNG}
            exportResultsAsCSV={exportResultsAsCSV}
            renderSequenceBody={renderSequenceBody}
          />
        </>
      )}

      {/* ── Comparison mode ───────────────────────────────────────────────── */}
      {comparisonMode && (
        <>
          {/* Row: Deck inputs */}
          <div className="deck-columns">
            <div className="panel">
              <div className="deck-column-header deck-column-header--a">{labelA}</div>
              <input
                className="deck-label-input"
                value={labelA}
                onChange={e => setLabelA(e.target.value)}
                placeholder="Deck A name"
              />
              <textarea
                value={deckText}
                onChange={e => setDeckText(e.target.value)}
                placeholder="Paste deck list here (MTG Arena format)"
                className="deck-textarea"
                style={{ height: 180 }}
              />
              <button
                onClick={() => handleParseDeck(deckText, setParsedDeck, setSelectedKeyCards)}
                className="btn-primary"
              >
                Parse Deck
              </button>
            </div>
            <div className="panel">
              <div className="deck-column-header deck-column-header--b">{labelB}</div>
              <input
                className="deck-label-input"
                value={labelB}
                onChange={e => setLabelB(e.target.value)}
                placeholder="Deck B name"
              />
              <textarea
                value={deckTextB}
                onChange={e => setDeckTextB(e.target.value)}
                placeholder="Paste deck list here (MTG Arena format)"
                className="deck-textarea"
                style={{ height: 180 }}
              />
              <button
                onClick={() =>
                  handleParseDeck(deckTextB, setParsedDeckB, setSelectedKeyCardsB, 'Deck B')
                }
                className="btn-primary"
              >
                Parse Deck
              </button>
            </div>
          </div>

          {/* Row: Lands */}
          <ComparisonRow
            left={
              parsedDeck ? (
                <LandsPanel
                  parsedDeck={parsedDeck}
                  getManaSymbol={getManaSymbol}
                  getFetchSymbol={getFetchSymbol}
                />
              ) : null
            }
            right={
              parsedDeckB ? (
                <LandsPanel
                  parsedDeck={parsedDeckB}
                  getManaSymbol={getManaSymbol}
                  getFetchSymbol={getFetchSymbol}
                />
              ) : null
            }
          />

          {/* Row: Artifacts */}
          <ComparisonRow
            left={
              parsedDeck?.artifacts?.length > 0 ? (
                <ArtifactsPanel
                  parsedDeck={parsedDeck}
                  includeArtifacts={includeArtifacts}
                  setIncludeArtifacts={setIncludeArtifacts}
                  disabledArtifacts={disabledArtifacts}
                  setDisabledArtifacts={setDisabledArtifacts}
                  getManaSymbol={getManaSymbol}
                />
              ) : null
            }
            right={
              parsedDeckB?.artifacts?.length > 0 ? (
                <ArtifactsPanel
                  parsedDeck={parsedDeckB}
                  includeArtifacts={includeArtifactsB}
                  setIncludeArtifacts={setIncludeArtifactsB}
                  disabledArtifacts={disabledArtifactsB}
                  setDisabledArtifacts={setDisabledArtifactsB}
                  getManaSymbol={getManaSymbol}
                />
              ) : null
            }
          />

          {/* Row: Creatures */}
          <ComparisonRow
            left={
              parsedDeck?.creatures?.length > 0 ? (
                <CreaturesPanel
                  parsedDeck={parsedDeck}
                  includeCreatures={includeCreatures}
                  setIncludeCreatures={setIncludeCreatures}
                  disabledCreatures={disabledCreatures}
                  setDisabledCreatures={setDisabledCreatures}
                  getManaSymbol={getManaSymbol}
                />
              ) : null
            }
            right={
              parsedDeckB?.creatures?.length > 0 ? (
                <CreaturesPanel
                  parsedDeck={parsedDeckB}
                  includeCreatures={includeCreaturesB}
                  setIncludeCreatures={setIncludeCreaturesB}
                  disabledCreatures={disabledCreaturesB}
                  setDisabledCreatures={setDisabledCreaturesB}
                  getManaSymbol={getManaSymbol}
                />
              ) : null
            }
          />

          {/* Row: Exploration */}
          <ComparisonRow
            left={
              parsedDeck?.exploration?.length > 0 ? (
                <ExplorationPanel
                  parsedDeck={parsedDeck}
                  includeExploration={includeExploration}
                  setIncludeExploration={setIncludeExploration}
                  disabledExploration={disabledExploration}
                  setDisabledExploration={setDisabledExploration}
                />
              ) : null
            }
            right={
              parsedDeckB?.exploration?.length > 0 ? (
                <ExplorationPanel
                  parsedDeck={parsedDeckB}
                  includeExploration={includeExplorationB}
                  setIncludeExploration={setIncludeExplorationB}
                  disabledExploration={disabledExplorationB}
                  setDisabledExploration={setDisabledExplorationB}
                />
              ) : null
            }
          />

          {/* Row: Ramp Spells */}
          <ComparisonRow
            left={
              parsedDeck?.rampSpells?.length > 0 ? (
                <RampSpellsPanel
                  parsedDeck={parsedDeck}
                  includeRampSpells={includeRampSpells}
                  setIncludeRampSpells={setIncludeRampSpells}
                  disabledRampSpells={disabledRampSpells}
                  setDisabledRampSpells={setDisabledRampSpells}
                  renderManaCost={renderManaCost}
                />
              ) : null
            }
            right={
              parsedDeckB?.rampSpells?.length > 0 ? (
                <RampSpellsPanel
                  parsedDeck={parsedDeckB}
                  includeRampSpells={includeRampSpellsB}
                  setIncludeRampSpells={setIncludeRampSpellsB}
                  disabledRampSpells={disabledRampSpellsB}
                  setDisabledRampSpells={setDisabledRampSpellsB}
                  renderManaCost={renderManaCost}
                />
              ) : null
            }
          />

          {/* Row: Rituals */}
          <ComparisonRow
            left={
              parsedDeck?.rituals?.length > 0 ? (
                <RitualsPanel
                  parsedDeck={parsedDeck}
                  includeRituals={includeRituals}
                  setIncludeRituals={setIncludeRituals}
                  disabledRituals={disabledRituals}
                  setDisabledRituals={setDisabledRituals}
                  renderManaCost={renderManaCost}
                />
              ) : null
            }
            right={
              parsedDeckB?.rituals?.length > 0 ? (
                <RitualsPanel
                  parsedDeck={parsedDeckB}
                  includeRituals={includeRitualsB}
                  setIncludeRituals={setIncludeRitualsB}
                  disabledRituals={disabledRitualsB}
                  setDisabledRituals={setDisabledRitualsB}
                  renderManaCost={renderManaCost}
                />
              ) : null
            }
          />

          {/* Row: Spells / Key-card selector */}
          <ComparisonRow
            left={
              hasCastables(parsedDeck) ? (
                <SpellsPanel
                  parsedDeck={parsedDeck}
                  selectedKeyCards={selectedKeyCards}
                  setSelectedKeyCards={setSelectedKeyCards}
                  renderManaCost={renderManaCost}
                />
              ) : null
            }
            right={
              hasCastables(parsedDeckB) ? (
                <SpellsPanel
                  parsedDeck={parsedDeckB}
                  selectedKeyCards={selectedKeyCardsB}
                  setSelectedKeyCards={setSelectedKeyCardsB}
                  renderManaCost={renderManaCost}
                />
              ) : null
            }
          />

          {/* Shared simulation settings */}
          {(parsedDeck || parsedDeckB) && (
            <SimulationSettingsPanel
              iterations={iterations}
              setIterations={setIterations}
              turns={turns}
              setTurns={setTurns}
              handSize={handSize}
              setHandSize={setHandSize}
              maxSequences={maxSequences}
              setMaxSequences={setMaxSequences}
              selectedTurnForSequences={selectedTurnForSequences}
              setSelectedTurnForSequences={setSelectedTurnForSequences}
              commanderMode={commanderMode}
              setCommanderMode={setCommanderMode}
              enableMulligans={enableMulligans}
              setEnableMulligans={setEnableMulligans}
              mulliganRule={mulliganRule}
              setMulliganRule={setMulliganRule}
              mulliganStrategy={mulliganStrategy}
              setMulliganStrategy={setMulliganStrategy}
              customMulliganRules={customMulliganRules}
              setCustomMulliganRules={setCustomMulliganRules}
              floodNLands={floodNLands}
              setFloodNLands={setFloodNLands}
              floodTurn={floodTurn}
              setFloodTurn={setFloodTurn}
              screwNLands={screwNLands}
              setScrewNLands={setScrewNLands}
              screwTurn={screwTurn}
              setScrewTurn={setScrewTurn}
              runSimulation={runSimulation}
              isSimulating={isSimulating}
            />
          )}

          {/* Comparison Results */}
          {chartData && chartDataB ? (
            <ComparisonResultsPanel
              chartDataA={chartData}
              chartDataB={chartDataB}
              simulationResultsA={simulationResults}
              simulationResultsB={simulationResultsB}
              iterations={iterations}
              enableMulligans={enableMulligans}
              selectedKeyCardsA={selectedKeyCards}
              selectedKeyCardsB={selectedKeyCardsB}
              labelA={labelA}
              labelB={labelB}
              exportResultsAsPNG={exportResultsAsPNG}
              exportResultsAsCSV={exportResultsAsCSV}
            />
          ) : chartData || chartDataB ? (
            <div className="panel">
              <p className="card-meta">
                {chartData
                  ? `${labelA} has results. Parse and simulate ${labelB} to see the comparison.`
                  : `${labelB} has results. Parse and simulate ${labelA} to see the comparison.`}
              </p>
            </div>
          ) : null}
        </>
      )}

      {/* Footer */}
      <div className="app-footer">
        <p>All card data © Wizards of the Coast</p>
        <p className="app-version">v{__APP_VERSION__}</p>
      </div>
    </div>
  );
};

export default MTGMonteCarloAnalyzer;
