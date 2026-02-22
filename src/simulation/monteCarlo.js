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

import { ARTIFACT_DATA, BURST_MANA_SOURCES } from '../../card_data/Artifacts.js';
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
  calculateBattlefieldDamage,
  calculateCostDiscount,
  enforceHandSizeLimit,
} from './simulationCore.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const average = arr => {
  if (!arr || arr.length === 0) return 0;
  const sum = arr.reduce((s, v) => (v != null && !isNaN(v) ? s + v : s), 0);
  return sum / arr.length;
};

const stdDev = arr => {
  if (!arr || arr.length < 2) return 0;
  const avg = average(arr);
  const variance =
    arr.reduce((s, v) => (v != null && !isNaN(v) ? s + (v - avg) ** 2 : s), 0) / arr.length;
  return Math.sqrt(variance);
};

// ─────────────────────────────────────────────────────────────────────────────
// buildCompleteDeck
//   Assembles the flat array of card objects that will be shuffled each
//   iteration, honouring the include/disabled toggles from the UI.
// ─────────────────────────────────────────────────────────────────────────────

/** Push copies of each card in `cards` that isn't in the `disabled` Set. */
const pushFiltered = (deck, cards, disabled) => {
  if (!cards) return;
  cards.forEach(card => {
    if (!disabled.has(card.name)) for (let i = 0; i < card.quantity; i++) deck.push({ ...card });
  });
};

/**
 * Apply per-card mana amount overrides from the UI.
 * mode='fixed'   → static manaAmount
 * mode='scaling' → manaScaling { base, growth } used per-turn in the sim
 */
const applyManaOverrides = (deck, manaOverrides) => {
  if (!manaOverrides || Object.keys(manaOverrides).length === 0) return deck;
  return deck.map(card => {
    const override = manaOverrides[card.name?.toLowerCase()];
    if (!override) return card;
    if (override.mode === 'fixed') {
      return { ...card, manaAmount: Math.max(1, override.fixed ?? 1), manaScaling: undefined };
    } else if (override.mode === 'scaling') {
      const base = Math.max(1, override.base ?? 1);
      const growth = Math.max(0, override.growth ?? 0);
      return { ...card, manaScaling: { base, growth }, manaAmount: base };
    }
    return card;
  });
};

/**
 * Apply per-card draw amount overrides from the UI.
 * mode='onetime'  → override isOneTimeDraw=true, netCardsDrawn=amount
 * mode='perturn'  → override isOneTimeDraw=false, avgCardsPerTurn=amount
 */
const applyDrawOverrides = (deck, drawOverrides) => {
  if (!drawOverrides || Object.keys(drawOverrides).length === 0) return deck;
  return deck.map(card => {
    if (!card.isDrawSpell) return card;
    const override = drawOverrides[card.name?.toLowerCase()];
    if (!override || override.mode === 'default') return card;
    if (override.mode === 'onetime') {
      return {
        ...card,
        isOneTimeDraw: true,
        staysOnBattlefield: false,
        netCardsDrawn: Math.max(0, override.amount ?? card.netCardsDrawn ?? 1),
      };
    } else if (override.mode === 'perturn') {
      return {
        ...card,
        isOneTimeDraw: false,
        staysOnBattlefield: true,
        avgCardsPerTurn: Math.max(0, override.amount ?? card.avgCardsPerTurn ?? 1),
      };
    }
    return card;
  });
};

export const buildCompleteDeck = (deckToParse, config = {}) => {
  if (!deckToParse) return [];
  const {
    includeArtifacts = true,
    disabledArtifacts = new Set(),
    includeCreatures = true,
    disabledCreatures = new Set(),
    includeExploration = true,
    disabledExploration = new Set(),
    includeRampSpells = true,
    disabledRampSpells = new Set(),
    includeRituals = true,
    disabledRituals = new Set(),
    includeCostReducers = true,
    disabledCostReducers = new Set(),
    includeDrawSpells = true,
    disabledDrawSpells = new Set(),
    manaOverrides = {},
    drawOverrides = {},
  } = config;

  const deck = [];

  deckToParse.lands.forEach(card => {
    for (let i = 0; i < card.quantity; i++) deck.push({ ...card });
  });

  if (includeArtifacts) pushFiltered(deck, deckToParse.artifacts, disabledArtifacts);
  if (includeCreatures) pushFiltered(deck, deckToParse.creatures, disabledCreatures);
  if (includeExploration) pushFiltered(deck, deckToParse.exploration, disabledExploration);
  if (includeRampSpells) pushFiltered(deck, deckToParse.rampSpells, disabledRampSpells);
  if (includeRituals) pushFiltered(deck, deckToParse.rituals, disabledRituals);
  if (includeCostReducers) pushFiltered(deck, deckToParse.costReducers, disabledCostReducers);
  if (includeDrawSpells) pushFiltered(deck, deckToParse.drawSpells, disabledDrawSpells);

  deckToParse.spells.forEach(card => {
    for (let i = 0; i < card.quantity; i++) deck.push({ ...card });
  });

  return applyDrawOverrides(applyManaOverrides(deck, manaOverrides), drawOverrides);
};

// ─────────────────────────────────────────────────────────────────────────────
// monteCarlo
// ─────────────────────────────────────────────────────────────────────────────
export const monteCarlo = (deckToParse, config = {}) => {
  const {
    iterations = 10000,
    turns = 7,
    handSize = 7,
    maxSequences = 1,
    commanderMode = false,
    enableMulligans = false,
    mulliganRule = 'london',
    mulliganStrategy = 'balanced',
    customMulliganRules = {},
    selectedKeyCards = new Set(),
    includeExploration = true,
    disabledExploration = new Set(),
    includeRampSpells = true,
    disabledRampSpells = new Set(),
    includeCostReducers = true,
    disabledCostReducers = new Set(),
    includeDrawSpells = true,
    disabledDrawSpells = new Set(),
    floodNLands = 5,
    floodTurn = 5,
    screwNLands = 2,
    screwTurn = 3,
  } = config;

  const deck = buildCompleteDeck(deckToParse, config);
  const keyCardNames = Array.from(selectedKeyCards);
  const simConfig = {
    includeRampSpells,
    disabledRampSpells,
    includeCostReducers,
    disabledCostReducers,
    includeDrawSpells,
    disabledDrawSpells,
  };

  const results = {
    landsPerTurn: Array(turns)
      .fill(null)
      .map(() => []),
    untappedLandsPerTurn: Array(turns)
      .fill(null)
      .map(() => []),
    colorsByTurn: Array(turns)
      .fill(null)
      .map(() => ({ W: [], U: [], B: [], R: [], G: [] })),
    totalManaPerTurn: Array(turns)
      .fill(null)
      .map(() => []),
    lifeLossPerTurn: Array(turns)
      .fill(null)
      .map(() => []),
    keyCardPlayability: {},
    keyCardPlayabilityBurst: {},
    keyCardOnCurvePlayability: {},
    keyCardOnCurveCMC: {},
    floodRate: null,
    screwRate: null,
    floodThreshold: { lands: floodNLands, turn: floodTurn },
    screwThreshold: { lands: screwNLands, turn: screwTurn },
    hasBurstCards: false,
    fastestPlaySequences: {},
    fastestPlaySequencesBurst: {},
    mulligans: 0,
    handsKept: 0,
  };

  keyCardNames.forEach(name => {
    results.keyCardPlayability[name] = Array(turns).fill(0);
    results.keyCardPlayabilityBurst[name] = Array(turns).fill(0);
    results.keyCardOnCurvePlayability[name] = 0;
  });

  results.hasBurstCards =
    [...deckToParse.spells, ...(deckToParse.artifacts || [])].some(c =>
      BURST_MANA_SOURCES.has(c.name?.toLowerCase())
    ) ||
    (deckToParse.rituals && deckToParse.rituals.length > 0);

  // Pre-build a lookup so the inner loop doesn't search all deck arrays on
  // every turn of every iteration for every key card.
  const allPlayableCards = [
    ...deckToParse.spells,
    ...deckToParse.creatures,
    ...(deckToParse.artifacts || []),
    ...(deckToParse.rampSpells || []),
    ...(deckToParse.drawSpells || []),
    ...(deckToParse.exploration || []),
  ];
  const keyCardMap = new Map(
    keyCardNames.map(name => [name, allPlayableCards.find(c => c.name === name)])
  );

  // Store the CMC of each key card so the UI can display the on-curve turn.
  keyCardNames.forEach(name => {
    const kc = keyCardMap.get(name);
    results.keyCardOnCurveCMC[name] = kc?.cmc ?? null;
  });

  // ── Main iteration loop ───────────────────────────────────────────────────
  for (let iter = 0; iter < iterations; iter++) {
    const shuffled = shuffle(deck);
    let hand = shuffled.slice(0, handSize);
    let library = shuffled.slice(handSize);

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
          if (
            customMulliganRules.mulliganMinLands &&
            landCount < customMulliganRules.minLandsThreshold
          )
            shouldMulligan = true;
          if (
            customMulliganRules.mulliganMaxLands &&
            landCount > customMulliganRules.maxLandsThreshold
          )
            shouldMulligan = true;
          if (customMulliganRules.mulliganNoPlaysByTurn) {
            if (
              !hand.some(c => !c.isLand && (c.cmc || 0) <= customMulliganRules.noPlaysTurnThreshold)
            )
              shouldMulligan = true;
          }
        }

        if (shouldMulligan) {
          mulliganCount++;
          results.mulligans++;
          // In Commander mode the first mulligan is free: you redraw 7 without
          // bottoming any card (official Commander rule).
          const effectiveMullCount = Math.max(0, mulliganCount - (commanderMode ? 1 : 0));
          if (mulliganRule === 'london') {
            const newShuffle = shuffle(deck);
            const newHand = newShuffle.slice(0, 7);
            const lc = newHand.filter(c => c.isLand).length;
            const sortedHand = [...newHand].sort((a, b) => {
              if (lc > 4) {
                if (a.isLand && !b.isLand) return -1;
                if (!a.isLand && b.isLand) return 1;
              } else if (lc < 2) {
                if (!a.isLand && b.isLand) return -1;
                if (a.isLand && !b.isLand) return 1;
              }
              return (b.cmc || 0) - (a.cmc || 0);
            });
            hand = sortedHand.slice(effectiveMullCount);
            library = newShuffle.slice(7);
          } else {
            const newShuffle = shuffle(deck);
            const newHandSize = 7 - effectiveMullCount;
            hand = newShuffle.slice(0, newHandSize);
            library = newShuffle.slice(newHandSize);
          }
        }
      }
    }

    results.handsKept++;
    const battlefield = [];
    const graveyard = [];
    let cumulativeLifeLoss = 0;
    const turnActions = [];
    const openingHand = hand.map(c => c.name);

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
      battlefield.forEach(p => {
        if (p.card.isManaVault && p.tapped) manaVaultDamage += 1;
      });
      turnLog.lifeLoss += manaVaultDamage;
      cumulativeLifeLoss += manaVaultDamage;

      // Upkeep — per-turn draw effects from draw spell permanents on battlefield
      if (includeDrawSpells) {
        battlefield.forEach(p => {
          const card = p.card;
          if (!card.isDrawSpell || card.isOneTimeDraw) return;
          if (disabledDrawSpells.has(card.name)) return;
          const perTurn = card.avgCardsPerTurn || 0;
          if (perTurn <= 0) return;
          const full = Math.floor(perTurn);
          const frac = Math.random() < perTurn - full ? 1 : 0;
          const toDraw = full + frac;
          for (let d = 0; d < toDraw && library.length > 0; d++) {
            hand.push(library.shift());
          }
          if (toDraw > 0) {
            turnLog.actions.push(`${card.name}: drew ${toDraw} card${toDraw !== 1 ? 's' : ''}`);
          }
        });
      }

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
        const ll = playLand(
          firstLand,
          hand,
          battlefield,
          library,
          graveyard,
          turn,
          turnLog,
          keyCardNames,
          deckToParse,
          commanderMode
        );
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
        const explorationInHand = hand.filter(
          c => c.isExploration && !disabledExploration.has(c.name)
        );
        for (const expl of explorationInHand) {
          if (canPlayCard(expl, manaAvailable)) {
            hand.splice(hand.indexOf(expl), 1);
            battlefield.push({
              card: expl,
              tapped: expl.entersTapped || false,
              summoningSick: expl.isManaCreature || false,
              enteredOnTurn: turn,
            });
            tapManaSources(expl, battlefield);
            const type = expl.isCreature ? 'creature' : expl.isArtifact ? 'artifact' : 'permanent';
            turnLog.actions.push(`Cast ${type}: ${expl.name} (Exploration effect)`);
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
        const ll = playLand(
          land,
          hand,
          battlefield,
          library,
          graveyard,
          turn,
          turnLog,
          keyCardNames,
          deckToParse,
          commanderMode
        );
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
        const fetchCost = fetchPermanent.card.fetchcost || 0;
        const canAffordFetch = fetchCost === 0 || manaAvailable.total >= fetchCost;

        if (!canAffordFetch) continue;

        // Pay generic mana cost
        let manaStillNeeded = fetchCost;
        if (manaStillNeeded > 0) {
          const untappedSources = battlefield.filter(
            p => !p.tapped && p.card.isLand && p !== fetchPermanent
          );
          for (const source of untappedSources) {
            if (manaStillNeeded <= 0) break;
            source.tapped = true;
            manaStillNeeded -= source.card.manaAmount || 1;
          }
        }

        const fetchedLand = findBestLandToFetch(
          fetchPermanent.card,
          library,
          battlefield,
          keyCardNames,
          deckToParse,
          turn
        );
        if (fetchedLand) {
          library.splice(library.indexOf(fetchedLand), 1);
          const entersTapped = fetchPermanent.card.fetchedLandEntersTapped
            ? true
            : doesLandEnterTapped(fetchedLand, battlefield, turn, commanderMode);

          battlefield.splice(battlefield.indexOf(fetchPermanent), 1);
          graveyard.push(fetchPermanent.card);
          battlefield.push({
            card: fetchedLand,
            tapped: entersTapped,
            enteredTapped: entersTapped,
          });

          if (
            fetchedLand.isShockLand &&
            turn <= 6 &&
            entersTapped &&
            !fetchPermanent.card.fetchedLandEntersTapped
          ) {
            battlefield[battlefield.length - 1].tapped = false;
            battlefield[battlefield.length - 1].enteredTapped = false;
            const shockCost = fetchedLand.lifeloss ?? 2;
            cumulativeLifeLoss += shockCost;
            turnLog.lifeLoss += shockCost;
          }
          if (fetchPermanent.card.fetchType === 'classic') {
            cumulativeLifeLoss += 1;
            turnLog.lifeLoss += 1;
          }
          const finalState = battlefield[battlefield.length - 1]?.tapped ? 'tapped' : 'untapped';
          const lifeCost = fetchPermanent.card.fetchType === 'classic' ? ' [-1 life]' : '';
          turnLog.actions.push(`Fetched ${fetchedLand.name} (${finalState})${lifeCost}`);
        } else {
          turnLog.actions.push(
            `${fetchPermanent.card.name} activated but no valid fetch targets in library`
          );
        }
      }

      // Phase 6: Cast spells
      castSpells(
        hand,
        battlefield,
        graveyard,
        turnLog,
        keyCardNames,
        deckToParse,
        library,
        turn,
        simConfig
      );

      // Phase 7: Calculate damage from mana sources and other permanents on the battlefield
      const { total: battlefieldDmg, breakdown: battlefieldDmgLog } = calculateBattlefieldDamage(
        battlefield,
        turn
      );
      if (battlefieldDmg > 0) {
        cumulativeLifeLoss += battlefieldDmg;
        turnLog.lifeLoss += battlefieldDmg;
        battlefieldDmgLog.forEach(msg => turnLog.actions.push(msg));
      }

      // End of turn: enforce hand size limit (discard to max 7)
      enforceHandSizeLimit(hand, graveyard, handSize, battlefield, floodNLands, turnLog);

      turnActions.push(turnLog);

      // Statistics
      const landCount = battlefield.filter(p => p.card.isLand).length;
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
      const burstInHand = hand.filter(c => BURST_MANA_SOURCES.has(c.name?.toLowerCase()));
      const burstFromArts = burstInHand.reduce((s, c) => {
        const known = ARTIFACT_DATA.get(c.name?.toLowerCase());
        return s + (known?.manaAmount ?? 1);
      }, 0);
      const ritualsInHand = hand.filter(c => c.isRitual && canPlayCard(c, manaAvailable));
      const burstFromRit = ritualsInHand.reduce((s, c) => s + (c.netGain || 0), 0);
      const burstTotal = burstFromArts + burstFromRit;

      const burstColorBonus = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
      burstInHand.forEach(c => {
        const known = ARTIFACT_DATA.get(c.name?.toLowerCase());
        const amt = known?.manaAmount ?? 1;
        ['W', 'U', 'B', 'R', 'G'].forEach(col => {
          burstColorBonus[col] += amt;
        });
      });
      ritualsInHand.forEach(c => {
        const colors = c.ritualColors;
        const gain = c.netGain || 0;
        if (colors && colors.length > 0) {
          colors.forEach(col => {
            if (col in burstColorBonus) burstColorBonus[col] += gain;
          });
        } else {
          ['W', 'U', 'B', 'R', 'G'].forEach(col => {
            burstColorBonus[col] += gain;
          });
        }
      });

      const manaWithBurst =
        burstTotal > 0
          ? {
              total: manaAvailable.total + burstTotal,
              colors: Object.fromEntries(
                Object.entries(manaAvailable.colors).map(([k, v]) => [
                  k,
                  v + (burstColorBonus[k] || 0),
                ])
              ),
            }
          : manaAvailable;

      // Key-card playability
      keyCardNames.forEach(cardName => {
        const keyCard = keyCardMap.get(cardName);
        const keyDiscount = keyCard ? calculateCostDiscount(keyCard, battlefield) : 0;

        if (keyCard && canPlayCard(keyCard, manaAvailable, keyDiscount)) {
          results.keyCardPlayability[cardName][turn]++;

          // On-curve: castable on exactly the turn equal to the card's CMC.
          // A CMC-3 card is "on curve" on turn 3 (turn index 2).
          // 0-CMC cards are considered on-curve on turn 1 (turn index 0).
          const onCurveTurnIdx = Math.max(0, (keyCard.cmc ?? 0) - 1);
          if (turn === onCurveTurnIdx) {
            results.keyCardOnCurvePlayability[cardName]++;
          }

          if (!results.fastestPlaySequences[cardName]) results.fastestPlaySequences[cardName] = {};
          const ct = turn + 1;
          if (!results.fastestPlaySequences[cardName][ct])
            results.fastestPlaySequences[cardName][ct] = [];
          if (results.fastestPlaySequences[cardName][ct].length < maxSequences) {
            results.fastestPlaySequences[cardName][ct].push({
              turn: ct,
              manaAvailable: manaAvailable.total,
              sequence: JSON.parse(JSON.stringify(turnActions)),
              openingHand: [...openingHand],
            });
          }
        }

        if (keyCard && canPlayCard(keyCard, manaWithBurst, keyDiscount)) {
          results.keyCardPlayabilityBurst[cardName][turn]++;
          if (!canPlayCard(keyCard, manaAvailable, keyDiscount)) {
            if (!results.fastestPlaySequencesBurst[cardName])
              results.fastestPlaySequencesBurst[cardName] = {};
            const ctb = turn + 1;
            if (!results.fastestPlaySequencesBurst[cardName][ctb])
              results.fastestPlaySequencesBurst[cardName][ctb] = [];
            if (results.fastestPlaySequencesBurst[cardName][ctb].length < maxSequences) {
              results.fastestPlaySequencesBurst[cardName][ctb].push({
                turn: ctb,
                manaAvailable: manaAvailable.total,
                manaWithBurst: manaWithBurst.total,
                burstCards: [...burstInHand.map(c => c.name), ...ritualsInHand.map(c => c.name)],
                sequence: JSON.parse(JSON.stringify(turnActions)),
                openingHand: [...openingHand],
              });
            }
          }
        }
      });
    } // end turn loop
  } // end iteration loop

  // Flood / screw rates — computed from raw per-turn arrays BEFORE averaging
  const floodTurnIdx = floodTurn - 1;
  const screwTurnIdx = screwTurn - 1;
  if (floodTurnIdx >= 0 && floodTurnIdx < turns && results.landsPerTurn[floodTurnIdx].length > 0) {
    const floodCount = results.landsPerTurn[floodTurnIdx].filter(n => n >= floodNLands).length;
    results.floodRate = (floodCount / results.handsKept) * 100;
  }
  if (screwTurnIdx >= 0 && screwTurnIdx < turns && results.landsPerTurn[screwTurnIdx].length > 0) {
    const screwCount = results.landsPerTurn[screwTurnIdx].filter(n => n <= screwNLands).length;
    results.screwRate = (screwCount / results.handsKept) * 100;
  }

  // Capture standard deviations before collapsing arrays to averages
  results.landsPerTurnStdDev = results.landsPerTurn.map(arr => stdDev(arr));
  results.untappedLandsPerTurnStdDev = results.untappedLandsPerTurn.map(arr => stdDev(arr));
  results.totalManaPerTurnStdDev = results.totalManaPerTurn.map(arr => stdDev(arr));
  results.lifeLossPerTurnStdDev = results.lifeLossPerTurn.map(arr => stdDev(arr));
  results.colorsByTurnStdDev = results.colorsByTurn.map(colorObj => {
    const out = {};
    Object.keys(colorObj).forEach(color => {
      out[color] = stdDev(colorObj[color]);
    });
    return out;
  });

  // Calculate averages
  for (let t = 0; t < turns; t++) {
    results.landsPerTurn[t] = average(results.landsPerTurn[t]);
    results.untappedLandsPerTurn[t] = average(results.untappedLandsPerTurn[t]);
    results.totalManaPerTurn[t] = average(results.totalManaPerTurn[t]);
    results.lifeLossPerTurn[t] = average(results.lifeLossPerTurn[t]);
    Object.keys(results.colorsByTurn[t]).forEach(color => {
      results.colorsByTurn[t][color] = average(results.colorsByTurn[t][color]);
    });
  }

  // Key-card percentages
  const toPercent = map => {
    Object.keys(map).forEach(name => {
      map[name] = map[name].map(count => (count / results.handsKept) * 100);
    });
  };
  toPercent(results.keyCardPlayability);
  toPercent(results.keyCardPlayabilityBurst);

  // On-curve percentage (single number per card, not per-turn)
  Object.keys(results.keyCardOnCurvePlayability).forEach(name => {
    results.keyCardOnCurvePlayability[name] =
      (results.keyCardOnCurvePlayability[name] / results.handsKept) * 100;
  });

  return results;
};
