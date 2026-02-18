/**
 * LandsPanel.jsx
 *
 * Displays the parsed land cards with mana production badges.
 *
 * Props:
 *   parsedDeck   – the parsed deck object
 *   getManaSymbol – (color: string) => emoji string
 *   getFetchSymbol – (fetchType: string) => emoji string
 */

import React from 'react';
import CardTooltip from './CardTooltip';

const LandsPanel = ({ parsedDeck, getManaSymbol, getFetchSymbol }) => {
  if (!parsedDeck) return null;

  return (
    <div className="panel">
      <h3>🏞️ Detected Lands ({parsedDeck.landCount})</h3>
      {parsedDeck.lands.map((land, idx) => (
        <div key={idx} className="card-row">
          <div className="card-row-label">
            <CardTooltip name={land.name}><span className="land-name">{land.quantity}x {land.name}</span></CardTooltip>
            {land.isBasic && <span className="land-fetch">⭐</span>}
            {land.isFetch && (
              <span className="land-fetch">FETCH {getFetchSymbol(land.fetchType)}</span>
            )}
            {land.hasInternalLogic ? (
              <span className="land-badge land-badge--logic">LOGIC</span>
            ) : (
              <span className="land-badge land-badge--parsed">PARSED</span>
            )}
          </div>
          <div className="mana-symbols">
            {land.produces.map(color => (
              <span key={color} className="mana-symbol">{getManaSymbol(color)}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default LandsPanel;
