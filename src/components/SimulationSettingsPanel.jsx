/**
 * SimulationSettingsPanel.jsx
 *
 * Simulation configuration: iteration count, turns, hand size, sequence
 * viewer, Commander mode, mulligan settings, and the Run button.
 *
 * Props: all simulation state values + their setters, plus runSimulation and
 * isSimulating.
 */

import React from 'react';

const SimulationSettingsPanel = ({
  iterations, setIterations,
  turns, setTurns,
  handSize, setHandSize,
  maxSequences, setMaxSequences,
  selectedTurnForSequences, setSelectedTurnForSequences,
  commanderMode, setCommanderMode,
  enableMulligans, setEnableMulligans,
  mulliganRule, setMulliganRule,
  mulliganStrategy, setMulliganStrategy,
  customMulliganRules, setCustomMulliganRules,
  runSimulation,
  isSimulating,
}) => (
  <div className="panel">
    <h3>⚙️ Simulation Settings</h3>

    {/* Core numeric settings */}
    <div className="settings-grid">
      <div>
        <label className="settings-label">Number of Simulations</label>
        <input
          type="number"
          value={iterations}
          onChange={(e) => setIterations(parseInt(e.target.value))}
          min="1000" max="100000"
          className="settings-input"
        />
      </div>
      <div>
        <label className="settings-label">Turns to Simulate</label>
        <input
          type="number"
          value={turns}
          onChange={(e) => setTurns(parseInt(e.target.value))}
          min="1" max="15"
          className="settings-input"
        />
      </div>
      <div>
        <label className="settings-label">Starting Hand Size</label>
        <input
          type="number"
          value={handSize}
          onChange={(e) => setHandSize(parseInt(e.target.value))}
          min="1" max="10"
          className="settings-input"
        />
      </div>
      <div>
        <label className="settings-label">Turn to View Play Sequences</label>
        <input
          type="range"
          value={selectedTurnForSequences}
          onChange={(e) => setSelectedTurnForSequences(parseInt(e.target.value))}
          min="1" max={turns}
          className="settings-input"
        />
        <div className="range-display">Turn {selectedTurnForSequences}</div>
      </div>
      <div>
        <label className="settings-label">Number of Example Sequences</label>
        <input
          type="range"
          value={maxSequences}
          onChange={(e) => setMaxSequences(parseInt(e.target.value))}
          min="1" max="10"
          className="settings-input"
        />
        <div className="range-display">
          {maxSequences} {maxSequences === 1 ? 'example' : 'examples'}
        </div>
      </div>
    </div>

    {/* Commander mode */}
    <div className="commander-box">
      <label className="commander-label">
        <input
          type="checkbox"
          checked={commanderMode}
          onChange={(e) => setCommanderMode(e.target.checked)}
        />
        <span>🎩 Commander Mode (100-card singleton, optimized for multiplayer)</span>
      </label>
      {commanderMode && (
        <div className="commander-hint">
          Assumes multiplayer environment: Crowd lands enter untapped, longer game simulation recommended
        </div>
      )}
    </div>

    {/* Mulligan logic */}
    <div className="mulligan-box">
      <label className="mulligan-toggle-label">
        <input
          type="checkbox"
          checked={enableMulligans}
          onChange={(e) => setEnableMulligans(e.target.checked)}
        />
        <span>Enable Mulligan Logic</span>
      </label>

      {enableMulligans && (
        <div className="mulligan-section">
          {/* Mulligan rule */}
          <div className="mulligan-field">
            <label className="mulligan-select-label">Mulligan Rule</label>
            <select
              value={mulliganRule}
              onChange={(e) => setMulliganRule(e.target.value)}
              className="mulligan-select"
            >
              <option value="london">London Mulligan (draw 7, bottom N cards)</option>
              <option value="vancouver">Vancouver Mulligan (draw N-1 cards)</option>
            </select>
          </div>

          {/* Mulligan strategy */}
          <div className="mulligan-field">
            <label className="mulligan-select-label">Mulligan Strategy</label>
            <select
              value={mulliganStrategy}
              onChange={(e) => setMulliganStrategy(e.target.value)}
              className="mulligan-select"
            >
              <option value="conservative">Conservative (only 0 or 7 lands)</option>
              <option value="balanced">Balanced (0/7 lands, no early plays)</option>
              <option value="aggressive">Aggressive (2-4 lands only)</option>
              <option value="custom">Custom Rules</option>
            </select>
          </div>

          {/* Custom rules */}
          {mulliganStrategy === 'custom' && (
            <div className="custom-rules-box">
              <div className="custom-rules-title">Custom Mulligan Rules:</div>

              {[
                { key: 'mulligan0Lands', label: 'Mulligan if 0 lands' },
                { key: 'mulligan7Lands', label: 'Mulligan if 7 lands' },
              ].map(({ key, label }) => (
                <label key={key} className="custom-rule-label">
                  <input
                    type="checkbox"
                    checked={customMulliganRules[key]}
                    onChange={(e) => setCustomMulliganRules({ ...customMulliganRules, [key]: e.target.checked })}
                  />
                  <span>{label}</span>
                </label>
              ))}

              <label className="custom-rule-label">
                <input
                  type="checkbox"
                  checked={customMulliganRules.mulliganMinLands}
                  onChange={(e) => setCustomMulliganRules({ ...customMulliganRules, mulliganMinLands: e.target.checked })}
                />
                <span>Mulligan if less than </span>
                <input
                  type="number"
                  value={customMulliganRules.minLandsThreshold}
                  onChange={(e) => setCustomMulliganRules({ ...customMulliganRules, minLandsThreshold: parseInt(e.target.value) })}
                  min="0" max="7"
                  className="custom-rule-input"
                />
                <span> lands</span>
              </label>

              <label className="custom-rule-label">
                <input
                  type="checkbox"
                  checked={customMulliganRules.mulliganMaxLands}
                  onChange={(e) => setCustomMulliganRules({ ...customMulliganRules, mulliganMaxLands: e.target.checked })}
                />
                <span>Mulligan if more than </span>
                <input
                  type="number"
                  value={customMulliganRules.maxLandsThreshold}
                  onChange={(e) => setCustomMulliganRules({ ...customMulliganRules, maxLandsThreshold: parseInt(e.target.value) })}
                  min="0" max="7"
                  className="custom-rule-input"
                />
                <span> lands</span>
              </label>

              <label className="custom-rule-label">
                <input
                  type="checkbox"
                  checked={customMulliganRules.mulliganNoPlaysByTurn}
                  onChange={(e) => setCustomMulliganRules({ ...customMulliganRules, mulliganNoPlaysByTurn: e.target.checked })}
                />
                <span>Mulligan if no plays by turn </span>
                <input
                  type="number"
                  value={customMulliganRules.noPlaysTurnThreshold}
                  onChange={(e) => setCustomMulliganRules({ ...customMulliganRules, noPlaysTurnThreshold: parseInt(e.target.value) })}
                  min="1" max="5"
                  className="custom-rule-input"
                />
              </label>
            </div>
          )}
        </div>
      )}
    </div>

    <button
      onClick={runSimulation}
      disabled={isSimulating}
      className="btn-run"
    >
      {isSimulating ? '⏳ Simulating...' : '🎲 Start Simulation'}
    </button>
  </div>
);

export default SimulationSettingsPanel;
