/**
 * cardProcessors.js
 *
 * Pure functions that transform raw Scryfall card data into the internal card
 * objects used throughout the simulation.  No React state is read here.
 */

import { RAMP_SPELL_DATA } from '../../Card_Archive/Ramp_Spells.js';
import { ARTIFACT_DATA, BURST_MANA_SOURCES } from '../../Card_Archive/Artifacts.js';
import { MANA_DORK_DATA } from '../../Card_Archive/Mana_Dorks.js';
import { EXPLORATION_EFFECTS } from '../../Card_Archive/Exploration_Effects.js';
import { RITUAL_DATA } from '../../Card_Archive/Rituals.js';
import LAND_DATA, {
  FETCH_LAND_DATA,
  KNOWN_FETCH_LANDS,
  LANDS_ENTER_TAPPED_ALWAYS,
  BOUNCE_LANDS,
  REVEAL_LANDS,
  CHECK_LANDS,
  FAST_LANDS,
  PAIN_LANDS,
  FIVE_COLOR_PAIN_LANDS,
  FILTER_LANDS,
  MAN_LANDS,
  STORAGE_LANDS,
  CROWD_LANDS,
  UTILITY_LANDS_UNTAPPED,
  ODYSSEY_FILTER_LANDS,
  HIDEAWAY_LANDS,
  CONDITIONAL_LIFE_LANDS,
  BATTLE_LANDS,
  SLOW_LANDS,
  PATHWAY_LANDS,
  SCALES_WITH_SWAMPS_LANDS,
  SCALES_WITH_BASIC_SWAMPS_LANDS,
  SIMPLIFIED_MANA_LANDS,
  PHYREXIAN_TOWER_LANDS,
  TEMPLE_FALSE_GOD_LANDS,
  THRIVING_LANDS,
  VERGE_LANDS,
  HORIZON_LANDS,
  MDFC_LANDS,
} from './landData.js';

// ─────────────────────────────────────────────────────────────────────────────
// Low-level text helpers
// ─────────────────────────────────────────────────────────────────────────────

export const extractManaProduction = oracleText => {
  if (!oracleText) return [];
  const produces = [];
  const manaSymbols = oracleText.match(/\{[WUBRGC]\}/g);
  if (manaSymbols) {
    manaSymbols.forEach(symbol => {
      const color = symbol.replace(/[{}]/g, '');
      if (!produces.includes(color)) produces.push(color);
    });
  }
  if (oracleText.includes('any color') || oracleText.includes('mana of any color')) {
    return ['W', 'U', 'B', 'R', 'G'];
  }
  return produces;
};

export const extractManaAmount = oracleText => {
  if (!oracleText) return 1;
  const colorlessRuns = oracleText.match(/(?:\{C\})+/g);
  if (colorlessRuns) {
    const maxRun = colorlessRuns.reduce((max, run) => {
      const count = run.split('{C}').length - 1;
      return Math.max(max, count);
    }, 0);
    if (maxRun > 1) return maxRun;
  }
  return 1;
};

export const extractRitualManaAmount = oracleText => {
  if (!oracleText) return 1;
  const manaSymbols = oracleText.match(/Add\s+(\{[WUBRGC]\})+/i);
  if (manaSymbols) {
    const symbols = manaSymbols[0].match(/\{[WUBRGC]\}/g);
    if (symbols) return symbols.length;
  }
  const wordMatch = oracleText.match(/add\s+(one|two|three|four|five|six|seven)\s+mana/i);
  if (wordMatch) {
    const wordToNum = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };
    return wordToNum[wordMatch[1].toLowerCase()] || 1;
  }
  const numMatch = oracleText.match(/add\s+(\d+)\s+mana/i);
  if (numMatch) return parseInt(numMatch[1], 10) || 1;
  return 1;
};

export const calculateCMC = (dataCmc, manaCostString) => {
  let cmc = dataCmc;
  if (manaCostString) {
    let calculatedCmc = 0;
    const symbols = manaCostString.match(/\{([^}]+)\}/g) || [];
    symbols.forEach(symbol => {
      const clean = symbol.replace(/[{}]/g, '');
      const num = parseInt(clean);
      if (!isNaN(num)) {
        calculatedCmc += num;
      } else if (clean !== 'X' && clean !== 'Y' && clean !== 'Z') {
        calculatedCmc += 1;
      }
    });
    if (cmc === undefined || cmc === null || (cmc === 0 && calculatedCmc > 0)) {
      cmc = calculatedCmc;
    }
  }
  const result = parseInt(cmc, 10);
  return isNaN(result) ? 0 : result;
};

export const hasManaTapAbility = oracleText => {
  if (!oracleText) return false;
  return /\{t\}:?\s*add|add\s*\{[wubrgc]/i.test(oracleText);
};

// ─────────────────────────────────────────────────────────────────────────────
// processLand
// ─────────────────────────────────────────────────────────────────────────────
export const processLand = (data, face, _isMDFC) => {
  const name = data.name.toLowerCase();
  const oracleText = face.oracle_text || '';
  const ldEntry = LAND_DATA.get(name);

  // Exclude transform cards whose back side is a land
  if (data.layout === 'transform' && data.card_faces && data.card_faces.length > 0) {
    const frontFace = data.card_faces[0];
    const backFace = data.card_faces[1];
    if (
      !frontFace.type_line?.toLowerCase().includes('land') &&
      backFace.type_line?.toLowerCase().includes('land')
    ) {
      return null;
    }
  }

  // Fetch detection
  const knownFetch = FETCH_LAND_DATA.get(name);
  const isFetch =
    !!knownFetch ||
    (oracleText.includes('search your library') &&
      oracleText.includes('land card') &&
      oracleText.includes('battlefield'));

  let fetchType = null;
  let fetchColors = [];
  let isHideawayFetch = false;
  let fetchesOnlyBasics = false;
  let fetchesTwoLands = false;
  let fetchcost = 0;
  let fetchedLandEntersTapped = false;
  let entersTappedAlways = false;
  let isBounce = false;
  let isReveal = false;
  let isCheck = false;
  let isFast = false;
  let isBattleLand = false;
  let isSlowLand = false;
  let isPathway = false;

  if (isFetch) {
    if (knownFetch) {
      fetchType = knownFetch.fetchType;
      fetchColors = knownFetch.fetchColors;
      fetchesOnlyBasics = knownFetch.fetchesOnlyBasics;
      fetchesTwoLands = knownFetch.fetchesTwoLands;
      fetchedLandEntersTapped = knownFetch.fetchedLandEntersTapped;
      isHideawayFetch = knownFetch.isHideawayFetch ?? false;
      fetchcost = knownFetch.fetchcost ?? 0;
      if (knownFetch.entersTappedAlways) entersTappedAlways = true;
    } else {
      if (HIDEAWAY_LANDS.has(name)) {
        fetchType = 'hideaway';
        isHideawayFetch = true;
        fetchesOnlyBasics = true;
        if (oracleText.includes('{T}: Add')) {
          const manaSymbols = oracleText.match(/\{[WUBRGC]\}/g);
          if (manaSymbols) {
            const colorToType = {
              W: 'Plains',
              U: 'Island',
              B: 'Swamp',
              R: 'Mountain',
              G: 'Forest',
            };
            const colors = [...new Set(manaSymbols.map(s => s.replace(/[{}]/g, '')))];
            fetchColors = colors.map(c => colorToType[c] || c).filter(Boolean);
          }
        }
      } else if (oracleText.toLowerCase().includes('basic land')) {
        fetchType = 'free_slow';
        fetchesOnlyBasics = true;
        fetchedLandEntersTapped = true;
        fetchColors = ['W', 'U', 'B', 'R', 'G'];
      } else if (
        oracleText.toLowerCase().includes('pay 1 life') &&
        !oracleText.toLowerCase().includes('tapped')
      ) {
        fetchType = 'classic';
      } else if (
        oracleText.toLowerCase().includes('pay 1 life') &&
        oracleText.toLowerCase().includes('tapped')
      ) {
        fetchType = 'slow';
      } else if (oracleText.match(/\{[0-9]+\}/)) {
        fetchType = 'mana_cost';
      } else {
        fetchType = 'free_slow';
      }
      if (!isHideawayFetch && !fetchesOnlyBasics) {
        const typeMatch = oracleText.match(/(Plains|Island|Swamp|Mountain|Forest)/g);
        if (typeMatch) {
          const typeToColor = { Plains: 'W', Island: 'U', Swamp: 'B', Mountain: 'R', Forest: 'G' };
          fetchColors = [...new Set(typeMatch.map(t => typeToColor[t]))];
        }
      }
    }
  }

  // Land subtypes
  const landSubtypes = [];
  if (face.type_line) {
    const types = face.type_line.split('—')[1];
    if (types) {
      ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes'].forEach(type => {
        if (types.includes(type)) landSubtypes.push(type);
      });
    }
  }
  if (landSubtypes.length === 0 && ldEntry?.types?.length) {
    landSubtypes.push(...ldEntry.types);
  }

  const isBasic =
    face.type_line?.includes('Basic') ||
    ['plains', 'island', 'swamp', 'mountain', 'forest', 'wastes'].includes(name);

  // Mana production
  const produces = [];
  if (FIVE_COLOR_PAIN_LANDS.has(name)) {
    produces.push('W', 'U', 'B', 'R', 'G');
  } else if (oracleText.includes('{T}: Add')) {
    const manaSymbols = oracleText.match(/\{[WUBRGC]\}/g);
    if (manaSymbols) {
      manaSymbols.forEach(symbol => {
        const color = symbol.replace(/[{}]/g, '');
        if (!produces.includes(color)) produces.push(color);
      });
    }
    if (oracleText.includes('any color') || oracleText.includes('mana of any color')) {
      produces.push('W', 'U', 'B', 'R', 'G');
    }
  }
  if (produces.length === 0 && ldEntry?.color_identity?.length) {
    ldEntry.color_identity.forEach(c => {
      if (!produces.includes(c)) produces.push(c);
    });
  }

  const manaAmount = ldEntry?.sim_flags?.manaAmount ?? 1;

  const hasInternalLogic = LAND_DATA.has(name) || KNOWN_FETCH_LANDS.has(name);

  if (BOUNCE_LANDS.has(name)) {
    entersTappedAlways = true;
    isBounce = true;
  } else if (LANDS_ENTER_TAPPED_ALWAYS.has(name)) {
    entersTappedAlways = true;
  } else if (knownFetch?.entersTappedAlways) {
    entersTappedAlways = true;
  } else if (HIDEAWAY_LANDS.has(name)) {
    entersTappedAlways = true;
  } else if (CONDITIONAL_LIFE_LANDS.has(name)) {
    entersTappedAlways = true;
  } else if (BATTLE_LANDS.has(name)) {
    isBattleLand = true;
  } else if (SLOW_LANDS.has(name)) {
    isSlowLand = true;
  } else if (PATHWAY_LANDS.has(name)) {
    isPathway = true;
  } else if (REVEAL_LANDS.has(name)) {
    entersTappedAlways = true;
    isReveal = true;
  } else if (CHECK_LANDS.has(name)) {
    isCheck = true;
  } else if (FAST_LANDS.has(name)) {
    isFast = true;
  } else if (PAIN_LANDS.has(name)) {
    entersTappedAlways = false;
  } else if (FIVE_COLOR_PAIN_LANDS.has(name)) {
    entersTappedAlways = false;
  } else if (FILTER_LANDS.has(name)) {
    entersTappedAlways = false;
  } else if (HORIZON_LANDS.has(name)) {
    entersTappedAlways = false;
  } else if (MAN_LANDS.has(name)) {
    entersTappedAlways = true;
  } else if (STORAGE_LANDS.has(name)) {
    entersTappedAlways = true;
  } else if (CROWD_LANDS.has(name)) {
    entersTappedAlways = undefined; // determined at runtime in doesLandEnterTapped
  } else if (UTILITY_LANDS_UNTAPPED.has(name)) {
    entersTappedAlways = false;
  } else if (ODYSSEY_FILTER_LANDS.has(name)) {
    entersTappedAlways = false;
  } else if (MDFC_LANDS.has(name)) {
    entersTappedAlways = false; // doesLandEnterTapped + playLand handle ETB dynamically (pay 3 life)
  } else {
    const hasEntersTappedText =
      oracleText.toLowerCase().includes('enters the battlefield tapped') ||
      oracleText.toLowerCase().includes('enters tapped');
    const hasUnlessCondition =
      oracleText.includes('unless') ||
      oracleText.includes('if you control') ||
      oracleText.includes('if an opponent') ||
      oracleText.includes('As ~ enters');
    entersTappedAlways = hasEntersTappedText && !hasUnlessCondition;
  }

  const isShockLand =
    !!ldEntry?.sim_flags?.isShockLand ||
    (landSubtypes.length === 2 && oracleText.includes('pay 2 life'));

  const isAncientTomb = name === 'ancient tomb';
  const isCityOfTraitors = name === 'city of traitors';
  const isPainLand = PAIN_LANDS.has(name);
  const isFiveColorPainLand = FIVE_COLOR_PAIN_LANDS.has(name);
  const isCrowd = CROWD_LANDS.has(name) || !!ldEntry?.sim_flags?.isCrowd;
  const checkTypes = ldEntry?.types ?? [];
  const cycleName = ldEntry?.cycleName ?? null;
  const isRoadLand = !!ldEntry?.sim_flags?.isRoadLand;
  const isFilterLand = FILTER_LANDS.has(name); // Shadowmoor — {A}/{B} activation
  const isOdysseyFilterLand = ODYSSEY_FILTER_LANDS.has(name); // Odyssey/Fallout — {1} activation
  const isHorizonLand = HORIZON_LANDS.has(name);
  const isMDFCLand = MDFC_LANDS.has(name); // Pay 3 life or enter tapped; untapped turns 1–4
  const isThriving = THRIVING_LANDS.has(name);
  const isVerge = VERGE_LANDS.has(name);
  const vergePrimary = isVerge ? (ldEntry?.primary ?? null) : null;
  const vergeSecondaryCheck = isVerge ? (ldEntry?.secondary_check ?? null) : null;

  return {
    name: data.name,
    type: 'land',
    isLand: true,
    isBasic,
    isFetch,
    fetchType,
    fetchColors,
    fetchesOnlyBasics,
    fetchesTwoLands,
    fetchedLandEntersTapped,
    isHideawayFetch,
    landSubtypes,
    produces,
    fetchcost,
    manaAmount,
    entersTappedAlways,
    isShockLand,
    hasCondition:
      oracleText.includes('unless you have two or more opponents') ||
      oracleText.includes('unless you control') ||
      oracleText.includes('unless an opponent'),
    isBounce,
    isReveal,
    isCheck,
    isFast,
    isBattleLand,
    isSlowLand,
    isPathway,
    isAncientTomb,
    isCityOfTraitors,
    isPainLand,
    isFiveColorPainLand,
    isCrowd,
    checkTypes,
    cycleName,
    isRoadLand,
    isFilterLand,
    isOdysseyFilterLand,
    isHorizonLand,
    isMDFCLand,
    isThriving,
    isVerge,
    vergePrimary,
    vergeSecondaryCheck,
    lifeloss: ldEntry?.sim_flags?.lifeloss ?? 0,
    // ── Scaling mana flags ────────────────────────────────────────────────────
    scalesWithSwamps: SCALES_WITH_SWAMPS_LANDS.has(name),
    scalesWithBasicSwamps: SCALES_WITH_BASIC_SWAMPS_LANDS.has(name),
    simplifiedMana: SIMPLIFIED_MANA_LANDS.has(name) ? 'turn-1' : null,
    manaFloor: ldEntry?.sim_flags?.manaFloor ?? null,
    isPhyrexianTower: PHYREXIAN_TOWER_LANDS.has(name),
    isTempleOfFalseGod: TEMPLE_FALSE_GOD_LANDS.has(name),
    hasInternalLogic,
    cmc: 0,
    manaCost: '',
    oracleText,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// processManaArtifact
// ─────────────────────────────────────────────────────────────────────────────
export const processManaArtifact = data => {
  const cardName = data.name.toLowerCase();
  const oracle = (data.oracle_text || '').toLowerCase();
  const known = ARTIFACT_DATA.get(cardName);

  const produces = known ? known.produces : extractManaProduction(data.oracle_text);
  const manaAmount = known ? known.manaAmount : extractManaAmount(data.oracle_text);
  const entersTapped =
    known != null
      ? known.entersTapped
      : oracle.includes('enters tapped') || oracle.includes('enters the battlefield tapped');
  const doesntUntapNaturally = known?.doesntUntapNaturally ?? false;
  const etbCost = known?.etbCost ?? null;
  const condition = known?.condition ?? null;

  const isMoxDiamond = cardName === 'mox diamond';
  const isChromeMox = cardName === 'chrome mox';
  const isMoxOpal = condition === 'metalcraft';
  const isMoxAmber = condition === 'legendary';
  const isBasaltMonolith = doesntUntapNaturally && cardName === 'basalt monolith';
  const isGrimMonolith = doesntUntapNaturally && cardName === 'grim monolith';
  const isManaVault = doesntUntapNaturally && cardName === 'mana vault';
  const isTalisman = known?.isTalisman ?? false;
  const lifeloss = known?.lifeloss ?? undefined;

  return {
    name: data.name,
    type: 'artifact',
    isManaArtifact: true,
    produces,
    manaAmount,
    entersTapped,
    isBasaltMonolith,
    isGrimMonolith,
    isManaVault,
    isMoxDiamond,
    isChromeMox,
    isMoxOpal,
    isMoxAmber,
    doesntUntapNaturally,
    etbCost,
    condition,
    isTalisman,
    ...(lifeloss !== undefined && { lifeloss }),
    cmc: calculateCMC(data.cmc, data.mana_cost),
    manaCost: data.mana_cost || '',
    oracleText: data.oracle_text,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// processManaCreature
// ─────────────────────────────────────────────────────────────────────────────
export const processManaCreature = data => {
  const cardName = data.name.toLowerCase();
  const known = MANA_DORK_DATA.get(cardName);
  const produces = known ? known.produces : extractManaProduction(data.oracle_text);
  const manaAmount = known ? known.manaAmount : extractManaAmount(data.oracle_text);
  return {
    name: data.name,
    type: 'creature',
    isManaCreature: true,
    produces,
    manaAmount,
    cmc: calculateCMC(data.cmc, data.mana_cost),
    manaCost: data.mana_cost || '',
    oracleText: data.oracle_text,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// processExploration
// ─────────────────────────────────────────────────────────────────────────────
export const processExploration = data => {
  const cardName = data.name.toLowerCase();
  let landsPerTurn = 2;
  if (cardName.includes('azusa')) landsPerTurn = 3;
  const isCreature = data.type_line?.includes('Creature');
  const isArtifact = data.type_line?.includes('Artifact');
  return {
    name: data.name,
    type: 'exploration',
    isExploration: true,
    isCreature,
    isArtifact,
    landsPerTurn,
    cmc: calculateCMC(data.cmc, data.mana_cost),
    manaCost: data.mana_cost || '',
    oracleText: data.oracle_text,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// processRampSpell
// ─────────────────────────────────────────────────────────────────────────────
export const processRampSpell = data => {
  const cardName = data.name.toLowerCase();
  const rampData = RAMP_SPELL_DATA.get(cardName) || {
    landsToAdd: 1,
    landsTapped: true,
    landsToHand: 0,
    sacrificeLand: false,
    fetchFilter: 'basic',
  };
  return {
    name: data.name,
    type: 'rampSpell',
    isRampSpell: true,
    landsToAdd: rampData.landsToAdd,
    landsTapped: rampData.landsTapped,
    landsToHand: rampData.landsToHand || 0,
    sacrificeLand: rampData.sacrificeLand || false,
    fetchFilter: rampData.fetchFilter || 'basic',
    fetchSubtypes: rampData.fetchSubtypes || null,
    cmc: calculateCMC(data.cmc, data.mana_cost),
    manaCost: data.mana_cost || '',
    oracleText: data.oracle_text,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// processRitual
// ─────────────────────────────────────────────────────────────────────────────
export const processRitual = data => {
  const cardName = data.name.toLowerCase();
  const ritualData = RITUAL_DATA.get(cardName) || { manaProduced: 1, netGain: 0, colors: [] };
  // Cards with activationCost use an ability (e.g. exile from hand) rather than
  // being cast, so their playability check should use the activation cost, not the CMC.
  const effectiveCmc =
    ritualData.activationCost !== undefined
      ? ritualData.activationCost
      : calculateCMC(data.cmc, data.mana_cost);
  const effectiveManaCost = ritualData.activationCost !== undefined ? '' : data.mana_cost || '';
  return {
    name: data.name,
    type: 'ritual',
    isRitual: true,
    manaProduced: ritualData.manaProduced,
    netGain: ritualData.netGain,
    ritualColors: ritualData.colors,
    cmc: effectiveCmc,
    manaCost: effectiveManaCost,
    oracleText: data.oracle_text,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// processSpell
// ─────────────────────────────────────────────────────────────────────────────
export const processSpell = data => {
  let cmc = data.cmc;
  let manaCost = data.mana_cost;
  let oracleText = data.oracle_text;
  let typeLine = data.type_line;

  if (data.card_faces && data.card_faces.length > 0) {
    const frontFace = data.card_faces[0];
    if (cmc === undefined || cmc === null) cmc = frontFace.cmc;
    if (!manaCost && frontFace.mana_cost) manaCost = frontFace.mana_cost;
    if (!oracleText && frontFace.oracle_text) oracleText = frontFace.oracle_text;
    if (!typeLine && frontFace.type_line) typeLine = frontFace.type_line;
  }
  const calculatedCMC = calculateCMC(cmc, manaCost);
  if (calculatedCMC === 0 && data.name) {
    console.warn(
      '⚠️ CMC is 0 for:',
      data.name,
      '| data.cmc:',
      data.cmc,
      '| data.mana_cost:',
      data.mana_cost
    );
  }
  return {
    name: data.name,
    type: 'spell',
    cmc: calculatedCMC,
    manaCost: manaCost || '',
    oracleText,
    typeLine,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// processCardData  (router — picks the correct processor for a raw Scryfall card)
// ─────────────────────────────────────────────────────────────────────────────
export const processCardData = data => {
  let frontFace = data;
  let isMDFC = false;

  if (data.card_faces && data.card_faces.length > 0) {
    const layout = data.layout?.toLowerCase() || '';
    if (layout === 'modal_dfc') {
      frontFace = data.card_faces[0];
      const backFace = data.card_faces[1];
      isMDFC = true;
      const frontIsLand = frontFace.type_line?.toLowerCase().includes('land');
      const backIsLand = backFace.type_line?.toLowerCase().includes('land');
      if (frontIsLand || backIsLand) {
        const landFace = frontIsLand ? frontFace : backFace;
        return processLand(data, landFace, isMDFC);
      }
    } else if (layout === 'transform' || layout === 'double_faced_token') {
      frontFace = data.card_faces[0];
    }
  }

  const isLand = !isMDFC && data.type_line?.toLowerCase().includes('land');
  if (isLand) return processLand(data, data, false);

  const hasManaTap = hasManaTapAbility(data.oracle_text || frontFace.oracle_text);
  const cardName = data.name.toLowerCase();
  const isCreature = (data.type_line || frontFace.type_line)?.includes('Creature');
  if (isCreature && hasManaTap) return processManaCreature(data);

  const isArtifact = (data.type_line || frontFace.type_line)?.includes('Artifact');
  if (isArtifact && !isCreature && hasManaTap) return processManaArtifact(data);
  if (isArtifact && !isCreature && ARTIFACT_DATA.has(cardName) && !BURST_MANA_SOURCES.has(cardName))
    return processManaArtifact(data);

  if (EXPLORATION_EFFECTS.has(cardName)) return processExploration(data);
  if (RAMP_SPELL_DATA.has(cardName)) return processRampSpell(data);
  if (RITUAL_DATA.has(cardName)) return processRitual(data);
  return processSpell(data);
};
