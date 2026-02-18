/**
 * RampSpellsPanel.jsx
 *
 * Displays ramp spells (Cultivate, Rampant Growth, etc.) with toggles.
 *
 * Props:
 *   parsedDeck          – parsed deck object
 *   includeRampSpells   – boolean
 *   setIncludeRampSpells – setter
 *   disabledRampSpells  – Set<string>
 *   setDisabledRampSpells – setter
 *   renderManaCost      – (manaCost: string) => JSX
 */

import React from 'react';

const RampSpellsPanel = ({
  parsedDeck,
  includeRampSpells,
  setIncludeRampSpells,
  disabledRampSpells,
  setDisabledRampSpells,
  renderManaCost,
}) => {
  if (!parsedDeck?.rampSpells?.length) return null;

  return (
    <div className="panel">
      <h3>🌿 Ramp Spells</h3>
      <label className="enable-all-label">
        <input
          type="checkbox"
          checked={includeRampSpells}
          onChange={(e) => {
            setIncludeRampSpells(e.target.checked);
            if (e.target.checked) {
              setDisabledRampSpells(new Set());
            } else {
              setDisabledRampSpells(new Set(parsedDeck.rampSpells.map(c => c.name)));
            }
          }}
        />
        <span className="checkbox-text">Enable All Ramp Spells</span>
      </label>

      {parsedDeck.rampSpells.map((ramp, idx) => (
        <div key={idx} className="card-row">
          <label className="card-row-label">
            <input
              type="checkbox"
              checked={includeRampSpells && !disabledRampSpells.has(ramp.name)}
              onChange={(e) => {
                const newSet = new Set(disabledRampSpells);
                if (e.target.checked) newSet.delete(ramp.name);
                else                  newSet.add(ramp.name);
                setDisabledRampSpells(newSet);
              }}
            />
            <span className="card-name">{ramp.quantity}x {ramp.name}</span>
            <span className="card-meta">
              +{ramp.landsToAdd} land{ramp.landsToAdd !== 1 ? 's' : ''}{ramp.landsTapped ? ' (tapped)' : ' (untapped)'}
              {ramp.fetchFilter === 'basic'   ? ' · basics only'                            : ''}
              {ramp.fetchFilter === 'subtype' && ramp.fetchSubtypes ? ` · ${ramp.fetchSubtypes.join('/')} type` : ''}
              {ramp.fetchFilter === 'snow'    ? ' · snow lands'                             : ''}
              {ramp.fetchFilter === 'any'     ? ' · any land'                               : ''}
              {ramp.sacrificeLand             ? ' · sac a land'                             : ''}
              {ramp.landsToHand > 0           ? ` · +${ramp.landsToHand} to hand`          : ''}
              {' · CMC '}{ramp.cmc}
            </span>
          </label>
          <div className="mana-cost-container">
            {renderManaCost(ramp.manaCost)}
          </div>
        </div>
      ))}
    </div>
  );
};

export default RampSpellsPanel;
