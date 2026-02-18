/**
 * ExplorationPanel.jsx
 *
 * Displays exploration-effect cards (Exploration, Azusa, etc.) with toggles.
 *
 * Props:
 *   parsedDeck            – parsed deck object
 *   includeExploration    – boolean
 *   setIncludeExploration – setter
 *   disabledExploration   – Set<string>
 *   setDisabledExploration – setter
 */

import React from 'react';

const ExplorationPanel = ({
  parsedDeck,
  includeExploration,
  setIncludeExploration,
  disabledExploration,
  setDisabledExploration,
}) => {
  if (!parsedDeck?.exploration?.length) return null;

  return (
    <div className="panel">
      <h3>🌳 Exploration Effects</h3>
      <label className="enable-all-label">
        <input
          type="checkbox"
          checked={includeExploration}
          onChange={(e) => {
            setIncludeExploration(e.target.checked);
            if (e.target.checked) {
              setDisabledExploration(new Set());
            } else {
              setDisabledExploration(new Set(parsedDeck.exploration.map(c => c.name)));
            }
          }}
        />
        <span className="checkbox-text">Enable All Exploration Effects</span>
      </label>

      {parsedDeck.exploration.map((expl, idx) => (
        <div key={idx} className="card-row">
          <label className="card-row-label">
            <input
              type="checkbox"
              checked={includeExploration && !disabledExploration.has(expl.name)}
              onChange={(e) => {
                const newSet = new Set(disabledExploration);
                if (e.target.checked) newSet.delete(expl.name);
                else                  newSet.add(expl.name);
                setDisabledExploration(newSet);
              }}
            />
            <span className="card-name">{expl.quantity}x {expl.name}</span>
            <span className="card-meta">{expl.landsPerTurn} Lands/Turn, CMC {expl.cmc}</span>
          </label>
        </div>
      ))}
    </div>
  );
};

export default ExplorationPanel;
