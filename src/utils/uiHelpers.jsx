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
export const getManaSymbol = color => {
  const symbols = { W: '☀️', U: '💧', B: '💀', R: '🔥', G: '🌿', C: '◇' };
  return symbols[color] || '';
};

const MANA_TITLES = {
  W: 'White mana',
  U: 'Blue mana',
  B: 'Black mana',
  R: 'Red mana',
  G: 'Green mana',
  C: 'Colorless mana',
};
export const getManaTitle = color => MANA_TITLES[color] || color;

export const parseManaSymbols = manaCost => {
  if (!manaCost) return [];
  return (manaCost.match(/\{([^}]+)\}/g) || []).map(s => s.replace(/[{}]/g, ''));
};

const MANA_COST_TITLES = {
  W: 'White mana',
  U: 'Blue mana',
  B: 'Black mana',
  R: 'Red mana',
  G: 'Green mana',
  C: 'Colorless mana',
};

export const renderManaCost = manaCost => {
  const colorSymbols = { W: '☀️', U: '💧', B: '💀', R: '🔥', G: '🌿', C: '◇' };
  return parseManaSymbols(manaCost).map((symbol, idx) => {
    if (colorSymbols[symbol])
      return (
        <span key={idx} className="mana-cost-symbol" title={MANA_COST_TITLES[symbol]}>
          {colorSymbols[symbol]}
        </span>
      );
    return (
      <span key={idx} className="mana-cost-generic" title={`Generic mana (${symbol})`}>
        {symbol}
      </span>
    );
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Fetch type badge
// ─────────────────────────────────────────────────────────────────────────────
export const getFetchSymbol = fetchType => {
  const symbols = { classic: '⚡', slow: '🐌', mana_cost: '💰', free_slow: '🆓' };
  return symbols[fetchType] || '';
};

export const getFetchTitle = fetchType => {
  const titles = {
    classic:
      '⚡ Classic fetch — pay 1 life, search your library for a matching land, put it on the battlefield',
    slow: '🐌 Slow fetch — enters tapped; sacrifice at the start of your next upkeep to search for a land',
    mana_cost: '💰 Paid fetch — tap and pay mana to search your library for a basic land',
    free_slow:
      '🆓 Free slow fetch — no life cost; enters tapped, sacrifice it to search for a basic land',
    auto_sacrifice: 'Auto-sacrifice fetch — sacrifices itself automatically to search for a land',
    trigger: 'Triggered fetch — searches for a land when a specific condition is met',
    saga_any: 'Saga fetch — searches for any land as part of a saga chapter ability',
  };
  return titles[fetchType] || 'Fetch land — searches your library for a land card';
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
      {data.sequence &&
        data.sequence.map((turnLog, idx) => (
          <div key={idx} className="seq-turn-block" style={{ '--seq-accent': accentColor }}>
            <p className="seq-turn-title">Turn {turnLog.turn}:</p>
            {turnLog.actions.length > 0 ? (
              <ul className="seq-turn-actions">
                {turnLog.actions.map((action, ai) => (
                  <li key={ai}>{action}</li>
                ))}
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
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
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

  const landsData = [];
  const manaByColorData = [];
  const lifeLossData = [];
  const cardsDrawnData = [];
  const keyCardsData = [];

  for (let i = 0; i < turns; i++) {
    const landsAvg = simulationResults.landsPerTurn?.[i] || 0;
    const landsSd = simulationResults.landsPerTurnStdDev?.[i] || 0;
    const untappedAvg = simulationResults.untappedLandsPerTurn?.[i] || 0;
    const untappedSd = simulationResults.untappedLandsPerTurnStdDev?.[i] || 0;
    const manaAvg = simulationResults.totalManaPerTurn?.[i] || 0;
    const manaSd = simulationResults.totalManaPerTurnStdDev?.[i] || 0;

    landsData.push({
      turn: i + 1,
      'Total Lands': safeToFixed(landsAvg, 2),
      'Untapped Lands': safeToFixed(untappedAvg, 2),
      'Total Lands Lo': safeToFixed(Math.max(0, landsAvg - landsSd), 2),
      'Total Lands Hi': safeToFixed(landsAvg + landsSd, 2),
      'Untapped Lands Lo': safeToFixed(Math.max(0, untappedAvg - untappedSd), 2),
      'Untapped Lands Hi': safeToFixed(untappedAvg + untappedSd, 2),
      _landsSd: safeToFixed(landsSd, 2),
      _untappedSd: safeToFixed(untappedSd, 2),
    });

    manaByColorData.push({
      turn: i + 1,
      'Total Mana': safeToFixed(manaAvg, 2),
      'Total Mana Lo': safeToFixed(Math.max(0, manaAvg - manaSd), 2),
      'Total Mana Hi': safeToFixed(manaAvg + manaSd, 2),
      _manaSd: safeToFixed(manaSd, 2),
      W: safeToFixed(simulationResults.colorsByTurn?.[i]?.W, 2),
      U: safeToFixed(simulationResults.colorsByTurn?.[i]?.U, 2),
      B: safeToFixed(simulationResults.colorsByTurn?.[i]?.B, 2),
      R: safeToFixed(simulationResults.colorsByTurn?.[i]?.R, 2),
      G: safeToFixed(simulationResults.colorsByTurn?.[i]?.G, 2),
    });

    const lifeLossAvg = simulationResults.lifeLossPerTurn?.[i] || 0;
    const lifeLossSd = simulationResults.lifeLossPerTurnStdDev?.[i] || 0;
    lifeLossData.push({
      turn: i + 1,
      'Life Loss': safeToFixed(lifeLossAvg, 2),
      'Life Loss Lo': safeToFixed(Math.max(0, lifeLossAvg - lifeLossSd), 2),
      'Life Loss Hi': safeToFixed(lifeLossAvg + lifeLossSd, 2),
      _lifeLossSd: safeToFixed(lifeLossSd, 2),
    });

    const drawnAvg = simulationResults.cardsDrawnPerTurn?.[i] || 0;
    const drawnSd = simulationResults.cardsDrawnPerTurnStdDev?.[i] || 0;
    cardsDrawnData.push({
      turn: i + 1,
      'Cards Drawn': safeToFixed(drawnAvg, 2),
      'Cards Drawn Lo': safeToFixed(Math.max(0, drawnAvg - drawnSd), 2),
      'Cards Drawn Hi': safeToFixed(drawnAvg + drawnSd, 2),
      _drawnSd: safeToFixed(drawnSd, 2),
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
          simulationResults.keyCardPlayabilityBurst[cardName]?.[i],
          1
        );
      });
    }
    keyCardsData.push(keyCardRow);
  }

  return { landsData, manaByColorData, lifeLossData, cardsDrawnData, keyCardsData };
};
