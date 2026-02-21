// Fetch land behavioral data for the MTG Monte Carlo Simulator.
// processLand() looks up FETCH_LAND_DATA first; oracle-text detection is the fallback.
//
// fetchType values:
//   'classic'               – Onslaught/Zendikar style: {T}, pay 1 life, sacrifice
//   'slow'                  – Mirage style: ETBs tapped, {T}, sacrifice next turn
//   'free_slow'             – Evolving Wilds style: {T}, sacrifice (no life cost), basic tapped
//   'mana_cost'             – requires additional generic mana to activate (fetchcost)
//   'auto_sacrifice'        – SNC hideaway: ETBs and immediately sacrifices itself
//   'colorless_or_fetch'    – produces {C} normally OR sacrifices to fetch
//   'colorless_or_cycle_fetch' – same but also has cycling
//   'trigger'               – fetches on a trigger (e.g. dying), not an activation
//   'saga_any'              – Saga chapter that searches for any land
//
// Fields:
//   fetchColors             – colors the land can fetch (['W','U','B','R','G'])
//   fetchesOnlyBasics       – true: only basic lands; false: any land with matching subtype
//   fetchesTwoLands         – true: fetches 2 lands in one activation (Myriad Landscape, Krosan Verge)
//   fetchedLandEntersTapped – true: the fetched land enters tapped
//   entersTappedAlways      – true: the fetch land itself ETBs tapped
//   fetchcost               – additional generic mana required to activate (0 = free)
//   isHideawayFetch         – true: SNC auto-sacrifice variety

export const FETCH_LAND_DATA = new Map([
  // ── Classic Onslaught / Zendikar Fetch Lands ──────────────────────────────
  // {T}, Pay 1 life, Sacrifice: search for matching subtype, enters untapped.
  [
    'flooded strand',
    {
      fetchType: 'classic',
      fetchColors: ['W', 'U'],
      fetchesOnlyBasics: false,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: false,
      entersTappedAlways: false,
      fetchcost: 0,
    },
  ],
  [
    'polluted delta',
    {
      fetchType: 'classic',
      fetchColors: ['U', 'B'],
      fetchesOnlyBasics: false,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: false,
      entersTappedAlways: false,
      fetchcost: 0,
    },
  ],
  [
    'bloodstained mire',
    {
      fetchType: 'classic',
      fetchColors: ['B', 'R'],
      fetchesOnlyBasics: false,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: false,
      entersTappedAlways: false,
      fetchcost: 0,
    },
  ],
  [
    'wooded foothills',
    {
      fetchType: 'classic',
      fetchColors: ['R', 'G'],
      fetchesOnlyBasics: false,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: false,
      entersTappedAlways: false,
      fetchcost: 0,
    },
  ],
  [
    'windswept heath',
    {
      fetchType: 'classic',
      fetchColors: ['G', 'W'],
      fetchesOnlyBasics: false,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: false,
      entersTappedAlways: false,
      fetchcost: 0,
    },
  ],
  [
    'marsh flats',
    {
      fetchType: 'classic',
      fetchColors: ['W', 'B'],
      fetchesOnlyBasics: false,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: false,
      entersTappedAlways: false,
      fetchcost: 0,
    },
  ],
  [
    'scalding tarn',
    {
      fetchType: 'classic',
      fetchColors: ['U', 'R'],
      fetchesOnlyBasics: false,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: false,
      entersTappedAlways: false,
      fetchcost: 0,
    },
  ],
  [
    'verdant catacombs',
    {
      fetchType: 'classic',
      fetchColors: ['B', 'G'],
      fetchesOnlyBasics: false,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: false,
      entersTappedAlways: false,
      fetchcost: 0,
    },
  ],
  [
    'arid mesa',
    {
      fetchType: 'classic',
      fetchColors: ['R', 'W'],
      fetchesOnlyBasics: false,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: false,
      entersTappedAlways: false,
      fetchcost: 0,
    },
  ],
  [
    'misty rainforest',
    {
      fetchType: 'classic',
      fetchColors: ['G', 'U'],
      fetchesOnlyBasics: false,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: false,
      entersTappedAlways: false,
      fetchcost: 0,
    },
  ],

  // ── Slow / Mirage Fetch Lands ─────────────────────────────────────────────
  // ETBs tapped. Next turn: {T}, Sacrifice to search for matching subtype.
  [
    'flood plain',
    {
      fetchType: 'slow',
      fetchColors: ['W', 'U'],
      fetchesOnlyBasics: false,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: false,
      entersTappedAlways: true,
      fetchcost: 0,
    },
  ],
  [
    'bad river',
    {
      fetchType: 'slow',
      fetchColors: ['U', 'B'],
      fetchesOnlyBasics: false,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: false,
      entersTappedAlways: true,
      fetchcost: 0,
    },
  ],
  [
    'rocky tar pit',
    {
      fetchType: 'slow',
      fetchColors: ['B', 'R'],
      fetchesOnlyBasics: false,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: false,
      entersTappedAlways: true,
      fetchcost: 0,
    },
  ],
  [
    'mountain valley',
    {
      fetchType: 'slow',
      fetchColors: ['R', 'G'],
      fetchesOnlyBasics: false,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: false,
      entersTappedAlways: true,
      fetchcost: 0,
    },
  ],
  [
    'grasslands',
    {
      fetchType: 'slow',
      fetchColors: ['G', 'W'],
      fetchesOnlyBasics: false,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: false,
      entersTappedAlways: true,
      fetchcost: 0,
    },
  ],

  // ── Prismatic Vista – any basic, pay 1 life ───────────────────────────────
  [
    'prismatic vista',
    {
      fetchType: 'classic',
      fetchColors: ['W', 'U', 'B', 'R', 'G'],
      fetchesOnlyBasics: true,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: false,
      entersTappedAlways: false,
      fetchcost: 0,
    },
  ],

  // ── Fabled Passage – basic, tapped (untapped at 4+ lands) ────────────────
  // Conservatively modelled as free_slow (always tapped in early turns).
  [
    'fabled passage',
    {
      fetchType: 'free_slow',
      fetchColors: ['W', 'U', 'B', 'R', 'G'],
      fetchesOnlyBasics: true,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: true,
      entersTappedAlways: false,
      fetchcost: 0,
    },
  ],

  // ── Evolving Wilds / Terramorphic Expanse – basic, tapped ────────────────
  [
    'evolving wilds',
    {
      fetchType: 'free_slow',
      fetchColors: ['W', 'U', 'B', 'R', 'G'],
      fetchesOnlyBasics: true,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: true,
      entersTappedAlways: false,
      fetchcost: 0,
    },
  ],
  [
    'terramorphic expanse',
    {
      fetchType: 'free_slow',
      fetchColors: ['W', 'U', 'B', 'R', 'G'],
      fetchesOnlyBasics: true,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: true,
      entersTappedAlways: false,
      fetchcost: 0,
    },
  ],

  // ── Free-sacrifice fetches: produce {C} normally ──────────────────────────
  [
    'escape tunnel',
    {
      fetchType: 'free_slow',
      fetchColors: ['W', 'U', 'B', 'R', 'G'],
      fetchesOnlyBasics: true,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: true,
      entersTappedAlways: false,
      fetchcost: 0,
    },
  ],
  [
    'multiversal passage',
    {
      fetchType: 'free_slow',
      fetchColors: ['W', 'U', 'B', 'R', 'G'],
      fetchesOnlyBasics: true,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: true,
      entersTappedAlways: false,
      fetchcost: 0,
    },
  ],

  // ── Mana-cost fetches: require additional generic mana to activate ─────────
  [
    'shire terrace',
    {
      fetchType: 'mana_cost',
      fetchColors: ['W', 'U', 'B', 'R', 'G'],
      fetchesOnlyBasics: true,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: true,
      entersTappedAlways: false,
      fetchcost: 1,
    },
  ],
  [
    'promising vein',
    {
      fetchType: 'mana_cost',
      fetchColors: ['W', 'U', 'B', 'R', 'G'],
      fetchesOnlyBasics: true,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: true,
      entersTappedAlways: false,
      fetchcost: 1,
    },
  ],
  [
    'terminal moraine',
    {
      fetchType: 'mana_cost',
      fetchColors: ['W', 'U', 'B', 'R', 'G'],
      fetchesOnlyBasics: true,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: true,
      entersTappedAlways: false,
      fetchcost: 2,
    },
  ],
  // Ash Barrens: {1},{T},Sacrifice OR basic landcycling {1}
  [
    'ash barrens',
    {
      fetchType: 'mana_cost',
      fetchColors: ['W', 'U', 'B', 'R', 'G'],
      fetchesOnlyBasics: true,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: true,
      entersTappedAlways: false,
      fetchcost: 1,
    },
  ],

  // ── Panoramas (Shards of Alara) – {C} normally; {1},{T},Sacrifice = 3-color basic ─
  [
    'bant panorama',
    {
      fetchType: 'mana_cost',
      fetchColors: ['G', 'W', 'U'],
      fetchesOnlyBasics: true,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: true,
      entersTappedAlways: false,
      fetchcost: 1,
    },
  ],
  [
    'esper panorama',
    {
      fetchType: 'mana_cost',
      fetchColors: ['W', 'U', 'B'],
      fetchesOnlyBasics: true,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: true,
      entersTappedAlways: false,
      fetchcost: 1,
    },
  ],
  [
    'grixis panorama',
    {
      fetchType: 'mana_cost',
      fetchColors: ['U', 'B', 'R'],
      fetchesOnlyBasics: true,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: true,
      entersTappedAlways: false,
      fetchcost: 1,
    },
  ],
  [
    'jund panorama',
    {
      fetchType: 'mana_cost',
      fetchColors: ['B', 'R', 'G'],
      fetchesOnlyBasics: true,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: true,
      entersTappedAlways: false,
      fetchcost: 1,
    },
  ],
  [
    'naya panorama',
    {
      fetchType: 'mana_cost',
      fetchColors: ['R', 'G', 'W'],
      fetchesOnlyBasics: true,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: true,
      entersTappedAlways: false,
      fetchcost: 1,
    },
  ],

  // ── MH3 Landscapes – {C} normally; {T},Sacrifice = 1 of 3 basics (tapped); has cycling ─
  [
    'bountiful landscape',
    {
      fetchType: 'colorless_or_cycle_fetch',
      fetchColors: ['G', 'W', 'U'],
      fetchesOnlyBasics: true,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: true,
      entersTappedAlways: false,
      fetchcost: 0,
    },
  ],
  [
    'contaminated landscape',
    {
      fetchType: 'colorless_or_cycle_fetch',
      fetchColors: ['U', 'B', 'R'],
      fetchesOnlyBasics: true,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: true,
      entersTappedAlways: false,
      fetchcost: 0,
    },
  ],
  [
    'deceptive landscape',
    {
      fetchType: 'colorless_or_cycle_fetch',
      fetchColors: ['B', 'G', 'U'],
      fetchesOnlyBasics: true,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: true,
      entersTappedAlways: false,
      fetchcost: 0,
    },
  ],
  [
    'foreboding landscape',
    {
      fetchType: 'colorless_or_cycle_fetch',
      fetchColors: ['W', 'B', 'G'],
      fetchesOnlyBasics: true,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: true,
      entersTappedAlways: false,
      fetchcost: 0,
    },
  ],
  [
    'perilous landscape',
    {
      fetchType: 'colorless_or_cycle_fetch',
      fetchColors: ['R', 'W', 'B'],
      fetchesOnlyBasics: true,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: true,
      entersTappedAlways: false,
      fetchcost: 0,
    },
  ],
  [
    'seething landscape',
    {
      fetchType: 'colorless_or_cycle_fetch',
      fetchColors: ['B', 'R', 'G'],
      fetchesOnlyBasics: true,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: true,
      entersTappedAlways: false,
      fetchcost: 0,
    },
  ],
  [
    'shattered landscape',
    {
      fetchType: 'colorless_or_cycle_fetch',
      fetchColors: ['U', 'R', 'W'],
      fetchesOnlyBasics: true,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: true,
      entersTappedAlways: false,
      fetchcost: 0,
    },
  ],
  [
    'sheltering landscape',
    {
      fetchType: 'colorless_or_cycle_fetch',
      fetchColors: ['R', 'G', 'W'],
      fetchesOnlyBasics: true,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: true,
      entersTappedAlways: false,
      fetchcost: 0,
    },
  ],
  [
    'tranquil landscape',
    {
      fetchType: 'colorless_or_cycle_fetch',
      fetchColors: ['W', 'U', 'B'],
      fetchesOnlyBasics: true,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: true,
      entersTappedAlways: false,
      fetchcost: 0,
    },
  ],
  [
    'twisted landscape',
    {
      fetchType: 'colorless_or_cycle_fetch',
      fetchColors: ['G', 'U', 'R'],
      fetchesOnlyBasics: true,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: true,
      entersTappedAlways: false,
      fetchcost: 0,
    },
  ],

  // ── SNC Family Lands (Hideaway Auto-Sacrifice) ───────────────────────────
  // Enter untapped; immediately sacrifice on ETB to fetch a 3-color basic (tapped).
  [
    'brokers hideout',
    {
      fetchType: 'auto_sacrifice',
      fetchColors: ['G', 'W', 'U'],
      fetchesOnlyBasics: true,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: true,
      entersTappedAlways: false,
      fetchcost: 0,
      isHideawayFetch: true,
    },
  ],
  [
    'obscura storefront',
    {
      fetchType: 'auto_sacrifice',
      fetchColors: ['W', 'U', 'B'],
      fetchesOnlyBasics: true,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: true,
      entersTappedAlways: false,
      fetchcost: 0,
      isHideawayFetch: true,
    },
  ],
  [
    'maestros theater',
    {
      fetchType: 'auto_sacrifice',
      fetchColors: ['U', 'B', 'R'],
      fetchesOnlyBasics: true,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: true,
      entersTappedAlways: false,
      fetchcost: 0,
      isHideawayFetch: true,
    },
  ],
  [
    'riveteers overlook',
    {
      fetchType: 'auto_sacrifice',
      fetchColors: ['B', 'R', 'G'],
      fetchesOnlyBasics: true,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: true,
      entersTappedAlways: false,
      fetchcost: 0,
      isHideawayFetch: true,
    },
  ],
  [
    'cabaretti courtyard',
    {
      fetchType: 'auto_sacrifice',
      fetchColors: ['R', 'G', 'W'],
      fetchesOnlyBasics: true,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: true,
      entersTappedAlways: false,
      fetchcost: 0,
      isHideawayFetch: true,
    },
  ],

  // ── Dual-fetch lands ──────────────────────────────────────────────────────
  // Myriad Landscape: {2},{T},Sacrifice = 2 basics that share a type (tapped)
  [
    'myriad landscape',
    {
      fetchType: 'mana_cost',
      fetchColors: ['W', 'U', 'B', 'R', 'G'],
      fetchesOnlyBasics: true,
      fetchesTwoLands: true,
      fetchedLandEntersTapped: true,
      entersTappedAlways: true,
      fetchcost: 2,
    },
  ],
  // Warped Landscape: {2},{T},Sacrifice = 1 basic (tapped)
  [
    'warped landscape',
    {
      fetchType: 'mana_cost',
      fetchColors: ['W', 'U', 'B', 'R', 'G'],
      fetchesOnlyBasics: true,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: true,
      entersTappedAlways: false,
      fetchcost: 2,
    },
  ],
  // Krosan Verge: {2},{T},Sacrifice = Forest AND Plains (can be non-basics with those subtypes, tapped)
  [
    'krosan verge',
    {
      fetchType: 'mana_cost',
      fetchColors: ['G', 'W'],
      fetchesOnlyBasics: false,
      fetchesTwoLands: true,
      fetchedLandEntersTapped: true,
      entersTappedAlways: true,
      fetchcost: 2,
    },
  ],
  // Blighted Woodland: {3}{G},{T},Sacrifice = 2 basics (tapped)
  [
    'blighted woodland',
    {
      fetchType: 'mana_cost',
      fetchColors: ['W', 'U', 'B', 'R', 'G'],
      fetchesOnlyBasics: true,
      fetchesTwoLands: true,
      fetchedLandEntersTapped: true,
      entersTappedAlways: false,
      fetchcost: 4,
    },
  ],

  // ── Thawing Glaciers – {1},{T}: fetch basic (tapped), bounces back to hand ─
  [
    'thawing glaciers',
    {
      fetchType: 'mana_cost',
      fetchColors: ['W', 'U', 'B', 'R', 'G'],
      fetchesOnlyBasics: true,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: true,
      entersTappedAlways: true,
      fetchcost: 1,
    },
  ],

  // ── Flagstones of Trokair – fetches Plains when it leaves the battlefield ─
  [
    'flagstones of trokair',
    {
      fetchType: 'trigger',
      fetchColors: ['W'],
      fetchesOnlyBasics: false,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: true,
      entersTappedAlways: false,
      fetchcost: 0,
    },
  ],

  // ── Urza's Cave – Chapter III Saga: search for ANY land (tapped) ──────────
  [
    "urza's cave",
    {
      fetchType: 'saga_any',
      fetchColors: ['W', 'U', 'B', 'R', 'G'],
      fetchesOnlyBasics: false,
      fetchesTwoLands: false,
      fetchedLandEntersTapped: true,
      entersTappedAlways: false,
      fetchcost: 0,
    },
  ],
]);
