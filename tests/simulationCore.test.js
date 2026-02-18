/**
 * simulationCore.js — Unit Tests
 *
 * Covers all 10 exported functions:
 *   shuffle                  – array permutation utility
 *   matchesRampFilter        – ramp-spell land eligibility
 *   doesLandEnterTapped      – tapped-entry logic for every land type
 *   selectBestLand           – best land to play from hand
 *   findBestLandToFetch      – best land to fetch from library
 *   calculateManaAvailability – total + per-colour mana
 *   canPlayCard              – spell-castability check
 *   tapManaSources           – marks battlefield sources as tapped
 *   playLand                 – mutation: moves land from hand → battlefield
 *   castSpells               – mutation: casts mana-producers and ramp spells
 *
 * Run:  npm test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  shuffle,
  matchesRampFilter,
  doesLandEnterTapped,
  selectBestLand,
  findBestLandToFetch,
  calculateManaAvailability,
  canPlayCard,
  tapManaSources,
  playLand,
  castSpells,
} from '../src/simulation/simulationCore.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers – minimal card / permanent factories
// ─────────────────────────────────────────────────────────────────────────────
const makeLand = (overrides = {}) => ({
  name: 'Forest',
  isLand: true,
  isBasic: true,
  produces: ['G'],
  manaAmount: 1,
  landSubtypes: ['Forest'],
  entersTappedAlways: false,
  isFetch: false,
  isBounce: false,
  isShockLand: false,
  isFast: false,
  isBattleLand: false,
  isCheck: false,
  isCrowd: false,
  ...overrides,
});

const makeCreature = (overrides = {}) => ({
  name: 'Llanowar Elves',
  type: 'Creature',
  isManaCreature: true,
  isLand: false,
  produces: ['G'],
  manaAmount: 1,
  cmc: 1,
  manaCost: '{G}',
  entersTapped: false,
  ...overrides,
});

const makeArtifact = (overrides = {}) => ({
  name: 'Sol Ring',
  type: 'Artifact',
  isManaArtifact: true,
  isLand: false,
  produces: ['C'],
  manaAmount: 2,
  cmc: 1,
  manaCost: '{1}',
  entersTapped: false,
  ...overrides,
});

const makeSpell = (overrides = {}) => ({
  name: 'Cultivate',
  type: 'Sorcery',
  isLand: false,
  isManaCreature: false,
  isManaArtifact: false,
  isRampSpell: true,
  cmc: 3,
  manaCost: '{2}{G}',
  landsToAdd: 1,
  landsTapped: true,
  landsToHand: 1,
  sacrificeLand: false,
  fetchFilter: 'basic',
  fetchSubtypes: null,
  ...overrides,
});

const perm = (card, overrides = {}) => ({
  card,
  tapped: false,
  summoningSick: false,
  enteredTapped: false,
  ...overrides,
});

// ─────────────────────────────────────────────────────────────────────────────
// shuffle
// ─────────────────────────────────────────────────────────────────────────────
describe('shuffle', () => {
  it('returns a new array with the same elements', () => {
    const original = [1, 2, 3, 4, 5];
    const result   = shuffle(original);
    expect(result).not.toBe(original);
    expect(result.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it('does not modify the original array', () => {
    const original = ['a', 'b', 'c'];
    const copy     = [...original];
    shuffle(original);
    expect(original).toEqual(copy);
  });

  it('returns an empty array unchanged', () => {
    expect(shuffle([])).toEqual([]);
  });

  it('returns a single-element array unchanged', () => {
    expect(shuffle([42])).toEqual([42]);
  });

  it('produces all 6 permutations of a 3-element array across many trials', () => {
    const seen = new Set();
    for (let i = 0; i < 500; i++) {
      seen.add(shuffle([1, 2, 3]).join(','));
    }
    expect(seen.size).toBe(6);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// matchesRampFilter
// ─────────────────────────────────────────────────────────────────────────────
describe('matchesRampFilter', () => {
  it('returns false for non-land cards', () => {
    const nonLand = makeCreature();
    nonLand.isLand = false;
    expect(matchesRampFilter(nonLand, { fetchFilter: 'any' })).toBe(false);
  });

  it('"any" filter accepts any land', () => {
    const dual = makeLand({ isBasic: false });
    expect(matchesRampFilter(dual, { fetchFilter: 'any' })).toBe(true);
  });

  it('"basic" filter accepts only basic lands', () => {
    const basic = makeLand({ isBasic: true });
    const dual  = makeLand({ isBasic: false });
    expect(matchesRampFilter(basic, { fetchFilter: 'basic' })).toBe(true);
    expect(matchesRampFilter(dual,  { fetchFilter: 'basic' })).toBe(false);
  });

  it('"subtype" filter accepts lands with a matching subtype', () => {
    const forest = makeLand({ landSubtypes: ['Forest'] });
    const island = makeLand({ landSubtypes: ['Island'] });
    const ramp = { fetchFilter: 'subtype', fetchSubtypes: ['Forest'] };
    expect(matchesRampFilter(forest, ramp)).toBe(true);
    expect(matchesRampFilter(island, ramp)).toBe(false);
  });

  it('"subtype" filter returns false when fetchSubtypes is missing', () => {
    const forest = makeLand({ landSubtypes: ['Forest'] });
    expect(matchesRampFilter(forest, { fetchFilter: 'subtype', fetchSubtypes: null })).toBe(false);
  });

  it('"snow" filter accepts lands whose name contains "snow"', () => {
    const snow    = makeLand({ name: 'Snow-Covered Forest' });
    const normal  = makeLand({ name: 'Forest' });
    expect(matchesRampFilter(snow,   { fetchFilter: 'snow' })).toBe(true);
    expect(matchesRampFilter(normal, { fetchFilter: 'snow' })).toBe(false);
  });

  it('unrecognized fetchFilter falls back to basic', () => {
    const basic = makeLand({ isBasic: true });
    const dual  = makeLand({ isBasic: false });
    expect(matchesRampFilter(basic, { fetchFilter: 'unknown_type_xyz' })).toBe(true);
    expect(matchesRampFilter(dual,  { fetchFilter: 'unknown_type_xyz' })).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// doesLandEnterTapped
// ─────────────────────────────────────────────────────────────────────────────
describe('doesLandEnterTapped', () => {
  it('a basic land always enters untapped', () => {
    const forest = makeLand();
    expect(doesLandEnterTapped(forest, [], 1, false)).toBe(false);
  });

  it('a land with entersTappedAlways=true always enters tapped', () => {
    const tapLand = makeLand({ entersTappedAlways: true });
    expect(doesLandEnterTapped(tapLand, [], 1, false)).toBe(true);
  });

  it('a shock land always enters tapped (the function returns true; playLand pays life)', () => {
    const shock = makeLand({ isShockLand: true });
    expect(doesLandEnterTapped(shock, [], 1, false)).toBe(true);
  });

  it('a fast land enters untapped when ≤ 2 lands are already in play', () => {
    const fast = makeLand({ isFast: true });
    const bf   = [
      perm(makeLand({ name: 'Island' })),
      perm(makeLand({ name: 'Swamp' })),
    ];
    expect(doesLandEnterTapped(fast, bf, 3, false)).toBe(false);
  });

  it('a fast land enters tapped when > 2 lands are already in play', () => {
    const fast = makeLand({ isFast: true });
    const bf   = [
      perm(makeLand({ name: 'A', isLand: true })),
      perm(makeLand({ name: 'B', isLand: true })),
      perm(makeLand({ name: 'C', isLand: true })),
    ];
    expect(doesLandEnterTapped(fast, bf, 4, false)).toBe(true);
  });

  it('a battle land enters untapped when ≥ 2 basics are in play', () => {
    const battle = makeLand({ isBattleLand: true });
    const bf = [
      perm(makeLand({ name: 'Forest', isBasic: true })),
      perm(makeLand({ name: 'Island', isBasic: true })),
    ];
    expect(doesLandEnterTapped(battle, bf, 3, false)).toBe(false);
  });

  it('a battle land enters tapped when < 2 basics are in play', () => {
    const battle = makeLand({ isBattleLand: true });
    expect(doesLandEnterTapped(battle, [], 1, false)).toBe(true);
  });

  it('a crowd land enters untapped in commander mode', () => {
    const crowd = makeLand({ isCrowd: true });
    expect(doesLandEnterTapped(crowd, [], 1, true)).toBe(false);
  });

  it('a crowd land enters tapped outside commander mode', () => {
    const crowd = makeLand({ isCrowd: true });
    expect(doesLandEnterTapped(crowd, [], 1, false)).toBe(true);
  });

  it('a check land enters untapped when required subtype is in play', () => {
    const check = makeLand({
      isCheck: true,
      produces: ['U', 'B'],
      checkTypes: ['Island', 'Swamp'],
    });
    const bf = [perm(makeLand({ name: 'Island', landSubtypes: ['Island'] }))];
    expect(doesLandEnterTapped(check, bf, 2, false)).toBe(false);
  });

  it('a check land enters tapped when required subtype is absent', () => {
    const check = makeLand({
      isCheck: true,
      produces: ['U', 'B'],
      checkTypes: ['Island', 'Swamp'],
    });
    expect(doesLandEnterTapped(check, [], 1, false)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// selectBestLand
// ─────────────────────────────────────────────────────────────────────────────
describe('selectBestLand', () => {
  it('returns null when hand has no lands', () => {
    const hand = [makeCreature(), makeSpell()];
    expect(selectBestLand(hand, [], [], 1)).toBeNull();
  });

  it('returns the only land when hand has one', () => {
    const forest = makeLand();
    const hand   = [forest];
    expect(selectBestLand(hand, [], [], 1)).toBe(forest);
  });

  it('prefers an untapped land over a tapped land', () => {
    const tapped   = makeLand({ name: 'Tap City',   entersTappedAlways: true });
    const untapped = makeLand({ name: 'Quick Hills', entersTappedAlways: false });
    const hand     = [tapped, untapped];
    expect(selectBestLand(hand, [], [], 1)).toBe(untapped);
  });

  it('returns null when the only land is a bounce land and battlefield is empty', () => {
    const bounce = makeLand({ name: 'Simic Growth Chamber', isBounce: true });
    const result = selectBestLand([bounce], [], [], 1);
    expect(result).toBeNull();
  });

  it('returns a bounce land when there is a non-bounce land to return', () => {
    const bounce  = makeLand({ name: 'Simic Growth Chamber', isBounce: true });
    const regular = makeLand({ name: 'Forest', isBounce: false });
    const bf      = [perm(regular)];
    const result  = selectBestLand([bounce], bf, [], 1);
    expect(result).toBe(bounce);
  });

  it('returns a fetch land before a plain untapped land when mana is available', () => {
    const fetch   = makeLand({ name: 'Polluted Delta', isFetch: true, fetchType: 'classic', fetchcost: 0 });
    const regular = makeLand({ name: 'Forest', isFetch: false });
    const hand    = [fetch, regular];
    const bf      = [perm(makeLand({ name: 'Island' }))];
    const result  = selectBestLand(hand, bf, [], 1);
    expect(result).toBe(fetch);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calculateManaAvailability
// ─────────────────────────────────────────────────────────────────────────────
describe('calculateManaAvailability', () => {
  it('returns zeroes for an empty battlefield', () => {
    const result = calculateManaAvailability([]);
    expect(result.total).toBe(0);
    expect(result.colors).toEqual({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });
  });

  it('counts a single untapped land', () => {
    const forest = makeLand({ produces: ['G'] });
    const result = calculateManaAvailability([perm(forest)]);
    expect(result.total).toBe(1);
    expect(result.colors.G).toBe(1);
  });

  it('does not count tapped lands', () => {
    const forest = makeLand({ produces: ['G'] });
    const result = calculateManaAvailability([perm(forest, { tapped: true })]);
    expect(result.total).toBe(0);
  });

  it('counts mana artifacts', () => {
    const solRing = makeArtifact({ produces: ['C'], manaAmount: 2 });
    const result  = calculateManaAvailability([perm(solRing)]);
    expect(result.total).toBe(2);
    expect(result.colors.C).toBe(2);
  });

  it('counts mana creatures without summoning sickness', () => {
    const dork   = makeCreature({ produces: ['G'], manaAmount: 1 });
    const result = calculateManaAvailability([perm(dork, { summoningSick: false })]);
    expect(result.total).toBe(1);
    expect(result.colors.G).toBe(1);
  });

  it('does not count mana creatures with summoning sickness', () => {
    const dork   = makeCreature({ produces: ['G'], manaAmount: 1 });
    const result = calculateManaAvailability([perm(dork, { summoningSick: true })]);
    expect(result.total).toBe(0);
  });

  it('correctly sums multiple sources', () => {
    const forest   = makeLand({ produces: ['G'] });
    const island   = makeLand({ name: 'Island', produces: ['U'] });
    const solRing  = makeArtifact({ produces: ['C'], manaAmount: 2 });
    const bf = [perm(forest), perm(island), perm(solRing)];
    const result   = calculateManaAvailability(bf);
    expect(result.total).toBe(4);
    expect(result.colors.G).toBe(1);
    expect(result.colors.U).toBe(1);
    expect(result.colors.C).toBe(2);
  });

  it('accounts for manaAmount > 1 on lands (e.g. Ancient Tomb)', () => {
    const tomb   = makeLand({ name: 'Ancient Tomb', produces: ['C'], manaAmount: 2 });
    const result = calculateManaAvailability([perm(tomb)]);
    expect(result.total).toBe(2);
    expect(result.colors.C).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// canPlayCard
// ─────────────────────────────────────────────────────────────────────────────
describe('canPlayCard', () => {
  const mana = (total, colors = {}) => ({
    total,
    colors: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, ...colors },
  });

  it('returns false when total mana is insufficient', () => {
    const card = { cmc: 4, manaCost: '{3}{G}' };
    expect(canPlayCard(card, mana(3, { G: 1 }))).toBe(false);
  });

  it('returns true when total mana and colour pips are satisfied', () => {
    const card = { cmc: 2, manaCost: '{1}{G}' };
    expect(canPlayCard(card, mana(3, { G: 2 }))).toBe(true);
  });

  it('returns false when colour pips are not met', () => {
    const card = { cmc: 2, manaCost: '{U}{U}' };
    expect(canPlayCard(card, mana(4, { U: 1 }))).toBe(false);
  });

  it('returns true for a zero-cost spell', () => {
    const card = { cmc: 0, manaCost: '{0}' };
    expect(canPlayCard(card, mana(0))).toBe(true);
  });

  it('handles monocolour pips correctly', () => {
    const card = { cmc: 3, manaCost: '{G}{G}{G}' };
    expect(canPlayCard(card, mana(3, { G: 3 }))).toBe(true);
    expect(canPlayCard(card, mana(3, { G: 2 }))).toBe(false);
  });

  it('handles multicolour spells', () => {
    const card = { cmc: 3, manaCost: '{1}{U}{B}' };
    expect(canPlayCard(card, mana(3, { U: 1, B: 1 }))).toBe(true);
    expect(canPlayCard(card, mana(3, { U: 1, B: 0 }))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// tapManaSources
// ─────────────────────────────────────────────────────────────────────────────
describe('tapManaSources', () => {
  it('taps a single coloured source for a coloured spell', () => {
    const forest   = makeLand({ produces: ['G'] });
    const bf       = [perm(forest)];
    const spell    = { manaCost: '{G}', cmc: 1 };
    tapManaSources(spell, bf);
    expect(bf[0].tapped).toBe(true);
  });

  it('taps a colourless source for a generic-cost spell', () => {
    const solRing = makeArtifact({ produces: ['C'], manaAmount: 2 });
    const bf      = [perm(solRing)];
    const spell   = { manaCost: '{2}', cmc: 2 };
    tapManaSources(spell, bf);
    expect(bf[0].tapped).toBe(true);
  });

  it('does not tap already-tapped sources', () => {
    const forest  = makeLand({ produces: ['G'] });
    const bf      = [perm(forest, { tapped: true })];
    const spell   = { manaCost: '{G}', cmc: 1 };
    tapManaSources(spell, bf);
    // tapped was already true and the source was unavailable — still true
    expect(bf[0].tapped).toBe(true);
  });

  it('taps exact number of sources needed for a multi-pip spell', () => {
    const f1 = makeLand({ name: 'Forest 1', produces: ['G'] });
    const f2 = makeLand({ name: 'Forest 2', produces: ['G'] });
    const f3 = makeLand({ name: 'Forest 3', produces: ['G'] });
    const bf = [perm(f1), perm(f2), perm(f3)];
    tapManaSources({ manaCost: '{G}{G}', cmc: 2 }, bf);
    const tappedCount = bf.filter(p => p.tapped).length;
    expect(tappedCount).toBe(2);
  });

  it('leaves battlefield untouched when spell has no mana cost', () => {
    const forest = makeLand({ produces: ['G'] });
    const bf     = [perm(forest)];
    tapManaSources({ manaCost: '{0}', cmc: 0 }, bf);
    expect(bf[0].tapped).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// findBestLandToFetch
// ─────────────────────────────────────────────────────────────────────────────
describe('findBestLandToFetch', () => {
  it('returns null when no eligible lands exist', () => {
    const fetch   = makeLand({ name: 'Polluted Delta', isFetch: true, fetchColors: ['U', 'B'], fetchesOnlyBasics: false });
    const library = [makeLand({ name: 'Forest', landSubtypes: ['Forest'], produces: ['G'] })];
    expect(findBestLandToFetch(fetch, library, [], [], null, 1)).toBeNull();
  });

  it('returns an eligible land that matches fetchColors', () => {
    const fetch   = makeLand({ name: 'Polluted Delta', isFetch: true, fetchColors: ['U', 'B'], fetchesOnlyBasics: false });
    const island  = makeLand({ name: 'Island', landSubtypes: ['Island'], produces: ['U'], isBasic: true });
    const library = [island];
    const result  = findBestLandToFetch(fetch, library, [], [], null, 1);
    expect(result).toBe(island);
  });

  it('respects fetchesOnlyBasics', () => {
    const fetch      = makeLand({ name: 'Evolving Wilds', isFetch: true, fetchColors: ['G'], fetchesOnlyBasics: true });
    const basic      = makeLand({ name: 'Forest',    landSubtypes: ['Forest'], produces: ['G'], isBasic: true });
    const nonbasic   = makeLand({ name: 'Overgrown Tomb', landSubtypes: ['Swamp', 'Forest'], produces: ['B', 'G'], isBasic: false });
    const library    = [nonbasic, basic];
    const result     = findBestLandToFetch(fetch, library, [], [], null, 1);
    expect(result).toBe(basic);
  });

  it('prioritises dual lands early (turn ≤ 2)', () => {
    const fetch   = makeLand({ name: 'Wooded Foothills', isFetch: true, fetchColors: ['G', 'R'], fetchesOnlyBasics: false });
    const dual    = makeLand({ name: 'Stomping Ground', landSubtypes: ['Mountain', 'Forest'], produces: ['R', 'G'], isBasic: false });
    const basic   = makeLand({ name: 'Forest', landSubtypes: ['Forest'], produces: ['G'], isBasic: true });
    const library = [basic, dual];
    const result  = findBestLandToFetch(fetch, library, [], [], null, 1);
    // Dual produces 2 colours → higher score on turn 1
    expect(result).toBe(dual);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// playLand
// ─────────────────────────────────────────────────────────────────────────────
describe('playLand', () => {
  it('moves the land from hand to battlefield', () => {
    const forest = makeLand();
    const hand   = [forest];
    const bf     = [];
    playLand(forest, hand, bf, [], [], 1, null, [], null, false);
    expect(hand).toHaveLength(0);
    expect(bf).toHaveLength(1);
    expect(bf[0].card).toBe(forest);
  });

  it('a basic land enters untapped', () => {
    const forest = makeLand();
    const bf     = [];
    playLand(forest, [forest], bf, [], [], 1, null, [], null, false);
    expect(bf[0].tapped).toBe(false);
  });

  it('a tapped land enters tapped', () => {
    const tapLand = makeLand({ entersTappedAlways: true });
    const bf      = [];
    playLand(tapLand, [tapLand], bf, [], [], 1, null, [], null, false);
    expect(bf[0].tapped).toBe(true);
  });

  it('records an action in turnLog', () => {
    const forest = makeLand();
    const log    = { actions: [] };
    playLand(forest, [forest], [], [], [], 1, log, [], null, false);
    expect(log.actions.length).toBeGreaterThan(0);
    expect(log.actions[0]).toContain('Forest');
  });

  it('a bounce land returns a non-bounce land to hand', () => {
    const regular = makeLand({ name: 'Forest', isBounce: false });
    const bounce  = makeLand({ name: 'Simic Growth Chamber', isBounce: true, entersTappedAlways: true });
    const hand    = [bounce];
    const bf      = [perm(regular)];
    playLand(bounce, hand, bf, [], [], 2, null, [], null, false);
    // Battlefield should now contain the bounce land; hand should contain the returned land
    expect(bf.some(p => p.card.name === 'Simic Growth Chamber')).toBe(true);
    expect(hand.some(c => c.name === 'Forest')).toBe(true);
  });

  it('a fetch land enters the battlefield (non-hideaway)', () => {
    const island  = makeLand({ name: 'Island', landSubtypes: ['Island'], produces: ['U'], isBasic: true });
    const fetch   = makeLand({
      name: 'Flooded Strand',
      isFetch: true,
      fetchType: 'classic',
      fetchColors: ['W', 'U'],
      fetchesOnlyBasics: false,
      isHideawayFetch: false,
      fetchcost: 0,
      entersTappedAlways: false,
    });
    const hand    = [fetch];
    const bf      = [perm(makeLand({ name: 'Plains' }))];
    const library = [island];
    playLand(fetch, hand, bf, library, [], 1, null, [], null, false);
    // Fetch should be on battlefield (waiting to be activated) or have fetched Island in
    // The function adds the fetch land itself to battlefield for non-hideaway fetches
    expect(hand).toHaveLength(0);
  });

  it('returns 0 life loss for a basic land', () => {
    const forest = makeLand();
    const result = playLand(forest, [forest], [], [], [], 1, null, [], null, false);
    expect(result).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// castSpells
// ─────────────────────────────────────────────────────────────────────────────
describe('castSpells', () => {
  it('casts a mana creature when enough mana exists', () => {
    const forest  = makeLand({ produces: ['G'] });
    const dork    = makeCreature({ name: 'Llanowar Elves', cmc: 1, manaCost: '{G}' });
    const hand    = [dork];
    const bf      = [perm(forest)];
    castSpells(hand, bf, [], null, [], null, [], 1, {});
    expect(hand).toHaveLength(0);
    expect(bf.some(p => p.card.name === 'Llanowar Elves')).toBe(true);
  });

  it('does not cast a mana creature when mana is insufficient', () => {
    const dork = makeCreature({ name: 'Llanowar Elves', cmc: 1, manaCost: '{G}' });
    const hand = [dork];
    castSpells(hand, [], [], null, [], null, [], 1, {});
    expect(hand).toHaveLength(1);
  });

  it('casts a mana artifact when enough mana exists', () => {
    const island   = makeLand({ produces: ['U'] });
    const signet   = makeArtifact({ name: 'Arcane Signet', cmc: 2, manaCost: '{2}', produces: ['G', 'U'], manaAmount: 1 });
    const hand     = [signet];
    const bf       = [perm(island), perm(makeLand({ name: 'Swamp', produces: ['B'] }))];
    castSpells(hand, bf, [], null, [], null, [], 1, {});
    expect(hand).toHaveLength(0);
    expect(bf.some(p => p.card.name === 'Arcane Signet')).toBe(true);
  });

  it('casts a ramp spell when enabled and targets are in library', () => {
    const forest1 = makeLand({ name: 'Forest 1', produces: ['G'], isBasic: true });
    const forest2 = makeLand({ name: 'Forest 2', produces: ['G'], isBasic: true });
    const forest3 = makeLand({ name: 'Forest 3', produces: ['G'], isBasic: true });
    const cultivate = makeSpell({ name: 'Cultivate', cmc: 3, manaCost: '{2}{G}', fetchFilter: 'basic', landsToAdd: 1, landsToHand: 1 });
    // 3 forests on battlefield provide {G}{G}{G}
    const bf  = [perm(forest1), perm(forest2), perm(forest3)];
    const lib  = [makeLand({ name: 'Forest 4', isBasic: true, produces: ['G'] }), makeLand({ name: 'Forest 5', isBasic: true, produces: ['G'] })];
    const hand = [cultivate];
    const gy   = [];
    castSpells(hand, bf, gy, null, [], null, lib, 3, { includeRampSpells: true, disabledRampSpells: new Set() });
    // Cultivate goes to graveyard; 1 basic → battlefield (tapped); 1 basic → hand
    expect(gy.some(c => c.name === 'Cultivate')).toBe(true);
    expect(bf.length).toBeGreaterThan(3);
    // The land-to-hand effect adds one basic to hand
    expect(hand).toHaveLength(1);
    expect(hand[0].isLand).toBe(true);
  });

  it('skips ramp spells when includeRampSpells=false', () => {
    const forest1 = makeLand({ name: 'F1', produces: ['G'], isBasic: true });
    const forest2 = makeLand({ name: 'F2', produces: ['G'], isBasic: true });
    const forest3 = makeLand({ name: 'F3', produces: ['G'], isBasic: true });
    const cultivate = makeSpell({ name: 'Cultivate', cmc: 3, manaCost: '{2}{G}' });
    const bf   = [perm(forest1), perm(forest2), perm(forest3)];
    const hand = [cultivate];
    castSpells(hand, bf, [], null, [], null, [], 3, { includeRampSpells: false });
    expect(hand).toHaveLength(1);
  });

  it('skips a ramp spell listed in disabledRampSpells', () => {
    const f1 = makeLand({ name: 'F1', produces: ['G'], isBasic: true });
    const f2 = makeLand({ name: 'F2', produces: ['G'], isBasic: true });
    const f3 = makeLand({ name: 'F3', produces: ['G'], isBasic: true });
    const cultivate = makeSpell({ name: 'Cultivate', cmc: 3, manaCost: '{2}{G}' });
    const bf   = [perm(f1), perm(f2), perm(f3)];
    const hand = [cultivate];
    castSpells(hand, bf, [], null, [], null, [], 3, { includeRampSpells: true, disabledRampSpells: new Set(['Cultivate']) });
    expect(hand).toHaveLength(1);
  });

  it('records cast actions in turnLog', () => {
    const forest = makeLand({ produces: ['G'] });
    const dork   = makeCreature({ name: 'Llanowar Elves', cmc: 1, manaCost: '{G}' });
    const log    = { actions: [] };
    castSpells([dork], [perm(forest)], [], log, [], null, [], 1, {});
    expect(log.actions.some(a => a.includes('Llanowar Elves'))).toBe(true);
  });
});
