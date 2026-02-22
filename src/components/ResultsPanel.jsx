/**
 * ResultsPanel.jsx
 *
 * Displays Monte Carlo simulation results: summary statistics, four recharts
 * line charts (lands, mana, life loss, key-card playability), and the
 * play-sequence explorer for the selected turn.
 *
 * Props:
 *   simulationResults  – object returned by monteCarlo()
 *   chartData          – object returned by prepareChartData()
 *   iterations         – number
 *   enableMulligans    – boolean
 *   selectedKeyCards   – Set<string>
 *   selectedTurnForSequences – number
 *   exportResultsAsPNG – () => void
 *   renderSequenceBody – (data, accentColor) => JSX
 */

import React from 'react';
import CardTooltip from './CardTooltip';
import {
  ComposedChart,
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

/**
 * Factory for a custom recharts Tooltip content component.
 * sdMap: { 'Series Name': '_sdDataKey', ... }
 * Each average series is shown as "name: value ± σ".
 * Band-area entries (array values) and internal _* keys are hidden.
 */
const makeStdTooltip = (sdMap = {}) => {
  const StdTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const rows = payload.filter(
      p => !Array.isArray(p.value) && !(typeof p.name === 'string' && p.name.startsWith('_'))
    );
    if (!rows.length) return null;
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
        {rows.map(p => {
          const sdKey = sdMap[p.name];
          const sd = sdKey != null ? p.payload?.[sdKey] : null;
          const avg = typeof p.value === 'number' ? p.value.toFixed(2) : p.value;
          return (
            <p key={p.name} style={{ margin: '2px 0', color: p.color || '#e5e7eb' }}>
              <span style={{ fontWeight: 500 }}>{p.name}:</span> {avg}
              {sd != null ? (
                <span style={{ opacity: 0.75 }}> ± {Number(sd).toFixed(2)}</span>
              ) : null}
            </p>
          );
        })}
      </div>
    );
  };
  return StdTooltip;
};

const FIRST_PLAYABLE_THRESHOLDS = [50, 80, 95];

const ResultsPanel = ({
  simulationResults,
  chartData,
  iterations,
  enableMulligans,
  selectedKeyCards,
  selectedTurnForSequences,
  exportResultsAsPNG,
  exportResultsAsCSV,
  renderSequenceBody,
}) => {
  if (!simulationResults || !chartData) return null;

  return (
    <div id="results-section">
      {/* Summary */}
      <div className="panel">
        <h3>📊 Simulation Results</h3>
        <p>Iterations: {iterations.toLocaleString()}</p>
        <p>Hands Kept: {simulationResults.handsKept.toLocaleString()}</p>
        {enableMulligans &&
          (() => {
            const mulliganPct =
              iterations > 0 ? (simulationResults.mulligans / iterations) * 100 : 0;
            return (
              <p>
                Mulligan Rate:{' '}
                <strong
                  style={{
                    color:
                      mulliganPct >= 35 ? '#b91c1c' : mulliganPct >= 18 ? '#92400e' : '#15803d',
                  }}
                >
                  {mulliganPct.toFixed(1)}%
                </strong>
              </p>
            );
          })()}
        <div className="export-buttons">
          <button onClick={exportResultsAsPNG} className="btn-success">
            📸 Export Results as PNG
          </button>
          <button onClick={exportResultsAsCSV} className="btn-success">
            📄 Export Results as CSV
          </button>
        </div>
      </div>

      {/* Lands per Turn */}
      <div className="panel">
        <h3>Lands per Turn</h3>
        <p className="card-meta">Shaded bands show ±1 standard deviation across simulations.</p>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData.landsData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="turn" label={{ value: 'Turn', position: 'insideBottom', offset: -5 }} />
            <YAxis label={{ value: 'Count', angle: -90, position: 'insideLeft' }} />
            <Tooltip
              content={makeStdTooltip({
                'Total Lands': '_landsSd',
                'Untapped Lands': '_untappedSd',
              })}
            />
            <Legend />
            {/* ±1σ bands */}
            <Area
              type="monotone"
              dataKey={d => [d['Total Lands Lo'], d['Total Lands Hi']]}
              fill="rgba(102,126,234,0.18)"
              stroke="none"
              name="Total Lands ±1σ"
              legendType="none"
              activeDot={false}
              dot={false}
            />
            <Area
              type="monotone"
              dataKey={d => [d['Untapped Lands Lo'], d['Untapped Lands Hi']]}
              fill="rgba(34,197,94,0.18)"
              stroke="none"
              name="Untapped Lands ±1σ"
              legendType="none"
              activeDot={false}
              dot={false}
            />
            {/* Average lines */}
            <Line
              type="monotone"
              dataKey="Total Lands"
              stroke="#667eea"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="Untapped Lands"
              stroke="#22c55e"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Flood / Screw rate badges */}
        {(simulationResults.floodRate != null || simulationResults.screwRate != null) && (
          <div className="flood-screw-rates">
            {simulationResults.floodRate != null && (
              <div className="flood-screw-badge flood-screw-badge--flood">
                <span className="flood-screw-badge__icon">🌊 Flood</span>
                <span className="flood-screw-badge__def">
                  {'>='}
                  {simulationResults.floodThreshold.lands} lands by T
                  {simulationResults.floodThreshold.turn}
                </span>
                <span className="flood-screw-badge__pct">
                  {simulationResults.floodRate.toFixed(1)}%
                </span>
              </div>
            )}
            {simulationResults.screwRate != null && (
              <div className="flood-screw-badge flood-screw-badge--screw">
                <span className="flood-screw-badge__icon">🏜️ Screw</span>
                <span className="flood-screw-badge__def">
                  {'<='}
                  {simulationResults.screwThreshold.lands} lands by T
                  {simulationResults.screwThreshold.turn}
                </span>
                <span className="flood-screw-badge__pct">
                  {simulationResults.screwRate.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mana by Color */}
      <div className="panel">
        <h3>Available Mana by Color</h3>
        <p className="card-meta">
          Shaded band on Total Mana shows ±1 standard deviation across simulations.
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData.manaByColorData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="turn" label={{ value: 'Turn', position: 'insideBottom', offset: -5 }} />
            <YAxis label={{ value: 'Mana', angle: -90, position: 'insideLeft' }} />
            <Tooltip content={makeStdTooltip({ 'Total Mana': '_manaSd' })} />
            <Legend />
            {/* ±1σ band for total mana */}
            <Area
              type="monotone"
              dataKey={d => [d['Total Mana Lo'], d['Total Mana Hi']]}
              fill="rgba(124,58,237,0.15)"
              stroke="none"
              name="Total Mana ±1σ"
              legendType="none"
              activeDot={false}
              dot={false}
            />
            {/* Average lines */}
            <Line
              type="monotone"
              dataKey="Total Mana"
              stroke="#7c3aed"
              strokeWidth={3}
              dot={false}
            />
            <Line type="monotone" dataKey="W" stroke="#fcd34d" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="U" stroke="#60a5fa" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="B" stroke="#6b7280" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="R" stroke="#f87171" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="G" stroke="#4ade80" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Life Loss */}
      <div className="panel">
        <h3>Cumulative Life Loss</h3>
        <p className="card-meta">Shaded band shows ±1 standard deviation across simulations.</p>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData.lifeLossData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="turn" label={{ value: 'Turn', position: 'insideBottom', offset: -5 }} />
            <YAxis label={{ value: 'Life Loss', angle: -90, position: 'insideLeft' }} />
            <Tooltip content={makeStdTooltip({ 'Life Loss': '_lifeLossSd' })} />
            <Legend />
            <Area
              type="monotone"
              dataKey={d => [d['Life Loss Lo'], d['Life Loss Hi']]}
              fill="rgba(220,38,38,0.15)"
              stroke="none"
              name="Life Loss ±1σ"
              legendType="none"
              activeDot={false}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="Life Loss"
              stroke="#dc2626"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Cards Drawn per Turn */}
      {chartData.cardsDrawnData && (
        <div className="panel">
          <h3>Cards Drawn per Turn</h3>
          <p className="card-meta">
            Includes natural draw, draw-engine upkeep triggers, and one-shot draw spells cast that
            turn. Does not include the opening hand. Shaded band = ±1σ.
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData.cardsDrawnData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="turn"
                label={{ value: 'Turn', position: 'insideBottom', offset: -5 }}
              />
              <YAxis label={{ value: 'Cards', angle: -90, position: 'insideLeft' }} />
              <Tooltip content={makeStdTooltip({ 'Cards Drawn': '_drawnSd' })} />
              <Legend />
              <Area
                type="monotone"
                dataKey={d => [d['Cards Drawn Lo'], d['Cards Drawn Hi']]}
                fill="rgba(6,182,212,0.18)"
                stroke="none"
                name="Cards Drawn ±1σ"
                legendType="none"
                activeDot={false}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="Cards Drawn"
                stroke="#06b6d4"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Key Card Playability */}
      {selectedKeyCards.size > 0 && (
        <div className="panel">
          <h3>Key Cards Playability (%)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData.keyCardsData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="turn"
                label={{ value: 'Turn', position: 'insideBottom', offset: -5 }}
              />
              <YAxis label={{ value: 'Playable (%)', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              {Array.from(selectedKeyCards).map((cardName, idx) => {
                const colors = ['#667eea', '#f59e0b', '#22c55e', '#dc2626', '#60a5fa'];
                const color = colors[idx % colors.length];
                const burstKey = `${cardName} (+burst)`;
                const showBurst =
                  simulationResults?.hasBurstCards &&
                  chartData.keyCardsData?.[0]?.[burstKey] !== undefined;
                return (
                  <React.Fragment key={cardName}>
                    <Line type="monotone" dataKey={cardName} stroke={color} strokeWidth={2} />
                    {showBurst && (
                      <Line
                        type="monotone"
                        dataKey={burstKey}
                        stroke={color}
                        strokeWidth={2}
                        strokeDasharray="6 3"
                        dot={false}
                        name={`${cardName} (+burst)`}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </LineChart>
          </ResponsiveContainer>

          {/* First Playable by Turn X */}
          {simulationResults?.keyCardPlayability &&
            Object.keys(simulationResults.keyCardPlayability).length > 0 && (
              <div className="first-playable-summary">
                <h4 className="first-playable-title">📅 First Playable by Turn</h4>
                <p className="card-meta">
                  Earliest turn where cumulative playability first crosses each threshold.
                </p>
                <table className="first-playable-table">
                  <thead>
                    <tr>
                      <th>Card</th>
                      {FIRST_PLAYABLE_THRESHOLDS.map(t => (
                        <th key={t}>&ge;&thinsp;{t}%</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(selectedKeyCards).map((cardName, idx) => {
                      const colors = ['#667eea', '#f59e0b', '#22c55e', '#dc2626', '#60a5fa'];
                      const color = colors[idx % colors.length];
                      const perTurn = simulationResults.keyCardPlayability?.[cardName] ?? [];
                      return (
                        <tr key={cardName}>
                          <td>
                            <span className="on-curve-card-dot" style={{ background: color }} />
                            <CardTooltip name={cardName}>{cardName}</CardTooltip>
                          </td>
                          {FIRST_PLAYABLE_THRESHOLDS.map(threshold => {
                            const turnIdx = perTurn.findIndex(pct => pct >= threshold);
                            return (
                              <td key={threshold}>
                                {turnIdx === -1 ? (
                                  <span className="first-playable-never">—</span>
                                ) : (
                                  <span
                                    className="first-playable-turn"
                                    style={{
                                      color:
                                        turnIdx + 1 <= 2
                                          ? '#15803d'
                                          : turnIdx + 1 <= 4
                                            ? '#92400e'
                                            : '#b91c1c',
                                      background:
                                        turnIdx + 1 <= 2
                                          ? '#dcfce7'
                                          : turnIdx + 1 <= 4
                                            ? '#fef3c7'
                                            : '#fee2e2',
                                    }}
                                  >
                                    T{turnIdx + 1}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

          {/* On-Curve Playability Summary */}
          {simulationResults?.keyCardOnCurvePlayability &&
            Object.keys(simulationResults.keyCardOnCurvePlayability).length > 0 && (
              <div className="on-curve-summary">
                <h4 className="on-curve-title">🎯 On-Curve Playability</h4>
                <p className="card-meta">
                  % of games where the card is castable on exactly the turn matching its CMC.
                </p>
                <table className="on-curve-table">
                  <thead>
                    <tr>
                      <th>Card</th>
                      <th>CMC</th>
                      <th>On-Curve Turn</th>
                      <th>On-Curve %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(selectedKeyCards).map((cardName, idx) => {
                      const colors = ['#667eea', '#f59e0b', '#22c55e', '#dc2626', '#60a5fa'];
                      const color = colors[idx % colors.length];
                      const cmc = simulationResults.keyCardOnCurveCMC?.[cardName];
                      const pct = simulationResults.keyCardOnCurvePlayability?.[cardName] ?? null;
                      const onCurveTurn = cmc != null ? (cmc === 0 ? 1 : cmc) : null;
                      const pctDisplay = pct != null ? `${pct.toFixed(1)}%` : '—';
                      const cmcDisplay = cmc != null ? cmc : '—';
                      const turnDisplay = onCurveTurn != null ? `Turn ${onCurveTurn}` : '—';
                      return (
                        <tr key={cardName}>
                          <td>
                            <span className="on-curve-card-dot" style={{ background: color }} />
                            <CardTooltip name={cardName}>{cardName}</CardTooltip>
                          </td>
                          <td>{cmcDisplay}</td>
                          <td>{turnDisplay}</td>
                          <td className="prob-bar-cell">
                            {pct != null && (
                              <div
                                className="prob-bar-fill"
                                style={{
                                  width: `${Math.min(pct, 100)}%`,
                                  background:
                                    pct >= 70 ? '#4ade80' : pct >= 40 ? '#f59e0b' : '#f87171',
                                }}
                              />
                            )}
                            <span
                              className="on-curve-pct prob-bar-value"
                              style={{
                                color:
                                  pct == null
                                    ? '#9ca3af'
                                    : pct >= 70
                                      ? '#15803d'
                                      : pct >= 40
                                        ? '#92400e'
                                        : '#b91c1c',
                              }}
                            >
                              {pctDisplay}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      )}

      {/* Play Sequences */}
      {Object.keys(simulationResults.fastestPlaySequences).length > 0 && (
        <div className="panel">
          <h3>⚡ Play Sequences for Turn {selectedTurnForSequences}</h3>
          <p className="card-meta card-meta--spaced">
            Showing example hands that can play key cards on turn {selectedTurnForSequences}
          </p>

          {Object.entries(simulationResults.fastestPlaySequences).map(
            ([cardName, sequencesByTurn]) => {
              const sequencesForTurn = sequencesByTurn[selectedTurnForSequences];
              const burstSequencesForTurn =
                simulationResults.fastestPlaySequencesBurst?.[cardName]?.[selectedTurnForSequences];

              if (
                (!sequencesForTurn || sequencesForTurn.length === 0) &&
                (!burstSequencesForTurn || burstSequencesForTurn.length === 0)
              ) {
                return (
                  <div key={cardName} className="sequence-group">
                    <h4 className="sequence-card-name">
                      <CardTooltip name={cardName}>{cardName}</CardTooltip>
                    </h4>
                    <p className="sequence-no-result">
                      No sequences found for turn {selectedTurnForSequences}. This card was not
                      playable on this turn in any simulated games.
                    </p>
                  </div>
                );
              }

              return (
                <div key={cardName} className="sequence-group">
                  <h4 className="sequence-card-name">
                    <CardTooltip name={cardName}>{cardName}</CardTooltip>
                  </h4>

                  {sequencesForTurn &&
                    sequencesForTurn.map((data, seqIdx) => (
                      <div key={seqIdx} className="sequence-card">
                        <p className="sequence-meta">
                          <strong>Example {seqIdx + 1}:</strong> Playable on turn {data.turn} (
                          {data.manaAvailable} mana available)
                        </p>
                        {renderSequenceBody(data, '#667eea')}
                      </div>
                    ))}

                  {burstSequencesForTurn && burstSequencesForTurn.length > 0 && (
                    <>
                      <p className="sequence-burst-label">
                        ⚡ Burst-only — playable only by spending{' '}
                        {burstSequencesForTurn[0]?.burstCards?.join(' / ')}
                      </p>
                      {burstSequencesForTurn.map((data, seqIdx) => (
                        <div key={`burst-${seqIdx}`} className="sequence-card sequence-card--burst">
                          <p className="sequence-burst-meta">
                            <strong>Burst example {seqIdx + 1}:</strong> Turn {data.turn}{' '}
                            &mdash;&nbsp;
                            {data.manaAvailable} base + {data.manaWithBurst - data.manaAvailable}{' '}
                            burst &nbsp;= {data.manaWithBurst} mana total
                          </p>
                          <p className="sequence-burst-cards">
                            Burst cards in hand: <strong>{data.burstCards.join(', ')}</strong>
                          </p>
                          {renderSequenceBody(data, '#f59e0b')}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              );
            }
          )}
        </div>
      )}
    </div>
  );
};

export default ResultsPanel;
