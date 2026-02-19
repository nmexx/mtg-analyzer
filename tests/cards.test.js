/**
 * Card Archive — Unit Tests
 *
 * Covers all six Card_Archive data files:
 *   Mana_Dorks.js         → MANA_DORK_DATA
 *   Artifacts.js          → ARTIFACT_DATA
 *   Ramp_Spells.js        → RAMP_SPELL_DATA
 *   Fetch_Lands.js        → FETCH_LAND_DATA
 *   Rituals.js            → RITUAL_DATA
 *   Exploration_Effects.js → EXPLORATION_EFFECTS
 *   Lands.js              → LANDS_JSON (default export)
 *
 * Run:  npm test
 * Watch: npm run test:watch
 */

import { describe, it, expect } from 'vitest';
import { MANA_DORK_DATA } from '../Card_Archive/Mana_Dorks.js';
import {
  ARTIFACT_DATA,
  SIMPLIFY_MOX_CONDITIONS,
  MOX_PRIORITY_ARTIFACTS,
  BURST_MANA_SOURCES,
} from '../Card_Archive/Artifacts.js';
import { RAMP_SPELL_DATA } from '../Card_Archive/Ramp_Spells.js';
import { FETCH_LAND_DATA } from '../Card_Archive/Fetch_Lands.js';
import { RITUAL_DATA } from '../Card_Archive/Rituals.js';
import { EXPLORATION_EFFECTS } from '../Card_Archive/Exploration_Effects.js';
import LANDS_JSON from '../Card_Archive/Lands.js';

const VALID_COLORS = new Set(['W', 'U', 'B', 'R', 'G', 'C']);
const VALID_FETCH_TYPES = new Set([
  'classic',
  'slow',
  'free_slow',
  'mana_cost',
  'auto_sacrifice',
  'colorless_or_fetch',
  'colorless_or_cycle_fetch',
  'trigger',
  'saga_any',
]);

// ─────────────────────────────────────────────────────────────────────────────
// MANA_DORK_DATA
// ─────────────────────────────────────────────────────────────────────────────
describe('Mana_Dorks — structural integrity', () => {
  it('every entry has manaAmount > 0, produces array with valid symbols', () => {
    for (const [name, data] of MANA_DORK_DATA) {
      expect(typeof data.manaAmount, `${name}: manaAmount type`).toBe('number');
      expect(data.manaAmount, `${name}: manaAmount > 0`).toBeGreaterThan(0);
      expect(Array.isArray(data.produces), `${name}: produces is array`).toBe(true);
      expect(data.produces.length, `${name}: produces not empty`).toBeGreaterThan(0);
      for (const color of data.produces) {
        expect(VALID_COLORS.has(color), `${name}: unknown color symbol "${color}"`).toBe(true);
      }
    }
  });

  it('all keys are lowercase', () => {
    for (const key of MANA_DORK_DATA.keys()) {
      expect(key, `key "${key}" should be lowercase`).toBe(key.toLowerCase());
    }
  });
});

describe('Mana_Dorks — known card values', () => {
  it('Birds of Paradise → any single color', () => {
    const d = MANA_DORK_DATA.get('birds of paradise');
    expect(d).toBeDefined();
    expect(d.manaAmount).toBe(1);
    expect(d.produces).toEqual(['W', 'U', 'B', 'R', 'G']);
  });

  it('Noble Hierarch → G, W, U (Bant)', () => {
    const d = MANA_DORK_DATA.get('noble hierarch');
    expect(d.produces).toContain('G');
    expect(d.produces).toContain('W');
    expect(d.produces).toContain('U');
    expect(d.produces).not.toContain('B');
    expect(d.produces).not.toContain('R');
  });

  it("Avacyn's Pilgrim → W only", () => {
    const d = MANA_DORK_DATA.get("avacyn's pilgrim");
    expect(d.produces).toEqual(['W']);
  });

  it('Palladium Myr → 2 colorless', () => {
    const d = MANA_DORK_DATA.get('palladium myr');
    expect(d.manaAmount).toBe(2);
    expect(d.produces).toEqual(['C']);
  });

  it('Boreal Druid → colorless only', () => {
    const d = MANA_DORK_DATA.get('boreal druid');
    expect(d.produces).toEqual(['C']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ARTIFACT_DATA
// ─────────────────────────────────────────────────────────────────────────────
describe('Artifacts — structural integrity', () => {
  it('every entry has required fields with valid types', () => {
    for (const [name, data] of ARTIFACT_DATA) {
      expect(typeof data.manaAmount, `${name}: manaAmount type`).toBe('number');
      expect(data.manaAmount, `${name}: manaAmount > 0`).toBeGreaterThan(0);
      expect(Array.isArray(data.produces), `${name}: produces is array`).toBe(true);
      expect(data.produces.length, `${name}: produces not empty`).toBeGreaterThan(0);
      expect(typeof data.entersTapped, `${name}: entersTapped type`).toBe('boolean');
      for (const color of data.produces) {
        expect(VALID_COLORS.has(color), `${name}: unknown color "${color}"`).toBe(true);
      }
    }
  });

  it('all keys are lowercase', () => {
    for (const key of ARTIFACT_DATA.keys()) {
      expect(key, `key "${key}" should be lowercase`).toBe(key.toLowerCase());
    }
  });

  it('ETB-tapped artifacts: diamonds and specific rocks are tapped', () => {
    const tappedRocks = [
      'marble diamond',
      'sky diamond',
      'charcoal diamond',
      'fire diamond',
      'moss diamond',
      'coldsteel heart',
      'fractured powerstone',
      'nyx lotus',
    ];
    for (const name of tappedRocks) {
      const d = ARTIFACT_DATA.get(name);
      expect(d, `${name} should exist`).toBeDefined();
      expect(d.entersTapped, `${name} should enter tapped`).toBe(true);
    }
  });

  it('fast mana artifacts enter untapped', () => {
    const fastMana = [
      'mana crypt',
      'sol ring',
      'mox diamond',
      'chrome mox',
      'mox opal',
      'mox amber',
      'lotus petal',
      'jeweled lotus',
    ];
    for (const name of fastMana) {
      const d = ARTIFACT_DATA.get(name);
      expect(d, `${name} should exist`).toBeDefined();
      expect(d.entersTapped, `${name} should enter untapped`).toBe(false);
    }
  });
});

describe('Artifacts — known card values', () => {
  it('Mana Crypt → 2 colorless, doesnt untap naturally = false', () => {
    const d = ARTIFACT_DATA.get('mana crypt');
    expect(d.manaAmount).toBe(2);
    expect(d.produces).toEqual(['C']);
    expect(d.doesntUntapNaturally ?? false).toBe(false);
  });

  it('Mana Vault → 3 colorless, doesnt untap naturally = true', () => {
    const d = ARTIFACT_DATA.get('mana vault');
    expect(d.manaAmount).toBe(3);
    expect(d.doesntUntapNaturally).toBe(true);
  });

  it("Lion's Eye Diamond → 3 any color, discards hand on ETB", () => {
    const d = ARTIFACT_DATA.get("lion's eye diamond");
    expect(d.manaAmount).toBe(3);
    expect(d.etbCost).toBe('discardHand');
  });

  it('Mox Diamond → 1 any color, discards land on ETB', () => {
    const d = ARTIFACT_DATA.get('mox diamond');
    expect(d.etbCost).toBe('discardLand');
  });

  it('Chrome Mox → imprints a nonland card', () => {
    const d = ARTIFACT_DATA.get('chrome mox');
    expect(d.etbCost).toBe('imprintNonland');
  });

  it('Mox Opal → metalcraft condition', () => {
    const d = ARTIFACT_DATA.get('mox opal');
    expect(d.condition).toBe('metalcraft');
  });

  it('Mox Amber → legendary condition', () => {
    const d = ARTIFACT_DATA.get('mox amber');
    expect(d.condition).toBe('legendary');
  });

  it('all 10 Guilds signets cover: manaAmount=1, not tapped', () => {
    const signets = [
      ['azorius signet', ['W', 'U']],
      ['dimir signet', ['U', 'B']],
      ['rakdos signet', ['B', 'R']],
      ['gruul signet', ['R', 'G']],
      ['selesnya signet', ['G', 'W']],
      ['orzhov signet', ['W', 'B']],
      ['izzet signet', ['U', 'R']],
      ['golgari signet', ['B', 'G']],
      ['boros signet', ['R', 'W']],
      ['simic signet', ['G', 'U']],
    ];
    for (const [name, colors] of signets) {
      const d = ARTIFACT_DATA.get(name);
      expect(d, `${name} missing`).toBeDefined();
      expect(d.manaAmount).toBe(1);
      expect(d.entersTapped).toBe(false);
      expect(d.produces).toEqual(colors);
    }
  });

  it('Gilded Lotus → 3 any color', () => {
    const d = ARTIFACT_DATA.get('gilded lotus');
    expect(d.manaAmount).toBe(3);
    expect(d.produces).toEqual(['W', 'U', 'B', 'R', 'G']);
  });

  it('all Talismans include C as a produce option', () => {
    const talismans = [
      'talisman of progress',
      'talisman of dominance',
      'talisman of indulgence',
      'talisman of impulse',
      'talisman of unity',
      'talisman of hierarchy',
      'talisman of creativity',
      'talisman of resilience',
      'talisman of conviction',
      'talisman of curiosity',
    ];
    for (const name of talismans) {
      const d = ARTIFACT_DATA.get(name);
      expect(d, `${name} missing`).toBeDefined();
      expect(d.produces, `${name} should include C`).toContain('C');
    }
  });
});

describe('Artifacts — exported constants', () => {
  it('SIMPLIFY_MOX_CONDITIONS is a boolean', () => {
    expect(typeof SIMPLIFY_MOX_CONDITIONS).toBe('boolean');
  });

  it('MOX_PRIORITY_ARTIFACTS contains the 4 Mox variants', () => {
    expect(MOX_PRIORITY_ARTIFACTS.has('mox diamond')).toBe(true);
    expect(MOX_PRIORITY_ARTIFACTS.has('chrome mox')).toBe(true);
    expect(MOX_PRIORITY_ARTIFACTS.has('mox opal')).toBe(true);
    expect(MOX_PRIORITY_ARTIFACTS.has('mox amber')).toBe(true);
  });

  it('BURST_MANA_SOURCES contains LED, Jeweled Lotus, and Lotus Petal', () => {
    expect(BURST_MANA_SOURCES.has("lion's eye diamond")).toBe(true);
    expect(BURST_MANA_SOURCES.has('jeweled lotus')).toBe(true);
    expect(BURST_MANA_SOURCES.has('lotus petal')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RAMP_SPELL_DATA
// ─────────────────────────────────────────────────────────────────────────────
describe('Ramp_Spells — structural integrity', () => {
  const VALID_FILTERS = new Set(['any', 'basic', 'subtype', 'snow']);

  it('every entry has required fields with valid values', () => {
    for (const [name, data] of RAMP_SPELL_DATA) {
      expect(typeof data.landsToAdd, `${name}: landsToAdd type`).toBe('number');
      expect(data.landsToAdd, `${name}: landsToAdd > 0`).toBeGreaterThan(0);
      expect(typeof data.landsTapped, `${name}: landsTapped type`).toBe('boolean');
      expect(typeof data.landsToHand, `${name}: landsToHand type`).toBe('number');
      expect(typeof data.sacrificeLand, `${name}: sacrificeLand type`).toBe('boolean');
      expect(
        VALID_FILTERS.has(data.fetchFilter),
        `${name}: invalid fetchFilter "${data.fetchFilter}"`
      ).toBe(true);
      // subtype filter must have a non-empty fetchSubtypes array
      if (data.fetchFilter === 'subtype') {
        expect(Array.isArray(data.fetchSubtypes), `${name}: fetchSubtypes array`).toBe(true);
        expect(data.fetchSubtypes.length, `${name}: fetchSubtypes not empty`).toBeGreaterThan(0);
      }
    }
  });

  it('all keys are lowercase', () => {
    for (const key of RAMP_SPELL_DATA.keys()) {
      expect(key).toBe(key.toLowerCase());
    }
  });
});

describe('Ramp_Spells — known card values', () => {
  it("Nature's Lore → 1 Forest subtype, untapped", () => {
    const d = RAMP_SPELL_DATA.get("nature's lore");
    expect(d.landsToAdd).toBe(1);
    expect(d.landsTapped).toBe(false);
    expect(d.fetchFilter).toBe('subtype');
    expect(d.fetchSubtypes).toContain('Forest');
  });

  it('Farseek → Plains/Island/Swamp/Mountain subtypes, tapped', () => {
    const d = RAMP_SPELL_DATA.get('farseek');
    expect(d.landsTapped).toBe(true);
    expect(d.fetchFilter).toBe('subtype');
    expect(d.fetchSubtypes).toContain('Plains');
    expect(d.fetchSubtypes).toContain('Island');
    expect(d.fetchSubtypes).toContain('Swamp');
    expect(d.fetchSubtypes).toContain('Mountain');
    expect(d.fetchSubtypes).not.toContain('Forest');
  });

  it('Cultivate → 1 basic tapped to battlefield + 1 to hand', () => {
    const d = RAMP_SPELL_DATA.get('cultivate');
    expect(d.landsToAdd).toBe(1);
    expect(d.landsTapped).toBe(true);
    expect(d.landsToHand).toBe(1);
    expect(d.fetchFilter).toBe('basic');
  });

  it("Kodama's Reach matches Cultivate profile", () => {
    const c = RAMP_SPELL_DATA.get('cultivate');
    const k = RAMP_SPELL_DATA.get("kodama's reach");
    expect(k).toEqual(c);
  });

  it('Skyshroud Claim → 2 Forest subtypes, untapped', () => {
    const d = RAMP_SPELL_DATA.get('skyshroud claim');
    expect(d.landsToAdd).toBe(2);
    expect(d.landsTapped).toBe(false);
    expect(d.fetchFilter).toBe('subtype');
    expect(d.fetchSubtypes).toContain('Forest');
  });

  it('Harrow → sacrifice land, fetch 2 basics untapped', () => {
    const d = RAMP_SPELL_DATA.get('harrow');
    expect(d.sacrificeLand).toBe(true);
    expect(d.landsToAdd).toBe(2);
    expect(d.landsTapped).toBe(false);
    expect(d.fetchFilter).toBe('basic');
  });

  it('Reshape the Earth → 10 any lands', () => {
    const d = RAMP_SPELL_DATA.get('reshape the earth');
    expect(d.landsToAdd).toBe(10);
    expect(d.fetchFilter).toBe('any');
  });

  it('Into the North → snow filter', () => {
    const d = RAMP_SPELL_DATA.get('into the north');
    expect(d.fetchFilter).toBe('snow');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FETCH_LAND_DATA
// ─────────────────────────────────────────────────────────────────────────────
describe('Fetch_Lands — structural integrity', () => {
  it('every entry has required fields with valid types', () => {
    for (const [name, data] of FETCH_LAND_DATA) {
      expect(
        VALID_FETCH_TYPES.has(data.fetchType),
        `${name}: unknown fetchType "${data.fetchType}"`
      ).toBe(true);
      expect(Array.isArray(data.fetchColors), `${name}: fetchColors is array`).toBe(true);
      expect(data.fetchColors.length, `${name}: fetchColors not empty`).toBeGreaterThan(0);
      expect(typeof data.fetchesOnlyBasics, `${name}: fetchesOnlyBasics type`).toBe('boolean');
      expect(typeof data.fetchesTwoLands, `${name}: fetchesTwoLands type`).toBe('boolean');
      expect(typeof data.fetchedLandEntersTapped, `${name}: fetchedLandEntersTapped type`).toBe(
        'boolean'
      );
      expect(typeof data.entersTappedAlways, `${name}: entersTappedAlways type`).toBe('boolean');
      expect(typeof data.fetchcost, `${name}: fetchcost type`).toBe('number');
      for (const color of data.fetchColors) {
        expect(VALID_COLORS.has(color), `${name}: unknown color "${color}"`).toBe(true);
      }
    }
  });

  it('all keys are lowercase', () => {
    for (const key of FETCH_LAND_DATA.keys()) {
      expect(key).toBe(key.toLowerCase());
    }
  });
});

describe('Fetch_Lands — known card values', () => {
  it('all 10 Onslaught/Zendikar fetches are classic, fetchcost=0, untapped', () => {
    const classics = [
      'flooded strand',
      'polluted delta',
      'bloodstained mire',
      'wooded foothills',
      'windswept heath',
      'marsh flats',
      'scalding tarn',
      'verdant catacombs',
      'arid mesa',
      'misty rainforest',
    ];
    for (const name of classics) {
      const d = FETCH_LAND_DATA.get(name);
      expect(d, `${name} missing`).toBeDefined();
      expect(d.fetchType, `${name}: fetchType`).toBe('classic');
      expect(d.fetchcost, `${name}: fetchcost`).toBe(0);
      expect(d.entersTappedAlways, `${name}: entersTappedAlways`).toBe(false);
      expect(d.fetchesOnlyBasics, `${name}: fetchesOnlyBasics`).toBe(false);
    }
  });

  it('all 5 Mirage slow fetches enter tapped', () => {
    const slow = ['flood plain', 'bad river', 'rocky tar pit', 'mountain valley', 'grasslands'];
    for (const name of slow) {
      const d = FETCH_LAND_DATA.get(name);
      expect(d, `${name} missing`).toBeDefined();
      expect(d.fetchType, `${name}: fetchType`).toBe('slow');
      expect(d.entersTappedAlways, `${name}: entersTappedAlways`).toBe(true);
    }
  });

  it('Evolving Wilds and Terramorphic Expanse → free_slow, basics only, fetched land tapped', () => {
    for (const name of ['evolving wilds', 'terramorphic expanse']) {
      const d = FETCH_LAND_DATA.get(name);
      expect(d.fetchType).toBe('free_slow');
      expect(d.fetchesOnlyBasics).toBe(true);
      expect(d.fetchedLandEntersTapped).toBe(true);
    }
  });

  it('Prismatic Vista → classic, basics only', () => {
    const d = FETCH_LAND_DATA.get('prismatic vista');
    expect(d.fetchType).toBe('classic');
    expect(d.fetchesOnlyBasics).toBe(true);
    expect(d.fetchColors).toHaveLength(5);
  });

  it('Myriad Landscape → fetches two lands', () => {
    const d = FETCH_LAND_DATA.get('myriad landscape');
    expect(d.fetchesTwoLands).toBe(true);
  });

  it('all 5 SNC hideaway lands → auto_sacrifice, isHideawayFetch=true', () => {
    const snc = [
      'brokers hideout',
      'obscura storefront',
      'maestros theater',
      'riveteers overlook',
      'cabaretti courtyard',
    ];
    for (const name of snc) {
      const d = FETCH_LAND_DATA.get(name);
      expect(d, `${name} missing`).toBeDefined();
      expect(d.fetchType, `${name}: fetchType`).toBe('auto_sacrifice');
      expect(d.isHideawayFetch, `${name}: isHideawayFetch`).toBe(true);
      expect(d.fetchesOnlyBasics, `${name}: fetchesOnlyBasics`).toBe(true);
    }
  });

  it('Terminal Moraine has fetchcost=2', () => {
    expect(FETCH_LAND_DATA.get('terminal moraine').fetchcost).toBe(2);
  });

  it('Blighted Woodland fetches two lands with fetchcost=4', () => {
    const d = FETCH_LAND_DATA.get('blighted woodland');
    expect(d.fetchesTwoLands).toBe(true);
    expect(d.fetchcost).toBe(4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RITUAL_DATA
// ─────────────────────────────────────────────────────────────────────────────
describe('Rituals — structural integrity', () => {
  it('every entry has manaProduced > 0, integer netGain, and a colors array', () => {
    for (const [name, data] of RITUAL_DATA) {
      expect(typeof data.manaProduced, `${name}: manaProduced type`).toBe('number');
      expect(data.manaProduced, `${name}: manaProduced > 0`).toBeGreaterThan(0);
      expect(typeof data.netGain, `${name}: netGain type`).toBe('number');
      expect(Array.isArray(data.colors), `${name}: colors is array`).toBe(true);
      expect(data.colors.length, `${name}: colors not empty`).toBeGreaterThan(0);
      for (const color of data.colors) {
        expect(VALID_COLORS.has(color), `${name}: unknown color "${color}"`).toBe(true);
      }
    }
  });

  it('all keys are lowercase', () => {
    for (const key of RITUAL_DATA.keys()) {
      expect(key).toBe(key.toLowerCase());
    }
  });

  it('netGain is never negative (ritual must at least break even)', () => {
    for (const [name, data] of RITUAL_DATA) {
      expect(data.netGain, `${name}: netGain should be >= 0`).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('Rituals — known card values', () => {
  it('Dark Ritual → 3 mana, net gain 2, Black', () => {
    const d = RITUAL_DATA.get('dark ritual');
    expect(d.manaProduced).toBe(3);
    expect(d.netGain).toBe(2);
    expect(d.colors).toEqual(['B']);
  });

  it('Seething Song → 5 mana, net gain 2, Red', () => {
    const d = RITUAL_DATA.get('seething song');
    expect(d.manaProduced).toBe(5);
    expect(d.netGain).toBe(2);
    expect(d.colors).toEqual(['R']);
  });

  it("Jeska's Will → 5 mana, net gain 2, Red", () => {
    const d = RITUAL_DATA.get("jeska's will");
    expect(d.manaProduced).toBe(5);
    expect(d.netGain).toBe(2);
  });

  it('Manamorphose → 2 mana, net gain 0, R/G', () => {
    const d = RITUAL_DATA.get('manamorphose');
    expect(d.manaProduced).toBe(2);
    expect(d.netGain).toBe(0);
    expect(d.colors).toContain('R');
    expect(d.colors).toContain('G');
  });

  it('Dramatic Reversal → Blue', () => {
    const d = RITUAL_DATA.get('dramatic reversal');
    expect(d.colors).toEqual(['U']);
  });

  it('Simian Spirit Guide → 1 mana, net gain 1, Red', () => {
    const d = RITUAL_DATA.get('simian spirit guide');
    expect(d).toBeDefined();
    expect(d.manaProduced).toBe(1);
    expect(d.netGain).toBe(1);
    expect(d.colors).toEqual(['R']);
  });

  it('Elvish Spirit Guide → 1 mana, net gain 1, Green', () => {
    const d = RITUAL_DATA.get('elvish spirit guide');
    expect(d).toBeDefined();
    expect(d.manaProduced).toBe(1);
    expect(d.netGain).toBe(1);
    expect(d.colors).toEqual(['G']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EXPLORATION_EFFECTS
// ─────────────────────────────────────────────────────────────────────────────
describe('Exploration_Effects — structural integrity', () => {
  it('is a Set', () => {
    expect(EXPLORATION_EFFECTS instanceof Set).toBe(true);
  });

  it('all entries are lowercase strings', () => {
    for (const name of EXPLORATION_EFFECTS) {
      expect(typeof name).toBe('string');
      expect(name).toBe(name.toLowerCase());
    }
  });

  it('contains no duplicates (Set guarantees this; verify count matches unique items)', () => {
    const arr = [...EXPLORATION_EFFECTS];
    expect(arr.length).toBe(new Set(arr).size);
  });
});

describe('Exploration_Effects — known card membership', () => {
  const mustBePresent = [
    'exploration',
    'fastbond',
    'azusa, lost but seeking',
    'oracle of mul daya',
    'dryad of the ilysian grove',
    'wayward swordtooth',
    'burgeoning',
    'summer bloom',
    'rites of flourishing',
    'mina and denn, wildborn',
  ];

  for (const name of mustBePresent) {
    it(`contains "${name}"`, () => {
      expect(EXPLORATION_EFFECTS.has(name)).toBe(true);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// LANDS_JSON (Lands.js default export)
// ─────────────────────────────────────────────────────────────────────────────
describe('Lands — top-level structure', () => {
  it('has a cycles array', () => {
    expect(Array.isArray(LANDS_JSON.cycles)).toBe(true);
    expect(LANDS_JSON.cycles.length).toBeGreaterThan(0);
  });
});

describe('Lands — structural integrity per cycle', () => {
  it('every cycle has a name, sim_flags, and a non-empty lands array', () => {
    for (const cycle of LANDS_JSON.cycles) {
      expect(typeof cycle.name, `cycle name type`).toBe('string');
      expect(cycle.name.length, `cycle name non-empty`).toBeGreaterThan(0);
      expect(typeof cycle.sim_flags, `${cycle.name}: sim_flags type`).toBe('object');
      expect(Array.isArray(cycle.lands), `${cycle.name}: lands is array`).toBe(true);
      expect(cycle.lands.length, `${cycle.name}: lands not empty`).toBeGreaterThan(0);
    }
  });

  it('every land entry has a name and color_identity array', () => {
    for (const cycle of LANDS_JSON.cycles) {
      for (const land of cycle.lands) {
        expect(typeof land.name, `${land.name}: name type`).toBe('string');
        expect(Array.isArray(land.color_identity), `${land.name}: color_identity array`).toBe(true);
        for (const color of land.color_identity) {
          expect(VALID_COLORS.has(color), `${land.name}: unknown color "${color}"`).toBe(true);
        }
      }
    }
  });

  it('no duplicate land names across all cycles', () => {
    const names = LANDS_JSON.cycles.flatMap(c => c.lands.map(l => l.name.toLowerCase()));
    // Collect duplicates for a readable failure message
    const seen = new Set();
    const duplicates = [];
    for (const n of names) {
      if (seen.has(n)) duplicates.push(n);
      seen.add(n);
    }
    expect(duplicates, `Duplicate land names: ${duplicates.join(', ')}`).toHaveLength(0);
  });
});

describe('Lands — known cycle values', () => {
  const findCycle = name => LANDS_JSON.cycles.find(c => c.name === name);
  const findLand = name => {
    for (const cycle of LANDS_JSON.cycles) {
      const l = cycle.lands.find(l => l.name.toLowerCase() === name.toLowerCase());
      if (l) return { land: l, cycle };
    }
    return null;
  };

  it('Shock Lands cycle has isShockLand flag and lifeloss=2', () => {
    const cycle = findCycle('Shock Lands');
    expect(cycle).toBeDefined();
    expect(cycle.sim_flags.isShockLand).toBe(true);
    expect(cycle.sim_flags.lifeloss).toBe(2);
    expect(cycle.sim_flags.entersTappedAlways).toBe(false);
  });

  it('Original Duals cycle never enters tapped and has basic types', () => {
    const cycle = findCycle('Original Duals (ABUR)');
    expect(cycle).toBeDefined();
    expect(cycle.sim_flags.entersTappedAlways).toBe(false);
    expect(cycle.behavior.has_basic_types).toBe(true);
  });

  it('Hallowed Fountain is in the Shock Lands cycle with W/U identity', () => {
    const result = findLand('Hallowed Fountain');
    expect(result).not.toBeNull();
    expect(result.cycle.name).toBe('Shock Lands');
    expect(result.land.color_identity).toContain('W');
    expect(result.land.color_identity).toContain('U');
  });

  it('Tundra is in the Original Duals cycle with W/U identity', () => {
    const result = findLand('Tundra');
    expect(result?.cycle.name).toBe('Original Duals (ABUR)');
    expect(result?.land.color_identity).toContain('W');
    expect(result?.land.color_identity).toContain('U');
  });

  it('each of the 10 shock lands exists in the Shock Lands cycle', () => {
    const shockLands = [
      'Hallowed Fountain',
      'Watery Grave',
      'Blood Crypt',
      'Stomping Ground',
      'Temple Garden',
      'Godless Shrine',
      'Steam Vents',
      'Overgrown Tomb',
      'Sacred Foundry',
      'Breeding Pool',
    ];
    const cycle = findCycle('Shock Lands');
    const cycleNames = cycle.lands.map(l => l.name);
    for (const name of shockLands) {
      expect(cycleNames, `missing ${name}`).toContain(name);
    }
  });

  it('each of the 10 ABUR duals exists in the Original Duals cycle', () => {
    const duals = [
      'Tundra',
      'Underground Sea',
      'Badlands',
      'Taiga',
      'Savannah',
      'Scrubland',
      'Volcanic Island',
      'Bayou',
      'Plateau',
      'Tropical Island',
    ];
    const cycle = findCycle('Original Duals (ABUR)');
    const cycleNames = cycle.lands.map(l => l.name);
    for (const name of duals) {
      expect(cycleNames, `missing ${name}`).toContain(name);
    }
  });
});
