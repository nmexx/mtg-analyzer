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

import {
  BOUNCE_LANDS,
  CROWD_LANDS,
  FAST_LANDS,
  CHECK_LANDS,
  BATTLE_LANDS,
  KNOWN_FETCH_LANDS,
} from './landData.js';
import {
  ARTIFACT_DATA,
  SIMPLIFY_MOX_CONDITIONS,
  MOX_PRIORITY_ARTIFACTS,
  BURST_MANA_SOURCES,
} from '../../Card_Archive/Artifacts.js';

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

export const shuffle = (array) => {
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
    case 'any':     return true;
    case 'basic':   return !!land.isBasic;
    case 'subtype':
      return !!(rampSpell.fetchSubtypes && land.landSubtypes &&
        rampSpell.fetchSubtypes.some(t => land.landSubtypes.includes(t)));
    case 'snow':
      return !!(land.name && land.name.toLowerCase().includes('snow'));
    default:        return !!land.isBasic;
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
    let needsTypes = land.checkTypes?.length ? [...land.checkTypes] : [];
    if (needsTypes.length === 0) {
      if (land.produces.includes('W') && land.produces.includes('U')) {
        needsTypes.push('Plains', 'Island');
      } else if (land.produces.includes('U') && land.produces.includes('B')) {
        needsTypes.push('Island', 'Swamp');
      } else if (land.produces.includes('B') && land.produces.includes('R')) {
        needsTypes.push('Swamp', 'Mountain');
      } else if (land.produces.includes('R') && land.produces.includes('G')) {
        needsTypes.push('Mountain', 'Forest');
      } else if (land.produces.includes('G') && land.produces.includes('W')) {
        needsTypes.push('Forest', 'Plains');
      } else if (land.produces.includes('W') && land.produces.includes('B')) {
        needsTypes.push('Plains', 'Swamp');
      } else if (land.produces.includes('U') && land.produces.includes('R')) {
        needsTypes.push('Island', 'Mountain');
      } else if (land.produces.includes('B') && land.produces.includes('G')) {
        needsTypes.push('Swamp', 'Forest');
      } else if (land.produces.includes('R') && land.produces.includes('W')) {
        needsTypes.push('Mountain', 'Plains');
      } else if (land.produces.includes('G') && land.produces.includes('U')) {
        needsTypes.push('Forest', 'Island');
      }
    }
    if (needsTypes.length === 0) return false;
    return !battlefield.some(p =>
      p.card.isLand && p.card.landSubtypes &&
      p.card.landSubtypes.some(t => needsTypes.includes(t))
    );
  }
  if (land.isCrowd) {
    return !commanderMode;
  }
  if (land.entersTappedAlways === true)  return true;
  if (land.entersTappedAlways === false) return false;
  return false;
};

// ─────────────────────────────────────────────────────────────────────────────
// selectBestLand
// ─────────────────────────────────────────────────────────────────────────────
export const selectBestLand = (hand, battlefield, library, turn) => {
  const lands = hand.filter(c => c.isLand);
  if (lands.length === 0) return null;

  const landsWithBouncability = lands.map(land => {
    const isBounceCard = land.isBounce || BOUNCE_LANDS.has(land.name.toLowerCase());
    if (!isBounceCard) return { land, canPlay: true };
    const nonBounceLandsToReturn = battlefield.filter(p =>
      p.card.isLand && !p.card.isBounce && !BOUNCE_LANDS.has(p.card.name.toLowerCase())
    );
    return { land, canPlay: nonBounceLandsToReturn.length > 0 };
  });

  const playableLands = landsWithBouncability.filter(i => i.canPlay).map(i => i.land);
  if (playableLands.length === 0) return null;

  const fetches      = playableLands.filter(l => l.isFetch && l.fetchType !== 'mana_cost');
  const untappedSources = battlefield.filter(d => d.isLand && !d.tapped);
  if (fetches.length > 0 && untappedSources.length >= fetches[0].fetchcost) return fetches[0];

  const untappedNonBounce = playableLands.filter(l =>
    !l.entersTappedAlways && !l.isBounce && !BOUNCE_LANDS.has(l.name.toLowerCase())
  );
  if (untappedNonBounce.length > 0) return untappedNonBounce[0];

  const bouncelands = playableLands.filter(l => l.isBounce || BOUNCE_LANDS.has(l.name.toLowerCase()));
  if (bouncelands.length > 0) return bouncelands[0];
  return playableLands[0];
};

// ─────────────────────────────────────────────────────────────────────────────
// findBestLandToFetch
// ─────────────────────────────────────────────────────────────────────────────
export const findBestLandToFetch = (fetchLand, library, battlefield, keyCardNames, parsedDeck, turn) => {
  const onlyBasics = fetchLand.isHideawayFetch || fetchLand.fetchesOnlyBasics;

  const eligibleLands = library.filter(card => {
    if (!card.isLand) return false;
    if (onlyBasics && !card.isBasic) return false;
    const landTypes  = card.landSubtypes || [];
    const fetchColors = fetchLand.fetchColors || [];
    return landTypes.some(type => {
      const typeToColor = { Plains: 'W', Island: 'U', Swamp: 'B', Mountain: 'R', Forest: 'G' };
      return fetchColors.includes(typeToColor[type]);
    });
  });

  if (eligibleLands.length === 0) return null;

  const neededColors = new Set();
  if (keyCardNames && keyCardNames.length > 0 && parsedDeck) {
    const keyCards = [];
    keyCardNames.forEach(cardName => {
      const card = parsedDeck.spells.find(c => c.name === cardName) ||
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
    if (permanent.card.isLand || permanent.card.isManaArtifact ||
        (permanent.card.isManaCreature && !permanent.summoningSick)) {
      (permanent.card.produces || []).forEach(color => {
        if (['W', 'U', 'B', 'R', 'G'].includes(color)) currentColors.add(color);
      });
    }
  });

  const missingColors = new Set([...neededColors].filter(c => !currentColors.has(c)));

  const scoredLands = eligibleLands.map(land => {
    let score = 0;
    const producesNeededColor = (land.produces || []).some(c => missingColors.has(c));
    if (producesNeededColor)                                  score += 300;
    if (turn <= 2 && (land.produces || []).length > 2)       score += 1000;
    if (turn >= 6 && land.isShockLand)                       score -= 100;
    if ((land.produces || []).length >= 2)                    score += 100;
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
export const playLand = (land, hand, battlefield, library, graveyard, turn, turnLog, keyCardNames, parsedDeck, commanderMode) => {
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
      const fetchedLand = findBestLandToFetch(land, library, battlefield, keyCardNames, parsedDeck, turn);
      if (fetchedLand) {
        library.splice(library.indexOf(fetchedLand), 1);
        battlefield.push({ card: fetchedLand, tapped: true, enteredTapped: true });
        graveyard.push(land);
        if (turnLog) turnLog.actions.push(`Played ${land.name}, sacrificed it to fetch ${fetchedLand.name} (tapped)`);
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
    const entersTapped     = doesLandEnterTapped(land, battlefield, turn, commanderMode);
    const isBounceCard     = land.isBounce || BOUNCE_LANDS.has(land.name.toLowerCase());

    if (isBounceCard) {
      const landsToBounce = battlefield.filter(p =>
        p.card.isLand && !p.card.isBounce && !BOUNCE_LANDS.has(p.card.name.toLowerCase())
      );
      if (landsToBounce.length === 0) {
        if (turnLog) turnLog.actions.push(`Cannot play ${land.name} (no non-bounce lands to bounce)`);
        return 0;
      }
    }

    battlefield.push({ card: land, tapped: entersTapped, enteredTapped: entersTapped });

    // Shock land: pay 2 life to enter untapped (turns 1–6)
    if (land.isShockLand && turn <= 6 && entersTapped) {
      battlefield[battlefield.length - 1].tapped = false;
      battlefield[battlefield.length - 1].enteredTapped = false;
      lifeLoss += (land.lifeloss ?? 2);
    }

    if (isBounceCard) {
      const bounceLandIndex = battlefield.length - 1;
      const finalState      = battlefield[bounceLandIndex]?.tapped ? 'tapped' : 'untapped';
      const landsToBounce   = battlefield.filter(p =>
        p.card.isLand && !p.card.isBounce && !BOUNCE_LANDS.has(p.card.name.toLowerCase())
      );
      const tappedLands = landsToBounce.filter(p => p.tapped);
      const toBounce    = tappedLands.length > 0 ? tappedLands[0] : landsToBounce[0];
      const bouncedState = toBounce.tapped ? 'tapped' : 'untapped';
      battlefield.splice(battlefield.indexOf(toBounce), 1);
      hand.push(toBounce.card);
      if (turnLog)
        turnLog.actions.push(`Played ${land.name} (${finalState}), bounced ${toBounce.card.name} (${bouncedState})`);
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
    const sources = battlefield.filter(p =>
      !p.tapped && p.card.produces?.includes(color) && (!p.summoningSick || p.card.isLand)
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
  let total    = 0;
  const moxSimpleTurn = 2;

  battlefield.filter(p => !p.tapped).forEach(permanent => {
    const card = permanent.card;
    if (card.isLand) {
      const amt = card.manaAmount || 1;
      total += amt;
      card.produces.forEach(color => { colors[color] = (colors[color] || 0) + amt; });
    } else if (card.isManaArtifact) {
      if (card.isMoxOpal && !(SIMPLIFY_MOX_CONDITIONS && turn >= moxSimpleTurn)) {
        const artCount = battlefield.filter(p =>
          p.card.type?.includes('artifact') || p.card.isManaArtifact
        ).length;
        if (artCount < 3) return;
      }
      if (card.isMoxAmber && !(SIMPLIFY_MOX_CONDITIONS && turn >= moxSimpleTurn)) {
        const legendaries = battlefield.filter(p =>
          p.card.oracleText?.includes('Legendary') || p.card.type?.includes('Legendary')
        );
        if (legendaries.length === 0) return;
      }
      const amt = card.manaAmount || 1;
      total += amt;
      card.produces.forEach(color => { colors[color] = (colors[color] || 0) + amt; });
    } else if (card.isManaCreature && !permanent.summoningSick) {
      const amt = card.manaAmount || 1;
      total += amt;
      card.produces.forEach(color => { colors[color] = (colors[color] || 0) + amt; });
    }
  });

  return { total, colors };
};

// ─────────────────────────────────────────────────────────────────────────────
// canPlayCard
// ─────────────────────────────────────────────────────────────────────────────
export const canPlayCard = (card, manaAvailable) => {
  if (card.cmc > manaAvailable.total) return false;
  const colorRequirements = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  const symbols = card.manaCost.match(/\{([^}]+)\}/g) || [];
  symbols.forEach(symbol => {
    const clean = symbol.replace(/[{}]/g, '');
    if (['W', 'U', 'B', 'R', 'G'].includes(clean)) colorRequirements[clean]++;
  });
  for (const color in colorRequirements) {
    if (colorRequirements[color] > 0 && (manaAvailable.colors[color] || 0) < colorRequirements[color])
      return false;
  }
  return true;
};

// ─────────────────────────────────────────────────────────────────────────────
// castSpells
//   NEW: simConfig = { includeRampSpells, disabledRampSpells }
// ─────────────────────────────────────────────────────────────────────────────
export const castSpells = (hand, battlefield, graveyard, turnLog, keyCardNames, parsedDeck, library, turn = 999, simConfig = {}) => {
  const { includeRampSpells = true, disabledRampSpells = new Set() } = simConfig;

  // Phase 1: mana-producing permanents
  let changed = true;
  while (changed) {
    changed = false;
    const manaAvailable = calculateManaAvailability(battlefield, turn);
    const creatures    = hand.filter(c => c.isManaCreature);
    const exploration  = hand.filter(c => c.isExploration);
    const artifacts    = hand.filter(c => c.isManaArtifact && !BURST_MANA_SOURCES.has(c.name?.toLowerCase()));

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
        const artCount = battlefield.filter(p => p.card.type?.includes('artifact') || p.card.isManaArtifact).length;
        if (artCount < 2) etbNote += ' ⚠ metalcraft not yet active';
      }
      if (spell.condition === 'legendary' && !(SIMPLIFY_MOX_CONDITIONS && turn >= 2)) {
        const hasLegendary = battlefield.some(p =>
          p.card.type?.includes('Legendary') || p.card.oracleText?.includes('Legendary')
        );
        if (!hasLegendary) etbNote += ' ⚠ no legendary — no mana produced';
      }

      hand.splice(hand.indexOf(spell), 1);
      battlefield.push({ card: spell, tapped: spell.entersTapped || false, summoningSick: spell.isManaCreature || spell.isExploration });
      tapManaSources(spell, battlefield);

      if (turnLog) {
        let type = 'permanent';
        if (spell.isManaArtifact)    type = 'artifact';
        else if (spell.isManaCreature) type = 'creature';
        else if (spell.isExploration)  type = spell.isCreature ? 'creature' : (spell.isArtifact ? 'artifact' : 'permanent');
        const explorationSuffix = spell.isExploration ? ' (Exploration effect)' : '';
        const tappedSuffix      = spell.entersTapped  ? ' (enters tapped)'      : '';
        turnLog.actions.push(`Cast ${type}: ${spell.name}${explorationSuffix}${tappedSuffix}${etbNote}`);
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
      const rampInHand    = hand.filter(c => c.isRampSpell && !disabledRampSpells.has(c.name));

      for (const rampSpell of rampInHand.sort((a, b) => a.cmc - b.cmc)) {
        if (!canPlayCard(rampSpell, manaAvailable)) continue;
        const eligibleInLibrary = library.filter(c => matchesRampFilter(c, rampSpell));
        const minNeeded = Math.max(1, (rampSpell.landsToAdd || 1) > 0 ? 1 : 0) +
                          (rampSpell.landsToHand > 0 ? 1 : 0);
        if (eligibleInLibrary.length < minNeeded) continue;

        hand.splice(hand.indexOf(rampSpell), 1);
        graveyard.push(rampSpell);
        tapManaSources(rampSpell, battlefield);

        let sacrificedLandName = null;
        if (rampSpell.sacrificeLand) {
          const candidates  = battlefield.filter(p => p.card.isLand && !p.card.isFetch);
          const basics       = candidates.filter(p => p.card.isBasic);
          const duals        = candidates.filter(p => !p.card.isBasic && !p.card.isBounce);
          const bounces      = candidates.filter(p => p.card.isBounce);
          const toSacrifice  = basics[0] ?? duals[0] ?? bounces[0] ?? null;
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
            battlefield.push({ card: fetchedCard, tapped: rampSpell.landsTapped, enteredTapped: rampSpell.landsTapped });
            landsToFieldNames.push(fetchedCard.name);
          }
        }

        const landsToHandNames = [];
        if (rampSpell.landsToHand > 0) {
          for (let li = 0; li < library.length && landsToHandNames.length < rampSpell.landsToHand; li++) {
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
          const sacNote    = sacrificedLandName  ? `, sac'd ${sacrificedLandName}` : '';
          const fieldNote  = landsToFieldNames.length > 0 ? ` → ${landsToFieldNames.join(', ')} (${tappedNote})` : ' → no land found';
          const handNote   = landsToHandNames.length > 0  ? `; ${landsToHandNames.join(', ')} to hand` : '';
          turnLog.actions.push(`Cast ramp spell: ${rampSpell.name}${sacNote}${fieldNote}${handNote}`);
        }
        rampChanged = true;
        break;
      }
    }
  }
};
