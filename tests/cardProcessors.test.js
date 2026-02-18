/**
 * cardProcessors.js — Unit Tests
 *
 * Covers all 13 exported functions:
 *   extractManaProduction      – low-level text helper
 *   extractManaAmount          – low-level text helper
 *   extractRitualManaAmount    – low-level text helper
 *   calculateCMC               – mana-cost math
 *   hasManaTapAbility          – oracle-text regex
 *   processLand                – full land object builder
 *   processManaArtifact        – artifact object builder
 *   processManaCreature        – creature object builder
 *   processExploration         – exploration object builder
 *   processRampSpell           – ramp-spell object builder
 *   processRitual              – ritual object builder
 *   processSpell               – generic spell object builder
 *   processCardData            – top-level routing function
 *
 * Run:  npm test
 */

import { describe, it, expect } from 'vitest';
import {
  extractManaProduction,
  extractManaAmount,
  extractRitualManaAmount,
  calculateCMC,
  hasManaTapAbility,
  processLand,
  processManaArtifact,
  processManaCreature,
  processExploration,
  processRampSpell,
  processRitual,
  processSpell,
  processCardData,
} from '../src/simulation/cardProcessors.js';

// ─────────────────────────────────────────────────────────────────────────────
// extractManaProduction
// ─────────────────────────────────────────────────────────────────────────────
describe('extractManaProduction', () => {
  it('returns [] for null / undefined oracle text', () => {
    expect(extractManaProduction(null)).toEqual([]);
    expect(extractManaProduction(undefined)).toEqual([]);
  });

  it('extracts a single color', () => {
    expect(extractManaProduction('{T}: Add {G}.')).toEqual(['G']);
  });

  it('extracts two colours without duplicates', () => {
    const result = extractManaProduction('{T}: Add {G} or {U}.');
    expect(result).toContain('G');
    expect(result).toContain('U');
    expect(result).toHaveLength(2);
  });

  it('returns all 5 colours for "any color" text', () => {
    const result = extractManaProduction('{T}: Add one mana of any color.');
    expect(result).toEqual(['W', 'U', 'B', 'R', 'G']);
  });

  it('returns all 5 colours for "mana of any color" text', () => {
    const result = extractManaProduction('Add mana of any color.');
    expect(result).toEqual(['W', 'U', 'B', 'R', 'G']);
  });

  it('deduplicates repeated mana symbols', () => {
    const result = extractManaProduction('{T}: Add {G}{G}.');
    expect(result).toEqual(['G']);
  });

  it('returns [] when there are no mana symbols', () => {
    expect(extractManaProduction('Draw a card.')).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// extractManaAmount
// ─────────────────────────────────────────────────────────────────────────────
describe('extractManaAmount', () => {
  it('returns 1 for null / undefined', () => {
    expect(extractManaAmount(null)).toBe(1);
    expect(extractManaAmount(undefined)).toBe(1);
  });

  it('returns 1 for a single {C}', () => {
    expect(extractManaAmount('{T}: Add {C}.')).toBe(1);
  });

  it('returns 2 for {C}{C}', () => {
    expect(extractManaAmount('{T}: Add {C}{C}.')).toBe(2);
  });

  it('returns 3 for {C}{C}{C}', () => {
    expect(extractManaAmount('{T}: Add {C}{C}{C}.')).toBe(3);
  });

  it('returns 1 when oracle text has no {C} symbols', () => {
    expect(extractManaAmount('{T}: Add {G}.')).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// extractRitualManaAmount
// ─────────────────────────────────────────────────────────────────────────────
describe('extractRitualManaAmount', () => {
  it('returns 1 for null / undefined', () => {
    expect(extractRitualManaAmount(null)).toBe(1);
  });

  it('counts explicit mana symbols after "Add"', () => {
    expect(extractRitualManaAmount('Add {R}{R}{R}.')).toBe(3);
  });

  it('parses English word amounts', () => {
    expect(extractRitualManaAmount('Add two mana of any color.')).toBe(2);
    expect(extractRitualManaAmount('Add three mana.')).toBe(3);
  });

  it('parses numeric amounts', () => {
    expect(extractRitualManaAmount('Add 4 mana of any color.')).toBe(4);
  });

  it('returns 1 for unrecognized text', () => {
    expect(extractRitualManaAmount('Draw a card.')).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calculateCMC
// ─────────────────────────────────────────────────────────────────────────────
describe('calculateCMC', () => {
  it('returns the numeric cmc when it is valid', () => {
    expect(calculateCMC(3, '{1}{G}{G}')).toBe(3);
  });

  it('calculates from mana cost when dataCmc is null/undefined', () => {
    expect(calculateCMC(null, '{2}{G}{G}')).toBe(4);
  });

  it('calculates from mana cost when dataCmc is 0 and cost is non-zero', () => {
    expect(calculateCMC(0, '{3}{U}')).toBe(4);
  });

  it('handles colourless generics only', () => {
    expect(calculateCMC(null, '{5}')).toBe(5);
  });

  it('handles hybrid / coloured symbols as 1 each', () => {
    expect(calculateCMC(null, '{W}{U}{B}{R}{G}')).toBe(5);
  });

  it('ignores X in the cost', () => {
    expect(calculateCMC(null, '{X}{R}')).toBe(1);
  });

  it('returns 0 for an empty / null mana cost with no dataCmc', () => {
    expect(calculateCMC(null, null)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// hasManaTapAbility
// ─────────────────────────────────────────────────────────────────────────────
describe('hasManaTapAbility', () => {
  it('returns false for null / undefined', () => {
    expect(hasManaTapAbility(null)).toBe(false);
    expect(hasManaTapAbility(undefined)).toBe(false);
  });

  it('returns true for "{T}: Add {G}"', () => {
    expect(hasManaTapAbility('{T}: Add {G}.')).toBe(true);
  });

  it('returns true for lowercase tap glyph', () => {
    expect(hasManaTapAbility('{t}: add {R}.')).toBe(true);
  });

  it('returns false for a plain spell without tap ability', () => {
    expect(hasManaTapAbility('Destroy target creature.')).toBe(false);
  });

  it('returns false for an MDFC back face that merely adds life', () => {
    expect(hasManaTapAbility('You gain 3 life.')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers – build minimal Scryfall-shaped objects for the processor tests
// ─────────────────────────────────────────────────────────────────────────────
const makeCard = (overrides = {}) => ({
  name: 'Test Card',
  type_line: 'Instant',
  oracle_text: '',
  mana_cost: '{1}',
  cmc: 1,
  layout: 'normal',
  ...overrides,
});

const makeLand = (overrides = {}) =>
  makeCard({ type_line: 'Land', mana_cost: '', cmc: 0, ...overrides });

// ─────────────────────────────────────────────────────────────────────────────
// processLand
// ─────────────────────────────────────────────────────────────────────────────
describe('processLand', () => {
  it('produces a well-formed land object for a basic Forest', () => {
    const data = makeLand({
      name: 'Forest',
      type_line: 'Basic Land — Forest',
      oracle_text: '({T}: Add {G}.)',
    });
    const result = processLand(data, data, false);
    expect(result).not.toBeNull();
    expect(result.type).toBe('land');
    expect(result.isLand).toBe(true);
    expect(result.produces).toContain('G');
    expect(result.isBasic).toBe(true);
  });

  it('identifies a fetch land (Polluted Delta)', () => {
    const data = makeLand({
      name: 'Polluted Delta',
      type_line: 'Land',
      oracle_text:
        '{T}, Pay 1 life, Sacrifice Polluted Delta: Search your library for an Island or Swamp card, put it onto the battlefield, then shuffle.',
    });
    const result = processLand(data, data, false);
    expect(result.isFetch).toBe(true);
    expect(result.fetchColors).toContain('U');
    expect(result.fetchColors).toContain('B');
  });

  it('returns null for a transform card whose back face is a land but front is not', () => {
    const data = {
      ...makeLand({ name: 'Test MDFC', layout: 'transform' }),
      card_faces: [
        { type_line: 'Sorcery', oracle_text: 'Draw a card.' },
        { type_line: 'Land', oracle_text: '{T}: Add {G}.' },
      ],
    };
    const result = processLand(data, data.card_faces[1], false);
    expect(result).toBeNull();
  });

  it('recognises bounce lands (e.g. Simic Growth Chamber)', () => {
    const data = makeLand({
      name: 'Simic Growth Chamber',
      type_line: 'Land',
      oracle_text:
        'Simic Growth Chamber enters the battlefield tapped.\nWhen Simic Growth Chamber enters, return a land you control to its owner\'s hand.\n{T}: Add {G}{U}.',
    });
    const result = processLand(data, data, false);
    expect(result).not.toBeNull();
    expect(result.isBounce).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// processManaArtifact
// ─────────────────────────────────────────────────────────────────────────────
describe('processManaArtifact', () => {
  it('builds a basic mana-artifact object', () => {
    const data = makeCard({
      name: 'Test Rock',
      type_line: 'Artifact',
      oracle_text: '{T}: Add {C}{C}.',
      mana_cost: '{3}',
      cmc: 3,
    });
    const result = processManaArtifact(data);
    expect(result.type).toBe('artifact');
    expect(result.isManaArtifact).toBe(true);
    expect(result.cmc).toBe(3);
  });

  it('correctly identifies Sol Ring (2 colourless, known entry)', () => {
    const data = makeCard({
      name: 'Sol Ring',
      type_line: 'Artifact',
      oracle_text: '{T}: Add {C}{C}.',
      mana_cost: '{1}',
      cmc: 1,
    });
    const result = processManaArtifact(data);
    expect(result.manaAmount).toBe(2);
    expect(result.cmc).toBe(1);
  });

  it('sets isMoxDiamond for Mox Diamond', () => {
    const data = makeCard({
      name: 'Mox Diamond',
      type_line: 'Artifact',
      oracle_text: 'If Mox Diamond would enter the battlefield, you may discard a land card instead. If you do, put Mox Diamond onto the battlefield. If you don\'t, put it into its owner\'s graveyard.\n{T}: Add one mana of any color.',
      mana_cost: '{0}',
      cmc: 0,
    });
    const result = processManaArtifact(data);
    expect(result.isMoxDiamond).toBe(true);
  });

  it('sets isChromeMox for Chrome Mox', () => {
    const data = makeCard({
      name: 'Chrome Mox',
      type_line: 'Artifact',
      oracle_text: 'Imprint — When Chrome Mox enters, you may exile a nonartifact, nonland card from your hand.\n{T}: Add one mana of any type the exiled card was.',
      mana_cost: '{0}',
      cmc: 0,
    });
    const result = processManaArtifact(data);
    expect(result.isChromeMox).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// processManaCreature
// ─────────────────────────────────────────────────────────────────────────────
describe('processManaCreature', () => {
  it('builds a well-formed creature object', () => {
    const data = makeCard({
      name: 'Test Dork',
      type_line: 'Creature — Elf Druid',
      oracle_text: '{T}: Add {G}.',
      mana_cost: '{G}',
      cmc: 1,
    });
    const result = processManaCreature(data);
    expect(result.type).toBe('creature');
    expect(result.isManaCreature).toBe(true);
    expect(result.produces).toContain('G');
    expect(result.cmc).toBe(1);
  });

  it('reads known values for Birds of Paradise', () => {
    const data = makeCard({
      name: 'Birds of Paradise',
      type_line: 'Creature — Bird',
      oracle_text: 'Flying\n{T}: Add one mana of any color.',
      mana_cost: '{G}',
      cmc: 1,
    });
    const result = processManaCreature(data);
    expect(result.produces).toEqual(['W', 'U', 'B', 'R', 'G']);
    expect(result.manaAmount).toBe(1);
  });

  it('reads known values for Llanowar Elves', () => {
    const data = makeCard({
      name: 'Llanowar Elves',
      type_line: 'Creature — Elf Druid',
      oracle_text: '{T}: Add {G}.',
      mana_cost: '{G}',
      cmc: 1,
    });
    const result = processManaCreature(data);
    expect(result.produces).toContain('G');
    expect(result.manaAmount).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// processExploration
// ─────────────────────────────────────────────────────────────────────────────
describe('processExploration', () => {
  it('defaults to landsPerTurn = 2', () => {
    const data = makeCard({ name: 'Exploration', type_line: 'Enchantment', mana_cost: '{G}', cmc: 1 });
    const result = processExploration(data);
    expect(result.type).toBe('exploration');
    expect(result.isExploration).toBe(true);
    expect(result.landsPerTurn).toBe(2);
  });

  it('sets landsPerTurn = 3 for Azusa', () => {
    const data = makeCard({ name: 'Azusa, Lost but Seeking', type_line: 'Creature — Human Monk', mana_cost: '{2}{G}', cmc: 3 });
    const result = processExploration(data);
    expect(result.landsPerTurn).toBe(3);
  });

  it('correctly flags isCreature / isArtifact', () => {
    const creature = makeCard({ name: 'Exploration', type_line: 'Creature', mana_cost: '{G}', cmc: 1 });
    const artifact = makeCard({ name: 'Exploration', type_line: 'Artifact', mana_cost: '{G}', cmc: 1 });
    const enchant  = makeCard({ name: 'Exploration', type_line: 'Enchantment', mana_cost: '{G}', cmc: 1 });
    expect(processExploration(creature).isCreature).toBe(true);
    expect(processExploration(artifact).isArtifact).toBe(true);
    expect(processExploration(enchant).isCreature).toBe(false);
    expect(processExploration(enchant).isArtifact).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// processRampSpell
// ─────────────────────────────────────────────────────────────────────────────
describe('processRampSpell', () => {
  it('returns a well-formed rampSpell object', () => {
    const data = makeCard({ name: 'Cultivate', type_line: 'Sorcery', mana_cost: '{2}{G}', cmc: 3 });
    const result = processRampSpell(data);
    expect(result.type).toBe('rampSpell');
    expect(result.isRampSpell).toBe(true);
    expect(typeof result.landsToAdd).toBe('number');
    expect(result.landsToAdd).toBeGreaterThan(0);
    expect(result.cmc).toBe(3);
  });

  it('falls back to sensible defaults for an unknown ramp spell', () => {
    const data = makeCard({ name: 'Unknown Ramp Spell XYZ', type_line: 'Sorcery', mana_cost: '{3}{G}', cmc: 4 });
    const result = processRampSpell(data);
    expect(result.landsToAdd).toBe(1);
    expect(result.landsTapped).toBe(true);
    expect(result.sacrificeLand).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// processRitual
// ─────────────────────────────────────────────────────────────────────────────
describe('processRitual', () => {
  it('returns a well-formed ritual object', () => {
    const data = makeCard({ name: 'Dark Ritual', type_line: 'Instant', mana_cost: '{B}', cmc: 1 });
    const result = processRitual(data);
    expect(result.type).toBe('ritual');
    expect(result.isRitual).toBe(true);
    expect(typeof result.manaProduced).toBe('number');
    expect(result.manaProduced).toBeGreaterThan(0);
    expect(result.cmc).toBe(1);
  });

  it('returns known values for Dark Ritual', () => {
    const data = makeCard({ name: 'Dark Ritual', type_line: 'Instant', mana_cost: '{B}', cmc: 1 });
    const result = processRitual(data);
    // Dark Ritual adds {B}{B}{B} for {B} → netGain of 2
    expect(result.manaProduced).toBe(3);
    expect(result.netGain).toBe(2);
  });

  it('falls back to safe defaults for an unknown name', () => {
    const data = makeCard({ name: 'Unknown Ritual XYZ', type_line: 'Instant', mana_cost: '{R}', cmc: 1 });
    const result = processRitual(data);
    expect(result.manaProduced).toBe(1);
    expect(result.netGain).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// processSpell
// ─────────────────────────────────────────────────────────────────────────────
describe('processSpell', () => {
  it('builds a plain spell object', () => {
    const data = makeCard({ name: 'Counterspell', type_line: 'Instant', mana_cost: '{U}{U}', cmc: 2 });
    const result = processSpell(data);
    expect(result.type).toBe('spell');
    expect(result.name).toBe('Counterspell');
    expect(result.cmc).toBe(2);
    expect(result.manaCost).toBe('{U}{U}');
  });

  it('reads front face data for split / adventure cards', () => {
    const data = {
      ...makeCard({ name: 'Rosethorn Acolyte', type_line: null, mana_cost: null, cmc: null }),
      card_faces: [
        { type_line: 'Creature — Elf Druid', mana_cost: '{2}{G}', cmc: 3, oracle_text: '' },
        { type_line: 'Sorcery — Adventure', mana_cost: '{G}', oracle_text: '' },
      ],
    };
    const result = processSpell(data);
    expect(result.cmc).toBe(3);
    expect(result.manaCost).toBe('{2}{G}');
  });

  it('sets cmc = 0 for a {0} cost spell', () => {
    const data = makeCard({ name: 'Ornithopter', type_line: 'Artifact Creature', mana_cost: '{0}', cmc: 0 });
    const result = processSpell(data);
    expect(result.cmc).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// processCardData  (routing function)
// ─────────────────────────────────────────────────────────────────────────────
describe('processCardData', () => {
  it('routes a land card to processLand', () => {
    const data = makeLand({ name: 'Island', type_line: 'Basic Land — Island', oracle_text: '({T}: Add {U}.)' });
    const result = processCardData(data);
    expect(result.type).toBe('land');
  });

  it('routes a mana-tap creature to processManaCreature', () => {
    const data = makeCard({
      name: 'Llanowar Elves',
      type_line: 'Creature — Elf Druid',
      oracle_text: '{T}: Add {G}.',
      mana_cost: '{G}',
      cmc: 1,
    });
    const result = processCardData(data);
    expect(result.type).toBe('creature');
    expect(result.isManaCreature).toBe(true);
  });

  it('routes a mana artifact to processManaArtifact', () => {
    const data = makeCard({
      name: 'Sol Ring',
      type_line: 'Artifact',
      oracle_text: '{T}: Add {C}{C}.',
      mana_cost: '{1}',
      cmc: 1,
    });
    const result = processCardData(data);
    expect(result.type).toBe('artifact');
    expect(result.isManaArtifact).toBe(true);
  });

  it('routes a known ramp spell to processRampSpell', () => {
    const data = makeCard({ name: 'Cultivate', type_line: 'Sorcery', mana_cost: '{2}{G}', cmc: 3 });
    const result = processCardData(data);
    expect(result.type).toBe('rampSpell');
  });

  it('routes a known ritual to processRitual', () => {
    const data = makeCard({ name: 'Dark Ritual', type_line: 'Instant', mana_cost: '{B}', cmc: 1 });
    const result = processCardData(data);
    expect(result.type).toBe('ritual');
  });

  it('routes a plain spell to processSpell', () => {
    const data = makeCard({ name: 'Counterspell', type_line: 'Instant', mana_cost: '{U}{U}', cmc: 2 });
    const result = processCardData(data);
    expect(result.type).toBe('spell');
  });

  it('handles a modal-DFC whose front face is a land', () => {
    const data = {
      name: 'Turntimber Symbiosis',
      type_line: 'Sorcery',
      oracle_text: '',
      mana_cost: '{4}{G}{G}{G}',
      cmc: 7,
      layout: 'modal_dfc',
      card_faces: [
        { type_line: 'Sorcery', mana_cost: '{4}{G}{G}{G}', oracle_text: '' },
        { type_line: 'Land — Forest', oracle_text: '({T}: Add {G}.)' },
      ],
    };
    const result = processCardData(data);
    // The existing implementation routes MDFCs with any land face to processLand
    expect(result.type).toBe('land');
  });
});
