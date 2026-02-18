/**
 * RitualsPanel.jsx
 *
 * Displays ritual / burst-mana spells with toggles.
 *
 * Props:
 *   parsedDeck       – parsed deck object
 *   includeRituals   – boolean
 *   setIncludeRituals – setter
 *   disabledRituals  – Set<string>
 *   setDisabledRituals – setter
 *   renderManaCost   – (manaCost: string) => JSX
 */

import React from 'react';
import CardTooltip from './CardTooltip';

const RitualsPanel = ({
  parsedDeck,
  includeRituals,
  setIncludeRituals,
  disabledRituals,
  setDisabledRituals,
  renderManaCost,
}) => {
  if (!parsedDeck?.rituals?.length) return null;

  return (
    <div className="panel">
      <h3>⚡ Ritual Spells (Burst Mana)</h3>
      <p className="card-meta card-meta--spaced">
        Rituals contribute their net mana gain to the &ldquo;with burst&rdquo; key-card line.
      </p>
      <label className="enable-all-label">
        <input
          type="checkbox"
          checked={includeRituals}
          onChange={(e) => {
            setIncludeRituals(e.target.checked);
            if (e.target.checked) {
              setDisabledRituals(new Set());
            } else {
              setDisabledRituals(new Set(parsedDeck.rituals.map(c => c.name)));
            }
          }}
        />
        <span className="checkbox-text">Enable All Rituals</span>
      </label>

      {parsedDeck.rituals.map((ritual, idx) => (
        <div key={idx} className="card-row">
          <label className="card-row-label">
            <input
              type="checkbox"
              checked={includeRituals && !disabledRituals.has(ritual.name)}
              onChange={(e) => {
                const newSet = new Set(disabledRituals);
                if (e.target.checked) newSet.delete(ritual.name);
                else                  newSet.add(ritual.name);
                setDisabledRituals(newSet);
              }}
            />
            <CardTooltip name={ritual.name}><span className="card-name">{ritual.quantity}x {ritual.name}</span></CardTooltip>
            <span className="card-meta">
              +{ritual.manaProduced} mana produced&nbsp;&nbsp;
              {ritual.netGain > 0 ? `(+${ritual.netGain} net)` : ritual.netGain === 0 ? '(neutral)' : `(${ritual.netGain} net)`}
              {' · CMC '}{ritual.cmc}
            </span>
          </label>
          <div className="mana-cost-container">
            {renderManaCost(ritual.manaCost)}
          </div>
        </div>
      ))}
    </div>
  );
};

export default RitualsPanel;
