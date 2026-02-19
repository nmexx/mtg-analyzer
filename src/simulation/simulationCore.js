/**
 * simulationCore.js
 *
 * Pure simulation primitives: land selection, playing, fetching, spell
 * casting, mana accounting.  No React state is read here; anything that
 * previously came from the component closure is passed as an explicit
 * parameter.
 *
 * API changes vs. the original App.jsx inline versions:
 *   · playLand  – gains `commanderMode` as its last argument
 *   · castSpells – gains `simConfig` as its last argument:
 *       { includeRampSpells, disabledRampSpells }
 */

import { BOUNCE_LANDS } from './landData.js';
import {
  SIMPLIFY_MOX_CONDITIONS,
  MOX_PRIORITY_ARTIFACTS,
  BURST_MANA_SOURCES,
} from '../../Card_Archive/Artifacts.js';

// ─────────────────────────────────────────────────────────────────────────────
// Module-level lookup tables (defined once, reused everywhere)
// ─────────────────────────────────────────────────────────────────────────────

/** Maps a basic-land subtype to its color symbol (used by fetch logic). */
const SUBTYPE_TO_COLOR = { Plains: 'W', Island: 'U', Swamp: 'B', Mountain: 'R', Forest: 'G' };

/** Maps a color symbol to its basic-land subtype name (used by check-land logic). */
const COLOR_TO_SUBTYPE = { W: 'Plains', U: 'Island', B: 'Swamp', R: 'Mountain', G: 'Forest' };

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

export const shuffle = array => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

/** Returns true when a land in the library satisfies a ramp spell's search restriction. */
export const matchesRampFilter = (land, rampSpell) => {
  if (!land.isLand) return false;
  switch (rampSpell.fetchFilter) {
    case 'any':
      return true;
    case 'basic':
      return !!land.isBasic;
    case 'subtype':
      return !!(
        rampSpell.fetchSubtypes &&
        land.landSubtypes &&
        rampSpell.fetchSubtypes.some(t => land.landSubtypes.includes(t))
      );
    case 'snow':
      return !!(land.name && land.name.toLowerCase().includes('snow'));
    default:
      return !!land.isBasic;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// doesLandEnterTapped
// ─────────────────────────────────────────────────────────────────────────────
export const doesLandEnterTapped = (land, battlefield, turn, commanderMode) => {
  if (land.isShockLand) return true;

  if (land.isFast) {
    return battlefield.filter(p => p.card.isLand).length > 2;
  }
  if (land.isBattleLand) {
    return battlefield.filter(p => p.card.isLand && p.card.isBasic).length < 2;
  }
  if (land.isCheck) {
    const needsTypes = land.checkTypes?.length ? [...land.checkTypes] : [];
    if (needsTypes.length === 0) {
      land.produces.forEach(c => {
        if (COLOR_TO_SUBTYPE[c]) needsTypes.push(COLOR_TO_SUBTYPE[c]);
      });
    }
    if (needsTypes.length === 0) return false;
    return !battlefield.some(
      p =>
        p.card.isLand &&
        p.card.landSubtypes &&
        p.card.landSubtypes.some(t => needsTypes.includes(t))
    );
  }
  if (land.isCrowd) {
    return !commanderMode;
  }
  if (land.entersTappedAlways === true) return true;
  if (land.entersTappedAlways === false) return false;
  return false;
};

// ─────────────────────────────────────────────────────────────────────────────
// selectBestLand
// ─────────────────────────────────────────────────────────────────────────────
export const selectBestLand = (hand, battlefield, _library, _turn) => {
  const lands = hand.filter(c => c.isLand);
  if (lands.length === 0) return null;

  const landsWithBouncability = lands.map(land => {
    const isBounceCard = land.isBounce || BOUNCE_LANDS.has(land.name.toLowerCase());
    if (!isBounceCard) return { land, canPlay: true };
    const nonBounceLandsToReturn = battlefield.filter(
      p => p.card.isLand && !p.card.isBounce && !BOUNCE_LANDS.has(p.card.name.toLowerCase())
    );
    return { land, canPlay: nonBounceLandsToReturn.length > 0 };
  });

  const playableLands = landsWithBouncability.filter(i => i.canPlay).map(i => i.land);
  if (playableLands.length === 0) return null;

  const fetches = playableLands.filter(l => l.isFetch && l.fetchType !== 'mana_cost');
  const untappedSources = battlefield.filter(d => d.card.isLand && !d.tapped);
  if (fetches.length > 0 && untappedSources.length >= fetches[0].fetchcost) return fetches[0];

  const untappedNonBounce = playableLands.filter(
    l => !l.entersTappedAlways && !l.isBounce && !BOUNCE_LANDS.has(l.name.toLowerCase())
  );
  if (untappedNonBounce.length > 0) return untappedNonBounce[0];

  const bouncelands = playableLands.filter(
    l => l.isBounce || BOUNCE_LANDS.has(l.name.toLowerCase())
  );
  if (bouncelands.length > 0) return bouncelands[0];
  return playableLands[0];
};

// ─────────────────────────────────────────────────────────────────────────────
// findBestLandToFetch
// ─────────────────────────────────────────────────────────────────────────────
export const findBestLandToFetch = (
  fetchLand,
  library,
  battlefield,
  keyCardNames,
  parsedDeck,
  turn
) => {
  const onlyBasics = fetchLand.isHideawayFetch || fetchLand.fetchesOnlyBasics;

  const eligibleLands = library.filter(card => {
    if (!card.isLand) return false;
    if (onlyBasics && !card.isBasic) return false;
    const landTypes = card.landSubtypes || [];
    const fetchColors = fetchLand.fetchColors || [];
    return landTypes.some(type => fetchColors.includes(SUBTYPE_TO_COLOR[type]));
  });

  if (eligibleLands.length === 0) return null;

  const neededColors = new Set();
  if (keyCardNames && keyCardNames.length > 0 && parsedDeck) {
    const keyCards = [];
    keyCardNames.forEach(cardName => {
      const card =
        parsedDeck.spells.find(c => c.name === cardName) ||
        parsedDeck.creatures.find(c => c.name === cardName) ||
        parsedDeck.artifacts.find(c => c.name === cardName);
      if (card) keyCards.push(card);
    });
    keyCards.sort((a, b) => a.cmc - b.cmc);
    keyCards.forEach(card => {
      const symbols = card.manaCost.match(/\{([^}]+)\}/g) || [];
      symbols.forEach(symbol => {
        const clean = symbol.replace(/[{}]/g, '');
        if (['W', 'U', 'B', 'R', 'G'].includes(clean)) neededColors.add(clean);
      });
    });
  }

  const currentColors = new Set();
  battlefield.forEach(permanent => {
    if (
      permanent.card.isLand ||
      permanent.card.isManaArtifact ||
      (permanent.card.isManaCreature && !permanent.summoningSick)
    ) {
      (permanent.card.produces || []).forEach(color => {
        if (['W', 'U', 'B', 'R', 'G'].includes(color)) currentColors.add(color);
      });
    }
  });

  const missingColors = new Set([...neededColors].filter(c => !currentColors.has(c)));

  const scoredLands = eligibleLands.map(land => {
    let score = 0;
    const producesNeededColor = (land.produces || []).some(c => missingColors.has(c));
    if (producesNeededColor) score += 300;
    if (turn <= 2 && (land.produces || []).length > 2) score += 1000;
    if (turn >= 6 && land.isShockLand) score -= 100;
    if ((land.produces || []).length >= 2) score += 100;
    score += (land.produces || []).filter(c => missingColors.has(c)).length * 250;
    return { land, score };
  });
  scoredLands.sort((a, b) => b.score - a.score);
  return scoredLands[0].land;
};

// ─────────────────────────────────────────────────────────────────────────────
// playLand
//   NEW: commanderMode is now an explicit parameter (was a closure over state)
// ─────────────────────────────────────────────────────────────────────────────
export const playLand = (
  land,
  hand,
  battlefield,
  library,
  graveyard,
  turn,
  turnLog,
  keyCardNames,
  parsedDeck,
  commanderMode
) => {
  const index = hand.indexOf(land);
  hand.splice(index, 1);
  let lifeLoss = 0;

  // City of Traitors: sacrifice when another land is played
  const cityOfTraitorsInPlay = battlefield.filter(p => p.card.isLand && p.card.isCityOfTraitors);
  if (cityOfTraitorsInPlay.length > 0 && !land.isCityOfTraitors) {
    cityOfTraitorsInPlay.forEach(city => {
      const cityIndex = battlefield.indexOf(city);
      battlefield.splice(cityIndex, 1);
      graveyard.push(city.card);
      if (turnLog) turnLog.actions.push(`Sacrificed ${city.card.name} (another land played)`);
    });
  }

  if (land.isFetch) {
    if (land.isHideawayFetch) {
      const fetchedLand = findBestLandToFetch(
        land,
        library,
        battlefield,
        keyCardNames,
        parsedDeck,
        turn
      );
      if (fetchedLand) {
        library.splice(library.indexOf(fetchedLand), 1);
        battlefield.push({ card: fetchedLand, tapped: true, enteredTapped: true });
        graveyard.push(land);
        if (turnLog)
          turnLog.actions.push(
            `Played ${land.name}, sacrificed it to fetch ${fetchedLand.name} (tapped)`
          );
      } else {
        battlefield.push({ card: land, tapped: true, enteredTapped: true });
        if (turnLog) turnLog.actions.push(`Played ${land.name} (tapped, no fetch targets)`);
      }
    } else {
      const entersTapped = doesLandEnterTapped(land, battlefield, turn, commanderMode);
      battlefield.push({ card: land, tapped: entersTapped, enteredTapped: entersTapped });
      if (turnLog) {
        const finalState = battlefield[battlefield.length - 1]?.tapped ? 'tapped' : 'untapped';
        turnLog.actions.push(`Played ${land.name} (fetch land, ${finalState})`);
      }
    }
  } else {
    const entersTapped = doesLandEnterTapped(land, battlefield, turn, commanderMode);
    const isBounceCard = land.isBounce || BOUNCE_LANDS.has(land.name.toLowerCase());

    if (isBounceCard) {
      const landsToBounce = battlefield.filter(
        p => p.card.isLand && !p.card.isBounce && !BOUNCE_LANDS.has(p.card.name.toLowerCase())
      );
      if (landsToBounce.length === 0) {
        if (turnLog)
          turnLog.actions.push(`Cannot play ${land.name} (no non-bounce lands to bounce)`);
        return 0;
      }
    }

    battlefield.push({ card: land, tapped: entersTapped, enteredTapped: entersTapped });

    // Shock land: pay 2 life to enter untapped (turns 1–6)
    if (land.isShockLand && turn <= 6 && entersTapped) {
      battlefield[battlefield.length - 1].tapped = false;
      battlefield[battlefield.length - 1].enteredTapped = false;
      lifeLoss += land.lifeloss ?? 2;
    }

    if (isBounceCard) {
      const bounceLandIndex = battlefield.length - 1;
      const finalState = battlefield[bounceLandIndex]?.tapped ? 'tapped' : 'untapped';
      const landsToBounce = battlefield.filter(
        p => p.card.isLand && !p.card.isBounce && !BOUNCE_LANDS.has(p.card.name.toLowerCase())
      );
      const tappedLands = landsToBounce.filter(p => p.tapped);
      const toBounce = tappedLands.length > 0 ? tappedLands[0] : landsToBounce[0];
      const bouncedState = toBounce.tapped ? 'tapped' : 'untapped';
      battlefield.splice(battlefield.indexOf(toBounce), 1);
      hand.push(toBounce.card);
      if (turnLog)
        turnLog.actions.push(
          `Played ${land.name} (${finalState}), bounced ${toBounce.card.name} (${bouncedState})`
        );
    } else {
      if (turnLog) {
        const finalState = battlefield[battlefield.length - 1]?.tapped ? 'tapped' : 'untapped';
        turnLog.actions.push(`Played ${land.name} (${finalState})`);
      }
    }
  }

  return lifeLoss;
};

// ─────────────────────────────────────────────────────────────────────────────
// tapManaSources
// ─────────────────────────────────────────────────────────────────────────────
export const tapManaSources = (spell, battlefield) => {
  const symbols = spell.manaCost.match(/\{([^}]+)\}/g) || [];
  const colorNeeds = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  let totalNeeded = 0;

  symbols.forEach(symbol => {
    const clean = symbol.replace(/[{}]/g, '');
    if (['W', 'U', 'B', 'R', 'G'].includes(clean)) {
      colorNeeds[clean]++;
      totalNeeded++;
    } else if (!isNaN(parseInt(clean))) {
      totalNeeded += parseInt(clean);
    }
  });

  ['W', 'U', 'B', 'R', 'G'].forEach(color => {
    let needed = colorNeeds[color];
    if (needed === 0) return;
    const sources = battlefield.filter(
      p => !p.tapped && p.card.produces?.includes(color) && (!p.summoningSick || p.card.isLand)
    );
    for (const source of sources) {
      if (needed <= 0) break;
      source.tapped = true;
      needed--;
      totalNeeded--;
    }
  });

  const untappedSources = battlefield.filter(p => !p.tapped && (!p.summoningSick || p.card.isLand));
  for (const source of untappedSources) {
    if (totalNeeded <= 0) break;
    source.tapped = true;
    totalNeeded -= source.card.manaAmount || 1;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// calculateManaAvailability
// ─────────────────────────────────────────────────────────────────────────────
export const calculateManaAvailability = (battlefield, turn = 999) => {
  const colors = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  let total = 0;
  // sources: one entry per mana unit available for bipartite pip-matching
  const sources = [];
  const moxSimpleTurn = 2;

  const addManaSource = (produces, amt) => {
    total += amt;
    produces.forEach(color => {
      colors[color] = (colors[color] || 0) + amt;
    });
    for (let i = 0; i < amt; i++) sources.push({ produces: [...produces] });
  };

  battlefield
    .filter(p => !p.tapped)
    .forEach(permanent => {
      const card = permanent.card;
      if (card.isLand) {
        let amt;
        if (card.scalesWithSwamps) {
          // Cabal Coffers: {2},{T} → {B} for each Swamp you control. Net = swampCount - 2.
          const swampCount = battlefield.filter(
            p => p.card.isLand && p.card.landSubtypes?.includes('Swamp')
          ).length;
          amt = Math.max(0, swampCount - 2);
        } else if (card.scalesWithBasicSwamps) {
          // Cabal Stronghold: {2},{T} → {B} for each basic Swamp. Net = basicSwampCount - 2.
          const basicSwampCount = battlefield.filter(
            p => p.card.isLand && p.card.isBasic && p.card.landSubtypes?.includes('Swamp')
          ).length;
          amt = Math.max(0, basicSwampCount - 2);
        } else if (card.isPhyrexianTower) {
          // Phyrexian Tower: {T}={C} normally, or {T}+sac creature={B}{B}.
          // If a creature is on the battlefield, produce 2 {B}; otherwise 1 {C}.
          const hasCreature = battlefield.some(
            p =>
              (p.card.isManaCreature || p.card.type?.toLowerCase().includes('creature')) &&
              !p.summoningSick
          );
          if (hasCreature) {
            addManaSource(['B'], 2); // sac a creature for {B}{B}
          } else {
            addManaSource(['C'], 1); // {T} for {C}
          }
          return; // handled inline above
        } else if (card.isTempleOfFalseGod) {
          // Temple of the False God: only produces {C}{C} with 5+ lands.
          const landCount = battlefield.filter(p => p.card.isLand).length;
          if (landCount >= 5) {
            amt = 2;
          } else {
            return; // no mana produced
          }
        } else if (card.simplifiedMana === 'turn-1') {
          // Simplified scaling lands (Gaea's Cradle, Nykthos, etc.): mana = max(floor, turn-1).
          amt = Math.max(card.manaFloor ?? 1, turn - 1);
        } else {
          amt = card.manaAmount || 1;
        }
        if (amt > 0) addManaSource(card.produces, amt);
      } else if (card.isManaArtifact) {
        if (card.isMoxOpal && !(SIMPLIFY_MOX_CONDITIONS && turn >= moxSimpleTurn)) {
          const artCount = battlefield.filter(
            p => p.card.type?.includes('artifact') || p.card.isManaArtifact
          ).length;
          if (artCount < 3) return;
        }
        if (card.isMoxAmber && !(SIMPLIFY_MOX_CONDITIONS && turn >= moxSimpleTurn)) {
          const legendaries = battlefield.filter(
            p => p.card.oracleText?.includes('Legendary') || p.card.type?.includes('Legendary')
          );
          if (legendaries.length === 0) return;
        }
        addManaSource(card.produces, card.manaAmount || 1);
      } else if (card.isManaCreature && !permanent.summoningSick) {
        addManaSource(card.produces, card.manaAmount || 1);
      }
    });

  return { total, colors, sources };
};

// ─────────────────────────────────────────────────────────────────────────────
// solveColorPips  –  bipartite-matching pip feasibility solver
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Returns true when every colored pip in `pips` can be assigned to a
 * distinct source in `sources`, meaning no two pips compete for the same
 * physical mana source (e.g. a single Watery Grave cannot satisfy both
 * {U} and {B} simultaneously).
 *
 * Algorithm: augmenting-path bipartite matching (Hopcroft-Karp-style DFS).
 *
 * @param {string[]}                 pips    – e.g. ['U','U','B']
 * @param {Array<{produces:string[]}>} sources – one entry per mana unit
 * @returns {boolean}
 */
export const solveColorPips = (pips, sources) => {
  // matchOf[srcIdx] = pipIdx currently matched to that source (-1 = free)
  const matchOf = new Array(sources.length).fill(-1);

  const dfs = (pipIdx, visited) => {
    for (let s = 0; s < sources.length; s++) {
      if (visited[s]) continue;
      const src = sources[s];
      // A source satisfies a pip when it produces that exact color or any color ('*')
      if (!src.produces.includes(pips[pipIdx]) && !src.produces.includes('*')) continue;
      visited[s] = true;
      if (matchOf[s] === -1 || dfs(matchOf[s], visited)) {
        matchOf[s] = pipIdx;
        return true;
      }
    }
    return false;
  };

  let matched = 0;
  for (let i = 0; i < pips.length; i++) {
    if (dfs(i, new Array(sources.length).fill(false))) matched++;
  }
  return matched === pips.length;
};

// ─────────────────────────────────────────────────────────────────────────────
// canPlayCard
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Returns true when the available mana can pay for `card`.
 *
 * When `manaAvailable.sources` is present (populated by
 * calculateManaAvailability) an exact bipartite-matching check is used so
 * that dual-colored mana sources (e.g. Watery Grave producing {U} or {B})
 * are never double-counted across competing pip requirements.
 *
 * When `sources` is absent the function falls back to the original
 * per-color aggregate check, preserving backward-compatibility with
 * callers that supply a hand-crafted manaAvailable object.
 */
export const canPlayCard = (card, manaAvailable) => {
  if (card.cmc > manaAvailable.total) return false;

  const symbols = card.manaCost.match(/\{([^}]+)\}/g) || [];
  const colorPips = [];
  symbols.forEach(symbol => {
    const clean = symbol.replace(/[{}]/g, '');
    if (['W', 'U', 'B', 'R', 'G'].includes(clean)) colorPips.push(clean);
  });

  if (colorPips.length === 0) return true;

  // Precise path: bipartite matching prevents double-counting shared sources
  if (manaAvailable.sources) {
    return solveColorPips(colorPips, manaAvailable.sources);
  }

  // Fallback: original per-color aggregate check
  const colorRequirements = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  colorPips.forEach(c => colorRequirements[c]++);
  for (const color in colorRequirements) {
    if (
      colorRequirements[color] > 0 &&
      (manaAvailable.colors[color] || 0) < colorRequirements[color]
    )
      return false;
  }
  return true;
};

// ─────────────────────────────────────────────────────────────────────────────
// castSpells
//   NEW: simConfig = { includeRampSpells, disabledRampSpells }
// ─────────────────────────────────────────────────────────────────────────────
export const castSpells = (
  hand,
  battlefield,
  graveyard,
  turnLog,
  keyCardNames,
  parsedDeck,
  library,
  turn = 999,
  simConfig = {}
) => {
  const { includeRampSpells = true, disabledRampSpells = new Set() } = simConfig;

  // Phase 1: mana-producing permanents
  let changed = true;
  while (changed) {
    changed = false;
    const manaAvailable = calculateManaAvailability(battlefield, turn);
    const creatures = hand.filter(c => c.isManaCreature);
    const exploration = hand.filter(c => c.isExploration);
    const artifacts = hand.filter(
      c => c.isManaArtifact && !BURST_MANA_SOURCES.has(c.name?.toLowerCase())
    );

    const castable = [...creatures, ...exploration, ...artifacts].sort((a, b) => {
      const aPrio = MOX_PRIORITY_ARTIFACTS.has(a.name?.toLowerCase()) ? -1 : a.cmc;
      const bPrio = MOX_PRIORITY_ARTIFACTS.has(b.name?.toLowerCase()) ? -1 : b.cmc;
      return aPrio - bPrio;
    });

    for (const spell of castable) {
      if (!canPlayCard(spell, manaAvailable)) continue;

      let etbNote = '';

      if (spell.etbCost === 'discardLand' || spell.isMoxDiamond) {
        const landsInHand = hand.filter(c => c.isLand);
        if (landsInHand.length === 0) continue;
        const landToDiscard = landsInHand.find(l => l.entersTappedAlways) || landsInHand[0];
        etbNote = ` (discarded ${landToDiscard.name})`;
        hand.splice(hand.indexOf(landToDiscard), 1);
        graveyard.push(landToDiscard);
      } else if (spell.etbCost === 'imprintNonland' || spell.isChromeMox) {
        const nonLandsInHand = hand.filter(c => !c.isLand);
        if (nonLandsInHand.length === 0) continue;
        const cardToImprint = nonLandsInHand[0];
        etbNote = ` (imprinted ${cardToImprint.name})`;
        hand.splice(hand.indexOf(cardToImprint), 1);
      } else if (spell.etbCost === 'discardHand') {
        const handNames = hand.filter(c => c !== spell).map(c => c.name);
        if (handNames.length > 0) {
          etbNote = ` (discarded hand: ${handNames.join(', ')})`;
          const rest = hand.filter(c => c !== spell);
          rest.forEach(c => graveyard.push(c));
          hand.length = 0;
          hand.push(spell);
        } else {
          etbNote = ' (discarded empty hand)';
        }
      } else if (spell.etbCost === 'sacrifice') {
        etbNote = ' (sacrifice for mana)';
      }

      if (spell.condition === 'metalcraft' && !(SIMPLIFY_MOX_CONDITIONS && turn >= 2)) {
        const artCount = battlefield.filter(
          p => p.card.type?.includes('artifact') || p.card.isManaArtifact
        ).length;
        if (artCount < 2) etbNote += ' ⚠ metalcraft not yet active';
      }
      if (spell.condition === 'legendary' && !(SIMPLIFY_MOX_CONDITIONS && turn >= 2)) {
        const hasLegendary = battlefield.some(
          p => p.card.type?.includes('Legendary') || p.card.oracleText?.includes('Legendary')
        );
        if (!hasLegendary) etbNote += ' ⚠ no legendary — no mana produced';
      }

      hand.splice(hand.indexOf(spell), 1);
      battlefield.push({
        card: spell,
        tapped: spell.entersTapped || false,
        summoningSick: spell.isManaCreature || spell.isExploration,
      });
      tapManaSources(spell, battlefield);

      if (turnLog) {
        let type = 'permanent';
        if (spell.isManaArtifact) type = 'artifact';
        else if (spell.isManaCreature) type = 'creature';
        else if (spell.isExploration)
          type = spell.isCreature ? 'creature' : spell.isArtifact ? 'artifact' : 'permanent';
        const explorationSuffix = spell.isExploration ? ' (Exploration effect)' : '';
        const tappedSuffix = spell.entersTapped ? ' (enters tapped)' : '';
        turnLog.actions.push(
          `Cast ${type}: ${spell.name}${explorationSuffix}${tappedSuffix}${etbNote}`
        );
      }

      changed = true;
      break;
    }
  }

  // Phase 2: ramp spells
  if (includeRampSpells) {
    let rampChanged = true;
    while (rampChanged) {
      rampChanged = false;
      const manaAvailable = calculateManaAvailability(battlefield, turn);
      const rampInHand = hand.filter(c => c.isRampSpell && !disabledRampSpells.has(c.name));

      for (const rampSpell of rampInHand.sort((a, b) => a.cmc - b.cmc)) {
        if (!canPlayCard(rampSpell, manaAvailable)) continue;
        const eligibleInLibrary = library.filter(c => matchesRampFilter(c, rampSpell));
        const minNeeded =
          Math.max(1, (rampSpell.landsToAdd || 1) > 0 ? 1 : 0) +
          (rampSpell.landsToHand > 0 ? 1 : 0);
        if (eligibleInLibrary.length < minNeeded) continue;

        hand.splice(hand.indexOf(rampSpell), 1);
        graveyard.push(rampSpell);
        tapManaSources(rampSpell, battlefield);

        let sacrificedLandName = null;
        if (rampSpell.sacrificeLand) {
          const candidates = battlefield.filter(p => p.card.isLand && !p.card.isFetch);
          const basics = candidates.filter(p => p.card.isBasic);
          const duals = candidates.filter(p => !p.card.isBasic && !p.card.isBounce);
          const bounces = candidates.filter(p => p.card.isBounce);
          const toSacrifice = basics[0] ?? duals[0] ?? bounces[0] ?? null;
          if (toSacrifice) {
            sacrificedLandName = toSacrifice.card.name;
            battlefield.splice(battlefield.indexOf(toSacrifice), 1);
            graveyard.push(toSacrifice.card);
          }
        }

        const landsToFieldNames = [];
        const target = rampSpell.landsToAdd || 1;
        for (let li = 0; li < library.length && landsToFieldNames.length < target; li++) {
          if (matchesRampFilter(library[li], rampSpell)) {
            const [fetchedCard] = library.splice(li, 1);
            li--;
            battlefield.push({
              card: fetchedCard,
              tapped: rampSpell.landsTapped,
              enteredTapped: rampSpell.landsTapped,
            });
            landsToFieldNames.push(fetchedCard.name);
          }
        }

        const landsToHandNames = [];
        if (rampSpell.landsToHand > 0) {
          for (
            let li = 0;
            li < library.length && landsToHandNames.length < rampSpell.landsToHand;
            li++
          ) {
            if (matchesRampFilter(library[li], rampSpell)) {
              const [card] = library.splice(li, 1);
              li--;
              hand.push(card);
              landsToHandNames.push(card.name);
            }
          }
        }

        if (turnLog) {
          const tappedNote = rampSpell.landsTapped ? 'tapped' : 'untapped';
          const sacNote = sacrificedLandName ? `, sac'd ${sacrificedLandName}` : '';
          const fieldNote =
            landsToFieldNames.length > 0
              ? ` → ${landsToFieldNames.join(', ')} (${tappedNote})`
              : ' → no land found';
          const handNote =
            landsToHandNames.length > 0 ? `; ${landsToHandNames.join(', ')} to hand` : '';
          turnLog.actions.push(
            `Cast ramp spell: ${rampSpell.name}${sacNote}${fieldNote}${handNote}`
          );
        }
        rampChanged = true;
        break;
      }
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// calculateBattlefieldDamage
//   Returns the total life loss from self-damaging permanents for a given turn,
//   plus a breakdown array for action-log messages.
//   `turn` is 0-based (matches the monteCarlo loop variable).
// ─────────────────────────────────────────────────────────────────────────────
export const calculateBattlefieldDamage = (battlefield, turn) => {
  const breakdown = [];
  let total = 0;

  // Mana Crypt (50% coin-flip = 1.5 avg per copy)
  const cryptCount = battlefield.filter(
    p => p.card.isManaArtifact && p.card.name?.toLowerCase() === 'mana crypt'
  ).length;
  if (cryptCount > 0) {
    const dmg = cryptCount * 1.5;
    total += dmg;
    breakdown.push(`Mana Crypt damage: -${dmg} life (avg)`);
  }

  // Ancient Tomb
  const tombDmg = battlefield
    .filter(p => p.card.isLand && p.card.isAncientTomb)
    .reduce((s, p) => s + (p.card.lifeloss ?? 2), 0);
  if (tombDmg > 0) {
    total += tombDmg;
    breakdown.push(`Ancient Tomb damage: -${tombDmg} life`);
  }

  // Pain Lands & Starting Town (turns 1-5 simplified)
  if (turn <= 5) {
    const painDmg = battlefield
      .filter(p => p.card.isLand && (p.card.isPainLand || p.card.name === 'starting town'))
      .reduce((s, p) => s + (p.card.lifeloss ?? 1), 0);
    if (painDmg > 0) {
      total += painDmg;
      breakdown.push(`Pain Land damage: -${painDmg} life`);
    }

    // Talismans (1 damage per talisman tapped for colored mana)
    const taliDmg = battlefield
      .filter(p => p.card.isTalisman)
      .reduce((s, p) => s + (p.card.lifeloss ?? 1), 0);
    if (taliDmg > 0) {
      total += taliDmg;
      breakdown.push(`Talisman damage: -${taliDmg} life`);
    }
  }

  // 5-Color Pain Lands (only when tapped)
  const fiveDmg = battlefield
    .filter(p => p.card.isLand && p.card.isFiveColorPainLand && p.tapped)
    .reduce((s, p) => s + (p.card.lifeloss ?? 1), 0);
  if (fiveDmg > 0) {
    total += fiveDmg;
    breakdown.push(`5-Color Pain Land damage: -${fiveDmg} life`);
  }

  return { total, breakdown };
};
