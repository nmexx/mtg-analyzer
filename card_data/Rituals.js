// Ritual and burst-mana spell data for the MTG Monte Carlo Simulator.
// Modelled as burst sources: stays in hand; net mana gain added to the "with burst" sim line.
//
// Fields (RITUAL_DATA):
//   manaProduced   – total mana symbols the spell produces
//   netGain        – manaProduced minus the spell's CMC (mana net advantage)
//   colors         – color identity of the spell (for display/filtering)
//   activationCost – (optional) mana needed to use the ability; omit for cast spells,
//                    set to 0 for exile-from-hand abilities like Spirit Guides
//
export const RITUAL_DATA = new Map([
  // ── Black Rituals ──────────────────────────────────────────────────────────
  ['dark ritual', { manaProduced: 3, netGain: 2, colors: ['B'] }],
  ['cabal ritual', { manaProduced: 3, netGain: 1, colors: ['B'] }],
  ['culling the weak', { manaProduced: 4, netGain: 3, colors: ['B'] }],
  ['burnt offering', { manaProduced: 4, netGain: 3, colors: ['B'] }],
  ['sacrifice', { manaProduced: 3, netGain: 2, colors: ['B'] }],
  ['bubbling muck', { manaProduced: 2, netGain: 1, colors: ['B'] }],
  // ── Red Rituals ───────────────────────────────────────────────────────────
  ['seething song', { manaProduced: 5, netGain: 2, colors: ['R'] }],
  ['pyretic ritual', { manaProduced: 3, netGain: 1, colors: ['R'] }],
  ['desperate ritual', { manaProduced: 3, netGain: 1, colors: ['R'] }],
  ['rite of flame', { manaProduced: 2, netGain: 1, colors: ['R'] }],
  ["jeska's will", { manaProduced: 5, netGain: 2, colors: ['R'] }],
  ['mana geyser', { manaProduced: 8, netGain: 3, colors: ['R'] }],
  ['inner fire', { manaProduced: 5, netGain: 1, colors: ['R'] }],
  // ── Blue (High Tide Package) ──────────────────────────────────────────────
  ['high tide', { manaProduced: 2, netGain: 1, colors: ['U'] }],
  ['dramatic reversal', { manaProduced: 4, netGain: 2, colors: ['U'] }],
  // ── Multi-color / Misc ────────────────────────────────────────────────────
  ['manamorphose', { manaProduced: 2, netGain: 0, colors: ['R', 'G'] }],
  // ── Hand-exile Producers (0-CMC, exile from hand) ─────────────────────────
  ['simian spirit guide', { manaProduced: 1, netGain: 1, colors: ['R'], activationCost: 0 }],
  ['elvish spirit guide', { manaProduced: 1, netGain: 1, colors: ['G'], activationCost: 0 }],
]);
