// Mana-artifact behavioral data for the MTG Monte Carlo Simulator.
// processManaArtifact() looks up ARTIFACT_DATA first; oracle-text parsing is the fallback.
//
// Fields:
//   manaAmount           – mana produced per tap activation
//                          (signets: net 1 after their {1} activation cost)
//   produces             – explicit color array; ['W','U','B','R','G'] = any single color
//   entersTapped         – enters the battlefield tapped
//   doesntUntapNaturally – true: doesn't untap during the untap step (Vault, Monolith)
//   etbCost              – ETB requirement:
//                          'discardLand' | 'imprintNonland' | 'discardHand' | 'sacrifice' | null
//   condition            – production condition: 'metalcraft' | 'legendary' | null

export const ARTIFACT_DATA = new Map([
  // ── 0-CMC Fast Mana ───────────────────────────────────────────────────────
  ['mana crypt',               { manaAmount: 2, produces: ['C'],                     entersTapped: false, doesntUntapNaturally: false }],
  ['mox diamond',              { manaAmount: 1, produces: ['W', 'U', 'B', 'R', 'G'], entersTapped: false, etbCost: 'discardLand'    }],
  ['chrome mox',               { manaAmount: 1, produces: ['W', 'U', 'B', 'R', 'G'], entersTapped: false, etbCost: 'imprintNonland' }],
  ['mox opal',                 { manaAmount: 1, produces: ['W', 'U', 'B', 'R', 'G'], entersTapped: false, condition: 'metalcraft'   }],
  ['mox amber',                { manaAmount: 1, produces: ['W', 'U', 'B', 'R', 'G'], entersTapped: false, condition: 'legendary'    }],
  ['lotus petal',              { manaAmount: 1, produces: ['W', 'U', 'B', 'R', 'G'], entersTapped: false, etbCost: 'sacrifice'      }],
  ["lion's eye diamond",       { manaAmount: 3, produces: ['W', 'U', 'B', 'R', 'G'], entersTapped: false, etbCost: 'discardHand'    }],
  ['jeweled lotus',            { manaAmount: 3, produces: ['W', 'U', 'B', 'R', 'G'], entersTapped: false, etbCost: 'sacrifice'      }],

  // ── Sol Ring & Vaults ─────────────────────────────────────────────────────
  ['sol ring',                 { manaAmount: 2, produces: ['C'],                     entersTapped: false }],
  ['mana vault',               { manaAmount: 3, produces: ['C'],                     entersTapped: false, doesntUntapNaturally: true }],
  ['grim monolith',            { manaAmount: 3, produces: ['C'],                     entersTapped: false, doesntUntapNaturally: true }],
  ['basalt monolith',          { manaAmount: 3, produces: ['C'],                     entersTapped: false, doesntUntapNaturally: true }],

  // ── Signets ({1},{T}: Add 2 colored — net manaAmount=1 after cost) ────────
  ['arcane signet',            { manaAmount: 1, produces: ['W', 'U', 'B', 'R', 'G'], entersTapped: false }],
  ['azorius signet',           { manaAmount: 1, produces: ['W', 'U'],                entersTapped: false }],
  ['dimir signet',             { manaAmount: 1, produces: ['U', 'B'],                entersTapped: false }],
  ['rakdos signet',            { manaAmount: 1, produces: ['B', 'R'],                entersTapped: false }],
  ['gruul signet',             { manaAmount: 1, produces: ['R', 'G'],                entersTapped: false }],
  ['selesnya signet',          { manaAmount: 1, produces: ['G', 'W'],                entersTapped: false }],
  ['orzhov signet',            { manaAmount: 1, produces: ['W', 'B'],                entersTapped: false }],
  ['izzet signet',             { manaAmount: 1, produces: ['U', 'R'],                entersTapped: false }],
  ['golgari signet',           { manaAmount: 1, produces: ['B', 'G'],                entersTapped: false }],
  ['boros signet',             { manaAmount: 1, produces: ['R', 'W'],                entersTapped: false }],
  ['simic signet',             { manaAmount: 1, produces: ['G', 'U'],                entersTapped: false }],

  // ── Talismans ({T}: {C} free, or colored for 1 damage) ───────────────────
  ['talisman of progress',     { manaAmount: 1, produces: ['C', 'W', 'U'],           entersTapped: false, isTalisman: true, lifeloss: 1 }],
  ['talisman of dominance',    { manaAmount: 1, produces: ['C', 'U', 'B'],           entersTapped: false, isTalisman: true, lifeloss: 1 }],
  ['talisman of indulgence',   { manaAmount: 1, produces: ['C', 'B', 'R'],           entersTapped: false, isTalisman: true, lifeloss: 1 }],
  ['talisman of impulse',      { manaAmount: 1, produces: ['C', 'R', 'G'],           entersTapped: false, isTalisman: true, lifeloss: 1 }],
  ['talisman of unity',        { manaAmount: 1, produces: ['C', 'G', 'W'],           entersTapped: false, isTalisman: true, lifeloss: 1 }],
  ['talisman of hierarchy',    { manaAmount: 1, produces: ['C', 'W', 'B'],           entersTapped: false, isTalisman: true, lifeloss: 1 }],
  ['talisman of creativity',   { manaAmount: 1, produces: ['C', 'U', 'R'],           entersTapped: false, isTalisman: true, lifeloss: 1 }],
  ['talisman of resilience',   { manaAmount: 1, produces: ['C', 'B', 'G'],           entersTapped: false, isTalisman: true, lifeloss: 1 }],
  ['talisman of conviction',   { manaAmount: 1, produces: ['C', 'R', 'W'],           entersTapped: false, isTalisman: true, lifeloss: 1 }],
  ['talisman of curiosity',    { manaAmount: 1, produces: ['C', 'G', 'U'],           entersTapped: false, isTalisman: true, lifeloss: 1 }],

  // ── Diamonds (ETB Tapped, single-color) ──────────────────────────────────
  ['marble diamond',           { manaAmount: 1, produces: ['W'],                     entersTapped: true  }],
  ['sky diamond',              { manaAmount: 1, produces: ['U'],                     entersTapped: true  }],
  ['charcoal diamond',         { manaAmount: 1, produces: ['B'],                     entersTapped: true  }],
  ['fire diamond',             { manaAmount: 1, produces: ['R'],                     entersTapped: true  }],
  ['moss diamond',             { manaAmount: 1, produces: ['G'],                     entersTapped: true  }],

  // ── Other ETB-Tapped Rocks ────────────────────────────────────────────────
  ['coldsteel heart',          { manaAmount: 1, produces: ['W', 'U', 'B', 'R', 'G'], entersTapped: true  }],
  ['fractured powerstone',     { manaAmount: 1, produces: ['C'],                     entersTapped: true  }],
  ['guardian idol',            { manaAmount: 1, produces: ['C'],                     entersTapped: true  }],
  ['star compass',             { manaAmount: 1, produces: ['W', 'U', 'B', 'R', 'G'], entersTapped: true  }],

  // ── Utility 2-MV Rocks ────────────────────────────────────────────────────
  ['fellwar stone',            { manaAmount: 1, produces: ['W', 'U', 'B', 'R', 'G'], entersTapped: false }],
  ['mind stone',               { manaAmount: 1, produces: ['C'],                     entersTapped: false }],
  ['thought vessel',           { manaAmount: 1, produces: ['C'],                     entersTapped: false }],
  ['liquimetal torque',        { manaAmount: 1, produces: ['C'],                     entersTapped: false }],
  ['prismatic lens',           { manaAmount: 1, produces: ['C', 'W', 'U', 'B', 'R', 'G'], entersTapped: false }],
  ['everflowing chalice',      { manaAmount: 1, produces: ['C'],                     entersTapped: false }],

  // ── 3-MV Staples ──────────────────────────────────────────────────────────
  ['chromatic lantern',        { manaAmount: 1, produces: ['W', 'U', 'B', 'R', 'G'], entersTapped: false }],
  ["commander's sphere",       { manaAmount: 1, produces: ['W', 'U', 'B', 'R', 'G'], entersTapped: false }],
  ['heraldic banner',          { manaAmount: 1, produces: ['W', 'U', 'B', 'R', 'G'], entersTapped: false }],
  ['cursed mirror',            { manaAmount: 1, produces: ['R'],                     entersTapped: false }],
  ['relic of legends',         { manaAmount: 1, produces: ['W', 'U', 'B', 'R', 'G'], entersTapped: false }],
  ["patriar's seal",           { manaAmount: 1, produces: ['W', 'U', 'B', 'R', 'G'], entersTapped: false }],
  ['decanter of endless water',{ manaAmount: 1, produces: ['W', 'U', 'B', 'R', 'G'], entersTapped: false }],
  ["dragon's hoard",           { manaAmount: 1, produces: ['W', 'U', 'B', 'R', 'G'], entersTapped: false }],

  // ── Big Mana Rocks ────────────────────────────────────────────────────────
  ['thran dynamo',             { manaAmount: 3, produces: ['C'],                     entersTapped: false }],
  ['gilded lotus',             { manaAmount: 3, produces: ['W', 'U', 'B', 'R', 'G'], entersTapped: false }],
  ['nyx lotus',                { manaAmount: 1, produces: ['W', 'U', 'B', 'R', 'G'], entersTapped: true  }],
  ['the great henge',          { manaAmount: 2, produces: ['G'],                     entersTapped: false }],
  ['forsaken monument',        { manaAmount: 1, produces: ['C'],                     entersTapped: false }],
  ['coveted jewel',            { manaAmount: 3, produces: ['W', 'U', 'B', 'R', 'G'], entersTapped: false }],
]);

// ── Mox / 0-CMC artifact simulation flags ─────────────────────────────────────
// When true: Mox Opal (metalcraft) and Mox Amber (legendary) always produce mana
// from turn 3 onwards, avoiding frustrating "never mana" edge cases.
// Set to false to restore strict rules-accurate checks.
export const SIMPLIFY_MOX_CONDITIONS = true;

// Pulled to the front of the casting queue every turn so they ETB as early as
// possible before spending other mana sources.
export const MOX_PRIORITY_ARTIFACTS = new Set([
  'mox diamond', 'chrome mox', 'mox opal', 'mox amber',
]);

// One-shot burst-mana sources: used to compute the "with burst" key-card line.
// Optimistic model: mana is simply added to the available pool (drawbacks ignored).
export const BURST_MANA_SOURCES = new Set([
  "lion's eye diamond",
  'jeweled lotus',
  'lotus petal',
]);
