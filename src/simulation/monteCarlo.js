/**
 * monteCarlo.js
 *
 * The Monte Carlo simulation engine.
 *
 * All state that was previously closed over from the React component is now
 * passed in through a `config` object so this module is fully pure and
 * independently testable.
 *
 * Config shape:
 * {
 *   iterations,            // number
 *   turns,                 // number
 *   handSize,              // number
 *   maxSequences,          // number
 *   commanderMode,         // boolean
 *   enableMulligans,       // boolean
 *   mulliganRule,          // 'london' | 'vancouver'
 *   mulliganStrategy,      // 'conservative' | 'balanced' | 'aggressive' | 'custom'
 *   customMulliganRules,   // object
 *   selectedKeyCards,      // Set<string>
 *   includeExploration,    // boolean
 *   disabledExploration,   // Set<string>
 *   includeRampSpells,     // boolean
 *   disabledRampSpells,    // Set<string>
 *   includeArtifacts,      // boolean
 *   disabledArtifacts,     // Set<string>
 *   includeCreatures,      // boolean
 *   disabledCreatures,     // Set<string>
 *   includeRituals,        // boolean
 *   disabledRituals,       // Set<string>
 * }
 */

import { ARTIFACT_DATA, BURST_MANA_SOURCES } from '../../Card_Archive/Artifacts.js';
import {
  shuffle,
  selectBestLand,
  playLand,
  findBestLandToFetch,
  doesLandEnterTapped,
  castSpells,
  calculateManaAvailability,
  canPlayCard,
  tapManaSources,
} from './simulationCore.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const average = (arr) => {
  if (!arr || arr.length === 0) return 0;
  const sum = arr.reduce((s, v) => (v != null && !isNaN(v) ? s + v : s), 0);
  return arr.length > 0 ? sum / arr.length : 0;
};

const stdDev = (arr) => {
  if (!arr || arr.length < 2) return 0;
  const avg = average(arr);
  const variance = arr.reduce((s, v) => (v != null && !isNaN(v) ? s + (v - avg) ** 2 : s), 0) / arr.length;
  return Math.sqrt(variance);
};

// ─────────────────────────────────────────────────────────────────────────────
// buildCompleteDeck
//   Assembles the flat array of card objects that will be shuffled each
//   iteration, honouring the include/disabled toggles from the UI.
// ─────────────────────────────────────────────────────────────────────────────
export const buildCompleteDeck = (deckToParse, config = {}) => {
  if (!deckToParse) return [];
  const {
    includeArtifacts  = true,  disabledArtifacts  = new Set(),
    includeCreatures  = true,  disabledCreatures  = new Set(),
    includeExploration = true, disabledExploration = new Set(),
    includeRampSpells = true,  disabledRampSpells  = new Set(),
    includeRituals    = true,  disabledRituals     = new Set(),
  } = config;

  const deck = [];

  deckToParse.lands.forEach(card => {
    for (let i = 0; i < card.quantity; i++) deck.push({ ...card });
  });

  if (includeArtifacts) {
    deckToParse.artifacts.forEach(card => {
      if (!disabledArtifacts.has(card.name))
        for (let i = 0; i < card.quantity; i++) deck.push({ ...card });
    });
  }
  if (includeCreatures) {
    deckToParse.creatures.forEach(card => {
      if (!disabledCreatures.has(card.name))
        for (let i = 0; i < card.quantity; i++) deck.push({ ...card });
    });
  }
  if (includeExploration && deckToParse.exploration) {
    deckToParse.exploration.forEach(card => {
      if (!disabledExploration.has(card.name))
        for (let i = 0; i < card.quantity; i++) deck.push({ ...card });
    });
  }
  if (includeRampSpells && deckToParse.rampSpells) {
    deckToParse.rampSpells.forEach(card => {
      if (!disabledRampSpells.has(card.name))
        for (let i = 0; i < card.quantity; i++) deck.push({ ...card });
    });
  }
  if (includeRituals && deckToParse.rituals) {
    deckToParse.rituals.forEach(card => {
      if (!disabledRituals.has(card.name))
        for (let i = 0; i < card.quantity; i++) deck.push({ ...card });
    });
  }

  deckToParse.spells.forEach(card => {
    for (let i = 0; i < card.quantity; i++) deck.push({ ...card });
  });

  return deck;
};

// ─────────────────────────────────────────────────────────────────────────────
// monteCarlo
// ─────────────────────────────────────────────────────────────────────────────
export const monteCarlo = (deckToParse, config = {}) => {
  const {
    iterations         = 10000,
    turns              = 7,
    handSize           = 7,
    maxSequences       = 1,
    commanderMode      = false,
    enableMulligans    = false,
    mulliganRule       = 'london',
    mulliganStrategy   = 'balanced',
    customMulliganRules = {},
    selectedKeyCards   = new Set(),
    includeExploration = true,
    disabledExploration = new Set(),
    includeRampSpells  = true,
    disabledRampSpells  = new Set(),
  } = config;

  const deck          = buildCompleteDeck(deckToParse, config);
  const keyCardNames  = Array.from(selectedKeyCards);
  const simConfig     = { includeRampSpells, disabledRampSpells };

  const results = {
    landsPerTurn:                Array(turns).fill(null).map(() => []),
    untappedLandsPerTurn:        Array(turns).fill(null).map(() => []),
    colorsByTurn:                Array(turns).fill(null).map(() => ({ W: [], U: [], B: [], R: [], G: [] })),
    totalManaPerTurn:            Array(turns).fill(null).map(() => []),
    lifeLossPerTurn:             Array(turns).fill(null).map(() => []),
    keyCardPlayability:          {},
    keyCardPlayabilityBurst:     {},
    hasBurstCards:               false,
    fastestPlaySequences:        {},
    fastestPlaySequencesBurst:   {},
    mulligans:                   0,
    handsKept:                   0,
  };

  keyCardNames.forEach(name => {
    results.keyCardPlayability[name]      = Array(turns).fill(0);
    results.keyCardPlayabilityBurst[name] = Array(turns).fill(0);
  });

  results.hasBurstCards =
    [...deckToParse.spells, ...(deckToParse.artifacts || [])].some(
      c => BURST_MANA_SOURCES.has(c.name?.toLowerCase())
    ) ||
    (deckToParse.rituals && deckToParse.rituals.length > 0);

  // ── Main iteration loop ───────────────────────────────────────────────────
  for (let iter = 0; iter < iterations; iter++) {
    const shuffled  = shuffle(deck);
    let hand        = shuffled.slice(0, handSize);
    let library     = shuffled.slice(handSize);

    // Mulligan logic
    let mulliganCount = 0;
    if (enableMulligans) {
      let shouldMulligan = true;
      while (shouldMulligan && mulliganCount < 6) {
        shouldMulligan = false;
        const landCount = hand.filter(c => c.isLand).length;

        if (mulliganStrategy === 'conservative') {
          if (landCount === 0 || landCount === 7) shouldMulligan = true;
        } else if (mulliganStrategy === 'balanced') {
          if (landCount === 0 || landCount === 7) {
            shouldMulligan = true;
          } else if (landCount < 2 || landCount > 5) {
            if (!hand.some(c => !c.isLand && (c.cmc || 0) <= 2)) shouldMulligan = true;
          }
        } else if (mulliganStrategy === 'aggressive') {
          if (landCount < 2 || landCount > 4) shouldMulligan = true;
        } else if (mulliganStrategy === 'custom') {
          if (customMulliganRules.mulligan0Lands && landCount === 0) shouldMulligan = true;
          if (customMulliganRules.mulligan7Lands && landCount === 7) shouldMulligan = true;
          if (customMulliganRules.mulliganMinLands && landCount < customMulliganRules.minLandsThreshold) shouldMulligan = true;
          if (customMulliganRules.mulliganMaxLands && landCount > customMulliganRules.maxLandsThreshold) shouldMulligan = true;
          if (customMulliganRules.mulliganNoPlaysByTurn) {
            if (!hand.some(c => !c.isLand && (c.cmc || 0) <= customMulliganRules.noPlaysTurnThreshold))
              shouldMulligan = true;
          }
        }

        if (shouldMulligan) {
          mulliganCount++;
          results.mulligans++;
          if (mulliganRule === 'london') {
            const newShuffle = shuffle(deck);
            const newHand    = newShuffle.slice(0, 7);
            const sortedHand = [...newHand].sort((a, b) => {
              const lc = newHand.filter(c => c.isLand).length;
              if (lc > 4) { if (a.isLand && !b.isLand) return -1; if (!a.isLand && b.isLand) return 1; }
              else if (lc < 2) { if (!a.isLand && b.isLand) return -1; if (a.isLand && !b.isLand) return 1; }
              return (b.cmc || 0) - (a.cmc || 0);
            });
            hand    = sortedHand.slice(mulliganCount);
            library = newShuffle.slice(7);
          } else {
            const newShuffle  = shuffle(deck);
            const newHandSize = 7 - mulliganCount;
            hand    = newShuffle.slice(0, newHandSize);
            library = newShuffle.slice(newHandSize);
          }
        }
      }
    }

    results.handsKept++;
    const battlefield        = [];
    const graveyard          = [];
    let cumulativeLifeLoss   = 0;
    const turnActions        = [];
    const openingHand        = hand.map(c => c.name);

    // ── Turn loop ────────────────────────────────────────────────────────────
    for (let turn = 0; turn < turns; turn++) {
      const turnLog = { turn: turn + 1, actions: [], lifeLoss: 0 };

      // Untap
      battlefield.forEach(p => {
        if (p.card.doesntUntapNaturally) return;
        p.tapped = false;
        if (p.summoningSick !== undefined) p.summoningSick = false;
      });

      // Upkeep — Mana Vault
      let manaVaultDamage = 0;
      battlefield.forEach(p => { if (p.card.isManaVault && p.tapped) manaVaultDamage += 1; });
      turnLog.lifeLoss       += manaVaultDamage;
      cumulativeLifeLoss     += manaVaultDamage;

      // Draw
      const shouldDraw = turn > 0 || commanderMode;
      if (shouldDraw && library.length > 0) {
        const drawn = library.shift();
        hand.push(drawn);
        turnLog.actions.push(`Drew: ${drawn.name}`);
      }

      // Phase 1: first land drop
      let landsPlayedThisTurn = 0;
      const firstLand = selectBestLand(hand, battlefield, library, turn);
      if (firstLand) {
        const ll = playLand(firstLand, hand, battlefield, library, graveyard, turn, turnLog, keyCardNames, deckToParse, commanderMode);
        turnLog.lifeLoss += ll;
        cumulativeLifeLoss += ll;
        if (ll > 0) {
          const last = turnLog.actions[turnLog.actions.length - 1];
          if (last && !last.includes('Cannot play'))
            turnLog.actions[turnLog.actions.length - 1] = `${last} [-${ll} life]`;
        }
        landsPlayedThisTurn++;
      }

      // Phase 2: Exploration effects (cast after first land)
      if (includeExploration) {
        const manaAvailable = calculateManaAvailability(battlefield);
        const explorationInHand = hand.filter(c => c.isExploration && !disabledExploration.has(c.name));
        for (const expl of explorationInHand) {
          if (canPlayCard(expl, manaAvailable)) {
            hand.splice(hand.indexOf(expl), 1);
            battlefield.push({ card: expl, tapped: expl.entersTapped || false, summoningSick: expl.isManaCreature || false });
            tapManaSources(expl, battlefield);
            if (turnLog) {
              const type = expl.isCreature ? 'creature' : (expl.isArtifact ? 'artifact' : 'permanent');
              turnLog.actions.push(`Cast ${type}: ${expl.name} (Exploration effect)`);
            }
            const nm = calculateManaAvailability(battlefield);
            Object.assign(manaAvailable, nm);
          }
        }
      }

      // Phase 3: Max lands per turn
      let maxLandsPerTurn = 1;
      if (includeExploration) {
        battlefield.forEach(p => {
          if (p.card.isExploration && !disabledExploration.has(p.card.name))
            maxLandsPerTurn = Math.max(maxLandsPerTurn, p.card.landsPerTurn || 2);
        });
      }

      // Phase 4: additional land drops
      while (landsPlayedThisTurn < maxLandsPerTurn) {
        const land = selectBestLand(hand, battlefield, library, turn);
        if (!land) break;
        const ll = playLand(land, hand, battlefield, library, graveyard, turn, turnLog, keyCardNames, deckToParse, commanderMode);
        turnLog.lifeLoss += ll;
        cumulativeLifeLoss += ll;
        if (ll > 0) {
          const last = turnLog.actions[turnLog.actions.length - 1];
          if (last && !last.includes('Cannot play'))
            turnLog.actions[turnLog.actions.length - 1] = `${last} [-${ll} life]`;
        }
        landsPlayedThisTurn++;
      }

      // Phase 5: Activate fetch lands already on battlefield
      const fetchLands = battlefield.filter(p => p.card.isFetch && !p.tapped);
      for (const fetchPermanent of fetchLands) {
        const manaAvailable = calculateManaAvailability(battlefield);
        const fetchCost     = fetchPermanent.card.fetchcost || 0;
        let canAffordFetch  = fetchCost === 0 || manaAvailable.total >= fetchCost;

        if (!canAffordFetch) continue;

        // Pay generic mana cost
        let manaStillNeeded = fetchCost;
        if (manaStillNeeded > 0) {
          const untappedSources = battlefield.filter(p => !p.tapped && p.card.isLand && p !== fetchPermanent);
          for (const source of untappedSources) {
            if (manaStillNeeded <= 0) break;
            source.tapped = true;
            manaStillNeeded -= source.card.manaAmount || 1;
          }
        }

        const fetchedLand = findBestLandToFetch(fetchPermanent.card, library, battlefield, keyCardNames, deckToParse, turn);
        if (fetchedLand) {
          library.splice(library.indexOf(fetchedLand), 1);
          let entersTapped = fetchPermanent.card.fetchedLandEntersTapped
            ? true
            : doesLandEnterTapped(fetchedLand, battlefield, turn, commanderMode);

          battlefield.splice(battlefield.indexOf(fetchPermanent), 1);
          graveyard.push(fetchPermanent.card);
          battlefield.push({ card: fetchedLand, tapped: entersTapped, enteredTapped: entersTapped });

          if (fetchedLand.isShockLand && turn <= 6 && entersTapped && !fetchPermanent.card.fetchedLandEntersTapped) {
            battlefield[battlefield.length - 1].tapped       = false;
            battlefield[battlefield.length - 1].enteredTapped = false;
            const shockCost = fetchedLand.lifeloss ?? 2;
            cumulativeLifeLoss += shockCost;
            turnLog.lifeLoss   += shockCost;
          }
          if (fetchPermanent.card.fetchType === 'classic') {
            cumulativeLifeLoss += 1;
            turnLog.lifeLoss   += 1;
          }
          if (turnLog) {
            const finalState = battlefield[battlefield.length - 1]?.tapped ? 'tapped' : 'untapped';
            const lifeCost   = fetchPermanent.card.fetchType === 'classic' ? ' [-1 life]' : '';
            turnLog.actions.push(`Fetched ${fetchedLand.name} (${finalState})${lifeCost}`);
          }
        } else {
          if (turnLog)
            turnLog.actions.push(`${fetchPermanent.card.name} activated but no valid fetch targets in library`);
        }
      }

      // Phase 6: Cast spells
      castSpells(hand, battlefield, graveyard, turnLog, keyCardNames, deckToParse, library, turn, simConfig);

      // Mana Crypt damage (50% coin-flip = 1.5 avg)
      const manaCryptCount = battlefield.filter(p => p.card.isManaArtifact && p.card.name?.toLowerCase() === 'mana crypt').length;
      if (manaCryptCount > 0) {
        const dmg = manaCryptCount * 1.5;
        cumulativeLifeLoss += dmg;
        turnLog.lifeLoss   += dmg;
        turnLog.actions.push(`Mana Crypt damage: -${dmg} life (avg)`);
      }

      // Ancient Tomb
      const ancientTombDmg = battlefield.filter(p => p.card.isLand && p.card.isAncientTomb)
        .reduce((s, p) => s + (p.card.lifeloss ?? 2), 0);
      if (ancientTombDmg > 0) {
        cumulativeLifeLoss += ancientTombDmg;
        turnLog.lifeLoss   += ancientTombDmg;
        turnLog.actions.push(`Ancient Tomb damage: -${ancientTombDmg} life`);
      }

      // Pain Lands & Starting Town (turns 1-5 simplified)
      const painLandDmg = battlefield
        .filter(p => p.card.isLand && (p.card.isPainLand || p.card.name === 'starting town'))
        .reduce((s, p) => s + (p.card.lifeloss ?? 1), 0);
      if (painLandDmg > 0 && turn <= 5) {
        cumulativeLifeLoss += painLandDmg;
        turnLog.lifeLoss   += painLandDmg;
        turnLog.actions.push(`Pain Land damage: -${painLandDmg} life`);
      }

      // Talismans (turns 1-5 simplified — 1 damage per talisman tapped for colored mana)
      const talismanDmg = battlefield.filter(p => p.card.isTalisman)
        .reduce((s, p) => s + (p.card.lifeloss ?? 1), 0);
      if (talismanDmg > 0 && turn <= 5) {
        cumulativeLifeLoss += talismanDmg;
        turnLog.lifeLoss   += talismanDmg;
        turnLog.actions.push(`Talisman damage: -${talismanDmg} life`);
      }

      // 5-Color Pain Lands
      const fiveColorPainDmg = battlefield.filter(p => p.card.isLand && p.card.isFiveColorPainLand && p.tapped)
        .reduce((s, p) => s + (p.card.lifeloss ?? 1), 0);
      if (fiveColorPainDmg > 0) {
        cumulativeLifeLoss += fiveColorPainDmg;
        turnLog.lifeLoss   += fiveColorPainDmg;
        turnLog.actions.push(`5-Color Pain Land damage: -${fiveColorPainDmg} life`);
      }

      turnActions.push(turnLog);

      // Statistics
      const landCount         = battlefield.filter(p => p.card.isLand).length;
      const untappedLandCount = battlefield.filter(p => p.card.isLand && !p.tapped).length;
      results.landsPerTurn[turn].push(landCount);
      results.untappedLandsPerTurn[turn].push(untappedLandCount);
      results.lifeLossPerTurn[turn].push(cumulativeLifeLoss);

      const manaAvailable = calculateManaAvailability(battlefield);
      results.totalManaPerTurn[turn].push(manaAvailable.total);
      ['W', 'U', 'B', 'R', 'G'].forEach(color => {
        results.colorsByTurn[turn][color].push(manaAvailable.colors[color] || 0);
      });

      // Burst mana
      const burstInHand    = hand.filter(c => BURST_MANA_SOURCES.has(c.name?.toLowerCase()));
      const burstFromArts  = burstInHand.reduce((s, c) => {
        const known = ARTIFACT_DATA.get(c.name?.toLowerCase());
        return s + (known?.manaAmount ?? 1);
      }, 0);
      const ritualsInHand  = hand.filter(c => c.isRitual && canPlayCard(c, manaAvailable));
      const burstFromRit   = ritualsInHand.reduce((s, c) => s + (c.netGain || 0), 0);
      const burstTotal     = burstFromArts + burstFromRit;

      const burstColorBonus = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
      burstInHand.forEach(c => {
        const known = ARTIFACT_DATA.get(c.name?.toLowerCase());
        const amt   = known?.manaAmount ?? 1;
        ['W', 'U', 'B', 'R', 'G'].forEach(col => { burstColorBonus[col] += amt; });
      });
      ritualsInHand.forEach(c => {
        const colors = c.ritualColors;
        const gain   = c.netGain || 0;
        if (colors && colors.length > 0) {
          colors.forEach(col => { if (col in burstColorBonus) burstColorBonus[col] += gain; });
        } else {
          ['W', 'U', 'B', 'R', 'G'].forEach(col => { burstColorBonus[col] += gain; });
        }
      });

      const manaWithBurst = burstTotal > 0 ? {
        total:  manaAvailable.total + burstTotal,
        colors: Object.fromEntries(
          Object.entries(manaAvailable.colors).map(([k, v]) => [k, v + (burstColorBonus[k] || 0)])
        ),
      } : manaAvailable;

      // Key-card playability
      keyCardNames.forEach(cardName => {
        const keyCard =
          deckToParse.spells.find(c => c.name === cardName) ||
          deckToParse.creatures.find(c => c.name === cardName) ||
          deckToParse.artifacts.find(c => c.name === cardName) ||
          (deckToParse.rampSpells   && deckToParse.rampSpells.find(c => c.name === cardName)) ||
          (deckToParse.exploration  && deckToParse.exploration.find(c => c.name === cardName));

        if (keyCard && canPlayCard(keyCard, manaAvailable)) {
          results.keyCardPlayability[cardName][turn]++;
          if (!results.fastestPlaySequences[cardName]) results.fastestPlaySequences[cardName] = {};
          const ct = turn + 1;
          if (!results.fastestPlaySequences[cardName][ct]) results.fastestPlaySequences[cardName][ct] = [];
          if (results.fastestPlaySequences[cardName][ct].length < maxSequences) {
            results.fastestPlaySequences[cardName][ct].push({
              turn: ct, manaAvailable: manaAvailable.total,
              sequence: JSON.parse(JSON.stringify(turnActions)), openingHand: [...openingHand],
            });
          }
        }

        if (keyCard && canPlayCard(keyCard, manaWithBurst)) {
          results.keyCardPlayabilityBurst[cardName][turn]++;
          if (!canPlayCard(keyCard, manaAvailable)) {
            if (!results.fastestPlaySequencesBurst[cardName]) results.fastestPlaySequencesBurst[cardName] = {};
            const ctb = turn + 1;
            if (!results.fastestPlaySequencesBurst[cardName][ctb]) results.fastestPlaySequencesBurst[cardName][ctb] = [];
            if (results.fastestPlaySequencesBurst[cardName][ctb].length < maxSequences) {
              results.fastestPlaySequencesBurst[cardName][ctb].push({
                turn: ctb, manaAvailable: manaAvailable.total, manaWithBurst: manaWithBurst.total,
                burstCards: [...burstInHand.map(c => c.name), ...ritualsInHand.map(c => c.name)],
                sequence: JSON.parse(JSON.stringify(turnActions)), openingHand: [...openingHand],
              });
            }
          }
        }
      });
    } // end turn loop
  } // end iteration loop

  // Capture standard deviations before collapsing arrays to averages
  results.landsPerTurnStdDev        = results.landsPerTurn.map(arr => stdDev(arr));
  results.untappedLandsPerTurnStdDev = results.untappedLandsPerTurn.map(arr => stdDev(arr));
  results.totalManaPerTurnStdDev    = results.totalManaPerTurn.map(arr => stdDev(arr));
  results.lifeLossPerTurnStdDev     = results.lifeLossPerTurn.map(arr => stdDev(arr));
  results.colorsByTurnStdDev        = results.colorsByTurn.map(colorObj => {
    const out = {};
    Object.keys(colorObj).forEach(color => { out[color] = stdDev(colorObj[color]); });
    return out;
  });

  // Calculate averages
  for (let t = 0; t < turns; t++) {
    results.landsPerTurn[t]         = average(results.landsPerTurn[t]);
    results.untappedLandsPerTurn[t] = average(results.untappedLandsPerTurn[t]);
    results.totalManaPerTurn[t]     = average(results.totalManaPerTurn[t]);
    results.lifeLossPerTurn[t]      = average(results.lifeLossPerTurn[t]);
    Object.keys(results.colorsByTurn[t]).forEach(color => {
      results.colorsByTurn[t][color] = average(results.colorsByTurn[t][color]);
    });
  }

  // Key-card percentages
  const toPercent = (map) => {
    Object.keys(map).forEach(name => {
      map[name] = map[name].map(count => (count / results.handsKept) * 100);
    });
  };
  toPercent(results.keyCardPlayability);
  toPercent(results.keyCardPlayabilityBurst);

  return results;
};
