/**
 * CardTooltip.jsx
 *
 * Wraps any content and shows a Scryfall card image tooltip on hover.
 * Uses fixed positioning so it escapes overflow constraints on parent panels.
 *
 * Props:
 *   name     – exact card name used to query Scryfall
 *   children – the content to wrap (the card name label)
 */

import React, { useState, useCallback } from 'react';

const CardTooltip = ({ name, children }) => {
  const [pos, setPos] = useState(null);

  const handleMouseEnter = useCallback((e) => {
    setPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseMove = useCallback((e) => {
    setPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setPos(null);
  }, []);

  const imgUrl = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image`;

  // Keep the tooltip on screen: offset right of cursor, flip left if near right edge
  const tooltipStyle = pos
    ? {
        left: Math.min(pos.x + 18, window.innerWidth - 230),
        top:  Math.max(pos.y - 30, 8),
      }
    : {};

  return (
    <>
      <span
        className="card-tooltip-trigger"
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </span>

      {pos && (
        <div className="card-tooltip" style={tooltipStyle}>
          <img
            src={imgUrl}
            alt={name}
            className="card-tooltip-img"
          />
        </div>
      )}
    </>
  );
};

export default CardTooltip;
