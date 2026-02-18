/**
 * CreaturesPanel.jsx
 *
 * Displays mana-creature cards with enable/disable toggles.
 *
 * Props:
 *   parsedDeck           – parsed deck object
 *   includeCreatures     – boolean
 *   setIncludeCreatures  – setter
 *   disabledCreatures    – Set<string>
 *   setDisabledCreatures – setter
 *   getManaSymbol        – (color) => emoji
 */

import React from 'react';

const CreaturesPanel = ({
  parsedDeck,
  includeCreatures,
  setIncludeCreatures,
  disabledCreatures,
  setDisabledCreatures,
  getManaSymbol,
}) => {
  if (!parsedDeck || parsedDeck.creatures.length === 0) return null;

  return (
    <div className="panel">
      <h3>🌱 Mana Creatures</h3>
      <label className="enable-all-label">
        <input
          type="checkbox"
          checked={includeCreatures}
          onChange={(e) => {
            setIncludeCreatures(e.target.checked);
            if (e.target.checked) {
              setDisabledCreatures(new Set());
            } else {
              setDisabledCreatures(new Set(parsedDeck.creatures.map(c => c.name)));
            }
          }}
        />
        <span className="checkbox-text">Enable All Creatures</span>
      </label>

      {parsedDeck.creatures.map((creature, idx) => (
        <div key={idx} className="card-row">
          <label className="card-row-label">
            <input
              type="checkbox"
              checked={includeCreatures && !disabledCreatures.has(creature.name)}
              onChange={(e) => {
                const newSet = new Set(disabledCreatures);
                if (e.target.checked) newSet.delete(creature.name);
                else                  newSet.add(creature.name);
                setDisabledCreatures(newSet);
              }}
            />
            <span className="card-name">{creature.quantity}x {creature.name}</span>
            <span className="card-meta">+{creature.manaAmount} Mana, CMC {creature.cmc}</span>
          </label>
          <div className="mana-symbols">
            {creature.produces.map(color => (
              <span key={color} className="mana-symbol">{getManaSymbol(color)}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default CreaturesPanel;
