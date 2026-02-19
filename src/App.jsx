import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar,
  XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

// ─── Simulation & Parsing ─────────────────────────────────────────────────────
import { monteCarlo }     from './simulation/monteCarlo.js';
import { parseDeckList }  from './parser/deckParser.js';

// ─── UI Utilities ─────────────────────────────────────────────────────────────
import {
  getManaSymbol,
  renderManaCost,
  getFetchSymbol,
  renderSequenceBody,
  prepareChartData,
} from './utils/uiHelpers.jsx';

// ─── Panel Components ─────────────────────────────────────────────────────────
import LandsPanel              from './components/LandsPanel.jsx';
import ArtifactsPanel          from './components/ArtifactsPanel.jsx';
import CreaturesPanel          from './components/CreaturesPanel.jsx';
import ExplorationPanel        from './components/ExplorationPanel.jsx';
import RampSpellsPanel         from './components/RampSpellsPanel.jsx';
import RitualsPanel            from './components/RitualsPanel.jsx';
import SpellsPanel             from './components/SpellsPanel.jsx';
import SimulationSettingsPanel    from './components/SimulationSettingsPanel.jsx';
import ResultsPanel                from './components/ResultsPanel.jsx';
import ComparisonResultsPanel      from './components/ComparisonResultsPanel.jsx';

// ─── html2canvas (lazy CDN loader) ────────────────────────────────────────────
const loadHtml2Canvas = () =>
  new Promise((resolve, reject) => {
    if (window.html2canvas) { resolve(window.html2canvas); return; }
    const script = document.createElement('script');
    script.src =
      'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload  = () => resolve(window.html2canvas);
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
// Deck slot — all per-deck mutable state in one object
// =============================================================================
const defaultDeckSlot = (saved = {}) => ({
  deckText:            saved.deckText            ?? '',
  parsedDeck:          null,
  selectedKeyCards:    new Set(saved.selectedKeyCards    ?? []),
  includeArtifacts:    saved.includeArtifacts    ?? true,
  disabledArtifacts:   new Set(saved.disabledArtifacts   ?? []),
  includeCreatures:    saved.includeCreatures    ?? true,
  disabledCreatures:   new Set(saved.disabledCreatures   ?? []),
  includeExploration:  saved.includeExploration  ?? true,
  disabledExploration: new Set(saved.disabledExploration ?? []),
  includeRampSpells:   saved.includeRampSpells   ?? true,
  disabledRampSpells:  new Set(saved.disabledRampSpells  ?? []),
  includeRituals:      saved.includeRituals      ?? true,
  disabledRituals:     new Set(saved.disabledRituals     ?? []),
  simulationResults:   null,
});

const serializeDeckSlot = (slot) => ({
  deckText:            slot.deckText,
  selectedKeyCards:    [...slot.selectedKeyCards],
  includeArtifacts:    slot.includeArtifacts,
  disabledArtifacts:   [...slot.disabledArtifacts],
  includeCreatures:    slot.includeCreatures,
  disabledCreatures:   [...slot.disabledCreatures],
  includeExploration:  slot.includeExploration,
  disabledExploration: [...slot.disabledExploration],
  includeRampSpells:   slot.includeRampSpells,
  disabledRampSpells:  [...slot.disabledRampSpells],
  includeRituals:      slot.includeRituals,
  disabledRituals:     [...slot.disabledRituals],
});

// =============================================================================
const MTGMonteCarloAnalyzer = () => {
  // ── Data source ────────────────────────────────────────────────────────────
  const [apiMode,        setApiMode]        = useState(() => getSaved().apiMode        ?? 'local');
  const [cardsDatabase,  setCardsDatabase]  = useState(null);
  const [cardLookupMap,  setCardLookupMap]  = useState(new Map());

  // ── Comparison mode ────────────────────────────────────────────────────────
  const [comparisonMode, setComparisonMode] = useState(() => getSaved().comparisonMode ?? false);
  const [labelA,         setLabelA]         = useState(() => getSaved().labelA ?? 'Deck A');
  const [labelB,         setLabelB]         = useState(() => getSaved().labelB ?? 'Deck B');

  // ── Shared slot-setter factory ───────────────────────────────────────────
  const makeSetterForSlot = (setSlot) => (key) => (valOrFn) =>
    setSlot(prev => ({
      ...prev,
      [key]: typeof valOrFn === 'function' ? valOrFn(prev[key]) : valOrFn,
    }));

  // ── Deck Slot A ───────────────────────────────────────────────────────────
  const [deckSlotA, setDeckSlotA] = useState(() => {
    const saved = getSaved();
    return defaultDeckSlot(saved.slotA ?? saved); // fallback reads old flat schema
  });
  const makeSlotSetterA = makeSetterForSlot(setDeckSlotA);

  const setDeckText            = makeSlotSetterA('deckText');
  const setParsedDeck          = makeSlotSetterA('parsedDeck');
  const setSelectedKeyCards    = makeSlotSetterA('selectedKeyCards');
  const setIncludeArtifacts    = makeSlotSetterA('includeArtifacts');
  const setDisabledArtifacts   = makeSlotSetterA('disabledArtifacts');
  const setIncludeCreatures    = makeSlotSetterA('includeCreatures');
  const setDisabledCreatures   = makeSlotSetterA('disabledCreatures');
  const setIncludeExploration  = makeSlotSetterA('includeExploration');
  const setDisabledExploration = makeSlotSetterA('disabledExploration');
  const setIncludeRampSpells   = makeSlotSetterA('includeRampSpells');
  const setDisabledRampSpells  = makeSlotSetterA('disabledRampSpells');
  const setIncludeRituals      = makeSlotSetterA('includeRituals');
  const setDisabledRituals     = makeSlotSetterA('disabledRituals');
  const setSimulationResults   = makeSlotSetterA('simulationResults');

  const {
    deckText, parsedDeck, selectedKeyCards,
    includeArtifacts,    disabledArtifacts,
    includeCreatures,    disabledCreatures,
    includeExploration,  disabledExploration,
    includeRampSpells,   disabledRampSpells,
    includeRituals,      disabledRituals,
    simulationResults,
  } = deckSlotA;

  // ── Deck Slot B ───────────────────────────────────────────────────────────
  const [deckSlotB, setDeckSlotB] = useState(() => defaultDeckSlot(getSaved().slotB ?? {}));
  const makeSlotSetterB = makeSetterForSlot(setDeckSlotB);

  const setDeckTextB            = makeSlotSetterB('deckText');
  const setParsedDeckB          = makeSlotSetterB('parsedDeck');
  const setSelectedKeyCardsB    = makeSlotSetterB('selectedKeyCards');
  const setIncludeArtifactsB    = makeSlotSetterB('includeArtifacts');
  const setDisabledArtifactsB   = makeSlotSetterB('disabledArtifacts');
  const setIncludeCreaturesB    = makeSlotSetterB('includeCreatures');
  const setDisabledCreaturesB   = makeSlotSetterB('disabledCreatures');
  const setIncludeExplorationB  = makeSlotSetterB('includeExploration');
  const setDisabledExplorationB = makeSlotSetterB('disabledExploration');
  const setIncludeRampSpellsB   = makeSlotSetterB('includeRampSpells');
  const setDisabledRampSpellsB  = makeSlotSetterB('disabledRampSpells');
  const setIncludeRitualsB      = makeSlotSetterB('includeRituals');
  const setDisabledRitualsB     = makeSlotSetterB('disabledRituals');
  const setSimulationResultsB   = makeSlotSetterB('simulationResults');

  const {
    deckText:            deckTextB,
    parsedDeck:          parsedDeckB,
    selectedKeyCards:    selectedKeyCardsB,
    includeArtifacts:    includeArtifactsB,
    disabledArtifacts:   disabledArtifactsB,
    includeCreatures:    includeCreaturesB,
    disabledCreatures:   disabledCreaturesB,
    includeExploration:  includeExplorationB,
    disabledExploration: disabledExplorationB,
    includeRampSpells:   includeRampSpellsB,
    disabledRampSpells:  disabledRampSpellsB,
    includeRituals:      includeRitualsB,
    disabledRituals:     disabledRitualsB,
    simulationResults:   simulationResultsB,
  } = deckSlotB;

  const [error,        setError]        = useState('');

  // ── Mulligan settings ──────────────────────────────────────────────────────
  const [enableMulligans,    setEnableMulligans]    = useState(() => getSaved().enableMulligans  ?? false);
  const [mulliganRule,       setMulliganRule]       = useState(() => getSaved().mulliganRule     ?? 'london');
  const [mulliganStrategy,   setMulliganStrategy]   = useState(() => getSaved().mulliganStrategy ?? 'balanced');
  const [customMulliganRules, setCustomMulliganRules] = useState(() => getSaved().customMulliganRules ?? {
    mulligan0Lands:        true,
    mulligan7Lands:        true,
    mulliganNoPlaysByTurn: false,
    noPlaysTurnThreshold:  2,
    mulliganMinLands:      false,
    minLandsThreshold:     1,
    mulliganMaxLands:      false,
    maxLandsThreshold:     5,
  });

  // ── Simulation settings ────────────────────────────────────────────────────
  const [iterations,               setIterations]               = useState(() => getSaved().iterations               ?? 10000);
  const [turns,                    setTurns]                    = useState(() => getSaved().turns                    ?? 7);
  const [handSize,                 setHandSize]                 = useState(() => getSaved().handSize                 ?? 7);
  const [maxSequences,             setMaxSequences]             = useState(() => getSaved().maxSequences             ?? 1);
  const [selectedTurnForSequences, setSelectedTurnForSequences] = useState(() => getSaved().selectedTurnForSequences ?? 3);
  const [commanderMode,            setCommanderMode]            = useState(() => getSaved().commanderMode            ?? false);

  const [isSimulating, setIsSimulating] = useState(false);

  // ── Derived chart data ─────────────────────────────────────────────────────
  const chartData  = simulationResults  ? prepareChartData(simulationResults,  turns) : null;
  const chartDataB = simulationResultsB ? prepareChartData(simulationResultsB, turns) : null;

  // ── Persist settings & deck text to localStorage ──────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
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
      }));
    } catch (err) {
      console.warn('localStorage save failed:', err);
    }
  }, [
    deckSlotA, deckSlotB, apiMode, comparisonMode, labelA, labelB,
    iterations, turns, handSize, maxSequences, selectedTurnForSequences,
    commanderMode, enableMulligans, mulliganRule, mulliganStrategy, customMulliganRules,
  ]);

  // ============================================================================
  // File upload — builds the cardLookupMap from a local Scryfall Default Cards JSON
  // ============================================================================
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 1024 * 1024 * 1024) {
      setError('File too large (max 1 GB). The Scryfall Default Cards file should be around 200-300 MB.');
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
      let skippedTokens = 0;

      data.forEach(card => {
        if (
          card.layout === 'token' ||
          card.layout === 'double_faced_token' ||
          card.set_type === 'token' ||
          card.type_line?.includes('Token')
        ) { skippedTokens++; return; }

        const name = card.name.toLowerCase();
        if (lookupMap.has(name)) {
          const existing = lookupMap.get(name);
          if ((card.cmc || 0) > (existing.cmc || 0)) lookupMap.set(name, card);
        } else {
          lookupMap.set(name, card);
        }
      });

      setCardLookupMap(lookupMap);
      setError('');
      console.log(
        `✓ Loaded ${data.length} cards from uploaded file (${skippedTokens} tokens filtered out)`
      );
    } catch (err) {
      setError('Invalid JSON file. Please check the file format.');
      console.error(err);
    }
  };

  // ============================================================================
  // Card lookup (local map + optional Scryfall API fallback)
  // ============================================================================
  const lookupCard = async (cardName) => {
    const searchName = cardName.toLowerCase().trim();

    if (cardLookupMap.has(searchName)) return cardLookupMap.get(searchName);

    for (const [name, card] of cardLookupMap.entries()) {
      if (name.startsWith(searchName) || name.includes(searchName)) return card;
    }

    if (apiMode === 'scryfall') {
      try {
        const response = await fetch(
          `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`
        );
        if (response.ok) {
          const data = await response.json();

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
                cardLookupMap.set(searchName, nonToken);
                return nonToken;
              }
            }
            return null;
          }

          cardLookupMap.set(searchName, data);
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
  // ============================================================================
  const handleParseDeck = async () => {
    const deck = await parseDeckList(deckText, { cardLookupMap, apiMode, lookupCard });
    if (deck) {
      setParsedDeck(deck);
      setError(deck.errors && deck.errors.length > 0 ? deck.errors.join(', ') : '');
    } else {
      setParsedDeck(null);
      setError('Parsing failed');
    }
  };

  const handleParseDeckB = async () => {
    const deck = await parseDeckList(deckTextB, { cardLookupMap, apiMode, lookupCard });
    if (deck) {
      setParsedDeckB(deck);
      setError(deck.errors && deck.errors.length > 0 ? deck.errors.join(', ') : '');
    } else {
      setParsedDeckB(null);
      setError('Parsing failed (Deck B)');
    }
  };

  // ============================================================================
  // Run Monte Carlo simulation — calls the extracted monteCarlo module
  // ============================================================================
  const buildSimConfig = (slot) => ({
    iterations,
    turns,
    handSize,
    maxSequences,
    commanderMode,
    enableMulligans,
    mulliganRule,
    mulliganStrategy,
    customMulliganRules,
    selectedKeyCards:    slot.selectedKeyCards,
    includeExploration:  slot.includeExploration,
    disabledExploration: slot.disabledExploration,
    includeRampSpells:   slot.includeRampSpells,
    disabledRampSpells:  slot.disabledRampSpells,
    includeArtifacts:    slot.includeArtifacts,
    disabledArtifacts:   slot.disabledArtifacts,
    includeCreatures:    slot.includeCreatures,
    disabledCreatures:   slot.disabledCreatures,
    includeRituals:      slot.includeRituals,
    disabledRituals:     slot.disabledRituals,
  });

  const runSimulation = () => {
    if (!parsedDeck) { setError('Please parse a deck first'); return; }

    // In comparison mode require both decks to be parsed
    if (comparisonMode && !parsedDeckB) { setError('Please parse Deck B first'); return; }

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
  const exportResultsAsPNG = async (event) => {
    if (!simulationResults) return;
    try {
      const html2canvas    = await loadHtml2Canvas();
      const resultsSection = document.getElementById('results-section');
      if (!resultsSection) { alert('Results section not found'); return; }

      const button           = event.target;
      const originalText     = button.textContent;
      button.textContent     = '📸 Capturing...';
      button.disabled        = true;

      await new Promise(r => setTimeout(r, 500));

      const canvas = await html2canvas(resultsSection, {
        backgroundColor: '#f9fafb',
        scale: 2,
        logging: false,
        useCORS: true,
      });

      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = `mtg-simulation-results-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        button.textContent = originalText;
        button.disabled    = false;
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
    const buildRows = (cd) => {
      if (!cd) return [];
      const { landsData, manaByColorData, lifeLossData, keyCardsData } = cd;
      return Array.from({ length: landsData.length }, (_, i) => {
        const row = {
          Turn:             landsData[i].turn,
          'Total Lands':    landsData[i]['Total Lands'],
          'Untapped Lands': landsData[i]['Untapped Lands'],
          'Total Mana':     manaByColorData[i]['Total Mana'],
          'W Mana':         manaByColorData[i].W,
          'U Mana':         manaByColorData[i].U,
          'B Mana':         manaByColorData[i].B,
          'R Mana':         manaByColorData[i].R,
          'G Mana':         manaByColorData[i].G,
          'Life Loss':      lifeLossData[i]['Life Loss'],
        };
        const keyRow = keyCardsData[i];
        Object.keys(keyRow).forEach(k => { if (k !== 'turn') row[k] = keyRow[k]; });
        return row;
      });
    };

    const rowsA = buildRows(chartData);
    const rowsB = buildRows(chartDataB);

    if (!rowsA.length && !rowsB.length) return;

    let rows, headers;
    if (comparisonMode && rowsA.length && rowsB.length) {
      // Merge: prefix all columns with deck label
      const headersA = Object.keys(rowsA[0]).map(k => k === 'Turn' ? 'Turn' : `${labelA}: ${k}`);
      const headersB = Object.keys(rowsB[0]).filter(k => k !== 'Turn').map(k => `${labelB}: ${k}`);
      headers = [...headersA, ...headersB];
      rows = rowsA.map((ra, i) => {
        const rb = rowsB[i] || {};
        const merged = {};
        Object.keys(ra).forEach((k, j) => { merged[headersA[j]] = ra[k]; });
        Object.keys(rb).filter(k => k !== 'Turn').forEach(k => { merged[`${labelB}: ${k}`] = rb[k]; });
        return merged;
      });
    } else {
      rows = rowsA.length ? rowsA : rowsB;
      headers = Object.keys(rows[0]);
    }

    const escape = v => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [
      headers.map(escape).join(','),
      ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
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
        <h1>🎲 MTG Monte Carlo Deck Analyzer</h1>
        <p>Simulation-based deck analysis for Magic: The Gathering</p>
      </div>

      {/* Data Source */}
      <div className="panel">
        <h3>⚙️ Data Source</h3>
        <div className="radio-group" style={{ marginBottom: 12 }}>
          <label className="radio-label">
            <input type="radio" checked={apiMode === 'local'} onChange={() => setApiMode('local')} />
            Local JSON File
          </label>
          <label className="radio-label">
            <input type="radio" checked={apiMode === 'scryfall'} onChange={() => setApiMode('scryfall')} />
            Scryfall API (Fallback)
          </label>
        </div>

        {apiMode === 'local' && (
          <div className="upload-section">
            <div className="upload-instructions">
              <p>📥 How to get cards.json:</p>
              <ol>
                <li>
                  Visit{' '}
                  <a href="https://scryfall.com/docs/api/bulk-data" target="_blank" rel="noopener noreferrer">
                    Scryfall Bulk Data
                  </a>
                </li>
                <li>Download <strong>"Default Cards"</strong> (not "All Cards" or "Oracle Cards")</li>
                <li>File size should be ~200-300 MB (compressed)</li>
                <li>Upload the JSON file below</li>
              </ol>
            </div>
            <input type="file" accept=".json" onChange={handleFileUpload} className="file-input" />
            {cardsDatabase && (
              <p className="loaded-success">✓ Loaded {cardsDatabase.length.toLocaleString()} cards</p>
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
                onChange={(e) => setDeckText(e.target.value)}
                placeholder={
                  'Paste your deck list here (MTG Arena format)\nExample:\n4 Lightning Bolt\n4 Island\n3 Counterspell'
                }
                className="deck-textarea"
              />
            </div>
            <button onClick={handleParseDeck} className="btn-primary">Parse Deck</button>
          </div>

          {/* Parsed Deck panels */}
          {parsedDeck && (
            <div>
              {/* Deck Statistics */}
              <div className="panel-grid">
                <div className="panel">
                  <h3>📊 Deck Statistics</h3>
                  <p>Total Cards: {parsedDeck.totalCards}</p>
                  <p>
                    Lands: {parsedDeck.landCount}{' '}
                    ({parsedDeck.totalCards > 0
                      ? ((parsedDeck.landCount / parsedDeck.totalCards) * 100).toFixed(1)
                      : 0}%)
                  </p>

                  {/* Derived stats block */}
                  {(() => {
                    const nonLandCards = [
                      ...(parsedDeck.spells      || []),
                      ...(parsedDeck.creatures   || []),
                      ...(parsedDeck.artifacts   || []),
                      ...(parsedDeck.rituals     || []),
                      ...(parsedDeck.rampSpells  || []),
                      ...(parsedDeck.exploration || []),
                    ];
                    let totalCmcSum = 0, totalNonLandQty = 0;
                    for (const card of nonLandCards) {
                      const qty = card.quantity || 1;
                      totalCmcSum += (typeof card.cmc === 'number' ? card.cmc : 0) * qty;
                      totalNonLandQty += qty;
                    }
                    const avgCmc = totalNonLandQty > 0 ? (totalCmcSum / totalNonLandQty).toFixed(2) : '—';
                    const rampCount =
                      (parsedDeck.artifacts   || []).reduce((s, c) => s + (c.quantity || 1), 0) +
                      (parsedDeck.creatures   || []).reduce((s, c) => s + (c.quantity || 1), 0) +
                      (parsedDeck.rampSpells  || []).reduce((s, c) => s + (c.quantity || 1), 0) +
                      (parsedDeck.rituals     || []).reduce((s, c) => s + (c.quantity || 1), 0) +
                      (parsedDeck.exploration || []).reduce((s, c) => s + (c.quantity || 1), 0);
                    const rampPct = parsedDeck.totalCards > 0
                      ? ((rampCount / parsedDeck.totalCards) * 100).toFixed(1) : '0';
                    const lands = parsedDeck.lands || [];
                    let tappedCount = 0, untappedCount = 0, fetchCount = 0, conditionalCount = 0;
                    for (const land of lands) {
                      const qty = land.quantity || 1;
                      if (land.isFetch) { fetchCount += qty; continue; }
                      if (land.entersTappedAlways === true)       tappedCount      += qty;
                      else if (land.entersTappedAlways === false)  untappedCount   += qty;
                      else                                          conditionalCount += qty;
                    }
                    return (
                      <>
                        <p>Avg. CMC (non-land): <strong>{avgCmc}</strong></p>
                        <p>
                          Ramp &amp; Acceleration: <strong>{rampCount}</strong>{' '}
                          <span style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.85em' }}>
                            ({rampPct}% of deck)
                          </span>
                        </p>
                        {lands.length > 0 && (
                          <p style={{ lineHeight: 1.8 }}>
                            Lands — Untapped: <strong>{untappedCount + fetchCount}</strong>
                            {' · '}Tapped: <strong>{tappedCount}</strong>
                            {conditionalCount > 0 && <>{' · '}Conditional: <strong>{conditionalCount}</strong></>}
                            {' · '}Fetches: <strong>{fetchCount}</strong>
                          </p>
                        )}
                      </>
                    );
                  })()}

                  {/* Mana Curve */}
                  {(() => {
                    const nonLandCards = [
                      ...(parsedDeck.spells || []), ...(parsedDeck.creatures || []),
                      ...(parsedDeck.artifacts || []), ...(parsedDeck.rituals || []),
                      ...(parsedDeck.rampSpells || []), ...(parsedDeck.exploration || []),
                    ];
                    if (nonLandCards.length === 0) return null;
                    const cmcMap = new Map();
                    for (const card of nonLandCards) {
                      const cmc = typeof card.cmc === 'number' ? card.cmc : 0;
                      cmcMap.set(cmc, (cmcMap.get(cmc) || 0) + (card.quantity || 1));
                    }
                    const maxCmc = Math.max(...cmcMap.keys());
                    const curveData = Array.from({ length: maxCmc + 1 }, (_, i) => ({ cmc: i, count: cmcMap.get(i) || 0 }));
                    const BAR_COLORS = ['#667eea','#7c3aed','#a855f7','#ec4899','#f87171','#fb923c','#facc15','#4ade80','#34d399','#60a5fa'];
                    return (
                      <div style={{ marginTop: '1rem' }}>
                        <h4 style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary, #94a3b8)' }}>Mana Curve</h4>
                        <ResponsiveContainer width="100%" height={160}>
                          <BarChart data={curveData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="cmc" tick={{ fontSize: 11 }}
                              label={{ value: 'CMC', position: 'insideBottom', offset: -2, fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                            <RechartsTooltip formatter={(v) => [v, 'Cards']} labelFormatter={(l) => `CMC ${l}`} />
                            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                              {curveData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    );
                  })()}

                  {/* Color Pip Demand */}
                  {(() => {
                    const nonLandCards = [
                      ...(parsedDeck.spells || []), ...(parsedDeck.creatures || []),
                      ...(parsedDeck.artifacts || []), ...(parsedDeck.rituals || []),
                      ...(parsedDeck.rampSpells || []), ...(parsedDeck.exploration || []),
                    ];
                    if (nonLandCards.length === 0) return null;
                    const pipCounts = { W: 0, U: 0, B: 0, R: 0, G: 0 };
                    for (const card of nonLandCards) {
                      if (!card.manaCost) continue;
                      const qty = card.quantity || 1;
                      const symbols = card.manaCost.match(/\{([^}]+)\}/g) || [];
                      for (const sym of symbols) {
                        const s = sym.replace(/[{}]/g, '').toUpperCase();
                        if (pipCounts[s] !== undefined) pipCounts[s] += qty;
                      }
                    }
                    const colorConfig = {
                      W: { label: 'White', fill: '#fcd34d' }, U: { label: 'Blue',  fill: '#60a5fa' },
                      B: { label: 'Black', fill: '#a1a1aa' }, R: { label: 'Red',   fill: '#f87171' },
                      G: { label: 'Green', fill: '#4ade80' },
                    };
                    const pipData = Object.entries(pipCounts).filter(([, v]) => v > 0)
                      .map(([k, v]) => ({ color: k, label: colorConfig[k].label, pips: v, fill: colorConfig[k].fill }));
                    if (pipData.length === 0) return null;
                    return (
                      <div style={{ marginTop: '1rem' }}>
                        <h4 style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary, #94a3b8)' }}>Color Pip Demand</h4>
                        <ResponsiveContainer width="100%" height={120}>
                          <BarChart data={pipData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                            <RechartsTooltip formatter={(v) => [v, 'Pips']} labelFormatter={(l) => l} />
                            <Bar dataKey="pips" radius={[3, 3, 0, 0]}>
                              {pipData.map((e) => <Cell key={e.color} fill={e.fill} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    );
                  })()}

                  {/* Color Pip Creation */}
                  {(() => {
                    const colorConfig = {
                      W: { label: 'White', fill: '#fcd34d' }, U: { label: 'Blue',  fill: '#60a5fa' },
                      B: { label: 'Black', fill: '#a1a1aa' }, R: { label: 'Red',   fill: '#f87171' },
                      G: { label: 'Green', fill: '#4ade80' },
                    };
                    const sources = { W: 0, U: 0, B: 0, R: 0, G: 0 };
                    const addProduces = (card) => {
                      const qty = card.quantity || 1;
                      for (const c of (card.produces || [])) { if (sources[c] !== undefined) sources[c] += qty; }
                    };
                    for (const land of (parsedDeck.lands || [])) {
                      const qty = land.quantity || 1;
                      if (land.isFetch) { for (const c of (land.fetchColors || [])) { if (sources[c] !== undefined) sources[c] += qty; } }
                      else              { for (const c of (land.produces    || [])) { if (sources[c] !== undefined) sources[c] += qty; } }
                    }
                    for (const card of (parsedDeck.artifacts || [])) addProduces(card);
                    for (const card of (parsedDeck.creatures || [])) addProduces(card);
                    for (const card of (parsedDeck.rituals   || [])) {
                      const qty = card.quantity || 1;
                      for (const c of (card.ritualColors || [])) { if (sources[c] !== undefined) sources[c] += qty; }
                    }
                    const demandedColors = new Set();
                    const nonLandCards = [
                      ...(parsedDeck.spells || []), ...(parsedDeck.creatures || []),
                      ...(parsedDeck.artifacts || []), ...(parsedDeck.rituals || []),
                      ...(parsedDeck.rampSpells || []), ...(parsedDeck.exploration || []),
                    ];
                    for (const card of nonLandCards) {
                      if (!card.manaCost) continue;
                      const symbols = card.manaCost.match(/\{([^}]+)\}/g) || [];
                      for (const sym of symbols) {
                        const s = sym.replace(/[{}]/g, '').toUpperCase();
                        if (colorConfig[s]) demandedColors.add(s);
                      }
                    }
                    const creationData = Object.entries(sources)
                      .filter(([k, v]) => v > 0 && demandedColors.has(k))
                      .map(([k, v]) => ({ color: k, label: colorConfig[k].label, sources: v, fill: colorConfig[k].fill }));
                    if (creationData.length === 0) return null;
                    return (
                      <div style={{ marginTop: '1rem' }}>
                        <h4 style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary, #94a3b8)' }}>Color Pip Creation</h4>
                        <ResponsiveContainer width="100%" height={120}>
                          <BarChart data={creationData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                            <RechartsTooltip formatter={(v) => [v, 'Sources']} labelFormatter={(l) => l} />
                            <Bar dataKey="sources" radius={[3, 3, 0, 0]}>
                              {creationData.map((e) => <Cell key={e.color} fill={e.fill} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Lands */}
              <div className="panel-grid">
                <LandsPanel parsedDeck={parsedDeck} getManaSymbol={getManaSymbol} getFetchSymbol={getFetchSymbol} />
              </div>

              {parsedDeck.artifacts.length > 0 && (
                <div className="panel-grid">
                  <ArtifactsPanel
                    parsedDeck={parsedDeck}
                    includeArtifacts={includeArtifacts} setIncludeArtifacts={setIncludeArtifacts}
                    disabledArtifacts={disabledArtifacts} setDisabledArtifacts={setDisabledArtifacts}
                    getManaSymbol={getManaSymbol}
                  />
                </div>
              )}

              {parsedDeck.creatures.length > 0 && (
                <div className="panel-grid">
                  <CreaturesPanel
                    parsedDeck={parsedDeck}
                    includeCreatures={includeCreatures} setIncludeCreatures={setIncludeCreatures}
                    disabledCreatures={disabledCreatures} setDisabledCreatures={setDisabledCreatures}
                    getManaSymbol={getManaSymbol}
                  />
                </div>
              )}

              {parsedDeck.exploration?.length > 0 && (
                <div className="panel-grid">
                  <ExplorationPanel
                    parsedDeck={parsedDeck}
                    includeExploration={includeExploration} setIncludeExploration={setIncludeExploration}
                    disabledExploration={disabledExploration} setDisabledExploration={setDisabledExploration}
                  />
                </div>
              )}

              {parsedDeck.rampSpells?.length > 0 && (
                <div className="panel-grid">
                  <RampSpellsPanel
                    parsedDeck={parsedDeck}
                    includeRampSpells={includeRampSpells} setIncludeRampSpells={setIncludeRampSpells}
                    disabledRampSpells={disabledRampSpells} setDisabledRampSpells={setDisabledRampSpells}
                    renderManaCost={renderManaCost}
                  />
                </div>
              )}

              {parsedDeck.rituals?.length > 0 && (
                <div className="panel-grid">
                  <RitualsPanel
                    parsedDeck={parsedDeck}
                    includeRituals={includeRituals} setIncludeRituals={setIncludeRituals}
                    disabledRituals={disabledRituals} setDisabledRituals={setDisabledRituals}
                    renderManaCost={renderManaCost}
                  />
                </div>
              )}

              {(parsedDeck.spells.length > 0 || parsedDeck.creatures.length > 0 ||
                parsedDeck.artifacts.length > 0 || parsedDeck.rituals?.length > 0 ||
                parsedDeck.rampSpells?.length > 0 || parsedDeck.exploration?.length > 0) && (
                <SpellsPanel
                  parsedDeck={parsedDeck}
                  selectedKeyCards={selectedKeyCards} setSelectedKeyCards={setSelectedKeyCards}
                  renderManaCost={renderManaCost}
                />
              )}

              {/* Simulation Settings */}
              <SimulationSettingsPanel
                iterations={iterations}                 setIterations={setIterations}
                turns={turns}                           setTurns={setTurns}
                handSize={handSize}                     setHandSize={setHandSize}
                maxSequences={maxSequences}             setMaxSequences={setMaxSequences}
                selectedTurnForSequences={selectedTurnForSequences}
                setSelectedTurnForSequences={setSelectedTurnForSequences}
                commanderMode={commanderMode}           setCommanderMode={setCommanderMode}
                enableMulligans={enableMulligans}       setEnableMulligans={setEnableMulligans}
                mulliganRule={mulliganRule}             setMulliganRule={setMulliganRule}
                mulliganStrategy={mulliganStrategy}     setMulliganStrategy={setMulliganStrategy}
                customMulliganRules={customMulliganRules}
                setCustomMulliganRules={setCustomMulliganRules}
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
                onChange={(e) => setLabelA(e.target.value)}
                placeholder="Deck A name"
              />
              <textarea
                value={deckText}
                onChange={(e) => setDeckText(e.target.value)}
                placeholder="Paste deck list here (MTG Arena format)"
                className="deck-textarea"
                style={{ height: 180 }}
              />
              <button onClick={handleParseDeck} className="btn-primary">Parse Deck</button>
            </div>
            <div className="panel">
              <div className="deck-column-header deck-column-header--b">{labelB}</div>
              <input
                className="deck-label-input"
                value={labelB}
                onChange={(e) => setLabelB(e.target.value)}
                placeholder="Deck B name"
              />
              <textarea
                value={deckTextB}
                onChange={(e) => setDeckTextB(e.target.value)}
                placeholder="Paste deck list here (MTG Arena format)"
                className="deck-textarea"
                style={{ height: 180 }}
              />
              <button onClick={handleParseDeckB} className="btn-primary">Parse Deck</button>
            </div>
          </div>

          {/* Row: Lands — shown once either deck is parsed */}
          {(parsedDeck || parsedDeckB) && (
            <div className="deck-columns">
              <div>
                {parsedDeck
                  ? <LandsPanel parsedDeck={parsedDeck} getManaSymbol={getManaSymbol} getFetchSymbol={getFetchSymbol} />
                  : <div className="comparison-empty-panel" />}
              </div>
              <div>
                {parsedDeckB
                  ? <LandsPanel parsedDeck={parsedDeckB} getManaSymbol={getManaSymbol} getFetchSymbol={getFetchSymbol} />
                  : <div className="comparison-empty-panel" />}
              </div>
            </div>
          )}

          {/* Row: Artifacts */}
          {(parsedDeck?.artifacts?.length > 0 || parsedDeckB?.artifacts?.length > 0) && (
            <div className="deck-columns">
              <div>
                {parsedDeck?.artifacts?.length > 0
                  ? <ArtifactsPanel
                      parsedDeck={parsedDeck}
                      includeArtifacts={includeArtifacts}   setIncludeArtifacts={setIncludeArtifacts}
                      disabledArtifacts={disabledArtifacts} setDisabledArtifacts={setDisabledArtifacts}
                      getManaSymbol={getManaSymbol}
                    />
                  : <div className="comparison-empty-panel" />}
              </div>
              <div>
                {parsedDeckB?.artifacts?.length > 0
                  ? <ArtifactsPanel
                      parsedDeck={parsedDeckB}
                      includeArtifacts={includeArtifactsB}   setIncludeArtifacts={setIncludeArtifactsB}
                      disabledArtifacts={disabledArtifactsB} setDisabledArtifacts={setDisabledArtifactsB}
                      getManaSymbol={getManaSymbol}
                    />
                  : <div className="comparison-empty-panel" />}
              </div>
            </div>
          )}

          {/* Row: Creatures */}
          {(parsedDeck?.creatures?.length > 0 || parsedDeckB?.creatures?.length > 0) && (
            <div className="deck-columns">
              <div>
                {parsedDeck?.creatures?.length > 0
                  ? <CreaturesPanel
                      parsedDeck={parsedDeck}
                      includeCreatures={includeCreatures}   setIncludeCreatures={setIncludeCreatures}
                      disabledCreatures={disabledCreatures} setDisabledCreatures={setDisabledCreatures}
                      getManaSymbol={getManaSymbol}
                    />
                  : <div className="comparison-empty-panel" />}
              </div>
              <div>
                {parsedDeckB?.creatures?.length > 0
                  ? <CreaturesPanel
                      parsedDeck={parsedDeckB}
                      includeCreatures={includeCreaturesB}   setIncludeCreatures={setIncludeCreaturesB}
                      disabledCreatures={disabledCreaturesB} setDisabledCreatures={setDisabledCreaturesB}
                      getManaSymbol={getManaSymbol}
                    />
                  : <div className="comparison-empty-panel" />}
              </div>
            </div>
          )}

          {/* Row: Exploration */}
          {(parsedDeck?.exploration?.length > 0 || parsedDeckB?.exploration?.length > 0) && (
            <div className="deck-columns">
              <div>
                {parsedDeck?.exploration?.length > 0
                  ? <ExplorationPanel
                      parsedDeck={parsedDeck}
                      includeExploration={includeExploration}   setIncludeExploration={setIncludeExploration}
                      disabledExploration={disabledExploration} setDisabledExploration={setDisabledExploration}
                    />
                  : <div className="comparison-empty-panel" />}
              </div>
              <div>
                {parsedDeckB?.exploration?.length > 0
                  ? <ExplorationPanel
                      parsedDeck={parsedDeckB}
                      includeExploration={includeExplorationB}   setIncludeExploration={setIncludeExplorationB}
                      disabledExploration={disabledExplorationB} setDisabledExploration={setDisabledExplorationB}
                    />
                  : <div className="comparison-empty-panel" />}
              </div>
            </div>
          )}

          {/* Row: Ramp Spells */}
          {(parsedDeck?.rampSpells?.length > 0 || parsedDeckB?.rampSpells?.length > 0) && (
            <div className="deck-columns">
              <div>
                {parsedDeck?.rampSpells?.length > 0
                  ? <RampSpellsPanel
                      parsedDeck={parsedDeck}
                      includeRampSpells={includeRampSpells}   setIncludeRampSpells={setIncludeRampSpells}
                      disabledRampSpells={disabledRampSpells} setDisabledRampSpells={setDisabledRampSpells}
                      renderManaCost={renderManaCost}
                    />
                  : <div className="comparison-empty-panel" />}
              </div>
              <div>
                {parsedDeckB?.rampSpells?.length > 0
                  ? <RampSpellsPanel
                      parsedDeck={parsedDeckB}
                      includeRampSpells={includeRampSpellsB}   setIncludeRampSpells={setIncludeRampSpellsB}
                      disabledRampSpells={disabledRampSpellsB} setDisabledRampSpells={setDisabledRampSpellsB}
                      renderManaCost={renderManaCost}
                    />
                  : <div className="comparison-empty-panel" />}
              </div>
            </div>
          )}

          {/* Row: Rituals */}
          {(parsedDeck?.rituals?.length > 0 || parsedDeckB?.rituals?.length > 0) && (
            <div className="deck-columns">
              <div>
                {parsedDeck?.rituals?.length > 0
                  ? <RitualsPanel
                      parsedDeck={parsedDeck}
                      includeRituals={includeRituals}   setIncludeRituals={setIncludeRituals}
                      disabledRituals={disabledRituals} setDisabledRituals={setDisabledRituals}
                      renderManaCost={renderManaCost}
                    />
                  : <div className="comparison-empty-panel" />}
              </div>
              <div>
                {parsedDeckB?.rituals?.length > 0
                  ? <RitualsPanel
                      parsedDeck={parsedDeckB}
                      includeRituals={includeRitualsB}   setIncludeRituals={setIncludeRitualsB}
                      disabledRituals={disabledRitualsB} setDisabledRituals={setDisabledRitualsB}
                      renderManaCost={renderManaCost}
                    />
                  : <div className="comparison-empty-panel" />}
              </div>
            </div>
          )}

          {/* Row: Spells / Key-card selector */}
          {((parsedDeck && (parsedDeck.spells.length > 0 || parsedDeck.creatures.length > 0 ||
              parsedDeck.artifacts.length > 0 || parsedDeck.rituals?.length > 0 ||
              parsedDeck.rampSpells?.length > 0 || parsedDeck.exploration?.length > 0)) ||
            (parsedDeckB && (parsedDeckB.spells.length > 0 || parsedDeckB.creatures.length > 0 ||
              parsedDeckB.artifacts.length > 0 || parsedDeckB.rituals?.length > 0 ||
              parsedDeckB.rampSpells?.length > 0 || parsedDeckB.exploration?.length > 0))) && (
            <div className="deck-columns">
              <div>
                {(parsedDeck && (parsedDeck.spells.length > 0 || parsedDeck.creatures.length > 0 ||
                  parsedDeck.artifacts.length > 0 || parsedDeck.rituals?.length > 0 ||
                  parsedDeck.rampSpells?.length > 0 || parsedDeck.exploration?.length > 0))
                  ? <SpellsPanel
                      parsedDeck={parsedDeck}
                      selectedKeyCards={selectedKeyCards} setSelectedKeyCards={setSelectedKeyCards}
                      renderManaCost={renderManaCost}
                    />
                  : <div className="comparison-empty-panel" />}
              </div>
              <div>
                {(parsedDeckB && (parsedDeckB.spells.length > 0 || parsedDeckB.creatures.length > 0 ||
                  parsedDeckB.artifacts.length > 0 || parsedDeckB.rituals?.length > 0 ||
                  parsedDeckB.rampSpells?.length > 0 || parsedDeckB.exploration?.length > 0))
                  ? <SpellsPanel
                      parsedDeck={parsedDeckB}
                      selectedKeyCards={selectedKeyCardsB} setSelectedKeyCards={setSelectedKeyCardsB}
                      renderManaCost={renderManaCost}
                    />
                  : <div className="comparison-empty-panel" />}
              </div>
            </div>
          )}

          {/* Shared simulation settings */}
          {(parsedDeck || parsedDeckB) && (
            <SimulationSettingsPanel
              iterations={iterations}                 setIterations={setIterations}
              turns={turns}                           setTurns={setTurns}
              handSize={handSize}                     setHandSize={setHandSize}
              maxSequences={maxSequences}             setMaxSequences={setMaxSequences}
              selectedTurnForSequences={selectedTurnForSequences}
              setSelectedTurnForSequences={setSelectedTurnForSequences}
              commanderMode={commanderMode}           setCommanderMode={setCommanderMode}
              enableMulligans={enableMulligans}       setEnableMulligans={setEnableMulligans}
              mulliganRule={mulliganRule}             setMulliganRule={setMulliganRule}
              mulliganStrategy={mulliganStrategy}     setMulliganStrategy={setMulliganStrategy}
              customMulliganRules={customMulliganRules}
              setCustomMulliganRules={setCustomMulliganRules}
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
          ) : (chartData || chartDataB) ? (
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
