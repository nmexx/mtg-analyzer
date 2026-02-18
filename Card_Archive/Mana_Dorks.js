// Mana creature (dork) data for the MTG Monte Carlo Simulator.
// processManaCreature() looks up MANA_DORK_DATA first; oracle-text parsing is the fallback.
//
// Fields:
//   manaAmount  – mana produced per tap (use 1 for scaling/devotion dorks; sim treats them as floor)
//   produces    – color array; ['W','U','B','R','G'] = any single color; ['C'] = colorless only

export const MANA_DORK_DATA = new Map([
  // ── 1-CMC Essentials ──────────────────────────────────────────────────────
  ['birds of paradise',        { manaAmount: 1, produces: ['W', 'U', 'B', 'R', 'G'] }],
  ['noble hierarch',           { manaAmount: 1, produces: ['G', 'W', 'U'] }],
  ['ignoble hierarch',         { manaAmount: 1, produces: ['B', 'R', 'G'] }],
  ['delighted halfling',       { manaAmount: 1, produces: ['W', 'U', 'B', 'R', 'G'] }],
  ['deathrite shaman',         { manaAmount: 1, produces: ['W', 'U', 'B', 'R', 'G'] }],
  ['llanowar elves',           { manaAmount: 1, produces: ['G'] }],
  ['fyndhorn elves',           { manaAmount: 1, produces: ['G'] }],
  ['elvish mystic',            { manaAmount: 1, produces: ['G'] }],
  ["avacyn's pilgrim",         { manaAmount: 1, produces: ['W'] }],
  ['elves of deep shadow',     { manaAmount: 1, produces: ['B'] }],
  ['boreal druid',             { manaAmount: 1, produces: ['C'] }],
  // Arbor Elf untaps a Forest rather than directly adding mana; model as {G}.
  ['arbor elf',                { manaAmount: 1, produces: ['G'] }],

  // ── 2-CMC Fixing & Utility ────────────────────────────────────────────────
  // Bloom Tender / Faeburrow Elder scale with color diversity; floor of 1.
  ['bloom tender',             { manaAmount: 1, produces: ['W', 'U', 'B', 'R', 'G'] }],
  ['faeburrow elder',          { manaAmount: 1, produces: ['W', 'U', 'B', 'R', 'G'] }],
  // Sanctum Weaver scales with enchantment count; floor of 1.
  ['sanctum weaver',           { manaAmount: 1, produces: ['W', 'U', 'B', 'R', 'G'] }],
  ['fanatic of rhonas',        { manaAmount: 1, produces: ['G'] }],
  ['devoted druid',            { manaAmount: 1, produces: ['G'] }],
  // Incubation Druid: {C} normally, or 3 of any color with a counter.
  ['incubation druid',         { manaAmount: 1, produces: ['C'] }],
  ['paradise druid',           { manaAmount: 1, produces: ['W', 'U', 'B', 'R', 'G'] }],
  ['biophagus',                { manaAmount: 1, produces: ['W', 'U', 'B', 'R', 'G'] }],

  // ── Myr Cycle (Artifact Creatures, 2-CMC) ─────────────────────────────────
  ['gold myr',                 { manaAmount: 1, produces: ['W'] }],
  ['silver myr',               { manaAmount: 1, produces: ['U'] }],
  ['leaden myr',               { manaAmount: 1, produces: ['B'] }],
  ['iron myr',                 { manaAmount: 1, produces: ['R'] }],
  ['copper myr',               { manaAmount: 1, produces: ['G'] }],
  ['plague myr',               { manaAmount: 1, produces: ['C'] }],

  // ── Colorless & Utility ───────────────────────────────────────────────────
  ['ornithopter of paradise',  { manaAmount: 1, produces: ['W', 'U', 'B', 'R', 'G'] }],
  // Palladium Myr produces {C}{C}.
  ['palladium myr',            { manaAmount: 2, produces: ['C'] }],

  // ── Big Mana & Scaling Producers ──────────────────────────────────────────
  // Scaling dorks: manaAmount is a conservative floor; actual output varies.
  ['priest of titania',        { manaAmount: 1, produces: ['G'] }],
  ['circle of dreams druid',   { manaAmount: 1, produces: ['G'] }],
  ['selvala, heart of the wilds',{ manaAmount: 1, produces: ['W', 'U', 'B', 'R', 'G'] }],
  ['marwyn, the nurturer',     { manaAmount: 1, produces: ['G'] }],
  ["karametra's acolyte",      { manaAmount: 1, produces: ['G'] }],
  ['elvish archdruid',         { manaAmount: 1, produces: ['G'] }],

  // ── Hand-exile Producers ──────────────────────────────────────────────────
  ['simian spirit guide',      { manaAmount: 1, produces: ['R'] }],
  ['elvish spirit guide',      { manaAmount: 1, produces: ['G'] }],
]);
