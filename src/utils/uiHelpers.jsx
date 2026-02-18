/**
 * uiHelpers.jsx
 *
 * Shared UI utilities: mana-symbol rendering, fetch badge symbols,
 * the reusable sequence body JSX, a text-file downloader, and the
 * chart-data preparation function (depends only on simulationResults
 * and the turns setting — no React state is imported here).
 *
 * Components that need these should import them individually.
 */

import React from 'react';
import { safeToFixed } from './math.js';

// ─────────────────────────────────────────────────────────────────────────────
// Mana symbols
// ─────────────────────────────────────────────────────────────────────────────
export const getManaSymbol = (color) => {
  const symbols = { W: '☀️', U: '💧', B: '💀', R: '🔥', G: '🌿', C: '◇' };
  return symbols[color] || '';
};

export const parseManaSymbols = (manaCost) => {
  if (!manaCost) return [];
  return (manaCost.match(/\{([^}]+)\}/g) || []).map(s => s.replace(/[{}]/g, ''));
};

export const renderManaCost = (manaCost) => {
  const colorSymbols = { W: '☀️', U: '💧', B: '💀', R: '🔥', G: '🌿', C: '◇' };
  return parseManaSymbols(manaCost).map((symbol, idx) => {
    if (colorSymbols[symbol])
      return <span key={idx} className="mana-cost-symbol">{colorSymbols[symbol]}</span>;
    return (
      <span key={idx} className="mana-cost-generic">{symbol}</span>
    );
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Fetch type badge
// ─────────────────────────────────────────────────────────────────────────────
export const getFetchSymbol = (fetchType) => {
  const symbols = { classic: '⚡', slow: '🐌', mana_cost: '💰', free_slow: '🆓' };
  return symbols[fetchType] || '';
};

// ─────────────────────────────────────────────────────────────────────────────
// renderSequenceBody  –  opening hand + turn-by-turn actions block
// ─────────────────────────────────────────────────────────────────────────────
export const renderSequenceBody = (data, accentColor = '#667eea') => (
  <>
    <div className="seq-opening-hand">
      <p className="seq-opening-title">Opening Hand:</p>
      <div className="seq-opening-cards">{data.openingHand.join(', ')}</div>
    </div>
    <div>
      <p className="seq-turns-title">Turn-by-turn sequence:</p>
      {data.sequence && data.sequence.map((turnLog, idx) => (
        <div key={idx} className="seq-turn-block" style={{ '--seq-accent': accentColor }}>
          <p className="seq-turn-title">Turn {turnLog.turn}:</p>
          {turnLog.actions.length > 0 ? (
            <ul className="seq-turn-actions">
              {turnLog.actions.map((action, ai) => <li key={ai}>{action}</li>)}
            </ul>
          ) : (
            <p className="seq-no-actions">No actions</p>
          )}
          {turnLog.lifeLoss > 0 && (
            <p className="seq-life-loss">Life lost this turn: {turnLog.lifeLoss}</p>
          )}
        </div>
      ))}
    </div>
  </>
);

// ─────────────────────────────────────────────────────────────────────────────
// downloadTextFile
// ─────────────────────────────────────────────────────────────────────────────
export const downloadTextFile = (content, filename) => {
  const blob = new Blob([content], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// ─────────────────────────────────────────────────────────────────────────────
// prepareChartData
//   Pure function — receives simulationResults + turns count.
// ─────────────────────────────────────────────────────────────────────────────
export const prepareChartData = (simulationResults, turns) => {
  if (!simulationResults) return null;

  const landsData      = [];
  const manaByColorData = [];
  const lifeLossData   = [];
  const keyCardsData   = [];

  for (let i = 0; i < turns; i++) {
    landsData.push({
      turn: i + 1,
      'Total Lands':   safeToFixed(simulationResults.landsPerTurn?.[i], 2),
      'Untapped Lands': safeToFixed(simulationResults.untappedLandsPerTurn?.[i], 2),
    });

    manaByColorData.push({
      turn: i + 1,
      'Total Mana': safeToFixed(simulationResults.totalManaPerTurn?.[i], 2),
      W: safeToFixed(simulationResults.colorsByTurn?.[i]?.W, 2),
      U: safeToFixed(simulationResults.colorsByTurn?.[i]?.U, 2),
      B: safeToFixed(simulationResults.colorsByTurn?.[i]?.B, 2),
      R: safeToFixed(simulationResults.colorsByTurn?.[i]?.R, 2),
      G: safeToFixed(simulationResults.colorsByTurn?.[i]?.G, 2),
    });

    lifeLossData.push({
      turn: i + 1,
      'Life Loss': safeToFixed(simulationResults.lifeLossPerTurn?.[i], 2),
    });

    const keyCardRow = { turn: i + 1 };
    if (simulationResults.keyCardPlayability) {
      Object.keys(simulationResults.keyCardPlayability).forEach(cardName => {
        keyCardRow[cardName] = safeToFixed(simulationResults.keyCardPlayability[cardName]?.[i], 1);
      });
    }
    if (simulationResults.hasBurstCards && simulationResults.keyCardPlayabilityBurst) {
      Object.keys(simulationResults.keyCardPlayabilityBurst).forEach(cardName => {
        keyCardRow[`${cardName} (+burst)`] = safeToFixed(
          simulationResults.keyCardPlayabilityBurst[cardName]?.[i], 1
        );
      });
    }
    keyCardsData.push(keyCardRow);
  }

  return { landsData, manaByColorData, lifeLossData, keyCardsData };
};
