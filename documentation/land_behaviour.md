# Land Behaviour Reference

This document describes how lands are processed, categorised, and played in the
Monte Carlo simulation.  It covers every land cycle that has special logic, the
assumptions made when choosing which land to play, which land to fetch, and how
mana sources are prioritised when casting spells.

---

## 1. Data Pipeline

```
Scryfall JSON
    │
    ▼
processLand()          (cardProcessors.js)
    │  – looks up LAND_DATA (from Lands.js) and FETCH_LAND_DATA (from Fetch_Lands.js)
    │  – attaches boolean flags: isShockLand, isBounce, isCheck, isFetch, …
    │  – resolves `produces[]` colours and `landSubtypes[]`
    ▼
Card object in deck  →  hand / library / battlefield arrays
    │
    ▼
simulationCore.js
    ├─ selectBestLand()        which land to play this turn
    ├─ playLand()              puts the land on the battlefield
    ├─ findBestLandToFetch()   which land a fetch land retrieves
    └─ calculateManaAvailability()  how much mana each permanent provides
```

All land knowledge lives in two archive files plus one derived module:

| File | Purpose |
|---|---|
| `card_data/Lands.js` | Non-fetch land cycles, `sim_flags` per cycle/card |
| `card_data/Fetch_Lands.js` | One entry per fetch land: `fetchType`, `fetchColors`, cost, targeting rules |
| `src/simulation/landData.js` | Builds the `LAND_DATA` Map from `Lands.js`; exports named `Set` constants per flag: `SLOW_LANDS`, `BATTLE_LANDS`, `FILTER_LANDS`, `ODYSSEY_FILTER_LANDS`, `HORIZON_LANDS`, `THRIVING_LANDS`, `VERGE_LANDS`, `MDFC_LANDS`, `BOUNCE_LANDS`, `PATHWAY_LANDS`, etc. `processLand()` imports these sets and stamps matching boolean flags directly on each card object. |

---

## 2. Land Cycle Catalogue

### 2.1 Always-Untapped Lands

| Cycle | Key flag | Notes |
|---|---|---|
| Original Duals (ABUR) | `entersTappedAlways: false` | Both basic subtypes; never tapped |
| Shock Lands | `isShockLand: true` | See §3.1 |
| Pain Lands | `isPainLand: true` | Untapped; deal 1 life when tapped for colour (§3.6) |
| 5-Colour Pain Lands (Mana Confluence, City of Brass) | `isFiveColorPainLand: true` | Produce any colour; 1 life when tapped |
| Filter Lands | `isFilterLand: true` | Shadowmoor cycle; two-pass mana logic, {A}/{B} activation (§3.5) |
| Pathway Lands | `isPathway: true` | Treated as a simple untapped dual; no ETB decision logic |
| Fast Lands | `isFast: true` | Untapped only when ≤2 other lands are already in play (§3.3) |
| Battle Lands | `isBattleLand: true` | Untapped only when ≥2 basic lands are already in play (§3.4) |
| Slow Lands | `isSlowLand: true` | Untapped only when ≥2 total lands are already in play (§3.13) |
| Check Lands | `isCheck: true` | Untapped only when a matching subtype land is already in play (§3.2) |
| Horizon Lands | `isHorizonLand: true` | Always untapped; every tap costs 1 life (§3.14) |
| Lair Lands (Planeshift) | `isBounce: true, entersTappedAlways: false` | 3-colour untapped bounce; returns a non-Lair land on ETB (§3.7) |
| MDFCs & Modal Lands | `isMDFCLand: true`, `lifeloss: 3` | Pay 3 life to enter untapped on turns 1–4; tapped with no life cost from turn 5 onward (§3.15) |
| Tron Lands | `entersTappedAlways: false` | Produce {C}; assembly bonus not simulated |
| Utility (always untapped) | `isUtilityUntapped: true` | Generic bucket for lands entered as untapped utility |
| Ancient Tomb | `isAncientTomb: true` | Produces {C}{C}; 2 life per upkeep tracked separately |
| Odyssey / Fallout Filter Lands | `isOdysseyFilter: true` | Untapped; two-pass mana logic, {1} generic activation (§3.5) |

### 2.2 Always-Tapped Lands

| Cycle | Key flag | Notes |
|---|---|---|
| Triomes | `entersTappedAlways: true` | 3 colours + 3 basic subtypes; always tapped |
| Man Lands | `isManLand: true` | Always tapped (creature ability not modelled) |
| Storage Lands | `isStorageLand: true` | Always tapped |
| Reveal Lands | `isReveal: true` | Always tapped in the sim (real condition not checked) |
| Bounce Lands (Karoo cycle) | `isBounce: true` | Always tapped; returns a non-bounce land to hand on ETB (§3.7) |
| Hideaway Fetch Sites (SNC) | `isHideawayFetch: true` | Auto-sacrifice on ETB to fetch a 3-colour basic tapped (§3.9) |
| Mirage Fetch Lands | `fetchType: 'slow'` | ETB tapped; treated like a land that produces its fetch targets next turn |
| Conditional-Life Lands | `isConditionalLife: true` | Always tapped; life-gain is not tracked |
| Crowd Lands | `isCrowd: true` | Untapped in Commander mode, tapped otherwise (§3.8) |
| Surveil Lands (MKM) | `entersTappedAlways: true` | Always tapped; ETB trigger: surveil 1 (not simulated); has basic subtypes |
| Bicycle Lands (Amonkhet) | `entersTappedAlways: true` | Always tapped; cycling not simulated; has basic subtypes (fetchable) |
| Snarl Lands (Strixhaven) | `isReveal: true` | Merged into the Reveal Lands (Show Lands / Snarls) cycle in `Lands.js`; always tapped in sim |
| Scry Lands (Theros) | `entersTappedAlways: true` | Always tapped; ETB scry 1 not simulated |
| Vivid Lands | `entersTappedAlways: true` | Always tapped; charge-counter "any colour" mode not simulated |
| Gain Lands / Refuge Lands / Coastal Lands | `entersTappedAlways: true` | Always tapped; life-gain ETB not tracked |
| Tri-Lands (Shard/Wedge) | `entersTappedAlways: true` | Always tapped; plain 3-colour tap duals |
| Gate Cycle | `entersTappedAlways: true` | Always tapped; plain 2-colour tap duals |
| Hideaway Lands (Lorwyn) | `entersTappedAlways: true` | Always tapped; hideaway ability not simulated |
| Depletion Lands | `entersTappedAlways: true` | Always tapped; depletion-counter logic not simulated |
| Extra Bounce Lands (single-colour) | `isBounce: true, entersTappedAlways: true` | Always tapped; returns a land on ETB (§3.7) |
| Various Utility Tap Lands | `entersTappedAlways: true` | Always tapped; 5-colour or generic tap duals |

### 2.3 Dynamic / Scaling Lands

| Card | Flag | Mana rule |
|---|---|---|
| Cabal Coffers | `scalesWithSwamps` | Net mana = max(0, Swamp count − 2) |
| Cabal Stronghold | `scalesWithBasicSwamps` | Net mana = max(0, basic Swamp count − 2) |
| Phyrexian Tower | `isPhyrexianTower` | {B}{B} if a creature is on the battlefield, else {C} |
| Temple of the False God | `isTempleOfFalseGod` | {C}{C} only when ≥5 lands are in play; produces nothing otherwise |
| Gaea's Cradle, Nykthos, etc. | `simplifiedMana: 'turn-1'` | mana = max(manaFloor, turn − 1); rough proxy for the ramp they represent |
| Verge Lands | `isVerge` | Primary colour always available; secondary only when matching subtype is on the battlefield |

---

## 3. ETB (Enters-the-Battlefield) Logic

`doesLandEnterTapped(land, battlefield, turn, commanderMode)` in `simulationCore.js`
resolves the ETB state at the moment a land is played.  Evaluation order:

1. **Shock Land** → always enters tapped here; `playLand()` immediately pays 2 life and
   flips it to untapped for turns 1–6.  From turn 7 onwards it enters tapped and stays
   tapped.
2. **Fast Land** → enters tapped when ≥3 lands are already on the battlefield.
3. **Battle Land** → enters tapped when fewer than 2 basic lands are on the battlefield.
4. **Check Land** → enters tapped unless a land with a matching basic subtype is already in play.
5. **Crowd Land** → enters tapped when `commanderMode` is `false`.
6. **`entersTappedAlways: true`** → always tapped.
7. **`entersTappedAlways: false`** → always untapped.
8. Default → untapped.

### 3.1 Shock Lands

The sim **always pays 2 life** to enter untapped on turns 1–6.  From turn 7
onward the land enters tapped and no life is paid.  Life loss is returned from
`playLand()` and accumulated in the Monte Carlo run.

### 3.2 Check Lands

The sim checks whether *any* land currently on the battlefield has a matching
basic subtype (e.g. Dragonskull Summit needs Island or Swamp).  The required
subtypes come from `checkTypes` on the card object, falling back to the colours
the land produces.

### 3.3 Fast Lands

Untapped when there are 0, 1, or 2 lands already on the battlefield; tapped from
the 3rd land onward.  This makes them strong on turns 1–3 and weak later.

### 3.4 Battle Lands

Untapped only when ≥2 basic lands are already in play.  This means they are
almost always tapped in the early game.

The database currently holds 8 of the 10 possible colour pairs: the original
BFZ five (Prairie Stream, Sunken Hollow, Smoldering Marsh, Cinder Glade,
Canopy Vista) plus three added in the February 2026 data update — Radiant
Summit ({R}/{W}), Vernal Fen ({B}/{G}), and Sodden Verdure ({G}/{U}).

### 3.5 Filter Lands

There are two distinct filter land sub-types handled by the two-pass system:

#### Shadowmoor Filter Lands (`isFilterLand`) — e.g. Mystic Gate, Fetid Heath

- **Pass 1** – all other permanents add their mana to the pool.
- **Pass 2** – the land looks for a source that produces **colour A or colour B**
  (one of its own colours):
  - If found: consumes that source and produces 2 coloured mana.
  - If not: falls back to `{C}` (mode 1).

Generic colourless (`{C}`) cannot pay this cost — only a matching coloured source qualifies.

#### Odyssey / Fallout Filter Lands (`isOdysseyFilterLand`) — e.g. Skycloud Expanse, Ferrous Lake

- **Pass 1** – same as above.
- **Pass 2** – the land checks whether **any** mana unit exists (`total ≥ 1`):
  - If yes: consumes 1 unit (preferring colourless sources) and produces 2 coloured mana.
  - If not: falls back to `{C}` (mode 1).

Any mana — including pure `{C}` from Sol Ring — can pay this activation cost.

### 3.6 Pain Lands / 5-Colour Pain Lands

`calculateBattlefieldDamage()` charges 1 life per pain land on turns 1–5 (a
simplified assumption – every pain land is assumed to be tapped for colour each
turn).  5-colour pain lands (Mana Confluence, City of Brass) are charged only
when the permanent is marked `tapped` (i.e. actually used).

### 3.7 Bounce Lands

Two sub-types share the `isBounce: true` flag:

- **Karoo cycle** (`entersTappedAlways: true`) – always enter tapped; produce double mana.
- **Lair lands** (`entersTappedAlways: false`) – enter untapped; produce 3-colour mana.

In both cases, when a bounce land is played:

1. **Before playing** – `selectBestLand()` marks it as unplayable if there are
   no non-bounce lands on the battlefield to return.
2. **On play** – `playLand()` selects the land to return: tapped non-bounce
   lands first, untapped non-bounce lands second.  The returned land goes back
   to hand.
3. **If a second bounce land is in hand** – it will only be played after the
   first bounce land has resolved and another non-bounce land is available.

### 3.8 Crowd Lands

Enter untapped in Commander mode (`commanderMode = true`) because the condition
"you have two or more opponents" is assumed to be met.  Enter tapped in 1v1 /
non-Commander mode.

### 3.9 Hideaway-Fetch Lands (SNC Family Lands)

These lands enter untapped, immediately sacrifice themselves, and fetch a basic
land from the library that matches one of their three colours.  Fetched land
enters tapped.  Target selection uses the same `findBestLandToFetch()` scoring
as regular fetch lands (§4).

### 3.10 City of Traitors

Every time a non-City-of-Traitors land is played, `playLand()` sacrifices all
City of Traitors copies currently on the battlefield.  This is an automatic
trigger — the sim assumes the opponent is playing a land, or accounts for the
ongoing drawback.

### 3.11 Thriving Lands

On ETB, the sim inspects the key cards' mana costs, counts colour-pip frequency,
and assigns the most-needed second colour to the land's `produces[]` array.  The
first (fixed) colour is kept.

### 3.12 Verge Lands

> **Data fix (Feb 2026):** `Lands.js` previously omitted `isVerge: true` from
> the cycle's `sim_flags`, which prevented `processLand()` from setting the flag
> on the card object.  As a result, Verge lands fell back to `entersTappedAlways:
> false` (always untapped) and the secondary-colour condition was never
> evaluated.  The flag has been restored and Verge lands now behave correctly.

Verge lands (e.g. Sunbillow Verge) produce their **primary colour unconditionally**
and their **secondary colour only when the required basic-land subtype is already
on the battlefield** at the moment `calculateManaAvailability()` is called.

- The `vergePrimary` field on the card object records the fixed colour (e.g. `'W'`).
- The `vergeSecondaryCheck` field records the required subtype string (e.g. `'Mountain'`).
- Inside `calculateManaAvailability()` the Verge land is handled before the regular
  land path.  The check scans `battlefield` for any land whose `landSubtypes` array
  includes the required type — this correctly counts shock lands, triomes, and other
  non-basic lands that carry the subtype in addition to actual basics.
- If the required subtype is absent, the `produces` array passed to `addManaSource`
  is `[vergePrimary]` only; secondary is not offered to the pip-matcher.

**Timing note:** the check is evaluated at mana-calculation time, not at ETB time.
This means a Verge land played on the same turn as a Mountain will gain its
secondary colour from the *next* spell-cast check onward (after the Mountain has
been placed on the battlefield).

### 3.13 Slow Lands

> **Data fix (Feb 2026):** `Lands.js` previously used `sim_flags: {
> entersTappedAlways: true }` for the Slow Lands cycle, which caused every Slow
> Land to enter tapped unconditionally and bypassed the ≥2-land check entirely.
> The flag was corrected to `isSlowLand: true` and the `SLOW_LANDS` set was
> added to `landData.js`; Slow Lands now enter correctly.

Untapped only when ≥2 total lands are already on the battlefield at the moment
of play.  Concretely, `doesLandEnterTapped()` returns `true` when the land
count is fewer than 2, making Slow Lands tapped on turns 1–2 and unconditionally
untapped from turn 3 onward (assuming one land per turn).  No life is paid, no
basic-land requirement must be met — any two lands suffice.  The logic is a
precise mirror of the Fast Land check (`> 2` → tapped) but inverted (`< 2` → tapped),
reflecting that Slow Lands are designed for mid-to-late game mana while Fast
Lands are designed for early game mana.

### 3.14 Horizon Lands

Horizon Lands (Horizon Canopy, Fiery Islet, Nurturing Peatland, Silent Clearing,
Sunbaked Canyon, Waterlogged Grove) always enter untapped.  Unlike pain lands
they do **not** have a colourless opt-out — the activation cost is always
`{T}, Pay 1 Life`; there is no `{T}` → `{C}` mode.

`calculateBattlefieldDamage()` charges **1 life per Horizon Land per turn** for
turns 1–5, using the same simplification as pain lands (every land is assumed
to be tapped for colour each turn it is in play).  From turn 6 onward no life
is charged.

### 3.15 MDFC Lands

Every card in the MDFCs & Modal Lands cycle is a double-faced card whose back
face is a single-colour land with the ability:

> *As this land enters, you may pay 3 life. If you don’t, it enters tapped.*

This is the same pattern as Shock Lands (§3.1) but with a different life cost
and a shorter untap window:

| Property | Shock Lands | MDFC Lands |
|---|---|---|
| Life to enter untapped | 2 | 3 |
| Pay-life threshold (turns) | 1–6 | 1–4 |
| From turn 7 / 5 onward | enters tapped, no life | enters tapped, no life |

**Simulation mechanics:**

1. `doesLandEnterTapped()` always returns `true` for `isMDFCLand`.
2. `playLand()` checks: when `isMDFCLand && turn <= 4 && entersTapped`, it flips
   the land to untapped and adds 3 life to the turn's `lifeLoss` return value.
3. From turn 5 onward the land enters tapped and no life is charged.
4. The land-selection logic in `selectBestLand()` treats MDFCs as untapped lands
   (their `entersTappedAlways` is `false`) because they are expected to enter
   untapped on the relevant early turns.

---

## 4. Fetch Land Selection (`findBestLandToFetch`)

When a fetch land is activated, every land in the library that matches the fetch
land's `fetchColors` (and `fetchesOnlyBasics` restriction) is scored:

| Condition | Score adjustment |
|---|---|
| Produces a colour missing from key cards | +300 (base), +250 per extra missing pip |
| Produces ≥2 colours | +100 |
| Turn ≤2 and produces ≥3 colours | +1000 (prioritise fixing very early) |
| Turn ≥6 and the target is a shock land | −100 (avoid life loss late game) |

**Missing colours** are derived by comparing the pip requirements of the
configured key cards against the colours already produced by untapped permanents
on the battlefield.

If no eligible land is found, the fetch land itself is placed on the battlefield
tapped (no fetch occurs).

**Fetch land ETB state:** Classic fetch lands (Onslaught/Zendikar) and Prismatic
Vista enter **untapped**.  Mirage fetches (`fetchType: 'slow'`), Evolving Wilds,
Terramorphic Expanse, and all basic-only fetches enter **untapped** but the
*fetched* land enters **tapped** (`fetchedLandEntersTapped: true`).

---

## 5. Land-to-Play Selection (`selectBestLand`)

Each turn, the simulation calls `selectBestLand(hand, battlefield, library, turn)`
to choose which land to play.  Priority order:

1. **Classic fetch land with sufficient mana to activate** – played immediately
   if ≥`fetchcost` untapped lands are on the battlefield.  Rationale: activating
   a fetch this turn nets a land drop *and* thins the deck.
2. **Any untapped, non-bounce land** – provides mana immediately this turn.
3. **Bounce land** (if a non-bounce land is available to return) – played last
   among non-tapped options; returns a tapped land where possible to minimise
   net tempo loss.
4. **Any remaining playable land** (anything with `canPlay = true`).

**Bounce land guard:** a bounce land is only considered `canPlay = true` when at
least one non-bounce land is already on the battlefield; otherwise it is skipped
entirely that turn.

---

## 6. Mana Availability (`calculateManaAvailability`)

Called once per candidate spell, this function tallies all untapped, non-
summoning-sick permanents.

Sources counted:

| Source type | Counted when |
|---|---|
| Lands | Untapped; special scaling rules apply (§2.3) |
| Mana artifacts | Untapped; Mox Opal requires metalcraft (3 artifacts); Mox Amber requires a legendary |
| Mana creatures | Untapped AND not summoning-sick |

The function returns:
- `total` – total mana units available
- `colors` – per-colour aggregate counts
- `sources` – one entry per mana unit with its `produces[]` array (used for bipartite matching)

### 6.1 Bipartite Pip Matching (`solveColorPips`)

Rather than checking per-colour aggregates, `canPlayCard()` runs an
augmenting-path bipartite match between colour pips and mana sources.  This
ensures that a single dual-colour source (e.g. Watery Grave producing {U} or
{B}) is never counted for *both* a {U} pip and a {B} pip simultaneously.

---

## 7. Mana Tapping (`tapManaSources`)

When a spell is cast, the sim taps permanents to pay for it in this order:

1. **Coloured pips first** – for each colour in the spell's cost, untapped
   sources that produce that colour are tapped one by one until that colour's
   requirement is met.
2. **Generic mana second** – remaining generic mana is paid by any still-untapped
   source (tapped in arbitrary order, using `manaAmount` where > 1).

This is greedy and does *not* model optimal tapping order (e.g. saving a
dual-coloured source for a later pip).  The result is correct for most
situations but may under-count available mana when sources overlap heavily.

---

## 8. Ramp Spell Land Fetching

When a ramp spell (`isRampSpell: true`) is cast, `castSpells()` searches the
library for lands matching the spell's `fetchFilter`:

| `fetchFilter` value | Eligible lands |
|---|---|
| `'any'` | Any land |
| `'basic'` | Basics only (`isBasic: true`) |
| `'subtype'` | Lands whose subtypes overlap with `fetchSubtypes[]` |
| `'snow'` | Lands whose name includes "snow" |
| default | Basics only |

The **first** matching land in library order is taken (the library is shuffled at
the start of each simulation run).  If `sacrificeLand` is set, a land is removed
from the battlefield before the search: basics are preferred over non-basics,
non-basics over bounce lands.

---

## 9. Life Loss Summary

Life loss from non-combat sources is tracked per turn:

| Source | Amount | When |
|---|---|---|
| Shock land (turn ≤6) | 2 | On ETB |
| Ancient Tomb | 2 | Per upkeep (every turn it is in play) |
| Pain land | 1 | Turns 1–5 (assumed tapped for colour) |
| 5-colour pain land | 1 | When tapped |
| Horizon Land | 1 | Turns 1–5 (assumed tapped every turn; no colourless opt-out) |
| MDFC Land | 3 | On ETB, turns 1–4 only (pays to enter untapped; no cost when entering tapped from turn 5) |
| Talisman | 1 | Turns 1–5 (assumed tapped for colour) |
| Mana Crypt | 1.5 (avg) | Per upkeep (50% chance × 3 damage = 1.5 expected) |

---

## 10. Known Assumptions and Simplifications

These are the places where the simulation makes a deliberate choice that may
differ from optimal or situational play:

| Topic | Assumption |
|---|---|
| Shock land life payment | Always pays 2 life on turns 1–6; never takes the tapped option early |
| Fast land threshold | Hard-coded at 3 lands = tapped; does not look ahead |
| Slow land threshold | Hard-coded at 2 lands = tapped; does not look ahead |
| Fetch target selection | Greedy score at fetch time; does not consider future turns |
| Shadowmoor filter land activation | Requires a source producing colour A or B (the land's own colours); `{C}` cannot pay — falls back to `{C}` output if no matching coloured source exists |
| Odyssey/Fallout filter land activation | Requires any 1 generic mana (including `{C}`); prefers consuming a colourless source over a coloured one |
| Bounce land return | Returns a tapped land first, then any non-bounce; does not evaluate which land is least valuable |
| Check land subtype inference | Falls back to the colours the land produces if `checkTypes` is absent |
| Reveal lands | Always treated as entering tapped; the actual "reveal a matching land" condition is not evaluated |
| Mox Opal / Mox Amber | Condition is simplified from turn 2 onward when `SIMPLIFY_MOX_CONDITIONS` is `true` |
| Scaling lands (Gaea's Cradle, etc.) | Approximated as `max(floor, turn − 1)`; does not count actual creatures/devotion |
| Pain land damage | Charged every turn 1–5 regardless of whether coloured mana was actually needed |
| MDFC land life payment | Pays 3 life only when entering untapped (turns 1–4); enters tapped with no life cost from turn 5 onward |
| Horizon land damage | Charged every turn 1–5; no colourless opt-out (unlike pain lands, Horizon Lands have no free {C} mode) |
| Tapping order | Greedy: colours paid first, generic paid last; not globally optimal |
| City of Traitors | Sacrificed whenever *any* other land is played; does not model strategic timing |
| Thriving lands | Second colour locked in on ETB based on key card pip frequency; cannot change later |
| Verge lands | Secondary colour evaluated at mana-calculation time against the current battlefield; no look-ahead into cards played in the same turn |
| Multi-land turns (Exploration effects) | The same land-selection priority is applied for each additional land drop |

---

## 11. Suggestions for Future Improvements

The following are areas where the current model could be refined:

- **Dynamic fetch timing** – currently a classic fetch land is played (and
  activated) on the same turn it is drawn.  Real play sometimes holds a fetch to
  shuffle after a Brainstorm or to avoid graveyard-hate.  Adding a "hold fetch"
  heuristic could improve accuracy.

- **Shock land decision by life total** – the model always pays 2 life on turns
  1–6.  A life-total threshold (e.g. stop paying below 10 life) would model
  games where shocks enter tapped late to preserve life.

- **Check land look-ahead** – the sim could evaluate whether playing a check
  land tapped now is better than playing a basic and getting the check land
  untapped next turn.

- **Bounce land target optimisation** – currently the sim returns a tapped land.
  It should prefer returning a land that will be replayed for free (e.g. an
  unneeded basic) over returning a land that holds an important colour.

- **Reveal land condition** – reveal lands (e.g. Port Town) enter untapped when
  you reveal a Plains or Island.  Since the hand is known to the sim, this
  condition could be evaluated accurately.

- **Verge land partial evaluation** – Verge lands' secondary colour is checked
  against the battlefield at mana-calculation time.  The check could be made
  turn-aware (e.g. the secondary colour becomes available right after a basic is
  fetched within the same turn).

- **Odyssey / Fallout Filter Lands** – use `isOdysseyFilterLand` (flag `isOdysseyFilter`
  in `Lands.js`) and generic `{1}` activation.  Shadowmoor filter lands use `isFilterLand`
  and require a matching coloured source.  The two sub-types are processed in separate
  second-pass loops.
