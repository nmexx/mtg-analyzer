import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

// ─── Module-level constants ────────────────────────────────────────────────────
const BAR_COLORS = [
  '#667eea',
  '#7c3aed',
  '#a855f7',
  '#ec4899',
  '#f87171',
  '#fb923c',
  '#facc15',
  '#4ade80',
  '#34d399',
  '#60a5fa',
];

const COLOR_CONFIG = {
  W: { label: 'White', fill: '#fcd34d' },
  U: { label: 'Blue', fill: '#60a5fa' },
  B: { label: 'Black', fill: '#a1a1aa' },
  R: { label: 'Red', fill: '#f87171' },
  G: { label: 'Green', fill: '#4ade80' },
};

const NON_LAND_KEYS = ['spells', 'creatures', 'artifacts', 'rituals', 'rampSpells', 'exploration'];
const getNonLandCards = deck => NON_LAND_KEYS.flatMap(k => deck[k] || []);

// ─── Sub-sections ──────────────────────────────────────────────────────────────
function DerivedStats({ parsedDeck }) {
  const nonLandCards = getNonLandCards(parsedDeck);
  let totalCmcSum = 0,
    totalNonLandQty = 0;
  for (const card of nonLandCards) {
    const qty = card.quantity || 1;
    totalCmcSum += (typeof card.cmc === 'number' ? card.cmc : 0) * qty;
    totalNonLandQty += qty;
  }
  const avgCmc = totalNonLandQty > 0 ? (totalCmcSum / totalNonLandQty).toFixed(2) : '—';

  const rampCount = ['artifacts', 'creatures', 'rampSpells', 'rituals', 'exploration'].reduce(
    (sum, key) => sum + (parsedDeck[key] || []).reduce((s, c) => s + (c.quantity || 1), 0),
    0
  );
  const rampPct =
    parsedDeck.totalCards > 0 ? ((rampCount / parsedDeck.totalCards) * 100).toFixed(1) : '0';

  const lands = parsedDeck.lands || [];
  let tappedCount = 0,
    untappedCount = 0,
    fetchCount = 0,
    conditionalCount = 0;
  for (const land of lands) {
    const qty = land.quantity || 1;
    if (land.isFetch) {
      fetchCount += qty;
      continue;
    }
    if (land.entersTappedAlways === true) tappedCount += qty;
    else if (land.entersTappedAlways === false) untappedCount += qty;
    else conditionalCount += qty;
  }

  return (
    <>
      <p>
        Avg. CMC (non-land): <strong>{avgCmc}</strong>
      </p>
      <p>
        Ramp &amp; Acceleration: <strong>{rampCount}</strong>{' '}
        <span style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.85em' }}>
          ({rampPct}% of deck)
        </span>
      </p>
      {lands.length > 0 && (
        <p style={{ lineHeight: 1.8 }}>
          Lands — Untapped: <strong>{untappedCount + fetchCount}</strong>
          {' · '}Tapped: <strong>{tappedCount}</strong>
          {conditionalCount > 0 && (
            <>
              {' · '}Conditional: <strong>{conditionalCount}</strong>
            </>
          )}
          {' · '}Fetches: <strong>{fetchCount}</strong>
        </p>
      )}
    </>
  );
}

function ManaCurve({ parsedDeck }) {
  const nonLandCards = getNonLandCards(parsedDeck);
  if (nonLandCards.length === 0) return null;

  const cmcMap = new Map();
  for (const card of nonLandCards) {
    const cmc = typeof card.cmc === 'number' ? card.cmc : 0;
    cmcMap.set(cmc, (cmcMap.get(cmc) || 0) + (card.quantity || 1));
  }
  const maxCmc = Math.max(...cmcMap.keys());
  const curveData = Array.from({ length: maxCmc + 1 }, (_, i) => ({
    cmc: i,
    count: cmcMap.get(i) || 0,
  }));

  return (
    <div style={{ marginTop: '1.75rem' }}>
      <h4
        style={{
          marginBottom: '0.5rem',
          fontSize: '0.9rem',
          color: 'var(--text-secondary, #94a3b8)',
        }}
      >
        Mana Curve
      </h4>
      <ResponsiveContainer width="100%" height={175}>
        <BarChart data={curveData} margin={{ top: 4, right: 8, left: -20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="cmc"
            tick={{ fontSize: 11 }}
            label={{ value: 'CMC', position: 'insideBottom', offset: -2, fontSize: 11 }}
          />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <RechartsTooltip formatter={v => [v, 'Cards']} labelFormatter={l => `CMC ${l}`} />
          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {curveData.map((_, i) => (
              <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ColorPipDemand({ parsedDeck }) {
  const nonLandCards = getNonLandCards(parsedDeck);
  if (nonLandCards.length === 0) return null;

  const pipCounts = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const card of nonLandCards) {
    if (!card.manaCost) continue;
    const qty = card.quantity || 1;
    for (const sym of card.manaCost.match(/\{([^}]+)\}/g) || []) {
      const s = sym.replace(/[{}]/g, '').toUpperCase();
      if (pipCounts[s] !== undefined) pipCounts[s] += qty;
    }
  }

  const pipData = Object.entries(pipCounts)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({
      color: k,
      label: COLOR_CONFIG[k].label,
      pips: v,
      fill: COLOR_CONFIG[k].fill,
    }));

  if (pipData.length === 0) return null;

  return (
    <div style={{ marginTop: '1.75rem' }}>
      <h4
        style={{
          marginBottom: '0.5rem',
          fontSize: '0.9rem',
          color: 'var(--text-secondary, #94a3b8)',
        }}
      >
        Color Pip Demand
      </h4>
      <ResponsiveContainer width="100%" height={145}>
        <BarChart data={pipData} margin={{ top: 4, right: 8, left: -20, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <RechartsTooltip formatter={v => [v, 'Pips']} labelFormatter={l => l} />
          <Bar dataKey="pips" radius={[3, 3, 0, 0]}>
            {pipData.map(e => (
              <Cell key={e.color} fill={e.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ColorPipCreation({ parsedDeck }) {
  const nonLandCards = getNonLandCards(parsedDeck);

  // Collect demanded colours
  const demandedColors = new Set();
  for (const card of nonLandCards) {
    if (!card.manaCost) continue;
    for (const sym of card.manaCost.match(/\{([^}]+)\}/g) || []) {
      const s = sym.replace(/[{}]/g, '').toUpperCase();
      if (COLOR_CONFIG[s]) demandedColors.add(s);
    }
  }

  // Collect sources
  const sources = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  const addProduces = card => {
    const qty = card.quantity || 1;
    for (const c of card.produces || []) {
      if (sources[c] !== undefined) sources[c] += qty;
    }
  };

  for (const land of parsedDeck.lands || []) {
    const qty = land.quantity || 1;
    if (land.isFetch) {
      for (const c of land.fetchColors || []) {
        if (sources[c] !== undefined) sources[c] += qty;
      }
    } else {
      for (const c of land.produces || []) {
        if (sources[c] !== undefined) sources[c] += qty;
      }
    }
  }
  for (const card of parsedDeck.artifacts || []) addProduces(card);
  for (const card of parsedDeck.creatures || []) addProduces(card);
  for (const card of parsedDeck.rituals || []) {
    const qty = card.quantity || 1;
    for (const c of card.ritualColors || []) {
      if (sources[c] !== undefined) sources[c] += qty;
    }
  }

  const creationData = Object.entries(sources)
    .filter(([k, v]) => v > 0 && demandedColors.has(k))
    .map(([k, v]) => ({
      color: k,
      label: COLOR_CONFIG[k].label,
      sources: v,
      fill: COLOR_CONFIG[k].fill,
    }));

  if (creationData.length === 0) return null;

  return (
    <div style={{ marginTop: '1.75rem' }}>
      <h4
        style={{
          marginBottom: '0.5rem',
          fontSize: '0.9rem',
          color: 'var(--text-secondary, #94a3b8)',
        }}
      >
        Color Pip Creation
      </h4>
      <ResponsiveContainer width="100%" height={145}>
        <BarChart data={creationData} margin={{ top: 4, right: 8, left: -20, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <RechartsTooltip formatter={v => [v, 'Sources']} labelFormatter={l => l} />
          <Bar dataKey="sources" radius={[3, 3, 0, 0]}>
            {creationData.map(e => (
              <Cell key={e.color} fill={e.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function DeckStatisticsPanel({ parsedDeck }) {
  return (
    <div className="panel-grid">
      <div className="panel">
        <h3>📊 Deck Statistics</h3>
        <p>Total Cards: {parsedDeck.totalCards}</p>
        <p>
          Lands: {parsedDeck.landCount} (
          {parsedDeck.totalCards > 0
            ? ((parsedDeck.landCount / parsedDeck.totalCards) * 100).toFixed(1)
            : 0}
          %)
        </p>
        <DerivedStats parsedDeck={parsedDeck} />
        <ManaCurve parsedDeck={parsedDeck} />
        <ColorPipDemand parsedDeck={parsedDeck} />
        <ColorPipCreation parsedDeck={parsedDeck} />
      </div>
    </div>
  );
}
