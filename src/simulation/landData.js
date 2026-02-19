/**
 * landData.js
 *
 * Builds the authoritative LAND_DATA map from Lands.js, then derives all the
 * land-cycle Sets that the simulation engine uses.  Keeping these at module
 * level means they are computed once on import and are importable anywhere
 * without having to thread them through React state.
 */

import LANDS_JSON from '../../Card_Archive/Lands.js';
import { FETCH_LAND_DATA } from '../../Card_Archive/Fetch_Lands.js';

// ─────────────────────────────────────────────────────────────────────────────
// Primary land map  ·  keyed by lowercase name
// ─────────────────────────────────────────────────────────────────────────────
const LAND_DATA = (() => {
  const map = new Map();
  for (const cycle of LANDS_JSON.cycles) {
    const cycleFlags = cycle.sim_flags || {};
    for (const land of cycle.lands) {
      const key = land.name.toLowerCase();
      if (!map.has(key)) {
        const flags = land.sim_flags ? { ...cycleFlags, ...land.sim_flags } : cycleFlags;
        map.set(key, {
          cycleName: cycle.name,
          behavior: cycle.behavior || {},
          sim_flags: flags,
          color_identity: land.color_identity || [],
          types: land.types || land.reveals || [],
        });
      }
    }
  }
  return map;
})();

// ─────────────────────────────────────────────────────────────────────────────
// Helper – collect all land names from LAND_DATA whose sim_flags[flag] is true
// ─────────────────────────────────────────────────────────────────────────────
export const landNamesWithFlag = (flag, value = true) => {
  const names = [];
  for (const [name, entry] of LAND_DATA.entries()) {
    if (entry.sim_flags?.[flag] === value) names.push(name);
  }
  return names;
};

export const landNamesInCycle = cycleName => {
  const names = [];
  for (const [name, entry] of LAND_DATA.entries()) {
    if (entry.cycleName === cycleName) names.push(name);
  }
  return names;
};

// ─────────────────────────────────────────────────────────────────────────────
// Derived Sets  (one per sim_flag)
// ─────────────────────────────────────────────────────────────────────────────
export const KNOWN_FETCH_LANDS = new Set(FETCH_LAND_DATA.keys());
export const LANDS_ENTER_TAPPED_ALWAYS = new Set(landNamesWithFlag('entersTappedAlways'));
export const BOUNCE_LANDS = new Set(landNamesWithFlag('isBounce'));
export const REVEAL_LANDS = new Set(landNamesWithFlag('isReveal'));
export const CHECK_LANDS = new Set(landNamesWithFlag('isCheck'));
export const FAST_LANDS = new Set(landNamesWithFlag('isFast'));
export const PAIN_LANDS = new Set(landNamesWithFlag('isPainLand'));
export const FIVE_COLOR_PAIN_LANDS = new Set(landNamesWithFlag('isFiveColorPainLand'));
export const FILTER_LANDS = new Set(landNamesWithFlag('isFilterLand'));
export const HORIZON_LANDS = new Set(landNamesWithFlag('isHorizonLand'));
export const MAN_LANDS = new Set(landNamesWithFlag('isManLand'));
export const STORAGE_LANDS = new Set(landNamesWithFlag('isStorageLand'));
export const CROWD_LANDS = new Set(landNamesWithFlag('isCrowd'));
export const UTILITY_LANDS_UNTAPPED = new Set(landNamesWithFlag('isUtilityUntapped'));
export const ODYSSEY_FILTER_LANDS = new Set(landNamesWithFlag('isOdysseyFilter'));
export const CONDITIONAL_LIFE_LANDS = new Set(landNamesWithFlag('isConditionalLife'));
export const BATTLE_LANDS = new Set(landNamesWithFlag('isBattleLand'));
export const PATHWAY_LANDS = new Set(landNamesWithFlag('isPathway'));

// ── Scaling / dynamic-mana land sets ────────────────────────────────────────
export const SCALES_WITH_SWAMPS_LANDS = new Set(landNamesWithFlag('scalesWithSwamps'));
export const SCALES_WITH_BASIC_SWAMPS_LANDS = new Set(landNamesWithFlag('scalesWithBasicSwamps'));
export const PHYREXIAN_TOWER_LANDS = new Set(landNamesWithFlag('isPhyrexianTower'));
export const TEMPLE_FALSE_GOD_LANDS = new Set(landNamesWithFlag('isTempleOfFalseGod'));
export const SIMPLIFIED_MANA_LANDS = new Set(landNamesWithFlag('simplified', 'turn-1'));

export const HIDEAWAY_LANDS = new Set([
  ...landNamesWithFlag('isHideawayFetch'),
  ...landNamesInCycle('Hideaway Lands'),
]);

export const SPECIAL_LANDS = new Set(landNamesInCycle('Special Lands'));

export { LAND_DATA, FETCH_LAND_DATA };
export default LAND_DATA;
