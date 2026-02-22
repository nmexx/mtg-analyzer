// Card-draw behavioral data for the MTG Monte Carlo Simulator.
// Covers 115 of the most commonly played card-draw sources in the Commander format.
//
// Fields:
//   cardType        – 'enchantment' | 'instant' | 'sorcery' | 'creature' |
//                     'artifact' | 'planeswalker'
//   cmc             – converted mana cost (mana value)
//   colorIdentity   – Commander color identity as an array of color symbols.
//                     ['W','U','B','R','G'] are the five colors; ['C'] means colorless.
//                     Multi-color cards list all colors present anywhere on the card.
//   triggerType     – when the draw happens:
//                     'cast'             – fires when this spell resolves
//                     'etb'              – fires when this permanent enters the battlefield
//                     'upkeep'           – fires at the beginning of your upkeep
//                     'opponent_cast'    – fires whenever an opponent casts a spell
//                     'on_draw'          – fires whenever any player draws a card
//                     'on_life_loss'     – fires whenever you lose life
//                     'combat'           – fires on combat damage / attack trigger
//                     'dies'             – fires when a creature/permanent dies
//                     'activated'        – player pays a cost to draw (activated ability)
//                     'enchantment_cast' – fires when you cast an enchantment
//                     'creature_etb'     – fires when a qualifying creature enters
//                     'land_etb'         – fires when a land enters the battlefield
//                     'historic_cast'    – fires when you cast a historic spell
//                     'instant_sorcery'  – fires when you cast/copy an instant or sorcery
//                     'lifegain'         – fires when you gain life
//                     'counter'          – fires when +1/+1 counters are placed on this
//   cardsDrawn      – raw cards drawn per single trigger (0 = fully variable / see note)
//   cardsDiscarded  – cards put back into library or discarded as part of the same effect
//   netCardsDrawn   – cardsDrawn − cardsDiscarded (actual hand-size gain per trigger)
//   avgCardsPerTurn – realistic estimated hand-size gain per full 4-player turn rotation;
//                     for variable/conditional cards this is a conservative median estimate
//   note            – brief rules summary and assumptions used for the estimate

export const CARD_DRAW_DATA = new Map([
  // ══════════════════════════════════════════════════════════════════════════
  // ENCHANTMENTS
  // ══════════════════════════════════════════════════════════════════════════

  // Draws a card whenever an opponent casts a spell unless they pay {1}.
  // 3 opponents typically pay ~half the time → ~1.5 triggers/opponent turn × 3 opponents.
  [
    'rhystic study',
    {
      cardType: 'enchantment',
      cmc: 3,
      triggerType: 'opponent_cast',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 2.5,
      colorIdentity: ['U'],
      note: 'Draw 1 when an opponent casts a spell unless they pay {1}. Estimate: ~2.5 cards/rotation in 4-player.',
    },
  ],

  // Similar to Rhystic Study but has a cumulative upkeep that eventually forces it off.
  // Early turns very high draw; model at a per-rotation average assuming 3–4 turns of life.
  [
    'mystic remora',
    {
      cardType: 'enchantment',
      cmc: 1,
      triggerType: 'opponent_cast',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 2.0,
      colorIdentity: ['U'],
      note: 'Draw 1 when an opponent casts a non-creature spell unless they pay {4}. Cumulative upkeep limits longevity; avg ~2 cards/rotation.',
    },
  ],

  // Draw an extra card at the start of each upkeep; lose 1 life.
  [
    'phyrexian arena',
    {
      cardType: 'enchantment',
      cmc: 3,
      triggerType: 'upkeep',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1,
      colorIdentity: ['B'],
      note: 'Draw 1 at the beginning of your upkeep; lose 1 life. Reliable 1 card/turn.',
    },
  ],

  // Draw 3 instead of 1 each upkeep; put 2 back (by paying 4 life each) or keep top 1 free.
  // Conservative model: player usually finances 2 extra draws by paying 8 life → net +2/turn.
  [
    'sylvan library',
    {
      cardType: 'enchantment',
      cmc: 2,
      triggerType: 'upkeep',
      cardsDrawn: 3,
      cardsDiscarded: 2,
      netCardsDrawn: 1,
      avgCardsPerTurn: 2,
      colorIdentity: ['G'],
      note: 'Draw 3 each upkeep; put back up to 2 or pay 4 life each to keep. Avg ~2 net cards/turn with life payments.',
    },
  ],

  // Skip your draw step; pay 1 life per card to exile and put into hand at end step.
  // Estimate: player averages ~3 life-paid draws per turn.
  [
    'necropotence',
    {
      cardType: 'enchantment',
      cmc: 3,
      triggerType: 'activated',
      cardsDrawn: 0,
      cardsDiscarded: 0,
      netCardsDrawn: 0,
      avgCardsPerTurn: 3,
      colorIdentity: ['B'],
      note: 'Skip draw step; pay 1 life: exile top card, put into hand at end step. Avg ~3 cards/turn depending on life total.',
    },
  ],

  // Pay {1}{B}: draw a card; lose 2 life.
  [
    'greed',
    {
      cardType: 'enchantment',
      cmc: 4,
      triggerType: 'activated',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 2,
      colorIdentity: ['B'],
      note: 'Activated: {1}{B}, draw 1, lose 2 life. Avg ~2 activations per turn when mana-available.',
    },
  ],

  // Draw a card whenever you cast an enchantment spell.
  [
    "enchantress's presence",
    {
      cardType: 'enchantment',
      cmc: 3,
      triggerType: 'enchantment_cast',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1.5,
      colorIdentity: ['G'],
      note: 'Draw 1 whenever you cast an enchantment. Avg ~1.5 cards/turn in an enchantress deck.',
    },
  ],

  // Draw a card whenever a non-token creature enters under your control (if no other of that name).
  [
    'guardian project',
    {
      cardType: 'enchantment',
      cmc: 4,
      triggerType: 'creature_etb',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1.5,
      colorIdentity: ['G'],
      note: 'Draw 1 when a non-token creature enters if no other creature with that name is on the battlefield. Avg ~1.5 cards/turn in creature-heavy decks.',
    },
  ],

  // Opponents lose 1 life when they draw; you may pay {1}{B}: draw 1, lose 2 life.
  [
    'erebos, god of the dead',
    {
      cardType: 'creature',
      cmc: 4,
      triggerType: 'activated',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 2,
      colorIdentity: ['B'],
      note: 'Activated: {1}{B}, draw 1, lose 2 life (same as Greed). Avg ~2 activations/turn.',
    },
  ],

  // Draw a card whenever you cast an enchantment spell.
  [
    'satyr enchanter',
    {
      cardType: 'creature',
      cmc: 2,
      triggerType: 'enchantment_cast',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1.5,
      colorIdentity: ['G', 'W'],
      note: 'Draw 1 whenever you cast an enchantment. Avg ~1.5 cards/turn in an enchantress deck.',
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // INSTANTS
  // ══════════════════════════════════════════════════════════════════════════

  // The most powerful cantrip ever printed.
  [
    'ancestral recall',
    {
      cardType: 'instant',
      cmc: 1,
      triggerType: 'cast',
      cardsDrawn: 3,
      cardsDiscarded: 0,
      netCardsDrawn: 3,
      avgCardsPerTurn: 3,
      colorIdentity: ['U'],
      note: 'Draw 3 cards. One-shot; net +3 for its {U} cost.',
    },
  ],

  // Draw 3, put 2 back on top — net +1 but sets up top of library.
  [
    'brainstorm',
    {
      cardType: 'instant',
      cmc: 1,
      triggerType: 'cast',
      cardsDrawn: 3,
      cardsDiscarded: 2,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1,
      colorIdentity: ['U'],
      note: 'Draw 3, put 2 cards from hand on top of library. Net +1 hand size; excellent with shuffle effects.',
    },
  ],

  // Reveal top 5; opponent divides into two piles, you pick one pile.
  // With 5 revealed, a conservative pick averages ~3 cards.
  [
    'fact or fiction',
    {
      cardType: 'instant',
      cmc: 4,
      triggerType: 'cast',
      cardsDrawn: 0,
      cardsDiscarded: 0,
      netCardsDrawn: 3,
      avgCardsPerTurn: 3,
      colorIdentity: ['U'],
      note: 'Reveal top 5; opponent splits into piles; you choose one pile. Avg ~3 cards after strategic splitting.',
    },
  ],

  // Delve — draw 2 cards from the top 7.
  [
    'dig through time',
    {
      cardType: 'instant',
      cmc: 8,
      triggerType: 'cast',
      cardsDrawn: 2,
      cardsDiscarded: 0,
      netCardsDrawn: 2,
      avgCardsPerTurn: 2,
      colorIdentity: ['U'],
      note: 'Delve; look at top 7, put 2 in hand, rest on bottom. Net +2 with strong selection.',
    },
  ],

  // Draw X−1.
  [
    'pull from tomorrow',
    {
      cardType: 'instant',
      cmc: 0,
      triggerType: 'cast',
      cardsDrawn: 0,
      cardsDiscarded: 0,
      netCardsDrawn: 4,
      avgCardsPerTurn: 4,
      colorIdentity: ['U'],
      note: 'Draw X−1 cards; discard a card. Variable; avg ~4–5 cards when cast for X=5 in mid-to-late game.',
    },
  ],

  // Pay X life, draw X cards (instant).
  [
    'necrologia',
    {
      cardType: 'instant',
      cmc: 5,
      triggerType: 'cast',
      cardsDrawn: 0,
      cardsDiscarded: 0,
      netCardsDrawn: 5,
      avgCardsPerTurn: 5,
      colorIdentity: ['B'],
      note: 'End of turn; pay X life, draw X cards. Typically cast for 5–8 — model at avg net +5.',
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // SORCERIES
  // ══════════════════════════════════════════════════════════════════════════

  // Look at top 3; put them back in any order (or shuffle), then draw 1.
  [
    'ponder',
    {
      cardType: 'sorcery',
      cmc: 1,
      triggerType: 'cast',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1,
      colorIdentity: ['U'],
      note: 'Look at top 3, reorder or shuffle library, draw 1. Net +1 with significant filtering.',
    },
  ],

  // Scry 2, then draw 1.
  [
    'preordain',
    {
      cardType: 'sorcery',
      cmc: 1,
      triggerType: 'cast',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1,
      colorIdentity: ['U'],
      note: 'Scry 2, then draw 1. Net +1 with light filtering.',
    },
  ],

  // Everyone discards hand, draws 7.
  [
    'wheel of fortune',
    {
      cardType: 'sorcery',
      cmc: 3,
      triggerType: 'cast',
      cardsDrawn: 7,
      cardsDiscarded: 0,
      netCardsDrawn: 7,
      avgCardsPerTurn: 7,
      colorIdentity: ['R'],
      note: 'Each player discards their hand and draws 7 cards. Net +7 from an empty or near-empty hand; less if hand is full.',
    },
  ],

  // Each player shuffles hand+graveyard into library, draws 7; untap lands.
  [
    'timetwister',
    {
      cardType: 'sorcery',
      cmc: 3,
      triggerType: 'cast',
      cardsDrawn: 7,
      cardsDiscarded: 0,
      netCardsDrawn: 7,
      avgCardsPerTurn: 7,
      colorIdentity: ['U'],
      note: 'Each player shuffles hand and graveyard into library and draws 7. Symmetrical but powerful as reset.',
    },
  ],

  // Shuffle graveyard+hand into library, each player draws 7, untap lands.
  [
    'time spiral',
    {
      cardType: 'sorcery',
      cmc: 6,
      triggerType: 'cast',
      cardsDrawn: 7,
      cardsDiscarded: 0,
      netCardsDrawn: 7,
      avgCardsPerTurn: 7,
      colorIdentity: ['U'],
      note: 'Each player shuffles their hand and graveyard into library and draws 7; untap up to 6 lands. Free on suspend.',
    },
  ],

  // Each player discards hand and draws cards equal to the number of cards the player with the most cards in hand had.
  [
    'windfall',
    {
      cardType: 'sorcery',
      cmc: 3,
      triggerType: 'cast',
      cardsDrawn: 0,
      cardsDiscarded: 0,
      netCardsDrawn: 5,
      avgCardsPerTurn: 5,
      colorIdentity: ['U'],
      note: 'Each player discards hand, then draws equal to the largest hand size at the table. Avg ~5 cards in a 4-player game.',
    },
  ],

  // Delve — draw 3 cards.
  [
    'treasure cruise',
    {
      cardType: 'sorcery',
      cmc: 8,
      triggerType: 'cast',
      cardsDrawn: 3,
      cardsDiscarded: 0,
      netCardsDrawn: 3,
      avgCardsPerTurn: 3,
      colorIdentity: ['U'],
      note: 'Delve; draw 3 cards. Effectively {U} with enough graveyard fuel.',
    },
  ],

  // Draw 3 cards.
  [
    'harmonize',
    {
      cardType: 'sorcery',
      cmc: 4,
      triggerType: 'cast',
      cardsDrawn: 3,
      cardsDiscarded: 0,
      netCardsDrawn: 3,
      avgCardsPerTurn: 3,
      colorIdentity: ['G'],
      note: "Draw 3 cards. Green's Concentrate; no drawback.",
    },
  ],

  // Draw 3 cards.
  [
    'concentrate',
    {
      cardType: 'sorcery',
      cmc: 4,
      triggerType: 'cast',
      cardsDrawn: 3,
      cardsDiscarded: 0,
      netCardsDrawn: 3,
      avgCardsPerTurn: 3,
      colorIdentity: ['U'],
      note: 'Draw 3 cards.',
    },
  ],

  // Draw 2 cards.
  [
    'divination',
    {
      cardType: 'sorcery',
      cmc: 3,
      triggerType: 'cast',
      cardsDrawn: 2,
      cardsDiscarded: 0,
      netCardsDrawn: 2,
      avgCardsPerTurn: 2,
      colorIdentity: ['U'],
      note: 'Draw 2 cards.',
    },
  ],

  // Draw 2 cards, lose 2 life.
  [
    "night's whisper",
    {
      cardType: 'sorcery',
      cmc: 2,
      triggerType: 'cast',
      cardsDrawn: 2,
      cardsDiscarded: 0,
      netCardsDrawn: 2,
      avgCardsPerTurn: 2,
      colorIdentity: ['B'],
      note: 'Draw 2 cards; you lose 2 life.',
    },
  ],

  // Draw 2 cards, lose 2 life (flexible — can target opponent at sorcery speed).
  [
    'sign in blood',
    {
      cardType: 'sorcery',
      cmc: 2,
      triggerType: 'cast',
      cardsDrawn: 2,
      cardsDiscarded: 0,
      netCardsDrawn: 2,
      avgCardsPerTurn: 2,
      colorIdentity: ['B'],
      note: 'Target player draws 2 cards and loses 2 life. Self-targeting draws 2.',
    },
  ],

  // Draw 3 cards, lose 3 life — best with 3 colors in play.
  [
    'painful truths',
    {
      cardType: 'sorcery',
      cmc: 3,
      triggerType: 'cast',
      cardsDrawn: 3,
      cardsDiscarded: 0,
      netCardsDrawn: 3,
      avgCardsPerTurn: 3,
      colorIdentity: ['B'],
      note: 'Draw cards equal to the number of colors among permanents you control (max 3); lose that much life. Effectively draw 3 in a 3-color deck.',
    },
  ],

  // Scry 2, draw 2, lose 2 life.
  [
    'read the bones',
    {
      cardType: 'sorcery',
      cmc: 3,
      triggerType: 'cast',
      cardsDrawn: 2,
      cardsDiscarded: 0,
      netCardsDrawn: 2,
      avgCardsPerTurn: 2,
      colorIdentity: ['B'],
      note: 'Scry 2, then draw 2; you lose 2 life.',
    },
  ],

  // Draw 3 cards, lose 3 life.
  [
    "ambition's cost",
    {
      cardType: 'sorcery',
      cmc: 4,
      triggerType: 'cast',
      cardsDrawn: 3,
      cardsDiscarded: 0,
      netCardsDrawn: 3,
      avgCardsPerTurn: 3,
      colorIdentity: ['B'],
      note: 'Draw 3 cards; you lose 3 life. (Functional reprint of Ancient Craving.)',
    },
  ],

  // Draw X cards (double-sided with Blue Sun's Zenith style refill).
  [
    "blue sun's zenith",
    {
      cardType: 'sorcery',
      cmc: 0,
      triggerType: 'cast',
      cardsDrawn: 0,
      cardsDiscarded: 0,
      netCardsDrawn: 4,
      avgCardsPerTurn: 4,
      colorIdentity: ['U'],
      note: 'Target player draws X cards; when it leaves the stack it is shuffled back. Avg ~4 cards when cast for X=4 in mid-game.',
    },
  ],

  // Draw X cards.
  [
    'mind spring',
    {
      cardType: 'sorcery',
      cmc: 0,
      triggerType: 'cast',
      cardsDrawn: 0,
      cardsDiscarded: 0,
      netCardsDrawn: 4,
      avgCardsPerTurn: 4,
      colorIdentity: ['U'],
      note: 'Draw X cards. Typically cast for X=4–5; avg net +4.',
    },
  ],

  // Draw cards equal to the greatest number of cards in an opponent's hand — then repeat if played after first main.
  [
    'recurring insight',
    {
      cardType: 'sorcery',
      cmc: 6,
      triggerType: 'cast',
      cardsDrawn: 0,
      cardsDiscarded: 0,
      netCardsDrawn: 5,
      avgCardsPerTurn: 5,
      colorIdentity: ['U'],
      note: "Draw cards equal to the number of cards in target opponent's hand; rebound. Avg ~4–6 cards total over two casts.",
    },
  ],

  // Opponents each discard 1 card; you draw 1 for each card discarded this way.
  [
    'syphon mind',
    {
      cardType: 'sorcery',
      cmc: 4,
      triggerType: 'cast',
      cardsDrawn: 0,
      cardsDiscarded: 0,
      netCardsDrawn: 3,
      avgCardsPerTurn: 3,
      colorIdentity: ['B'],
      note: 'Each other player discards a card; you draw a card for each card discarded. Nets +3 in a 4-player game.',
    },
  ],

  // Draw cards equal to the CMC of your commander — very variable.
  [
    'stinging study',
    {
      cardType: 'sorcery',
      cmc: 5,
      triggerType: 'cast',
      cardsDrawn: 0,
      cardsDiscarded: 0,
      netCardsDrawn: 5,
      avgCardsPerTurn: 5,
      colorIdentity: ['B'],
      note: 'Draw cards equal to the mana value of your commander; lose that much life. Avg ~5 based on typical 5-CMC commander.',
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // CREATURES
  // ══════════════════════════════════════════════════════════════════════════

  // ETB: draw 2 (or evoke for just the draw).
  [
    'mulldrifter',
    {
      cardType: 'creature',
      cmc: 5,
      triggerType: 'etb',
      cardsDrawn: 2,
      cardsDiscarded: 0,
      netCardsDrawn: 2,
      avgCardsPerTurn: 2,
      colorIdentity: ['U'],
      note: 'ETB draw 2. Evoke {2}{U} for immediate draw at instant speed.',
    },
  ],

  // Draw 2 whenever an opponent draws a card.
  [
    'consecrated sphinx',
    {
      cardType: 'creature',
      cmc: 6,
      triggerType: 'on_draw',
      cardsDrawn: 2,
      cardsDiscarded: 0,
      netCardsDrawn: 2,
      avgCardsPerTurn: 4,
      colorIdentity: ['U'],
      note: 'Whenever an opponent draws a card, you may draw 2. With 3 opponents drawing ~2/turn each, avg ~4–6 cards/rotation.',
    },
  ],

  // Draw a card whenever an unblocked creature deals combat damage to an opponent (not the creature itself).
  [
    'edric, spymaster of trest',
    {
      cardType: 'creature',
      cmc: 3,
      triggerType: 'combat',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 2,
      colorIdentity: ['G', 'U'],
      note: 'Whenever a creature deals combat damage to a player, its controller may draw a card. Avg ~2 cards/turn from your own evasive creatures.',
    },
  ],

  // Draw 1 when a creature with power 2 or less enters (pay {1}).
  [
    'mentor of the meek',
    {
      cardType: 'creature',
      cmc: 3,
      triggerType: 'creature_etb',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1.5,
      colorIdentity: ['W'],
      note: 'Whenever a creature with power 2 or less enters the battlefield, pay {1}: draw a card. Avg ~1.5 cards/turn in token/weenie decks.',
    },
  ],

  // Draw 1 per combat-damage-dealing creature you control at beginning of postcombat main phase.
  [
    'tymna the weaver',
    {
      cardType: 'creature',
      cmc: 3,
      triggerType: 'combat',
      cardsDrawn: 0,
      cardsDiscarded: 0,
      netCardsDrawn: 2,
      avgCardsPerTurn: 2,
      colorIdentity: ['W', 'B'],
      note: 'At beginning of postcombat main phase, draw 1 for each opponent dealt combat damage this turn; pay 1 life each. Avg ~2 cards/turn with multiple attackers.',
    },
  ],

  // Draw a card whenever a +1/+1 counter is placed on Fathom Mage.
  [
    'fathom mage',
    {
      cardType: 'creature',
      cmc: 4,
      triggerType: 'counter',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1.5,
      colorIdentity: ['G', 'U'],
      note: 'Draw 1 whenever a +1/+1 counter is placed on Fathom Mage. Avg ~1.5 cards/turn with proliferate or evolve support.',
    },
  ],

  // ETB: look at top 2, put 1 in hand; dies: draw a card.
  [
    'solemn simulacrum',
    {
      cardType: 'creature',
      cmc: 4,
      triggerType: 'dies',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1,
      colorIdentity: ['C'],
      note: 'ETB search a basic land; when it dies, draw 1. One-time draw on death.',
    },
  ],

  // Flash; replacement effect — whenever an opponent draws a card, you draw instead.
  [
    'notion thief',
    {
      cardType: 'creature',
      cmc: 4,
      triggerType: 'on_draw',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 3,
      colorIdentity: ['U', 'B'],
      note: 'If an opponent would draw a card, you draw instead. Devastating against Windfall/wheel effects. Avg ~3 cards/rotation from opponent draws.',
    },
  ],

  // Draw a card whenever you cast an enchantment (creature-based enchantress effect).
  [
    'mesa enchantress',
    {
      cardType: 'creature',
      cmc: 3,
      triggerType: 'enchantment_cast',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1.5,
      colorIdentity: ['W'],
      note: 'Draw 1 whenever you cast an enchantment. Avg ~1.5 cards/turn in an enchantress deck.',
    },
  ],

  // Draw a card for each card opponent draws (pair with Windfall/wheels).
  [
    'smothering tithe',
    {
      cardType: 'enchantment',
      cmc: 4,
      triggerType: 'opponent_cast',
      cardsDrawn: 0,
      cardsDiscarded: 0,
      netCardsDrawn: 0,
      avgCardsPerTurn: 0,
      colorIdentity: ['W'],
      note: 'NOT card draw — generates Treasure tokens unless opponents pay {2}. Included for context; produces mana, not cards.',
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // ARTIFACTS
  // ══════════════════════════════════════════════════════════════════════════

  // Equipped creature that dies makes you draw 2.
  [
    'skullclamp',
    {
      cardType: 'artifact',
      cmc: 1,
      triggerType: 'dies',
      cardsDrawn: 2,
      cardsDiscarded: 0,
      netCardsDrawn: 2,
      avgCardsPerTurn: 3,
      colorIdentity: ['C'],
      note: 'Equipped creature gets +1/−1; when it dies, draw 2. Avg ~3 cards/turn when sacrificing 1-toughness tokens.',
    },
  ],

  // All players draw an extra card at the beginning of their draw step.
  [
    'howling mine',
    {
      cardType: 'artifact',
      cmc: 2,
      triggerType: 'upkeep',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1,
      colorIdentity: ['C'],
      note: 'Each player draws an extra card at the beginning of their draw step. Symmetrical; net +1/turn for you.',
    },
  ],

  // {T}: draw a card at start of your upkeep.
  [
    'staff of nin',
    {
      cardType: 'artifact',
      cmc: 6,
      triggerType: 'upkeep',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1,
      colorIdentity: ['C'],
      note: 'Draw a card at the beginning of your upkeep. Reliable +1/turn; also pings for 1 damage.',
    },
  ],

  // {T}: look at top 3 and reorder; or draw and put SDT on top.
  [
    "sensei's divining top",
    {
      cardType: 'artifact',
      cmc: 1,
      triggerType: 'activated',
      cardsDrawn: 1,
      cardsDiscarded: 1,
      netCardsDrawn: 0,
      avgCardsPerTurn: 1,
      colorIdentity: ['C'],
      note: 'Draw 1 card, then put Top on top of library (net 0 raw), but provides deck filtering; combos with shuffle effects for net +1/turn.',
    },
  ],

  // Draw a card when a creature of the chosen type enters (pay {1} per).
  [
    "vanquisher's banner",
    {
      cardType: 'artifact',
      cmc: 5,
      triggerType: 'creature_etb',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1.5,
      colorIdentity: ['C'],
      note: 'Whenever you cast a creature of the chosen type, draw a card. Avg ~1.5 cards/turn in a tribe-heavy deck.',
    },
  ],

  // Scry 1 each upkeep; pay {G}: draw a card whenever you cast a creature.
  [
    "lifecrafter's bestiary",
    {
      cardType: 'artifact',
      cmc: 3,
      triggerType: 'creature_etb',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1,
      colorIdentity: ['G'],
      note: 'Scry 1 at upkeep; {G}: draw whenever you cast a creature. Avg ~1 card/turn in creature-heavy decks.',
    },
  ],

  // Whenever you gain life, you may draw a card (pay {2}).
  [
    'well of lost dreams',
    {
      cardType: 'artifact',
      cmc: 4,
      triggerType: 'lifegain',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1.5,
      colorIdentity: ['C'],
      note: 'Whenever you gain life, pay {2}: draw a card for each life gained. Avg ~1.5 cards/turn in lifegain decks.',
    },
  ],

  // All players draw up to 3 extra cards if they pay increasing costs (asymmetrically beneficial).
  [
    'font of mythos',
    {
      cardType: 'artifact',
      cmc: 4,
      triggerType: 'upkeep',
      cardsDrawn: 2,
      cardsDiscarded: 0,
      netCardsDrawn: 2,
      avgCardsPerTurn: 2,
      colorIdentity: ['C'],
      note: 'Each player draws 2 extra cards at the beginning of their draw step. Symmetrical; +2/turn for you.',
    },
  ],

  // Tap: draw a card.
  [
    'tome of legends',
    {
      cardType: 'artifact',
      cmc: 2,
      triggerType: 'activated',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1,
      colorIdentity: ['C'],
      note: 'Gains a page counter when your commander enters or attacks; {1}{T}, remove a page counter: draw a card. Avg ~1 card/turn.',
    },
  ],

  // Exile top card; may play it this turn.
  [
    'experimental frenzy',
    {
      cardType: 'enchantment',
      cmc: 4,
      triggerType: 'upkeep',
      cardsDrawn: 0,
      cardsDiscarded: 0,
      netCardsDrawn: 2,
      avgCardsPerTurn: 2,
      colorIdentity: ['R'],
      note: "You may look at and play the top card of your library; can't play cards from hand. Quasi-draw; avg ~2 extra spells/turn in low-curve decks.",
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL HIGH-FREQUENCY COMMANDER STAPLES
  // ══════════════════════════════════════════════════════════════════════════

  // Draw a card whenever you cast a creature — {G} trigger.
  [
    'beast whisperer',
    {
      cardType: 'creature',
      cmc: 4,
      triggerType: 'creature_etb',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1.5,
      colorIdentity: ['G'],
      note: 'Whenever you cast a creature spell, draw a card. Avg ~1.5 cards/turn in creature-heavy decks.',
    },
  ],

  // Look at top 2; put 1 in hand, 1 on bottom (ETB trigger).
  [
    'sea gate oracle',
    {
      cardType: 'creature',
      cmc: 3,
      triggerType: 'etb',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1,
      colorIdentity: ['U'],
      note: 'ETB: look at top 2, put 1 in hand and 1 on bottom of library. One-time +1 with top-deck selection.',
    },
  ],

  // Draw X cards from top of library equal to devotion (variable).
  [
    "sphinx's revelation",
    {
      cardType: 'instant',
      cmc: 0,
      triggerType: 'cast',
      cardsDrawn: 0,
      cardsDiscarded: 0,
      netCardsDrawn: 4,
      avgCardsPerTurn: 4,
      colorIdentity: ['W', 'U'],
      note: 'You gain X life and draw X cards. Typically cast for X=4 or more in Commander; avg net +4.',
    },
  ],

  // Whenever a nontoken creature enters, draw a card if you attacked this turn with a creature.
  [
    'ohran frostfang',
    {
      cardType: 'creature',
      cmc: 5,
      triggerType: 'combat',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 2,
      colorIdentity: ['G'],
      note: 'Creatures you control have deathtouch; whenever one deals combat damage, draw a card. Avg ~2 cards/turn.',
    },
  ],

  // ETB: draw up to 3, discard up to 3 (looting effect — net 0, but quality improvement).
  [
    'jace, the mind sculptor',
    {
      cardType: 'planeswalker',
      cmc: 4,
      triggerType: 'activated',
      cardsDrawn: 3,
      cardsDiscarded: 2,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1,
      colorIdentity: ['U'],
      note: '+0: Draw 3, put 2 on top (Brainstorm). Net +1/turn; also has Unsummon and Fateseal modes.',
    },
  ],

  // Opponent draws extra cards but you also draw whenever they do.
  [
    'teferi, master of time',
    {
      cardType: 'planeswalker',
      cmc: 4,
      triggerType: 'activated',
      cardsDrawn: 1,
      cardsDiscarded: 1,
      netCardsDrawn: 0,
      avgCardsPerTurn: 1,
      colorIdentity: ['U'],
      note: "+1 (on each player's turn): Draw 1, discard 1. Provides looting every turn rotation including opponents' turns; avg ~1 net/turn.",
    },
  ],

  // {T}: look at top card; if creature, put in hand (pay 3).
  [
    'garruk, primal hunter',
    {
      cardType: 'planeswalker',
      cmc: 5,
      triggerType: 'activated',
      cardsDrawn: 0,
      cardsDiscarded: 0,
      netCardsDrawn: 3,
      avgCardsPerTurn: 3,
      colorIdentity: ['G'],
      note: '−3: Draw cards equal to the greatest power among creatures you control. Typically draws 3–6 in a creature deck; avg ~3.',
    },
  ],

  // Whenever you draw a card, scry 1 (cantrip value engine).
  [
    "alhammarret's archive",
    {
      cardType: 'artifact',
      cmc: 5,
      triggerType: 'on_draw',
      cardsDrawn: 0,
      cardsDiscarded: 0,
      netCardsDrawn: 0,
      avgCardsPerTurn: 3,
      colorIdentity: ['C'],
      note: 'If you would draw cards during your draw step, draw that many plus one more; life gain is doubled. Roughly doubles your draw-step card draw; avg ~3 bonus cards/rotation.',
    },
  ],

  // Draw a card when Reclamation Sage or another creature enters (enchantress slot / budget pick).
  [
    'primordial sage',
    {
      cardType: 'creature',
      cmc: 6,
      triggerType: 'creature_etb',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1.5,
      colorIdentity: ['G'],
      note: 'Whenever you cast a creature spell, draw a card. Older take on Beast Whisperer; avg ~1.5 cards/turn.',
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // WHITE  (W)
  // ══════════════════════════════════════════════════════════════════════════

  // Draw when an opponent casts their second spell of the turn or attacks with 2+ creatures.
  [
    'mangara, the diplomat',
    {
      cardType: 'creature',
      cmc: 4,
      triggerType: 'opponent_cast',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 2,
      colorIdentity: ['W'],
      note: 'Draw 1 when an opponent casts their second spell in a turn or attacks with 2+ creatures. Avg ~2 cards/rotation in 4-player.',
    },
  ],

  // Draw when you cast an aura, equipment, or vehicle.
  [
    'sram, senior edificer',
    {
      cardType: 'creature',
      cmc: 2,
      triggerType: 'cast',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 2,
      colorIdentity: ['W'],
      note: 'Whenever you cast an aura, equipment, or vehicle spell, draw a card. Avg ~2 cards/turn in an equipment-focused deck.',
    },
  ],

  // White Rhystic Study — opponent casts a noncreature spell, pay 1 or you draw.
  [
    'esper sentinel',
    {
      cardType: 'creature',
      cmc: 1,
      triggerType: 'opponent_cast',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 2,
      colorIdentity: ['W'],
      note: "When an opponent casts a noncreature spell, draw unless they pay {X} (X = sentinel's power). Avg ~2 cards/rotation; scales with +1/+1 counters.",
    },
  ],

  // Nontoken creature with power ≤2 enters → draw.
  [
    'welcoming vampire',
    {
      cardType: 'creature',
      cmc: 3,
      triggerType: 'creature_etb',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1.5,
      colorIdentity: ['W'],
      note: 'Once per turn: whenever a nontoken creature with power 2 or less enters under your control, draw a card. Avg ~1.5 cards/turn in weenie/token decks.',
    },
  ],

  // Flash: redirect multiple draw to yourself if an opponent would draw 2+ cards.
  [
    'alms collector',
    {
      cardType: 'creature',
      cmc: 3,
      triggerType: 'on_draw',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1.5,
      colorIdentity: ['W'],
      note: 'If an opponent would draw 2+ cards, each opponent draws 1 and you draw 1 instead. Avg ~1.5 cards/rotation; devastating against wheels.',
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // BLUE  (U)
  // ══════════════════════════════════════════════════════════════════════════

  // Doubles cards drawn during your turn.
  [
    "teferi's ageless insight",
    {
      cardType: 'enchantment',
      cmc: 4,
      triggerType: 'on_draw',
      cardsDrawn: 0,
      cardsDiscarded: 0,
      netCardsDrawn: 0,
      avgCardsPerTurn: 2,
      colorIdentity: ['U'],
      note: 'If you would draw a card during your turn, draw that many plus one more. Roughly doubles your turn-draw output; avg ~2 bonus cards/turn with other draw engines.',
    },
  ],

  // Opponents can't draw extra cards; −2: look at top 4, put noncreature nonland in hand.
  [
    'narset, parter of veils',
    {
      cardType: 'planeswalker',
      cmc: 3,
      triggerType: 'activated',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1,
      colorIdentity: ['U'],
      note: "Static: opponents can't draw extra cards. −2: Reveal top 4 cards; put all noncreature nonland cards into your hand. Also shuts down opponent draw engines.",
    },
  ],

  // Tap a wizard you control: draw a card.
  [
    'azami, lady of scrolls',
    {
      cardType: 'creature',
      cmc: 5,
      triggerType: 'activated',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 3,
      colorIdentity: ['U'],
      note: 'Tap a wizard you control: draw a card. With 3+ wizards the activation is repeatable; avg ~3 cards/turn in a wizard tribal deck.',
    },
  ],

  // Cast a historic spell → draw a card.
  [
    'jhoira, weatherlight captain',
    {
      cardType: 'creature',
      cmc: 4,
      triggerType: 'historic_cast',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 2,
      colorIdentity: ['U', 'R'],
      note: 'Whenever you cast a historic spell (artifact, legendary, or saga), draw a card. Avg ~2 cards/turn in an artifact-heavy deck.',
    },
  ],

  // Upkeep: you may pay {1} to draw then discard; whenever you draw, create a tentacle token.
  [
    'nadir kraken',
    {
      cardType: 'creature',
      cmc: 3,
      triggerType: 'on_draw',
      cardsDrawn: 0,
      cardsDiscarded: 0,
      netCardsDrawn: 0,
      avgCardsPerTurn: 0,
      colorIdentity: ['U'],
      note: 'Whenever you draw a card, put a +1/+1 counter on Nadir Kraken and create a 1/1 Tentacle token. Synergy piece rather than raw draw; avg 0 net cards but snowballs the board.',
    },
  ],

  // Aura: enchanted creature deals damage → you draw a card.
  [
    'curiosity',
    {
      cardType: 'enchantment',
      cmc: 1,
      triggerType: 'combat',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1,
      colorIdentity: ['U'],
      note: 'Enchanted creature deals damage to a player → draw 1. Avg ~1 card/turn on a reliable attacker; infinite with Niv-Mizzet.',
    },
  ],

  // Creatures deal combat damage → draw a card.
  [
    'coastal piracy',
    {
      cardType: 'enchantment',
      cmc: 3,
      triggerType: 'combat',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 2,
      colorIdentity: ['U'],
      note: 'Whenever a creature you control deals combat damage to a player, draw a card. Avg ~2 cards/turn with 2 unblocked attackers.',
    },
  ],

  // Creatures deal combat damage → draw. Also forces opponents' creatures to attack.
  [
    'bident of thassa',
    {
      cardType: 'enchantment',
      cmc: 4,
      triggerType: 'combat',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 2,
      colorIdentity: ['U'],
      note: 'Whenever a creature you control deals combat damage to a player, draw a card. Also has an activated effect to force opponent creatures to attack. Avg ~2 cards/turn.',
    },
  ],

  // Whenever you cast or copy an instant or sorcery, draw a card.
  [
    'archmage emeritus',
    {
      cardType: 'creature',
      cmc: 4,
      triggerType: 'instant_sorcery',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 2,
      colorIdentity: ['U'],
      note: 'Magecraft — whenever you cast or copy an instant or sorcery spell, draw a card. Avg ~2 cards/turn in a spellslinger deck.',
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // BLACK  (B)
  // ══════════════════════════════════════════════════════════════════════════

  // Whenever you lose life, draw that many cards.
  [
    'vilis, broker of blood',
    {
      cardType: 'creature',
      cmc: 8,
      triggerType: 'on_life_loss',
      cardsDrawn: 0,
      cardsDiscarded: 0,
      netCardsDrawn: 3,
      avgCardsPerTurn: 3,
      colorIdentity: ['B'],
      note: 'Whenever you lose life, draw that many cards. Pairs explosively with Necropotence, Phyrexian Arena, etc. Avg ~3 cards/turn depending on self-damage sources.',
    },
  ],

  // Upkeep: reveal top card, pay life equal to its mana value, put into hand.
  [
    'dark confidant',
    {
      cardType: 'creature',
      cmc: 2,
      triggerType: 'upkeep',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1,
      colorIdentity: ['B'],
      note: 'Upkeep: reveal top card; add it to hand and lose life equal to its mana value. Reliable +1/turn; risky in high-curve Commander decks.',
    },
  ],

  // Instant: end of turn, reveal and exile cards one at a time, pay life to keep; stop anytime.
  [
    'ad nauseam',
    {
      cardType: 'instant',
      cmc: 5,
      triggerType: 'cast',
      cardsDrawn: 0,
      cardsDiscarded: 0,
      netCardsDrawn: 7,
      avgCardsPerTurn: 7,
      colorIdentity: ['B'],
      note: 'Reveal cards from top of library; put each into hand and lose that much life; stop anytime. In a low-curve deck at low life, avg ~7 cards. Combo enabler.',
    },
  ],

  // Upkeep: target player draws a card, loses 1 life.
  [
    'bloodgift demon',
    {
      cardType: 'creature',
      cmc: 5,
      triggerType: 'upkeep',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1,
      colorIdentity: ['B'],
      note: 'Beginning of upkeep: target player draws a card and loses 1 life. Self-targeting is Phyrexian Arena on a flying 5/4; reliable +1/turn.',
    },
  ],

  // Enchantment version of Dark Confidant.
  [
    'dark tutelage',
    {
      cardType: 'enchantment',
      cmc: 3,
      triggerType: 'upkeep',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1,
      colorIdentity: ['B'],
      note: 'Upkeep: reveal top card; add to hand, lose life equal to its mana value. Enchantment-based Dark Confidant. Reliable +1/turn.',
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // RED  (R)
  // ══════════════════════════════════════════════════════════════════════════

  // Secretly bid life; lowest bidder discards hand and draws 7.
  [
    'wheel of misfortune',
    {
      cardType: 'sorcery',
      cmc: 2,
      triggerType: 'cast',
      cardsDrawn: 7,
      cardsDiscarded: 0,
      netCardsDrawn: 7,
      avgCardsPerTurn: 7,
      colorIdentity: ['R'],
      note: 'Players secretly bid life; lowest bidder discards hand and draws 7. With strategic bidding you draw 7 for minimal life loss; avg net +7.',
    },
  ],

  // Draw 2, discard 2; flashback for 2R.
  [
    'faithless looting',
    {
      cardType: 'sorcery',
      cmc: 1,
      triggerType: 'cast',
      cardsDrawn: 2,
      cardsDiscarded: 2,
      netCardsDrawn: 0,
      avgCardsPerTurn: 1,
      colorIdentity: ['R'],
      note: 'Draw 2, discard 2. Flashback {2}{R}. Net 0 hand size but excellent quality filter; avg ~1 net useful card via flashback total.',
    },
  ],

  // If you control a commander: exile top 3 of each opponent's library; add RRR.
  [
    "jeska's will",
    {
      cardType: 'sorcery',
      cmc: 2,
      triggerType: 'cast',
      cardsDrawn: 0,
      cardsDiscarded: 0,
      netCardsDrawn: 3,
      avgCardsPerTurn: 3,
      colorIdentity: ['R'],
      note: "If you control a commander: exile top 3 of each opponent's library; you may cast those cards this turn. Also adds {R}{R}{R}. Avg ~3 cards accessible when commander is in play.",
    },
  ],

  // Miracle wheel — discard hand, draw 7 for {1}{R} if drawn first that turn.
  [
    'reforge the soul',
    {
      cardType: 'sorcery',
      cmc: 5,
      triggerType: 'cast',
      cardsDrawn: 7,
      cardsDiscarded: 0,
      netCardsDrawn: 7,
      avgCardsPerTurn: 7,
      colorIdentity: ['R'],
      note: "Each player discards their hand and draws 7 cards. Miracle {1}{R} if it's the first card drawn this turn. Effectively a {1}{R} Wheel of Fortune when miraculed.",
    },
  ],

  // Creature: sacrifice it to have each player discard hand and draw 7.
  [
    'magus of the wheel',
    {
      cardType: 'creature',
      cmc: 3,
      triggerType: 'activated',
      cardsDrawn: 7,
      cardsDiscarded: 0,
      netCardsDrawn: 7,
      avgCardsPerTurn: 7,
      colorIdentity: ['R'],
      note: '{T}, Sacrifice Magus of the Wheel: each player discards their hand and draws 7 cards. One-time creature-based Wheel of Fortune.',
    },
  ],

  // Discard 2, draw 3.
  [
    'cathartic reunion',
    {
      cardType: 'sorcery',
      cmc: 2,
      triggerType: 'cast',
      cardsDrawn: 3,
      cardsDiscarded: 2,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1,
      colorIdentity: ['R'],
      note: 'Discard 2 cards, then draw 3. Net +1 hand size with strong graveyard-fill side benefit.',
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // GREEN  (G)
  // ══════════════════════════════════════════════════════════════════════════

  // Sacrifice a creature: draw cards equal to its power, then discard 3.
  [
    'greater good',
    {
      cardType: 'enchantment',
      cmc: 4,
      triggerType: 'dies',
      cardsDrawn: 0,
      cardsDiscarded: 3,
      netCardsDrawn: 3,
      avgCardsPerTurn: 3,
      colorIdentity: ['G'],
      note: 'Sacrifice a creature: draw cards equal to its power, discard 3. Net positive when sacrificing power-3+ creatures; avg ~3 net cards/use with a typical 6-power sac target.',
    },
  ],

  // Nontoken creature with power 3+ enters → draw.
  [
    'elemental bond',
    {
      cardType: 'enchantment',
      cmc: 3,
      triggerType: 'creature_etb',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1.5,
      colorIdentity: ['G'],
      note: 'Whenever a nontoken creature with power 3 or greater enters the battlefield under your control, draw a card. Avg ~1.5 cards/turn in a midrange/big-creature deck.',
    },
  ],

  // Draw cards equal to the number of creatures you control; gain life for identical types.
  [
    'shamanic revelation',
    {
      cardType: 'sorcery',
      cmc: 5,
      triggerType: 'cast',
      cardsDrawn: 0,
      cardsDiscarded: 0,
      netCardsDrawn: 5,
      avgCardsPerTurn: 5,
      colorIdentity: ['G'],
      note: 'Draw cards equal to creatures you control; gain 4 life for each creature that shares a creature type with another. Avg ~5 cards in a creature-heavy board state.',
    },
  ],

  // Draw cards equal to greatest power among creatures you control; cast a card ≤5 CMC for free.
  [
    "rishkar's expertise",
    {
      cardType: 'sorcery',
      cmc: 6,
      triggerType: 'cast',
      cardsDrawn: 0,
      cardsDiscarded: 0,
      netCardsDrawn: 5,
      avgCardsPerTurn: 5,
      colorIdentity: ['G'],
      note: 'Draw cards equal to the greatest power among creatures you control; cast a card with mana value ≤5 from your hand for free. Avg ~5 cards with a 5-power creature.',
    },
  ],

  // Draw cards equal to the greatest power of a non-human creature you control (instant).
  [
    'return of the wildspeaker',
    {
      cardType: 'instant',
      cmc: 5,
      triggerType: 'cast',
      cardsDrawn: 0,
      cardsDiscarded: 0,
      netCardsDrawn: 4,
      avgCardsPerTurn: 4,
      colorIdentity: ['G'],
      note: 'Choose: draw cards equal to greatest power of a non-human creature you control, OR creatures you control get +3/+3 this turn. Avg ~4 cards drawn with a 4-power creature.',
    },
  ],

  // Sacrifice a creature: draw cards equal to its power.
  [
    "life's legacy",
    {
      cardType: 'sorcery',
      cmc: 2,
      triggerType: 'dies',
      cardsDrawn: 0,
      cardsDiscarded: 0,
      netCardsDrawn: 5,
      avgCardsPerTurn: 5,
      colorIdentity: ['G'],
      note: 'Sacrifice a creature: draw cards equal to its power. Explosive on a high-power creature before removal; avg ~5 cards with a 5-power creature.',
    },
  ],

  // Nontoken creature ETB → draw.
  [
    'soul of the harvest',
    {
      cardType: 'creature',
      cmc: 6,
      triggerType: 'creature_etb',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1.5,
      colorIdentity: ['G'],
      note: 'Whenever another nontoken creature enters the battlefield under your control, draw a card. Avg ~1.5 cards/turn in a creature-heavy deck.',
    },
  ],

  // Nonhuman creature ETB → draw a card, put a +1/+1 counter.
  [
    'the great henge',
    {
      cardType: 'artifact',
      cmc: 11,
      triggerType: 'creature_etb',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 2,
      colorIdentity: ['G'],
      note: 'Costs {7}{G}{G} but reduced by the greatest power among creatures you control (effectively {2}{G}{G} with a 5-power). Taps for {G}{G}; nonhuman creature ETB → draw 1 and put a +1/+1 counter. Avg ~2 cards/turn.',
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // MULTICOLOR
  // ══════════════════════════════════════════════════════════════════════════

  // Draw a card → deal 1 damage; opponent casts instant/sorcery → draw.
  [
    'niv-mizzet, parun',
    {
      cardType: 'creature',
      cmc: 6,
      triggerType: 'on_draw',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 3,
      colorIdentity: ['U', 'R'],
      note: 'Whenever you draw a card, deal 1 damage to any target. Whenever an opponent casts an instant or sorcery, draw a card. Self-reinforcing; avg ~3 cards/rotation from spell triggers alone.',
    },
  ],

  // Draw a card → deal 1 damage; deal damage → draw.
  [
    'niv-mizzet, the firemind',
    {
      cardType: 'creature',
      cmc: 6,
      triggerType: 'on_draw',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 2,
      colorIdentity: ['U', 'R'],
      note: '{T}: draw a card. Whenever you draw a card, deal 1 damage to any target. Self-reinforcing loop with Curiosity. Avg ~2 cards/turn from normal draw + activation.',
    },
  ],

  // Whenever you draw a card, create a 1/1 insect. Upkeep: draw for each insect.
  [
    'the locust god',
    {
      cardType: 'creature',
      cmc: 6,
      triggerType: 'on_draw',
      cardsDrawn: 0,
      cardsDiscarded: 0,
      netCardsDrawn: 0,
      avgCardsPerTurn: 2,
      colorIdentity: ['U', 'R'],
      note: 'Whenever you draw a card, create a 1/1 flying haste insect. At beginning of each upkeep, draw a card for each insect you control. Avg ~2 bonus cards/turn as insect army grows.',
    },
  ],

  // Flying, haste; whenever an opponent casts their second spell in a turn, draw a card.
  [
    "kraum, ludevic's opus",
    {
      cardType: 'creature',
      cmc: 5,
      triggerType: 'opponent_cast',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1.5,
      colorIdentity: ['U', 'R'],
      note: 'Whenever an opponent casts their second spell in a turn, draw a card. Avg ~1.5 cards/rotation in 4-player as opponents spend mana.',
    },
  ],

  // Land ETB → draw a card and gain 1 life.
  [
    'tatyova, benthic druid',
    {
      cardType: 'creature',
      cmc: 5,
      triggerType: 'land_etb',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 2,
      colorIdentity: ['G', 'U'],
      note: 'Whenever a land enters the battlefield under your control, draw a card and gain 1 life. Avg ~2 cards/turn in a landfall or ramp deck placing extra lands.',
    },
  ],

  // First spell each turn → reveal top card; if its CMC ≤ spell cast, cast it free, else put in hand.
  [
    'rashmi, eternities crafter',
    {
      cardType: 'creature',
      cmc: 4,
      triggerType: 'cast',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1.5,
      colorIdentity: ['G', 'U'],
      note: 'Whenever you cast your first spell each turn, reveal top card: cast it for free if its mana value is ≤ the spell cast, else put it into your hand. Avg ~1.5 net cards/turn.',
    },
  ],

  // Parley: each player reveals top card; for each nonland revealed, you draw and opponents gain life.
  [
    'selvala, explorer returned',
    {
      cardType: 'creature',
      cmc: 2,
      triggerType: 'activated',
      cardsDrawn: 0,
      cardsDiscarded: 0,
      netCardsDrawn: 2,
      avgCardsPerTurn: 2,
      colorIdentity: ['G', 'W'],
      note: '{T}: Parley — each player reveals top card; you draw 1 and add {G} for each nonland revealed; opponents gain 1 life each. Avg ~2 net cards since all four players likely reveal nonlands.',
    },
  ],

  // Draw a card at the beginning of each combat step (gains power when enchantments are cast).
  [
    'tuvasa the sunlit',
    {
      cardType: 'creature',
      cmc: 3,
      triggerType: 'enchantment_cast',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1.5,
      colorIdentity: ['G', 'W', 'U'],
      note: 'Draw a card at the beginning of combat on your turn if you control an enchantment. Avg ~1 guaranteed card/turn plus enchantress draw triggers.',
    },
  ],

  // ══════════════════════════════════════════════════════════════════════════
  // COLORLESS  (C)
  // ══════════════════════════════════════════════════════════════════════════

  // ETB protection; upkeep: take a burden counter then draw that many cards (and lose that life).
  [
    'the one ring',
    {
      cardType: 'artifact',
      cmc: 4,
      triggerType: 'upkeep',
      cardsDrawn: 0,
      cardsDiscarded: 0,
      netCardsDrawn: 3,
      avgCardsPerTurn: 3,
      colorIdentity: ['C'],
      note: 'ETB: protection from everything until your next turn. Upkeep: take a burden counter; draw cards equal to burden counters; lose 1 life per counter. Avg ~3 cards/turn over first few turns.',
    },
  ],

  // Activate: exile hand face-down; draw 7; at end of turn discard drawn cards and return hand.
  [
    'memory jar',
    {
      cardType: 'artifact',
      cmc: 5,
      triggerType: 'activated',
      cardsDrawn: 7,
      cardsDiscarded: 7,
      netCardsDrawn: 0,
      avgCardsPerTurn: 7,
      colorIdentity: ['C'],
      note: '{T}, Sacrifice Memory Jar: each player exiles their hand face-down, draws 7; at end of turn, returns exiled cards. Net 0 permanent draw but functions as a full 7-card refill for one turn.',
    },
  ],

  // Tap: each player draws a card (symmetrical, cheap).
  [
    'temple bell',
    {
      cardType: 'artifact',
      cmc: 3,
      triggerType: 'activated',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1,
      colorIdentity: ['C'],
      note: '{T}: each player draws a card. Symmetrical but cheap; pairs with Notion Thief or anti-draw effects to one-side the benefit.',
    },
  ],

  // Whenever an opponent draws a card, pay {1}: draw a card.
  [
    "mind's eye",
    {
      cardType: 'artifact',
      cmc: 5,
      triggerType: 'on_draw',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 3,
      colorIdentity: ['C'],
      note: 'Whenever an opponent draws a card, pay {1}: draw a card. With 3 opponents drawing ~2/turn each, avg ~3 cards/rotation if you have the mana.',
    },
  ],

  // Exchange any number of cards from hand with top of library; later draw normally.
  [
    'scroll rack',
    {
      cardType: 'artifact',
      cmc: 1,
      triggerType: 'activated',
      cardsDrawn: 0,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1,
      colorIdentity: ['C'],
      note: '{1}{T}: Exile any number of cards from hand face-down; put that many cards from the top of your library into your hand. Powerful deck manipulation; avg ~1 effective new card/turn.',
    },
  ],

  // Tap for CCC or tap + sacrifice: draw 3.
  [
    'dreamstone hedron',
    {
      cardType: 'artifact',
      cmc: 6,
      triggerType: 'activated',
      cardsDrawn: 3,
      cardsDiscarded: 0,
      netCardsDrawn: 3,
      avgCardsPerTurn: 3,
      colorIdentity: ['C'],
      note: '{T}: Add {C}{C}{C}. {3}, {T}, Sacrifice: draw 3 cards. Functions as ramp until it converts into a burst of 3 cards when no longer needed.',
    },
  ],

  // Tap for CC or tap + sacrifice: draw 2.
  [
    'hedron archive',
    {
      cardType: 'artifact',
      cmc: 4,
      triggerType: 'activated',
      cardsDrawn: 2,
      cardsDiscarded: 0,
      netCardsDrawn: 2,
      avgCardsPerTurn: 2,
      colorIdentity: ['C'],
      note: '{T}: Add {C}{C}. {2}, {T}, Sacrifice: draw 2 cards. Efficient dual-purpose ramp-and-draw artifact.',
    },
  ],

  // Equipment: combat damage by equipped creature → deal 2 damage + draw a card.
  [
    'sword of fire and ice',
    {
      cardType: 'artifact',
      cmc: 3,
      triggerType: 'combat',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1,
      colorIdentity: ['C'],
      note: 'Equipped creature gets +2/+2 and protection from red and blue. Whenever it deals combat damage to a player, deal 2 damage to any target and draw a card. Avg ~1 card/turn on a reliable attacker.',
    },
  ],

  // Tap for C; sacrifice: draw a card.
  [
    'mind stone',
    {
      cardType: 'artifact',
      cmc: 2,
      triggerType: 'activated',
      cardsDrawn: 1,
      cardsDiscarded: 0,
      netCardsDrawn: 1,
      avgCardsPerTurn: 1,
      colorIdentity: ['C'],
      note: '{T}: Add {C}. {1}, {T}, Sacrifice Mind Stone: draw a card. Dual-purpose 2-drop: early ramp that converts into a card when mana is no longer needed.',
    },
  ],
]);
