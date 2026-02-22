/**
 * ComparisonResultsPanel.jsx
 *
 * Renders side-by-side overlay charts for two simulated decklists (A/B mode).
 * Each chart plots both decks on the same axes so differences are immediately
 * visible.  Solid lines = Deck A, dashed lines = Deck B.
 *
 * Props:
 *   chartDataA           – object returned by prepareChartData() for Deck A
 *   chartDataB           – object returned by prepareChartData() for Deck B
 *   simulationResultsA   – raw monteCarlo() result for Deck A
 *   simulationResultsB   – raw monteCarlo() result for Deck B
 *   iterations           – number (shared)
 *   enableMulligans      – boolean (shared)
 *   selectedKeyCardsA    – Set<string>
 *   selectedKeyCardsB    – Set<string>
 *   labelA               – string (default "Deck A")
 *   labelB               – string (default "Deck B")
 *   exportResultsAsPNG   – () => void
 *   exportResultsAsCSV   – () => void
 */

import React from 'react';
import {
  ComposedChart,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// ── Colour palette ─────────────────────────────────────────────────────────────
// Deck A: cool blues/greens   Deck B: warm amber/reds
const DECK_A = {
  primary: '#667eea',
  secondary: '#22c55e',
};
const DECK_B = {
  primary: '#f59e0b',
  secondary: '#f87171',
};

const KEY_PALETTE_A = ['#667eea', '#22c55e', '#60a5fa', '#4ade80', '#a78bfa'];
const KEY_PALETTE_B = ['#f59e0b', '#f87171', '#fb923c', '#fbbf24', '#e879f9'];

// ── Tooltip helper ─────────────────────────────────────────────────────────────
const SimpleTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'rgba(30,30,40,0.92)',
        border: '1px solid #555',
        borderRadius: 6,
        padding: '8px 12px',
        fontSize: 13,
        color: '#e5e7eb',
      }}
    >
      <p style={{ margin: '0 0 6px', fontWeight: 600, color: '#cbd5e1' }}>Turn {label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ margin: '2px 0', color: p.color || '#e5e7eb' }}>
          <span style={{ fontWeight: 500 }}>{p.name}:</span>{' '}
          {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
        </p>
      ))}
    </div>
  );
};

// ── Delta helpers (module-level) ─────────────────────────────────────────────
const delta = (a, b, higherIsBetter = true) => {
  const diff = b - a;
  if (Math.abs(diff) < 0.01) return null;
  const better = higherIsBetter ? diff > 0 : diff < 0;
  return { diff: diff.toFixed(2), better };
};

const DeltaBadge = ({ a, b, higherIsBetter = true, labelB }) => {
  const d = delta(a, b, higherIsBetter);
  if (!d) return <span className="delta-neutral">≈ equal</span>;
  const label = `${d.diff > 0 ? '+' : ''}${d.diff}`;
  return (
    <span className={d.better ? 'delta-better' : 'delta-worse'}>
      {labelB} {d.better ? '▲' : '▼'} {label}
    </span>
  );
};

// ── Component ──────────────────────────────────────────────────────────────────
const ComparisonResultsPanel = ({
  chartDataA,
  chartDataB,
  simulationResultsA,
  simulationResultsB,
  iterations,
  enableMulligans,
  selectedKeyCardsA,
  selectedKeyCardsB,
  labelA = 'Deck A',
  labelB = 'Deck B',
  exportResultsAsPNG,
  exportResultsAsCSV,
}) => {
  if (!chartDataA || !chartDataB) return null;

  const numTurns = Math.min(chartDataA.landsData.length, chartDataB.landsData.length);

  // ── Merge per-turn data for each chart ───────────────────────────────────────
  const landsCompare = Array.from({ length: numTurns }, (_, i) => ({
    turn: chartDataA.landsData[i].turn,
    [`${labelA}: Total Lands`]: chartDataA.landsData[i]['Total Lands'],
    [`${labelB}: Total Lands`]: chartDataB.landsData[i]['Total Lands'],
    [`${labelA}: Untapped Lands`]: chartDataA.landsData[i]['Untapped Lands'],
    [`${labelB}: Untapped Lands`]: chartDataB.landsData[i]['Untapped Lands'],
  }));

  const manaCompare = Array.from({ length: numTurns }, (_, i) => ({
    turn: chartDataA.manaByColorData[i].turn,
    [`${labelA}: Total Mana`]: chartDataA.manaByColorData[i]['Total Mana'],
    [`${labelB}: Total Mana`]: chartDataB.manaByColorData[i]['Total Mana'],
  }));

  const lifeCompare = Array.from({ length: numTurns }, (_, i) => ({
    turn: chartDataA.lifeLossData[i].turn,
    [`${labelA}: Life Loss`]: chartDataA.lifeLossData[i]['Life Loss'],
    [`${labelB}: Life Loss`]: chartDataB.lifeLossData[i]['Life Loss'],
  }));

  const drawnCompare = Array.from({ length: numTurns }, (_, i) => ({
    turn: chartDataA.cardsDrawnData[i].turn,
    [`${labelA}: Cards Drawn`]: chartDataA.cardsDrawnData[i]['Cards Drawn'],
    [`${labelB}: Cards Drawn`]: chartDataB.cardsDrawnData[i]['Cards Drawn'],
  }));

  // ── Key card playability — union of both sets ────────────────────────────────
  const allKeyCards = new Set([...selectedKeyCardsA, ...selectedKeyCardsB]);
  const keyCompare = Array.from({ length: numTurns }, (_, i) => {
    const row = { turn: chartDataA.keyCardsData[i]?.turn ?? i + 1 };
    for (const card of allKeyCards) {
      if (selectedKeyCardsA.has(card) && chartDataA.keyCardsData[i]?.[card] !== undefined)
        row[`${labelA}: ${card}`] = chartDataA.keyCardsData[i][card];
      if (selectedKeyCardsB.has(card) && chartDataB.keyCardsData[i]?.[card] !== undefined)
        row[`${labelB}: ${card}`] = chartDataB.keyCardsData[i][card];
    }
    return row;
  });

  // ── Delta helpers for summary ────────────────────────────────────────────────
  const finalLandA = chartDataA.landsData.at(-1)?.['Total Lands'] ?? 0;
  const finalLandB = chartDataB.landsData.at(-1)?.['Total Lands'] ?? 0;
  const finalManaA = chartDataA.manaByColorData.at(-1)?.['Total Mana'] ?? 0;
  const finalManaB = chartDataB.manaByColorData.at(-1)?.['Total Mana'] ?? 0;
  const finalLifeA = chartDataA.lifeLossData.at(-1)?.['Life Loss'] ?? 0;
  const finalLifeB = chartDataB.lifeLossData.at(-1)?.['Life Loss'] ?? 0;

  return (
    <div id="results-section">
      {/* ── Summary ─────────────────────────────────────────────────────────── */}
      <div className="panel">
        <h3>📊 Comparison Results</h3>

        <div className="comparison-summary-grid">
          {[
            {
              label: labelA,
              res: simulationResultsA,
              finalLand: finalLandA,
              finalMana: finalManaA,
              finalLife: finalLifeA,
            },
            {
              label: labelB,
              res: simulationResultsB,
              finalLand: finalLandB,
              finalMana: finalManaB,
              finalLife: finalLifeB,
            },
          ].map(({ label, res, finalLand, finalMana, finalLife }) => (
            <div key={label} className="comparison-summary-col">
              <h4 className={label === labelA ? 'deck-label-a' : 'deck-label-b'}>{label}</h4>
              <p>
                Hands kept: <strong>{res.handsKept.toLocaleString()}</strong>
              </p>
              {enableMulligans && (
                <p>
                  Mulligan rate: <strong>{((res.mulligans / iterations) * 100).toFixed(1)}%</strong>
                </p>
              )}
              <p>
                Lands by final turn: <strong>{finalLand.toFixed(2)}</strong>
              </p>
              <p>
                Mana by final turn: <strong>{finalMana.toFixed(2)}</strong>
              </p>
              <p>
                Life loss by final turn: <strong>{finalLife.toFixed(2)}</strong>
              </p>
            </div>
          ))}
          <div className="comparison-summary-col comparison-summary-col--delta">
            <h4>Δ Difference (B vs A)</h4>
            <p>
              Lands:{' '}
              <DeltaBadge a={finalLandA} b={finalLandB} higherIsBetter={true} labelB={labelB} />
            </p>
            <p>
              Mana:{' '}
              <DeltaBadge a={finalManaA} b={finalManaB} higherIsBetter={true} labelB={labelB} />
            </p>
            <p>
              Life loss:{' '}
              <DeltaBadge a={finalLifeA} b={finalLifeB} higherIsBetter={false} labelB={labelB} />
            </p>
          </div>
        </div>

        <div className="export-buttons" style={{ marginTop: '1rem' }}>
          <button onClick={exportResultsAsPNG} className="btn-success">
            📸 Export Results as PNG
          </button>
          <button onClick={exportResultsAsCSV} className="btn-success">
            📄 Export Results as CSV
          </button>
        </div>
      </div>

      {/* ── Lands per Turn ──────────────────────────────────────────────────── */}
      <div className="panel">
        <h3>Lands per Turn</h3>
        <p className="card-meta">
          Solid = Total Lands · Dashed = Untapped Lands · Blue = {labelA} · Amber = {labelB}
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={landsCompare}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="turn" label={{ value: 'Turn', position: 'insideBottom', offset: -5 }} />
            <YAxis label={{ value: 'Count', angle: -90, position: 'insideLeft' }} />
            <Tooltip content={SimpleTooltip} />
            <Legend />
            <Line
              type="monotone"
              dataKey={`${labelA}: Total Lands`}
              stroke={DECK_A.primary}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey={`${labelB}: Total Lands`}
              stroke={DECK_B.primary}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey={`${labelA}: Untapped Lands`}
              stroke={DECK_A.secondary}
              strokeWidth={2}
              dot={false}
              strokeDasharray="6 3"
            />
            <Line
              type="monotone"
              dataKey={`${labelB}: Untapped Lands`}
              stroke={DECK_B.secondary}
              strokeWidth={2}
              dot={false}
              strokeDasharray="6 3"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Total Mana per Turn ─────────────────────────────────────────────── */}
      <div className="panel">
        <h3>Available Mana per Turn</h3>
        <p className="card-meta">
          Blue = {labelA} · Amber = {labelB}
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={manaCompare}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="turn" label={{ value: 'Turn', position: 'insideBottom', offset: -5 }} />
            <YAxis label={{ value: 'Mana', angle: -90, position: 'insideLeft' }} />
            <Tooltip content={SimpleTooltip} />
            <Legend />
            <Line
              type="monotone"
              dataKey={`${labelA}: Total Mana`}
              stroke={DECK_A.primary}
              strokeWidth={3}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey={`${labelB}: Total Mana`}
              stroke={DECK_B.primary}
              strokeWidth={3}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Cumulative Life Loss ─────────────────────────────────────────────── */}
      <div className="panel">
        <h3>Cumulative Life Loss</h3>
        <p className="card-meta">
          Blue = {labelA} · Amber = {labelB}
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={lifeCompare}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="turn" label={{ value: 'Turn', position: 'insideBottom', offset: -5 }} />
            <YAxis label={{ value: 'Life Loss', angle: -90, position: 'insideLeft' }} />
            <Tooltip content={SimpleTooltip} />
            <Legend />
            <Line
              type="monotone"
              dataKey={`${labelA}: Life Loss`}
              stroke={DECK_A.primary}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey={`${labelB}: Life Loss`}
              stroke={DECK_B.primary}
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Cards Drawn per Turn ─────────────────────────────────────────────── */}
      <div className="panel">
        <h3>Cards Drawn per Turn</h3>
        <p className="card-meta">
          Blue = {labelA} · Amber = {labelB}
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={drawnCompare}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="turn" label={{ value: 'Turn', position: 'insideBottom', offset: -5 }} />
            <YAxis label={{ value: 'Cards', angle: -90, position: 'insideLeft' }} />
            <Tooltip content={SimpleTooltip} />
            <Legend />
            <Line
              type="monotone"
              dataKey={`${labelA}: Cards Drawn`}
              stroke={DECK_A.primary}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey={`${labelB}: Cards Drawn`}
              stroke={DECK_B.primary}
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Key Card Playability ─────────────────────────────────────────────── */}
      {allKeyCards.size > 0 && (
        <div className="panel">
          <h3>Key Cards Playability (%)</h3>
          <p className="card-meta">
            Solid = {labelA} key cards · Dashed = {labelB} key cards
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={keyCompare}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="turn"
                label={{ value: 'Turn', position: 'insideBottom', offset: -5 }}
              />
              <YAxis label={{ value: 'Playable (%)', angle: -90, position: 'insideLeft' }} />
              <Tooltip content={SimpleTooltip} />
              <Legend />
              {(() => {
                const lines = [];
                let idxA = 0;
                let idxB = 0;
                for (const card of allKeyCards) {
                  if (selectedKeyCardsA.has(card))
                    lines.push(
                      <Line
                        key={`A-${card}`}
                        type="monotone"
                        dataKey={`${labelA}: ${card}`}
                        stroke={KEY_PALETTE_A[idxA++ % KEY_PALETTE_A.length]}
                        strokeWidth={2}
                        dot={false}
                      />
                    );
                  if (selectedKeyCardsB.has(card))
                    lines.push(
                      <Line
                        key={`B-${card}`}
                        type="monotone"
                        dataKey={`${labelB}: ${card}`}
                        stroke={KEY_PALETTE_B[idxB++ % KEY_PALETTE_B.length]}
                        strokeWidth={2}
                        dot={false}
                        strokeDasharray="6 3"
                      />
                    );
                }
                return lines;
              })()}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default ComparisonResultsPanel;
