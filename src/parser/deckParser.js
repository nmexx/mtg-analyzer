/**
 * deckParser.js
 *
 * Parses an MTG Arena–format deck list into the internal card arrays used by
 * the simulation engine.
 *
 * All state that was previously closed over from the React component is passed
 * explicitly through `parserCtx`:
 * {
 *   cardLookupMap,   // Map<string, object>  – pre-built from the JSON file
 *   apiMode,         // 'local' | 'scryfall'
 *   lookupCard,      // async (name: string) => cardData | null
 * }
 *
 * Returns a deck object (see return type below) or null on fatal parse failure.
 * Errors are included in the returned object's `errors` array — the caller is
 * responsible for surfacing them to the UI.
 */

import { processCardData, processSpell } from '../simulation/cardProcessors.js';

const EMPTY_RESULT = (errors = []) => ({
  errors,
  lands: [],
  artifacts: [],
  creatures: [],
  exploration: [],
  rituals: [],
  rampSpells: [],
  costReducers: [],
  drawSpells: [],
  spells: [],
  totalCards: 0,
  landCount: 0,
});

/**
 * parseDeckList
 *
 * @param {string}  deckText   Raw deck list text (MTG Arena format).
 * @param {object}  parserCtx  { cardLookupMap, apiMode, lookupCard }
 * @returns {Promise<object|null>}
 */
export const parseDeckList = async (deckText, parserCtx = {}) => {
  const { cardLookupMap = new Map(), apiMode = 'local', lookupCard } = parserCtx;
  const errors = [];

  if (!deckText.trim()) {
    return EMPTY_RESULT(['Please enter a deck list']);
  }
  if (cardLookupMap.size === 0 && apiMode === 'local') {
    return EMPTY_RESULT(['Please upload cards.json file first']);
  }
  if (typeof lookupCard !== 'function') {
    return EMPTY_RESULT(['No card lookup function provided']);
  }

  // ── Parse quantity + name pairs ──────────────────────────────────────────
  const lines = deckText.split('\n');
  const cardCounts = new Map();

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      !trimmed ||
      trimmed.startsWith('//') ||
      trimmed.startsWith('#') ||
      trimmed.toLowerCase() === 'deck' ||
      trimmed.toLowerCase() === 'sideboard' ||
      trimmed.toLowerCase() === 'commander'
    )
      continue;

    const numMatch = trimmed.match(/^(\d+)x?\s+(.+)$/);
    let quantity, cardName;
    if (numMatch) {
      quantity = parseInt(numMatch[1], 10);
      cardName = numMatch[2].trim();
    } else {
      // No leading number — treat as a single copy
      quantity = 1;
      cardName = trimmed;
    }
    cardCounts.set(cardName, (cardCounts.get(cardName) || 0) + quantity);
  }

  if (cardCounts.size === 0) return null;

  // ── Look up and categorise each card ─────────────────────────────────────
  const lands = [];
  const artifacts = [];
  const creatures = [];
  const rituals = [];
  const rampSpells = [];
  const costReducers = [];
  const exploration = [];
  const drawSpells = [];
  const spells = [];

  for (const [cardName, quantity] of cardCounts.entries()) {
    const cardData = await lookupCard(cardName);
    if (!cardData) {
      errors.push(`Card "${cardName}" not found`);
      continue;
    }

    const processed = processCardData(cardData);
    if (!processed) continue; // transform-land back face → skip

    processed.quantity = quantity;

    // MDFCs with a land face also get a spell-side entry for key-card selection
    if (cardData.layout === 'modal_dfc' && cardData.card_faces?.length > 0) {
      const frontFace = cardData.card_faces[0];
      const backFace = cardData.card_faces[1];
      const frontIsLand = frontFace.type_line?.toLowerCase().includes('land');
      const backIsLand = backFace.type_line?.toLowerCase().includes('land');

      if (frontIsLand || backIsLand) {
        lands.push(processed);

        // Add the non-land face as a spell option
        const spellVersion = processSpell(cardData);
        spellVersion.quantity = quantity;
        spellVersion.name = cardData.name;
        spellVersion.isMDFCSpellSide = true;
        spells.push(spellVersion);
        continue;
      }
    }

    // Normal categorisation
    if (processed.isLand) lands.push(processed);
    else if (processed.isManaArtifact) artifacts.push(processed);
    else if (processed.isManaCreature) creatures.push(processed);
    else if (processed.isExploration) exploration.push(processed);
    else if (processed.isCostReducer) costReducers.push(processed);
    else if (processed.isRitual) rituals.push(processed);
    else if (processed.isRampSpell) rampSpells.push(processed);
    else if (processed.isDrawSpell) drawSpells.push(processed);
    else spells.push(processed);
  }

  const groups = [
    lands,
    artifacts,
    creatures,
    exploration,
    costReducers,
    rituals,
    rampSpells,
    drawSpells,
    spells,
  ];
  // MDFCs are stored in both lands[] and spells[] (isMDFCSpellSide); exclude the spell copy from the count
  const totalCards = groups.reduce(
    (sum, g) => sum + g.reduce((s, c) => s + (c.isMDFCSpellSide ? 0 : c.quantity), 0),
    0
  );

  return {
    lands,
    artifacts,
    creatures,
    exploration,
    costReducers,
    rituals,
    rampSpells,
    drawSpells,
    spells,
    totalCards,
    landCount: lands.reduce((sum, c) => sum + c.quantity, 0),
    errors,
  };
};
