import React from 'react';

/**
 * Renders two deck-column panels side-by-side.
 * Pass `null` for either side to show an empty placeholder.
 * The row is omitted entirely when both sides are null.
 */
export default function ComparisonRow({ left, right }) {
  if (!left && !right) return null;
  return (
    <div className="deck-columns">
      <div>{left ?? <div className="comparison-empty-panel" />}</div>
      <div>{right ?? <div className="comparison-empty-panel" />}</div>
    </div>
  );
}
