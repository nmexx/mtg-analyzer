/**
 * ArtifactsPanel.jsx
 *
 * Displays the mana-artifact cards with enable/disable toggles.
 *
 * Props:
 *   parsedDeck           – parsed deck object
 *   includeArtifacts     – boolean
 *   setIncludeArtifacts  – setter
 *   disabledArtifacts    – Set<string>
 *   setDisabledArtifacts – setter
 *   getManaSymbol        – (color) => emoji
 */

import React from 'react';

const ArtifactsPanel = ({
  parsedDeck,
  includeArtifacts,
  setIncludeArtifacts,
  disabledArtifacts,
  setDisabledArtifacts,
  getManaSymbol,
}) => {
  if (!parsedDeck || parsedDeck.artifacts.length === 0) return null;

  return (
    <div className="panel">
      <h3>⚙️ Mana Artifacts</h3>
      <label className="enable-all-label">
        <input
          type="checkbox"
          checked={includeArtifacts}
          onChange={(e) => {
            setIncludeArtifacts(e.target.checked);
            if (e.target.checked) {
              setDisabledArtifacts(new Set());
            } else {
              setDisabledArtifacts(new Set(parsedDeck.artifacts.map(a => a.name)));
            }
          }}
        />
        <span className="checkbox-text">Enable All Artifacts</span>
      </label>

      {parsedDeck.artifacts.map((artifact, idx) => (
        <div key={idx} className="card-row">
          <label className="card-row-label">
            <input
              type="checkbox"
              checked={includeArtifacts && !disabledArtifacts.has(artifact.name)}
              onChange={(e) => {
                const newSet = new Set(disabledArtifacts);
                if (e.target.checked) newSet.delete(artifact.name);
                else                  newSet.add(artifact.name);
                setDisabledArtifacts(newSet);
              }}
            />
            <span className="card-name">{artifact.quantity}x {artifact.name}</span>
            <span className="card-meta">+{artifact.manaAmount} Mana, CMC {artifact.cmc}</span>
          </label>
          <div className="mana-symbols">
            {artifact.produces.map(color => (
              <span key={color} className="mana-symbol">{getManaSymbol(color)}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ArtifactsPanel;
