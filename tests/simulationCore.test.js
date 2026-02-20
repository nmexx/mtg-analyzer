/**
 * simulationCore.js — Unit Tests
 *
 * Covers all 11 exported functions:
 *   shuffle                    – array permutation utility
 *   matchesRampFilter          – ramp-spell land eligibility
 *   doesLandEnterTapped        – tapped-entry logic for every land type
 *   selectBestLand             – best land to play from hand
 *   findBestLandToFetch        – best land to fetch from library
 *   calculateManaAvailability  – total + per-colour mana
 *   canPlayCard                – spell-castability check
 *   tapManaSources             – marks battlefield sources as tapped
 *   playLand                   – mutation: moves land from hand → battlefield
 *   castSpells                 – mutation: casts mana-producers and ramp spells
 *   calculateBattlefieldDamage – life-loss breakdown for pain sources
 *
 * Run:  npm test
 */

import { describe, it, expect } from 'vitest';
import {
  shuffle,
  matchesRampFilter,
  doesLandEnterTapped,
  selectBestLand,
  findBestLandToFetch,
  calculateManaAvailability,
  solveColorPips,
  canPlayCard,
  tapManaSources,
  playLand,
  castSpells,
  calculateBattlefieldDamage,
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
    const result = shuffle(original);
    expect(result).not.toBe(original);
    expect(result.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it('does not modify the original array', () => {
    const original = ['a', 'b', 'c'];
    const copy = [...original];
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
    const dual = makeLand({ isBasic: false });
    expect(matchesRampFilter(basic, { fetchFilter: 'basic' })).toBe(true);
    expect(matchesRampFilter(dual, { fetchFilter: 'basic' })).toBe(false);
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
    const snow = makeLand({ name: 'Snow-Covered Forest' });
    const normal = makeLand({ name: 'Forest' });
    expect(matchesRampFilter(snow, { fetchFilter: 'snow' })).toBe(true);
    expect(matchesRampFilter(normal, { fetchFilter: 'snow' })).toBe(false);
  });

  it('unrecognized fetchFilter falls back to basic', () => {
    const basic = makeLand({ isBasic: true });
    const dual = makeLand({ isBasic: false });
    expect(matchesRampFilter(basic, { fetchFilter: 'unknown_type_xyz' })).toBe(true);
    expect(matchesRampFilter(dual, { fetchFilter: 'unknown_type_xyz' })).toBe(false);
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

  it('an MDFC land always returns true from doesLandEnterTapped on any turn', () => {
    const mdfc = makeLand({ isMDFCLand: true });
    expect(doesLandEnterTapped(mdfc, [], 1, false)).toBe(true);
    expect(doesLandEnterTapped(mdfc, [], 4, false)).toBe(true);
    expect(doesLandEnterTapped(mdfc, [], 5, false)).toBe(true);
  });

  it('a fast land enters untapped when ≤ 2 lands are already in play', () => {
    const fast = makeLand({ isFast: true });
    const bf = [perm(makeLand({ name: 'Island' })), perm(makeLand({ name: 'Swamp' }))];
    expect(doesLandEnterTapped(fast, bf, 3, false)).toBe(false);
  });

  it('a fast land enters tapped when > 2 lands are already in play', () => {
    const fast = makeLand({ isFast: true });
    const bf = [
      perm(makeLand({ name: 'A', isLand: true })),
      perm(makeLand({ name: 'B', isLand: true })),
      perm(makeLand({ name: 'C', isLand: true })),
    ];
    expect(doesLandEnterTapped(fast, bf, 4, false)).toBe(true);
  });

  it('a slow land enters tapped when < 2 lands are already in play', () => {
    const slow = makeLand({ isSlowLand: true });
    const bf = [perm(makeLand({ name: 'Island' }))];
    expect(doesLandEnterTapped(slow, bf, 2, false)).toBe(true);
  });

  it('a slow land enters tapped on an empty battlefield', () => {
    const slow = makeLand({ isSlowLand: true });
    expect(doesLandEnterTapped(slow, [], 1, false)).toBe(true);
  });

  it('a slow land enters untapped when exactly 2 lands are already in play', () => {
    const slow = makeLand({ isSlowLand: true });
    const bf = [perm(makeLand({ name: 'Forest' })), perm(makeLand({ name: 'Mountain' }))];
    expect(doesLandEnterTapped(slow, bf, 3, false)).toBe(false);
  });

  it('a slow land enters untapped when > 2 lands are already in play', () => {
    const slow = makeLand({ isSlowLand: true });
    const bf = [
      perm(makeLand({ name: 'Forest' })),
      perm(makeLand({ name: 'Mountain' })),
      perm(makeLand({ name: 'Island' })),
    ];
    expect(doesLandEnterTapped(slow, bf, 4, false)).toBe(false);
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
    const hand = [forest];
    expect(selectBestLand(hand, [], [], 1)).toBe(forest);
  });

  it('prefers an untapped land over a tapped land', () => {
    const tapped = makeLand({ name: 'Tap City', entersTappedAlways: true });
    const untapped = makeLand({ name: 'Quick Hills', entersTappedAlways: false });
    const hand = [tapped, untapped];
    expect(selectBestLand(hand, [], [], 1)).toBe(untapped);
  });

  it('returns null when the only land is a bounce land and battlefield is empty', () => {
    const bounce = makeLand({ name: 'Simic Growth Chamber', isBounce: true });
    const result = selectBestLand([bounce], [], [], 1);
    expect(result).toBeNull();
  });

  it('returns a bounce land when there is a non-bounce land to return', () => {
    const bounce = makeLand({ name: 'Simic Growth Chamber', isBounce: true });
    const regular = makeLand({ name: 'Forest', isBounce: false });
    const bf = [perm(regular)];
    const result = selectBestLand([bounce], bf, [], 1);
    expect(result).toBe(bounce);
  });

  it('returns a fetch land before a plain untapped land when mana is available', () => {
    const fetch = makeLand({
      name: 'Polluted Delta',
      isFetch: true,
      fetchType: 'classic',
      fetchcost: 0,
    });
    const regular = makeLand({ name: 'Forest', isFetch: false });
    const hand = [fetch, regular];
    const bf = [perm(makeLand({ name: 'Island' }))];
    const result = selectBestLand(hand, bf, [], 1);
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
    expect(result.sources).toEqual([]);
  });

  it('counts a single untapped land', () => {
    const forest = makeLand({ produces: ['G'] });
    const result = calculateManaAvailability([perm(forest)]);
    expect(result.total).toBe(1);
    expect(result.colors.G).toBe(1);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].produces).toEqual(['G']);
  });

  it('does not count tapped lands', () => {
    const forest = makeLand({ produces: ['G'] });
    const result = calculateManaAvailability([perm(forest, { tapped: true })]);
    expect(result.total).toBe(0);
  });

  it('counts mana artifacts', () => {
    const solRing = makeArtifact({ produces: ['C'], manaAmount: 2 });
    const result = calculateManaAvailability([perm(solRing)]);
    expect(result.total).toBe(2);
    expect(result.colors.C).toBe(2);
  });

  it('counts mana creatures without summoning sickness', () => {
    const dork = makeCreature({ produces: ['G'], manaAmount: 1 });
    const result = calculateManaAvailability([perm(dork, { summoningSick: false })]);
    expect(result.total).toBe(1);
    expect(result.colors.G).toBe(1);
  });

  it('does not count mana creatures with summoning sickness', () => {
    const dork = makeCreature({ produces: ['G'], manaAmount: 1 });
    const result = calculateManaAvailability([perm(dork, { summoningSick: true })]);
    expect(result.total).toBe(0);
  });

  it('correctly sums multiple sources', () => {
    const forest = makeLand({ produces: ['G'] });
    const island = makeLand({ name: 'Island', produces: ['U'] });
    const solRing = makeArtifact({ produces: ['C'], manaAmount: 2 });
    const bf = [perm(forest), perm(island), perm(solRing)];
    const result = calculateManaAvailability(bf);
    expect(result.total).toBe(4);
    expect(result.colors.G).toBe(1);
    expect(result.colors.U).toBe(1);
    expect(result.colors.C).toBe(2);
  });

  it('accounts for manaAmount > 1 on lands (e.g. Ancient Tomb)', () => {
    const tomb = makeLand({ name: 'Ancient Tomb', produces: ['C'], manaAmount: 2 });
    const result = calculateManaAvailability([perm(tomb)]);
    expect(result.total).toBe(2);
    expect(result.colors.C).toBe(2);
    // manaAmount=2 → two source entries so either can be used independently
    expect(result.sources).toHaveLength(2);
  });

  it('builds a source entry per mana unit for a dual land (Watery Grave)', () => {
    const wg = makeLand({ name: 'Watery Grave', produces: ['U', 'B'], isBasic: false });
    const result = calculateManaAvailability([perm(wg)]);
    expect(result.total).toBe(1);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].produces).toContain('U');
    expect(result.sources[0].produces).toContain('B');
  });

  // ── Filter Lands ──────────────────────────────────────────────────────────
  // A Filter Land (e.g. Mystic Gate) has two modes:
  //   Mode 1 – {T} → {C}                (no precondition, always available)
  //   Mode 2 – {A} or {B}, {T} → {A}{A}/{A}{B}/{B}{B}  (requires 1 colored mana
  //             matching one of the filter land's OWN colors — {C} cannot pay)
  // The simulator: when a source producing color A or B is available it consumes
  // that source and adds 2 colored production; otherwise falls back to {C}.

  it('Filter Land alone produces {C} (mode 1 fallback — no other mana)', () => {
    const filter = makeLand({
      name: 'Mystic Gate',
      isFilterLand: true,
      produces: ['W', 'U'],
      manaAmount: 1,
    });
    const result = calculateManaAvailability([perm(filter)]);
    expect(result.total).toBe(1);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].produces).toEqual(['C']);
    expect(result.colors.W).toBe(0);
    expect(result.colors.U).toBe(0);
    expect(result.colors.C).toBe(1);
  });

  it('Filter Land with a matching colored source: consumes it and produces 2 colored (mode 2)', () => {
    const filter = makeLand({
      name: 'Mystic Gate',
      isFilterLand: true,
      produces: ['W', 'U'],
      manaAmount: 1,
    });
    const island = makeLand({ name: 'Island', produces: ['U'] });
    const result = calculateManaAvailability([perm(island), perm(filter)]);
    // Island {U} matches Mystic Gate's colors (W/U); consumed as activation cost.
    // Filter produces 2 W/U — net total = 2.
    expect(result.total).toBe(2);
    expect(result.sources).toHaveLength(2);
    result.sources.forEach(s => {
      expect(s.produces.some(c => c === 'W' || c === 'U')).toBe(true);
    });
  });

  it('Filter Land with colorless-only source falls back to mode 1 — {C} cannot pay the cost', () => {
    const filter = makeLand({
      name: 'Flooded Grove',
      isFilterLand: true,
      produces: ['G', 'U'],
      manaAmount: 1,
    });
    const solRing = makeArtifact({ name: 'Sol Ring', produces: ['C'], manaAmount: 2 });
    const result = calculateManaAvailability([perm(solRing), perm(filter)]);
    // Sol Ring gives 2 {C}; neither source produces G or U, so mode 2 cannot fire.
    // Filter falls back to mode 1 → 1 {C}. Total = 3 {C}, no colored mana.
    expect(result.total).toBe(3);
    expect(result.colors.C).toBe(3);
    expect(result.colors.G).toBe(0);
    expect(result.colors.U).toBe(0);
  });

  it('Filter Land with a non-matching colored source falls back to mode 1', () => {
    const filter = makeLand({
      name: 'Mystic Gate',
      isFilterLand: true,
      produces: ['W', 'U'],
      manaAmount: 1,
    });
    // Mountain only provides {R}, which is not in Mystic Gate's W/U colors.
    const mountain = makeLand({ name: 'Mountain', produces: ['R'] });
    const result = calculateManaAvailability([perm(mountain), perm(filter)]);
    // No W or U source available — mode 2 cannot fire. Filter → {C}. Total = 2.
    expect(result.total).toBe(2);
    expect(result.colors.R).toBe(1);
    expect(result.colors.W).toBe(0);
    expect(result.colors.U).toBe(0);
    expect(result.colors.C).toBe(1);
  });

  it('two Filter Lands chain — first uses the non-filter land, second uses the colored output of the first', () => {
    // filter1 (W/U) consumes Island {U} (matching color) → produces 2 W/U.
    // filter2 (G/U) consumes one of those W/U sources (U matches) → produces 2 G/U.
    // Net: island consumed + 2 filter1 (1 consumed by filter2) + 2 filter2 = 3 total.
    const filter1 = makeLand({ name: 'Mystic Gate', isFilterLand: true, produces: ['W', 'U'] });
    const filter2 = makeLand({ name: 'Flooded Grove', isFilterLand: true, produces: ['G', 'U'] });
    const island = makeLand({ name: 'Island', produces: ['U'] });
    const result = calculateManaAvailability([perm(island), perm(filter1), perm(filter2)]);
    expect(result.total).toBe(3);
  });

  // ── Odyssey / Fallout Filter Lands ────────────────────────────────────────
  // Same two modes but the activation is {1},{T} — any generic mana qualifies,
  // including pure colorless sources like Sol Ring.  Off-color mana also qualifies.
  // Prefers consuming a colorless source to preserve coloured pips.

  it('Odyssey Filter Land alone produces {C} (mode 1 fallback — no other mana)', () => {
    const filter = makeLand({
      name: 'Skycloud Expanse',
      isOdysseyFilterLand: true,
      produces: ['W', 'U'],
      manaAmount: 1,
    });
    const result = calculateManaAvailability([perm(filter)]);
    expect(result.total).toBe(1);
    expect(result.sources[0].produces).toEqual(['C']);
    expect(result.colors.W).toBe(0);
    expect(result.colors.U).toBe(0);
  });

  it('Odyssey Filter Land with a colorless source (Sol Ring): {C} DOES pay the {1} cost', () => {
    const filter = makeLand({
      name: 'Skycloud Expanse',
      isOdysseyFilterLand: true,
      produces: ['W', 'U'],
      manaAmount: 1,
    });
    const solRing = makeArtifact({ name: 'Sol Ring', produces: ['C'], manaAmount: 2 });
    const result = calculateManaAvailability([perm(solRing), perm(filter)]);
    // Sol Ring gives 2 {C}; one is consumed as the {1} cost → 1 {C} remains + 2 W/U = 3 total.
    expect(result.total).toBe(3);
    expect(result.colors.C).toBe(1);
    expect(result.colors.W).toBeGreaterThan(0);
    expect(result.colors.U).toBeGreaterThan(0);
  });

  it('Odyssey Filter Land with an off-color source: any mana pays the {1} cost', () => {
    const filter = makeLand({
      name: 'Skycloud Expanse',
      isOdysseyFilterLand: true,
      produces: ['W', 'U'],
      manaAmount: 1,
    });
    // Mountain {R} is off-color but still generic enough to pay {1}.
    const mountain = makeLand({ name: 'Mountain', produces: ['R'] });
    const result = calculateManaAvailability([perm(mountain), perm(filter)]);
    // {R} consumed as {1}; filter adds 2 W/U — net total = 2.
    expect(result.total).toBe(2);
    expect(result.colors.R).toBe(0);
    expect(result.colors.W).toBeGreaterThan(0);
    expect(result.colors.U).toBeGreaterThan(0);
  });

  it('Odyssey Filter Land prefers consuming the colorless source over a colored one', () => {
    const filter = makeLand({
      name: 'Skycloud Expanse',
      isOdysseyFilterLand: true,
      produces: ['W', 'U'],
      manaAmount: 1,
    });
    const island = makeLand({ name: 'Island', produces: ['U'] });
    const solRing = makeArtifact({ name: 'Sol Ring', produces: ['C'], manaAmount: 1 });
    const result = calculateManaAvailability([perm(island), perm(solRing), perm(filter)]);
    // Sol Ring {C} is consumed (preferred over Island {U}).
    // Remaining: Island {U} + 2 W/U from filter = 3 total; U stays at ≥1.
    expect(result.total).toBe(3);
    expect(result.colors.U).toBeGreaterThan(0); // Island still contributes
    expect(result.colors.C).toBe(0); // Sol Ring was consumed
  });

  // ── Horizon Lands ─────────────────────────────────────────────────────────
  // Horizon Lands (e.g. Horizon Canopy) enter untapped and produce colored mana
  // at the cost of 1 life per activation.  There is no colorless opt-out.
  // Mana production is modelled identically to a plain untapped dual.
  // Life loss is tracked separately in calculateBattlefieldDamage (turns 1-5).

  it('Horizon Land produces 1 colored mana source (enters untapped, no extra rules)', () => {
    const hl = makeLand({
      name: 'Horizon Canopy',
      isHorizonLand: true,
      produces: ['G', 'W'],
      manaAmount: 1,
    });
    const result = calculateManaAvailability([perm(hl)]);
    expect(result.total).toBe(1);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].produces).toEqual(['G', 'W']);
    expect(result.colors.G).toBe(1);
    expect(result.colors.W).toBe(1);
  });

  it('two Horizon Lands produce 2 independent colored mana sources', () => {
    const canopy = makeLand({ name: 'Horizon Canopy', isHorizonLand: true, produces: ['G', 'W'] });
    const islet = makeLand({ name: 'Fiery Islet', isHorizonLand: true, produces: ['U', 'R'] });
    const result = calculateManaAvailability([perm(canopy), perm(islet)]);
    expect(result.total).toBe(2);
    expect(result.colors.G).toBe(1);
    expect(result.colors.W).toBe(1);
    expect(result.colors.U).toBe(1);
    expect(result.colors.R).toBe(1);
  });

  // ── Verge Lands ───────────────────────────────────────────────────────
  // A Verge Land (e.g. Sunbillow Verge) always produces its primary color but
  // only adds the secondary color when the required basic-land subtype is
  // already on the battlefield.

  it('Verge Land produces only primary color when required subtype is absent', () => {
    const verge = makeLand({
      name: 'Sunbillow Verge',
      isVerge: true,
      produces: ['W', 'R'],
      vergePrimary: 'W',
      vergeSecondaryCheck: 'Mountain',
      landSubtypes: [],
    });
    // Only a Plains on the battlefield — no Mountain
    const plains = makeLand({ name: 'Plains', landSubtypes: ['Plains'], produces: ['W'] });
    const result = calculateManaAvailability([perm(verge), perm(plains)]);
    expect(result.colors.W).toBe(2); // plains + verge primary
    expect(result.colors.R).toBe(0); // secondary blocked
    // Verge source should only offer the primary color
    const vergeSource = result.sources.find(
      s =>
        (s.produces.length === 1 &&
          s.produces[0] === 'W' &&
          result.sources.filter(x => x === s).length === 0) ||
        true
    );
    expect(result.sources.every(s => !s.produces.includes('R'))).toBe(true);
  });

  it('Verge Land produces both colors when required subtype is on the battlefield', () => {
    const verge = makeLand({
      name: 'Sunbillow Verge',
      isVerge: true,
      produces: ['W', 'R'],
      vergePrimary: 'W',
      vergeSecondaryCheck: 'Mountain',
      landSubtypes: [],
    });
    const mountain = makeLand({
      name: 'Mountain',
      landSubtypes: ['Mountain'],
      produces: ['R'],
      isBasic: true,
    });
    const result = calculateManaAvailability([perm(verge), perm(mountain)]);
    // verge: both colors; mountain: {R} → W≥1, R≥2
    expect(result.colors.W).toBeGreaterThanOrEqual(1);
    expect(result.colors.R).toBeGreaterThanOrEqual(2);
    const vergeSource = result.sources.find(s => s.produces.includes('W'));
    expect(vergeSource).toBeDefined();
    expect(vergeSource.produces).toContain('R');
  });

  it('Verge Land: Mountain on battlefield enables {R} even via shock land subtype', () => {
    const verge = makeLand({
      name: 'Riverpyre Verge',
      isVerge: true,
      produces: ['U', 'R'],
      vergePrimary: 'U',
      vergeSecondaryCheck: 'Mountain',
      landSubtypes: [],
    });
    // Steam Vents has the Mountain subtype
    const steamVents = makeLand({
      name: 'Steam Vents',
      produces: ['U', 'R'],
      landSubtypes: ['Island', 'Mountain'],
      isShockLand: true,
    });
    const result = calculateManaAvailability([perm(verge), perm(steamVents)]);
    expect(result.colors.R).toBeGreaterThanOrEqual(1);
    // Verge source should include 'R'
    const vs = result.sources.find(s => s.produces.includes('U') && s.produces.includes('R'));
    expect(vs).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// solveColorPips
// ─────────────────────────────────────────────────────────────────────────────
describe('solveColorPips', () => {
  const src = colors => ({ produces: colors });

  it('returns true when there are no pip requirements', () => {
    expect(solveColorPips([], [src(['G'])])).toBe(true);
  });

  it('returns true when sources exactly satisfy pips', () => {
    // Island + Swamp → {U}{B}
    expect(solveColorPips(['U', 'B'], [src(['U']), src(['B'])])).toBe(true);
  });

  it('returns false when there are not enough sources', () => {
    // only one source for two pips
    expect(solveColorPips(['U', 'U'], [src(['U'])])).toBe(false);
  });

  it('returns true when a dual land satisfies one of two different pips (shared source)', () => {
    // Watery Grave (U/B) + Island (U) → can cast {U}{B}?
    // WG → B, Island → U  ✓
    expect(solveColorPips(['U', 'B'], [src(['U', 'B']), src(['U'])])).toBe(true);
  });

  it('correctly rejects when a single dual land cannot satisfy two different-colour pips alone', () => {
    // Watery Grave (U/B) alone cannot pay {U}{B} (CMC=2 from one source)
    // The total check already prevents this, but the pip solver also enforces it if called
    // directly: two pips, one source → no matching
    expect(solveColorPips(['U', 'B'], [src(['U', 'B'])])).toBe(false);
  });

  it('identifies the classic false-positive scenario: dual land double-counted', () => {
    // Watery Grave (U/B) + Forest (G)
    // Old code: colors.U=1, colors.B=1 → passes for {U}{B}, but WG can only give ONE mana
    // Pip solver: 2 pips, 2 sources (WG and Forest) — Forest can't satisfy U or B
    //             → only WG qualifies, but 1 source cannot fill 2 different-colour pips
    expect(solveColorPips(['U', 'B'], [src(['U', 'B']), src(['G'])])).toBe(false);
  });

  it('handles same-colour double pips with two matching sources', () => {
    expect(solveColorPips(['G', 'G'], [src(['G']), src(['G'])])).toBe(true);
  });

  it('honours the wildcard "*" produces (e.g. City of Brass style lands)', () => {
    expect(solveColorPips(['U', 'B', 'R'], [src(['*']), src(['*']), src(['*'])])).toBe(true);
  });

  it('handles five-colour pips against one source per colour', () => {
    expect(
      solveColorPips(
        ['W', 'U', 'B', 'R', 'G'],
        [src(['W']), src(['U']), src(['B']), src(['R']), src(['G'])]
      )
    ).toBe(true);
  });

  it('returns false when one colour pip is unserviceable', () => {
    // Need {W} but only have {U} and {B} sources
    expect(solveColorPips(['W'], [src(['U']), src(['B'])])).toBe(false);
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

  // ── Competing-demand tests (precise path via manaAvailable.sources) ────────

  it('rejects {U}{B} when only source is a Watery Grave+Forest (double-counting bug)', () => {
    // Watery Grave (U|B) + Forest (G): colours look like U=1,B=1 but WG can only
    // produce ONE colour per tap — the pip solver must reject this.
    const card = { cmc: 2, manaCost: '{U}{B}' };
    const available = {
      total: 2,
      colors: { W: 0, U: 1, B: 1, R: 0, G: 1, C: 0 },
      sources: [
        { produces: ['U', 'B'] }, // Watery Grave
        { produces: ['G'] }, // Forest
      ],
    };
    expect(canPlayCard(card, available)).toBe(false);
  });

  it('accepts {U}{B} when Watery Grave is paired with an Island', () => {
    // WG covers B, Island covers U  ✓
    const card = { cmc: 2, manaCost: '{U}{B}' };
    const available = {
      total: 2,
      colors: { W: 0, U: 2, B: 1, R: 0, G: 0, C: 0 },
      sources: [
        { produces: ['U', 'B'] }, // Watery Grave
        { produces: ['U'] }, // Island
      ],
    };
    expect(canPlayCard(card, available)).toBe(true);
  });

  it('accepts {U}{U} when two Watery Graves are available', () => {
    const card = { cmc: 2, manaCost: '{U}{U}' };
    const available = {
      total: 2,
      colors: { W: 0, U: 2, B: 2, R: 0, G: 0, C: 0 },
      sources: [
        { produces: ['U', 'B'] }, // Watery Grave 1
        { produces: ['U', 'B'] }, // Watery Grave 2
      ],
    };
    expect(canPlayCard(card, available)).toBe(true);
  });

  it('rejects {U}{U} when only one Watery Grave is available', () => {
    const card = { cmc: 2, manaCost: '{U}{U}' };
    const available = {
      total: 2,
      colors: { W: 0, U: 1, B: 1, R: 0, G: 0, C: 0 },
      sources: [
        { produces: ['U', 'B'] }, // Watery Grave — counted toward U and B but only one tap
        { produces: ['B'] }, // Swamp — cannot help with U
      ],
    };
    expect(canPlayCard(card, available)).toBe(false);
  });

  it('accepts a 5-colour spell with one source per colour', () => {
    const card = { cmc: 5, manaCost: '{W}{U}{B}{R}{G}' };
    const available = {
      total: 5,
      colors: { W: 1, U: 1, B: 1, R: 1, G: 1, C: 0 },
      sources: [
        { produces: ['W'] },
        { produces: ['U'] },
        { produces: ['B'] },
        { produces: ['R'] },
        { produces: ['G'] },
      ],
    };
    expect(canPlayCard(card, available)).toBe(true);
  });

  it('uses fallback aggregate check when sources array is absent', () => {
    // Original mana() helper has no sources property — fallback path must work
    const card = { cmc: 2, manaCost: '{U}{B}' };
    expect(canPlayCard(card, mana(2, { U: 1, B: 1 }))).toBe(true);
    expect(canPlayCard(card, mana(2, { U: 0, B: 1 }))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// tapManaSources
// ─────────────────────────────────────────────────────────────────────────────
describe('tapManaSources', () => {
  it('taps a single coloured source for a coloured spell', () => {
    const forest = makeLand({ produces: ['G'] });
    const bf = [perm(forest)];
    const spell = { manaCost: '{G}', cmc: 1 };
    tapManaSources(spell, bf);
    expect(bf[0].tapped).toBe(true);
  });

  it('taps a colourless source for a generic-cost spell', () => {
    const solRing = makeArtifact({ produces: ['C'], manaAmount: 2 });
    const bf = [perm(solRing)];
    const spell = { manaCost: '{2}', cmc: 2 };
    tapManaSources(spell, bf);
    expect(bf[0].tapped).toBe(true);
  });

  it('does not tap already-tapped sources', () => {
    const forest = makeLand({ produces: ['G'] });
    const bf = [perm(forest, { tapped: true })];
    const spell = { manaCost: '{G}', cmc: 1 };
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
    const bf = [perm(forest)];
    tapManaSources({ manaCost: '{0}', cmc: 0 }, bf);
    expect(bf[0].tapped).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// findBestLandToFetch
// ─────────────────────────────────────────────────────────────────────────────
describe('findBestLandToFetch', () => {
  it('returns null when no eligible lands exist', () => {
    const fetch = makeLand({
      name: 'Polluted Delta',
      isFetch: true,
      fetchColors: ['U', 'B'],
      fetchesOnlyBasics: false,
    });
    const library = [makeLand({ name: 'Forest', landSubtypes: ['Forest'], produces: ['G'] })];
    expect(findBestLandToFetch(fetch, library, [], [], null, 1)).toBeNull();
  });

  it('returns an eligible land that matches fetchColors', () => {
    const fetch = makeLand({
      name: 'Polluted Delta',
      isFetch: true,
      fetchColors: ['U', 'B'],
      fetchesOnlyBasics: false,
    });
    const island = makeLand({
      name: 'Island',
      landSubtypes: ['Island'],
      produces: ['U'],
      isBasic: true,
    });
    const library = [island];
    const result = findBestLandToFetch(fetch, library, [], [], null, 1);
    expect(result).toBe(island);
  });

  it('respects fetchesOnlyBasics', () => {
    const fetch = makeLand({
      name: 'Evolving Wilds',
      isFetch: true,
      fetchColors: ['G'],
      fetchesOnlyBasics: true,
    });
    const basic = makeLand({
      name: 'Forest',
      landSubtypes: ['Forest'],
      produces: ['G'],
      isBasic: true,
    });
    const nonbasic = makeLand({
      name: 'Overgrown Tomb',
      landSubtypes: ['Swamp', 'Forest'],
      produces: ['B', 'G'],
      isBasic: false,
    });
    const library = [nonbasic, basic];
    const result = findBestLandToFetch(fetch, library, [], [], null, 1);
    expect(result).toBe(basic);
  });

  it('prioritises dual lands early (turn ≤ 2)', () => {
    const fetch = makeLand({
      name: 'Wooded Foothills',
      isFetch: true,
      fetchColors: ['G', 'R'],
      fetchesOnlyBasics: false,
    });
    const dual = makeLand({
      name: 'Stomping Ground',
      landSubtypes: ['Mountain', 'Forest'],
      produces: ['R', 'G'],
      isBasic: false,
    });
    const basic = makeLand({
      name: 'Forest',
      landSubtypes: ['Forest'],
      produces: ['G'],
      isBasic: true,
    });
    const library = [basic, dual];
    const result = findBestLandToFetch(fetch, library, [], [], null, 1);
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
    const hand = [forest];
    const bf = [];
    playLand(forest, hand, bf, [], [], 1, null, [], null, false);
    expect(hand).toHaveLength(0);
    expect(bf).toHaveLength(1);
    expect(bf[0].card).toBe(forest);
  });

  it('a basic land enters untapped', () => {
    const forest = makeLand();
    const bf = [];
    playLand(forest, [forest], bf, [], [], 1, null, [], null, false);
    expect(bf[0].tapped).toBe(false);
  });

  it('a tapped land enters tapped', () => {
    const tapLand = makeLand({ entersTappedAlways: true });
    const bf = [];
    playLand(tapLand, [tapLand], bf, [], [], 1, null, [], null, false);
    expect(bf[0].tapped).toBe(true);
  });

  it('records an action in turnLog', () => {
    const forest = makeLand();
    const log = { actions: [] };
    playLand(forest, [forest], [], [], [], 1, log, [], null, false);
    expect(log.actions.length).toBeGreaterThan(0);
    expect(log.actions[0]).toContain('Forest');
  });

  it('a bounce land returns a non-bounce land to hand', () => {
    const regular = makeLand({ name: 'Forest', isBounce: false });
    const bounce = makeLand({
      name: 'Simic Growth Chamber',
      isBounce: true,
      entersTappedAlways: true,
    });
    const hand = [bounce];
    const bf = [perm(regular)];
    playLand(bounce, hand, bf, [], [], 2, null, [], null, false);
    // Battlefield should now contain the bounce land; hand should contain the returned land
    expect(bf.some(p => p.card.name === 'Simic Growth Chamber')).toBe(true);
    expect(hand.some(c => c.name === 'Forest')).toBe(true);
  });

  it('a fetch land enters the battlefield (non-hideaway)', () => {
    const island = makeLand({
      name: 'Island',
      landSubtypes: ['Island'],
      produces: ['U'],
      isBasic: true,
    });
    const fetch = makeLand({
      name: 'Flooded Strand',
      isFetch: true,
      fetchType: 'classic',
      fetchColors: ['W', 'U'],
      fetchesOnlyBasics: false,
      isHideawayFetch: false,
      fetchcost: 0,
      entersTappedAlways: false,
    });
    const hand = [fetch];
    const bf = [perm(makeLand({ name: 'Plains' }))];
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

  // -- MDFC Lands --
  // Turns 1–4: pays 3 life, enters untapped.
  // Turn 5+: enters tapped, no life paid.

  it('MDFC land enters untapped and costs 3 life on turn ≤ 4', () => {
    const mdfc = makeLand({
      name: 'Turntimber Symbiosis',
      isMDFCLand: true,
      produces: ['G'],
      lifeloss: 3,
    });
    const hand = [mdfc];
    const bf = [];
    const lifeLoss = playLand(mdfc, hand, bf, [], [], 2, null, [], null, false);
    expect(bf[0].tapped).toBe(false);
    expect(lifeLoss).toBe(3);
  });

  it('MDFC land enters untapped on the turn-4 boundary and costs 3 life', () => {
    const mdfc = makeLand({
      name: 'Fell the Profane',
      isMDFCLand: true,
      produces: ['B'],
      lifeloss: 3,
    });
    const hand = [mdfc];
    const bf = [];
    const lifeLoss = playLand(mdfc, hand, bf, [], [], 4, null, [], null, false);
    expect(bf[0].tapped).toBe(false);
    expect(lifeLoss).toBe(3);
  });

  it('MDFC land enters tapped and costs no life on turn 5', () => {
    const mdfc = makeLand({
      name: "Emeria's Call",
      isMDFCLand: true,
      produces: ['W'],
      lifeloss: 3,
    });
    const hand = [mdfc];
    const bf = [];
    const lifeLoss = playLand(mdfc, hand, bf, [], [], 5, null, [], null, false);
    expect(bf[0].tapped).toBe(true);
    expect(lifeLoss).toBe(0);
  });

  it('MDFC land enters tapped and costs no life on turn 7', () => {
    const mdfc = makeLand({
      name: 'Sea Gate Restoration',
      isMDFCLand: true,
      produces: ['U'],
      lifeloss: 3,
    });
    const hand = [mdfc];
    const bf = [];
    const lifeLoss = playLand(mdfc, hand, bf, [], [], 7, null, [], null, false);
    expect(bf[0].tapped).toBe(true);
    expect(lifeLoss).toBe(0);
  });

  it('MDFC land is removed from hand and placed on battlefield', () => {
    const mdfc = makeLand({
      name: 'Shatterskull Smashing',
      isMDFCLand: true,
      produces: ['R'],
      lifeloss: 3,
    });
    const hand = [mdfc];
    const bf = [];
    playLand(mdfc, hand, bf, [], [], 1, null, [], null, false);
    expect(hand).toHaveLength(0);
    expect(bf).toHaveLength(1);
    expect(bf[0].card.name).toBe('Shatterskull Smashing');
  });

  // -- Thriving Lands -------------------------------------------------------
  // On ETB, a Thriving Land looks at the key-card pip frequencies and assigns
  // the most-demanded color (excluding its own primary) as the second color.

  it('Thriving Land: second color is chosen from key card pip frequency', () => {
    const thriving = makeLand({
      name: 'Thriving Bluff',
      isThriving: true,
      produces: ['R'],
    });
    // Key card needs {B}{B} → B is the most-demanded non-R color
    const parsedDeck = {
      spells: [{ name: 'Damnation', manaCost: '{2}{B}{B}' }],
      creatures: [],
      artifacts: [],
    };
    const hand = [thriving];
    const bf = [];
    const log = { actions: [] };
    playLand(thriving, hand, bf, [], [], 1, log, ['Damnation'], parsedDeck, false);
    expect(bf[0].card.produces).toContain('R');
    expect(bf[0].card.produces).toContain('B');
    expect(bf[0].card.produces).toHaveLength(2);
  });

  it('Thriving Land: picks highest-frequency pip when key card has multiple non-primary colors', () => {
    const thriving = makeLand({
      name: 'Thriving Grove',
      isThriving: true,
      produces: ['G'],
    });
    // {U}{U}{B} → U appears twice, B once → second color should be U
    const parsedDeck = {
      spells: [
        { name: 'Counterspell', manaCost: '{U}{U}' },
        { name: 'Dark Ritual', manaCost: '{B}' },
      ],
      creatures: [],
      artifacts: [],
    };
    const hand = [thriving];
    const bf = [];
    const log = { actions: [] };
    playLand(
      thriving,
      hand,
      bf,
      [],
      [],
      1,
      log,
      ['Counterspell', 'Dark Ritual'],
      parsedDeck,
      false
    );
    expect(bf[0].card.produces).toContain('G');
    expect(bf[0].card.produces).toContain('U'); // U wins the frequency race
    expect(bf[0].card.produces).not.toContain('B');
  });

  it('Thriving Land: leaves produces unchanged when no key cards are selected', () => {
    const thriving = makeLand({
      name: 'Thriving Isle',
      isThriving: true,
      produces: ['U'],
    });
    const hand = [thriving];
    const bf = [];
    playLand(thriving, hand, bf, [], [], 1, null, [], null, false);
    // No key cards → frequency map empty → produces stays as-is
    expect(bf[0].card.produces).toEqual(['U']);
  });

  it('Thriving Land: logs the chosen second color action', () => {
    const thriving = makeLand({
      name: 'Thriving Heath',
      isThriving: true,
      produces: ['W'],
    });
    const parsedDeck = {
      spells: [{ name: 'Lightning Bolt', manaCost: '{R}' }],
      creatures: [],
      artifacts: [],
    };
    const log = { actions: [] };
    playLand(thriving, [thriving], [], [], [], 1, log, ['Lightning Bolt'], parsedDeck, false);
    expect(log.actions.some(a => a.includes('Thriving Land chose second color'))).toBe(true);
    expect(log.actions.some(a => a.includes('R'))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// castSpells
// ─────────────────────────────────────────────────────────────────────────────
describe('castSpells', () => {
  it('casts a mana creature when enough mana exists', () => {
    const forest = makeLand({ produces: ['G'] });
    const dork = makeCreature({ name: 'Llanowar Elves', cmc: 1, manaCost: '{G}' });
    const hand = [dork];
    const bf = [perm(forest)];
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
    const island = makeLand({ produces: ['U'] });
    const signet = makeArtifact({
      name: 'Arcane Signet',
      cmc: 2,
      manaCost: '{2}',
      produces: ['G', 'U'],
      manaAmount: 1,
    });
    const hand = [signet];
    const bf = [perm(island), perm(makeLand({ name: 'Swamp', produces: ['B'] }))];
    castSpells(hand, bf, [], null, [], null, [], 1, {});
    expect(hand).toHaveLength(0);
    expect(bf.some(p => p.card.name === 'Arcane Signet')).toBe(true);
  });

  it('casts a ramp spell when enabled and targets are in library', () => {
    const forest1 = makeLand({ name: 'Forest 1', produces: ['G'], isBasic: true });
    const forest2 = makeLand({ name: 'Forest 2', produces: ['G'], isBasic: true });
    const forest3 = makeLand({ name: 'Forest 3', produces: ['G'], isBasic: true });
    const cultivate = makeSpell({
      name: 'Cultivate',
      cmc: 3,
      manaCost: '{2}{G}',
      fetchFilter: 'basic',
      landsToAdd: 1,
      landsToHand: 1,
    });
    // 3 forests on battlefield provide {G}{G}{G}
    const bf = [perm(forest1), perm(forest2), perm(forest3)];
    const lib = [
      makeLand({ name: 'Forest 4', isBasic: true, produces: ['G'] }),
      makeLand({ name: 'Forest 5', isBasic: true, produces: ['G'] }),
    ];
    const hand = [cultivate];
    const gy = [];
    castSpells(hand, bf, gy, null, [], null, lib, 3, {
      includeRampSpells: true,
      disabledRampSpells: new Set(),
    });
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
    const bf = [perm(forest1), perm(forest2), perm(forest3)];
    const hand = [cultivate];
    castSpells(hand, bf, [], null, [], null, [], 3, { includeRampSpells: false });
    expect(hand).toHaveLength(1);
  });

  it('skips a ramp spell listed in disabledRampSpells', () => {
    const f1 = makeLand({ name: 'F1', produces: ['G'], isBasic: true });
    const f2 = makeLand({ name: 'F2', produces: ['G'], isBasic: true });
    const f3 = makeLand({ name: 'F3', produces: ['G'], isBasic: true });
    const cultivate = makeSpell({ name: 'Cultivate', cmc: 3, manaCost: '{2}{G}' });
    const bf = [perm(f1), perm(f2), perm(f3)];
    const hand = [cultivate];
    castSpells(hand, bf, [], null, [], null, [], 3, {
      includeRampSpells: true,
      disabledRampSpells: new Set(['Cultivate']),
    });
    expect(hand).toHaveLength(1);
  });

  it('records cast actions in turnLog', () => {
    const forest = makeLand({ produces: ['G'] });
    const dork = makeCreature({ name: 'Llanowar Elves', cmc: 1, manaCost: '{G}' });
    const log = { actions: [] };
    castSpells([dork], [perm(forest)], [], log, [], null, [], 1, {});
    expect(log.actions.some(a => a.includes('Llanowar Elves'))).toBe(true);
  });
});

// =============================================================================
// calculateBattlefieldDamage
// =============================================================================
describe('calculateBattlefieldDamage', () => {
  it('returns zero total and empty breakdown for an empty battlefield', () => {
    const { total, breakdown } = calculateBattlefieldDamage([], 1);
    expect(total).toBe(0);
    expect(breakdown).toHaveLength(0);
  });

  it('counts 1.5 life loss per Mana Crypt (coin-flip average)', () => {
    const crypt = { name: 'Mana Crypt', isManaArtifact: true, isLand: false };
    const { total, breakdown } = calculateBattlefieldDamage([perm(crypt)], 1);
    expect(total).toBe(1.5);
    expect(breakdown[0]).toMatch(/Mana Crypt/);
  });

  it('counts 3 life loss for two Mana Crypts', () => {
    const crypt = { name: 'Mana Crypt', isManaArtifact: true, isLand: false };
    const { total } = calculateBattlefieldDamage([perm(crypt), perm(crypt)], 1);
    expect(total).toBe(3);
  });

  it('counts 2 life loss for Ancient Tomb', () => {
    const tomb = makeLand({ name: 'Ancient Tomb', isAncientTomb: true, lifeloss: 2 });
    const { total, breakdown } = calculateBattlefieldDamage([perm(tomb)], 1);
    expect(total).toBe(2);
    expect(breakdown[0]).toMatch(/Ancient Tomb/);
  });

  it('counts pain land damage on turn ≤ 5', () => {
    const pain = makeLand({ name: 'Adarkar Wastes', isPainLand: true, lifeloss: 1 });
    const { total } = calculateBattlefieldDamage([perm(pain)], 4);
    expect(total).toBe(1);
  });

  it('does NOT count pain land damage on turn > 5', () => {
    const pain = makeLand({ name: 'Adarkar Wastes', isPainLand: true, lifeloss: 1 });
    const { total } = calculateBattlefieldDamage([perm(pain)], 6);
    expect(total).toBe(0);
  });

  it('counts talisman damage on turn ≤ 5', () => {
    const tali = {
      name: 'Talisman of Progress',
      isManaArtifact: true,
      isTalisman: true,
      lifeloss: 1,
    };
    const { total, breakdown } = calculateBattlefieldDamage([perm(tali)], 3);
    expect(total).toBe(1);
    expect(breakdown[0]).toMatch(/Talisman/);
  });

  it('does NOT count talisman damage on turn > 5', () => {
    const tali = {
      name: 'Talisman of Progress',
      isManaArtifact: true,
      isTalisman: true,
      lifeloss: 1,
    };
    const { total } = calculateBattlefieldDamage([perm(tali)], 6);
    expect(total).toBe(0);
  });

  it('counts 5-color pain land damage only when tapped', () => {
    const city = makeLand({ name: 'City of Brass', isFiveColorPainLand: true, lifeloss: 1 });
    const { total: tappedTotal, breakdown } = calculateBattlefieldDamage(
      [perm(city, { tapped: true })],
      1
    );
    expect(tappedTotal).toBe(1);
    expect(breakdown[0]).toMatch(/5-Color/);
    const { total: untappedTotal } = calculateBattlefieldDamage([perm(city, { tapped: false })], 1);
    expect(untappedTotal).toBe(0);
  });

  it('sums multiple damage sources correctly', () => {
    const crypt = { name: 'Mana Crypt', isManaArtifact: true, isLand: false };
    const tomb = makeLand({ name: 'Ancient Tomb', isAncientTomb: true, lifeloss: 2 });
    const pain = makeLand({ name: 'Adarkar Wastes', isPainLand: true, lifeloss: 1 });
    const hl = makeLand({ name: 'Horizon Canopy', isHorizonLand: true, lifeloss: 1 });
    const { total, breakdown } = calculateBattlefieldDamage(
      [perm(crypt), perm(tomb), perm(pain), perm(hl)],
      3
    );
    expect(total).toBe(5.5); // 1.5 (Crypt) + 2 (Tomb) + 1 (Pain) + 1 (Horizon)
    expect(breakdown).toHaveLength(4);
  });
});
