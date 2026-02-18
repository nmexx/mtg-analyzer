import React, { useState } from 'react';

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
import SimulationSettingsPanel from './components/SimulationSettingsPanel.jsx';
import ResultsPanel            from './components/ResultsPanel.jsx';

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
const MTGMonteCarloAnalyzer = () => {
  // ── Data source ────────────────────────────────────────────────────────────
  const [apiMode,        setApiMode]        = useState('local');
  const [cardsDatabase,  setCardsDatabase]  = useState(null);
  const [cardLookupMap,  setCardLookupMap]  = useState(new Map());

  // ── Deck input & parsing ───────────────────────────────────────────────────
  const [deckText,   setDeckText]   = useState('');
  const [parsedDeck, setParsedDeck] = useState(null);
  const [error,      setError]      = useState('');

  // ── Key-card selection ─────────────────────────────────────────────────────
  const [selectedKeyCards, setSelectedKeyCards] = useState(new Set());

  // ── Card-type include/exclude toggles ─────────────────────────────────────
  const [includeArtifacts,    setIncludeArtifacts]    = useState(true);
  const [disabledArtifacts,   setDisabledArtifacts]   = useState(new Set());
  const [includeCreatures,    setIncludeCreatures]    = useState(true);
  const [disabledCreatures,   setDisabledCreatures]   = useState(new Set());
  const [includeExploration,  setIncludeExploration]  = useState(true);
  const [disabledExploration, setDisabledExploration] = useState(new Set());
  const [includeRampSpells,   setIncludeRampSpells]   = useState(true);
  const [disabledRampSpells,  setDisabledRampSpells]  = useState(new Set());
  const [includeRituals,      setIncludeRituals]      = useState(true);
  const [disabledRituals,     setDisabledRituals]     = useState(new Set());

  // ── Mulligan settings ──────────────────────────────────────────────────────
  const [enableMulligans,    setEnableMulligans]    = useState(false);
  const [mulliganRule,       setMulliganRule]       = useState('london');
  const [mulliganStrategy,   setMulliganStrategy]   = useState('balanced');
  const [customMulliganRules, setCustomMulliganRules] = useState({
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
  const [iterations,               setIterations]               = useState(10000);
  const [turns,                    setTurns]                    = useState(7);
  const [handSize,                 setHandSize]                 = useState(7);
  const [maxSequences,             setMaxSequences]             = useState(1);
  const [selectedTurnForSequences, setSelectedTurnForSequences] = useState(3);
  const [commanderMode,            setCommanderMode]            = useState(false);

  // ── Simulation results ─────────────────────────────────────────────────────
  const [simulationResults, setSimulationResults] = useState(null);
  const [isSimulating,      setIsSimulating]      = useState(false);

  // ── Derived chart data ─────────────────────────────────────────────────────
  const chartData = simulationResults ? prepareChartData(simulationResults, turns) : null;

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

  // ============================================================================
  // Run Monte Carlo simulation — calls the extracted monteCarlo module
  // ============================================================================
  const runSimulation = () => {
    if (!parsedDeck) { setError('Please parse a deck first'); return; }

    setIsSimulating(true);
    setError('');

    setTimeout(() => {
      try {
        const results = monteCarlo(parsedDeck, {
          iterations,
          turns,
          handSize,
          maxSequences,
          commanderMode,
          enableMulligans,
          mulliganRule,
          mulliganStrategy,
          customMulliganRules,
          selectedKeyCards,
          includeExploration,
          disabledExploration,
          includeRampSpells,
          disabledRampSpells,
          includeArtifacts,
          disabledArtifacts,
          includeCreatures,
          disabledCreatures,
          includeRituals,
          disabledRituals,
        });
        setSimulationResults(results);
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
        <div className="radio-group">
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
                  <a
                    href="https://scryfall.com/docs/api/bulk-data"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
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
              <p className="loaded-success">
                ✓ Loaded {cardsDatabase.length.toLocaleString()} cards
              </p>
            )}
          </div>
        )}
      </div>

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
        <button onClick={handleParseDeck} className="btn-primary">
          Parse Deck
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="error-banner">⚠️ {error}</div>
      )}

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
            </div>
          </div>

          {/* Lands */}
          <div className="panel-grid">
            <LandsPanel
              parsedDeck={parsedDeck}
              getManaSymbol={getManaSymbol}
              getFetchSymbol={getFetchSymbol}
            />
          </div>

          {/* Artifacts */}
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

          {/* Creatures */}
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

          {/* Exploration */}
          {parsedDeck.exploration && parsedDeck.exploration.length > 0 && (
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

          {/* Ramp Spells */}
          {parsedDeck.rampSpells && parsedDeck.rampSpells.length > 0 && (
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

          {/* Rituals */}
          {parsedDeck.rituals && parsedDeck.rituals.length > 0 && (
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

          {/* Spells / Key-card selector */}
          {(
            parsedDeck.spells.length > 0 ||
            parsedDeck.creatures.length > 0 ||
            parsedDeck.artifacts.length > 0 ||
            (parsedDeck.rituals && parsedDeck.rituals.length > 0) ||
            (parsedDeck.rampSpells && parsedDeck.rampSpells.length > 0) ||
            (parsedDeck.exploration && parsedDeck.exploration.length > 0)
          ) && (
            <SpellsPanel
              parsedDeck={parsedDeck}
              selectedKeyCards={selectedKeyCards}
              setSelectedKeyCards={setSelectedKeyCards}
              renderManaCost={renderManaCost}
            />
          )}

          {/* Simulation Settings */}
          <SimulationSettingsPanel
            iterations={iterations}               setIterations={setIterations}
            turns={turns}                         setTurns={setTurns}
            handSize={handSize}                   setHandSize={setHandSize}
            maxSequences={maxSequences}           setMaxSequences={setMaxSequences}
            selectedTurnForSequences={selectedTurnForSequences}
            setSelectedTurnForSequences={setSelectedTurnForSequences}
            commanderMode={commanderMode}         setCommanderMode={setCommanderMode}
            enableMulligans={enableMulligans}     setEnableMulligans={setEnableMulligans}
            mulliganRule={mulliganRule}           setMulliganRule={setMulliganRule}
            mulliganStrategy={mulliganStrategy}   setMulliganStrategy={setMulliganStrategy}
            customMulliganRules={customMulliganRules}
            setCustomMulliganRules={setCustomMulliganRules}
            runSimulation={runSimulation}
            isSimulating={isSimulating}
          />
        </div>
      )}

      {/* Results */}
      <ResultsPanel
        simulationResults={simulationResults}
        chartData={chartData}
        iterations={iterations}
        enableMulligans={enableMulligans}
        selectedKeyCards={selectedKeyCards}
        selectedTurnForSequences={selectedTurnForSequences}
        exportResultsAsPNG={exportResultsAsPNG}
        renderSequenceBody={renderSequenceBody}
      />

      {/* Footer */}
      <div className="app-footer">
        <p>All card data © Wizards of the Coast</p>
      </div>
    </div>
  );
};

export default MTGMonteCarloAnalyzer;
