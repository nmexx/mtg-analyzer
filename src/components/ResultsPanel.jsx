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
  LineChart, Line,
  XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';

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
        {enableMulligans && (
          <p>
            Mulligan Rate:{' '}
            {iterations > 0
              ? ((simulationResults.mulligans / iterations) * 100).toFixed(1)
              : 0}%
          </p>
        )}
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
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData.landsData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="turn" label={{ value: 'Turn', position: 'insideBottom', offset: -5 }} />
            <YAxis label={{ value: 'Count', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="Total Lands" stroke="#667eea" strokeWidth={2} />
            <Line type="monotone" dataKey="Untapped Lands" stroke="#22c55e" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Mana by Color */}
      <div className="panel">
        <h3>Available Mana by Color</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData.manaByColorData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="turn" label={{ value: 'Turn', position: 'insideBottom', offset: -5 }} />
            <YAxis label={{ value: 'Mana', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="Total Mana" stroke="#7c3aed" strokeWidth={3} />
            <Line type="monotone" dataKey="W" stroke="#fcd34d" strokeWidth={2} />
            <Line type="monotone" dataKey="U" stroke="#60a5fa" strokeWidth={2} />
            <Line type="monotone" dataKey="B" stroke="#6b7280" strokeWidth={2} />
            <Line type="monotone" dataKey="R" stroke="#f87171" strokeWidth={2} />
            <Line type="monotone" dataKey="G" stroke="#4ade80" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Life Loss */}
      <div className="panel">
        <h3>Cumulative Life Loss</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData.lifeLossData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="turn" label={{ value: 'Turn', position: 'insideBottom', offset: -5 }} />
            <YAxis label={{ value: 'Life Loss', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="Life Loss" stroke="#dc2626" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Key Card Playability */}
      {selectedKeyCards.size > 0 && (
        <div className="panel">
          <h3>Key Cards Playability (%)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData.keyCardsData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="turn" label={{ value: 'Turn', position: 'insideBottom', offset: -5 }} />
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
        </div>
      )}

      {/* Play Sequences */}
      {Object.keys(simulationResults.fastestPlaySequences).length > 0 && (
        <div className="panel">
          <h3>⚡ Play Sequences for Turn {selectedTurnForSequences}</h3>
          <p className="card-meta card-meta--spaced">
            Showing example hands that can play key cards on turn {selectedTurnForSequences}
          </p>

          {Object.entries(simulationResults.fastestPlaySequences).map(([cardName, sequencesByTurn]) => {
            const sequencesForTurn = sequencesByTurn[selectedTurnForSequences];
            const burstSequencesForTurn =
              simulationResults.fastestPlaySequencesBurst?.[cardName]?.[selectedTurnForSequences];

            if (
              (!sequencesForTurn || sequencesForTurn.length === 0) &&
              (!burstSequencesForTurn || burstSequencesForTurn.length === 0)
            ) {
              return (
                <div key={cardName} className="sequence-group">
                  <h4 className="sequence-card-name"><CardTooltip name={cardName}>{cardName}</CardTooltip></h4>
                  <p className="sequence-no-result">
                    No sequences found for turn {selectedTurnForSequences}. This card was not playable
                    on this turn in any simulated games.
                  </p>
                </div>
              );
            }

            return (
              <div key={cardName} className="sequence-group">
                <h4 className="sequence-card-name"><CardTooltip name={cardName}>{cardName}</CardTooltip></h4>

                {sequencesForTurn && sequencesForTurn.map((data, seqIdx) => (
                  <div key={seqIdx} className="sequence-card">
                    <p className="sequence-meta">
                      <strong>Example {seqIdx + 1}:</strong> Playable on turn {data.turn}{' '}
                      ({data.manaAvailable} mana available)
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
                          <strong>Burst example {seqIdx + 1}:</strong> Turn {data.turn} &mdash;&nbsp;
                          {data.manaAvailable} base + {data.manaWithBurst - data.manaAvailable} burst
                          &nbsp;= {data.manaWithBurst} mana total
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
          })}
        </div>
      )}
    </div>
  );
};

export default ResultsPanel;
