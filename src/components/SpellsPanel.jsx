/**
 * SpellsPanel.jsx
 *
 * Shows the combined "Spells & Creatures" list for key-card selection.
 *
 * Props:
 *   parsedDeck        – parsed deck object
 *   selectedKeyCards  – Set<string>
 *   setSelectedKeyCards – setter
 *   renderManaCost    – (manaCost: string) => JSX
 */

import React from 'react';
import CardTooltip from './CardTooltip';

const SpellsPanel = ({ parsedDeck, selectedKeyCards, setSelectedKeyCards, renderManaCost }) => {
  if (!parsedDeck) return null;

  const hasAny =
    parsedDeck.spells.length > 0 ||
    parsedDeck.creatures.length > 0 ||
    parsedDeck.artifacts.length > 0 ||
    parsedDeck.rituals?.length > 0 ||
    parsedDeck.rampSpells?.length > 0 ||
    parsedDeck.drawSpells?.length > 0 ||
    parsedDeck.exploration?.length > 0;

  if (!hasAny) return null;

  const allCards = [
    ...parsedDeck.spells,
    ...parsedDeck.creatures,
    ...parsedDeck.artifacts,
    ...(parsedDeck.rituals || []),
    ...(parsedDeck.rampSpells || []),
    ...(parsedDeck.drawSpells || []),
    ...(parsedDeck.exploration || []),
  ].sort((a, b) => a.cmc - b.cmc);

  const toggle = name => {
    const newSet = new Set(selectedKeyCards);
    if (newSet.has(name)) newSet.delete(name);
    else newSet.add(name);
    setSelectedKeyCards(newSet);
  };

  return (
    <div className="panel">
      <h3>🎴 Spells &amp; Creatures (Key Card Selection)</h3>
      <p className="card-meta">Select cards to track playability:</p>

      {allCards.map((card, idx) => (
        <div
          key={idx}
          className={`spell-row${selectedKeyCards.has(card.name) ? ' spell-row--selected' : ''}`}
          onClick={() => toggle(card.name)}
        >
          <div className="card-row-label">
            <input type="checkbox" checked={selectedKeyCards.has(card.name)} readOnly />
            <CardTooltip name={card.name}>
              <span className="spell-card-name">
                {card.quantity}x {card.name}
              </span>
            </CardTooltip>
            <span className="card-meta">CMC {card.cmc}</span>
          </div>
          <div className="mana-cost-container">{renderManaCost(card.manaCost)}</div>
        </div>
      ))}
    </div>
  );
};

export default SpellsPanel;
