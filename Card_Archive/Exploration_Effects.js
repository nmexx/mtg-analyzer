// Mana creature and exploration-effect data for the MTG Monte Carlo Simulator.
// Mana creatures (dorks) are detected by oracle-text parsing in processManaCreature() —
// no hardcoded lookup map is needed for individual dorks.
//
// EXPLORATION_EFFECTS identifies permanents that grant additional land-drops per turn;
// the simulator tracks these separately from normal land-drop logic.

export const EXPLORATION_EFFECTS = new Set([
  // Enchantments / Sorceries
  'exploration',
  'fastbond',
  'storm cauldron',
  'rites of flourishing',
  'summer bloom',
  'manabond',

  // Creatures
  'burgeoning',              // technically an enchantment but behaves like exploration
  'azusa, lost but seeking',
  'oracle of mul daya',
  'mina and denn, wildborn',
  'wayward swordtooth',
  'dryad of the ilysian grove',
  'zhur-taa ancient',
  'sakura-tribe scout',
  'walking atlas',
  'llanowar scout',
  'excavator',
  'patron of the moon',
  'budoka gardener',
]);
