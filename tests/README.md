# MTG Monte Carlo Analyzer — Test Suite

## Running the tests

```bash
# Run all tests once
npm test

# Watch mode (re-runs on file save)
npm run test:watch
```

**Framework:** [Vitest](https://vitest.dev/)
**Test files:** 8 files · **423 tests** total (as of Feb 2026)

---

## Test files

### `cards.test.js` — Card data integrity (76 tests)

Validates the six data files in `card_data/` that feed the simulation engine.

| Describe block | What is checked |
|---|---|
| `Mana_Dorks — structural integrity` | Every entry has `manaAmount > 0`, a non-empty `produces` array with valid colour symbols, and a lowercase key |
| `Mana_Dorks — known card values` | Spot-checks Birds of Paradise, Noble Hierarch, Avacyn's Pilgrim, Palladium Myr |
| `Artifacts — structural integrity` | Every entry has valid `produces` colours and a numeric `manaAmount` |
| `Artifacts — special flags` | `isMoxDiamond`, `isChromeMox`, `doesntUntapNaturally`, `etbCost` are correct for named cards |
| `Ramp_Spells — structural integrity` | Every entry has `landsToAdd ≥ 1` and a valid `fetchFilter` string |
| `Ramp_Spells — known card values` | Spot-checks Cultivate, Kodama's Reach, Three Visits, Skyshroud Claim |
| `Fetch_Lands — structural integrity` | Every entry has a valid `fetchType`, non-empty `fetchColors`, boolean flags |
| `Fetch_Lands — known card values` | Spot-checks Polluted Delta, Evolving Wilds, Fabled Passage |
| `Rituals — structural integrity` | Every entry has `manaProduced > 0` and `netGain ≥ 0` |
| `Rituals — known card values` | Spot-checks Dark Ritual, Cabal Ritual, Seething Song, Pyretic Ritual |
| `Exploration_Effects — structural integrity` | Every entry has a positive `landsPerTurn` |
| `Lands — structural integrity` | Every entry has a non-empty `color_identity`, and valid `sim_flags` |

---

### `cardProcessors.test.js` — `src/simulation/cardProcessors.js` (58 tests)

Covers all 13 exported pure functions that transform raw Scryfall data into internal card objects.

| Function | Tests | Key scenarios |
|---|---|---|
| `extractManaProduction` | 7 | `null` input, single colour, two colours, deduplication, "any color" → all 5, no symbols → `[]` |
| `extractManaAmount` | 5 | `null`, single `{C}`, `{C}{C}`, `{C}{C}{C}`, no `{C}` symbols |
| `extractRitualManaAmount` | 5 | `null`, explicit symbols (`{R}{R}{R}`), English words (two/three), numeric, unrecognized |
| `calculateCMC` | 7 | Valid `dataCmc`, calculated from cost, 0-override, generics-only, coloured pips, X ignored, null/null |
| `hasManaTapAbility` | 5 | `null`, `{T}: Add {G}`, lowercase `{t}`, plain spell, life-gain text |
| `processLand` | 4 | Basic forest, fetch land (Polluted Delta), transform-back-land → `null`, bounce land (`isBounce`) |
| `processManaArtifact` | 4 | Generic rock, Sol Ring known entry, Mox Diamond flag, Chrome Mox flag |
| `processManaCreature` | 3 | Generic dork, Birds of Paradise known entry, Llanowar Elves known entry |
| `processExploration` | 3 | Default `landsPerTurn=2`, Azusa → 3, `isCreature`/`isArtifact` flags |
| `processRampSpell` | 2 | Cultivate known entry, unknown name falls back to safe defaults |
| `processRitual` | 3 | Well-formed object, Dark Ritual known values, unknown name defaults |
| `processSpell` | 3 | Plain spell, split/adventure card takes front face, `{0}` cost → `cmc=0` |
| `processCardData` | 7 | Routes land, mana creature, mana artifact, ramp spell, ritual, plain spell, MDFC land-face |

> **Bug found during testing:** `isBounce` was always `false` because `BOUNCE_LANDS` check came *after* `LANDS_ENTER_TAPPED_ALWAYS` in `processLand`. The check order was fixed in `cardProcessors.js`.

---

### `simulationCore.js` — `src/simulation/simulationCore.js` (93 tests)

Covers all 11 exported pure simulation primitives.

| Function | Tests | Key scenarios |
|---|---|---|
| `shuffle` | 5 | New array returned, original unmodified, empty/single-element, all 6 permutations observed across 500 trials |
| `matchesRampFilter` | 7 | Non-land rejected; `any`, `basic`, `subtype`, `snow`, unknown-fallback filters |
| `doesLandEnterTapped` | 9 | Basic (untapped), `entersTappedAlways`, shock, fast (≤2 / >2 lands), battle (≥2 / <2 basics), crowd (commander / non-commander), check (subtype present / absent) |
| `selectBestLand` | 5 | No lands → `null`, single land, untapped preferred, bounce blocked on empty board, fetch preferred |
| `findBestLandToFetch` | 4 | No targets → `null`, colour match, `fetchesOnlyBasics`, dual-land priority on early turns |
| `calculateManaAvailability` | 10 | Empty board, untapped/tapped lands, artifacts, creatures with/without summoning sickness, multiple sources, `manaAmount > 1`, `sources` array populated (single land, dual land) |
| `solveColorPips` | 9 | No pips, exact match, not enough sources, dual land covers one of two different pips, single dual land cannot cover two pips, classic double-counting false positive, same-colour double pips, wildcard `*`, 5-colour, unsatisfiable colour |
| `canPlayCard` | 13 | Total insufficient, satisfied, colour pips unsatisfied, zero-cost, monocolour, multicolour; competing-demand (Watery Grave+Forest rejected, Watery Grave+Island accepted, two Watery Graves for `{U}{U}`, one Watery Grave Swamp rejected for `{U}{U}`, 5-colour, fallback aggregate path) |
| `tapManaSources` | 5 | Coloured source, generic-cost, already-tapped ignored, exact count, zero-cost no-op |
| `playLand` | 6 | Hand→battlefield, untapped/tapped entry, `turnLog` written, bounce returns a land, fetch placed, life-loss = 0 for basics |
| `castSpells` | 7 | Mana creature cast, insufficient mana skip, artifact cast, Cultivate (lands-to-hand), `includeRampSpells=false`, disabled list, `turnLog` |
| `calculateBattlefieldDamage` | 10 | Empty battlefield → 0; Mana Crypt 1.5 per copy; Ancient Tomb 2 life; pain land counted turns 1–5 only; talisman counted turns 1–5 only; 5-color pain land counted when tapped only; multiple sources sum correctly |

---

### `monteCarlo.test.js` — `src/simulation/monteCarlo.js` (56 tests)

Covers both exports of the main simulation engine.

#### `buildCompleteDeck` (20 tests)

| Scenario | What is verified |
|---|---|
| `null` / `undefined` / empty deck | Returns `[]` without throwing |
| `quantity > 1` | Correct number of copies added |
| Object identity | Each copy is a fresh object (not the same reference as the source) |
| `include*` flags set to `false` | Entire category excluded |
| `disabled*` Sets | Only the named card excluded; others remain |
| Lands and spells | Always included regardless of any flag |
| Total card count | Correct sum across all categories |

#### `monteCarlo` (36 tests)

| Group | What is verified |
|---|---|
| Result shape | All top-level keys present; array lengths equal `turns`; all values finite |
| `handsKept` / `mulligans` | `handsKept` always equals `iterations`; `mulligans=0` when disabled |
| Land statistics | Avg > 0 on turn 1; non-decreasing across turns; untapped ≤ total; all-tapped deck → 0 untapped; mono-green produces only G |
| Key-card playability | `{0}` ≈ 100% by turn 2; CMC-10 → 0% on turn 1; values in [0,100]; array length = turns; monotonically non-decreasing |
| `hasBurstCards` | `true` with rituals present, `false` otherwise |
| Mulligans | Aggressive strategy triggers mulligans; London and Vancouver rules run cleanly |
| Life-loss | 0 for basics-only deck; non-negative; cumulative |
| Commander mode | Runs cleanly; turn-2 lands ≥ non-commander baseline |
| Edge cases | `iterations=1`, `turns=1`, all-spells deck, `handSize=1`, `fastestPlaySequences` populated |

---

### `deckParser.test.js` — `src/parser/deckParser.js` (30 tests)

Covers `parseDeckList`, the single async export.

| Group | Tests | Key scenarios |
|---|---|---|
| Guard conditions | 3 | Blank text → error, empty `cardLookupMap` in local mode → error, no parseable lines → `null` |
| Line parsing | 8 | `"1 Forest"`, `"4x Forest"`, duplicate accumulation, blank lines, `Deck`/`Sideboard`/`Commander` headers (case-insensitive) |
| Unknown cards | 2 | Error recorded, known cards still processed |
| Card categorisation | 8 | Land, creature, artifact, ramp spell, ritual, exploration, generic spell, full mixed deck |
| MDFC with land face | 2 | Land entry created + `isMDFCSpellSide` spell entry; name/quantity preserved |
| `totalCards` / `landCount` | 3 | Cross-category sum, land-only count, zero when no lands |
| Result shape | 3 | All keys present, `errors: []` for clean deck, per-card `quantity` correct |
| Transform-land null path | 1 | `processCardData` returns `null` for transform back-land → card silently skipped, no error |

---

### `math.test.js` — `src/utils/math.js` (22 tests)

Covers both exported pure helpers.

| Function | Tests | Key scenarios |
|---|---|---|
| `average` | 11 | `null`/`undefined`/empty → 0, single value, simple mean, all-zeros, decimals, large array (1–100 → 50.5), `null`/`NaN` elements skipped, negative numbers |
| `safeToFixed` | 11 | `undefined`/`null`/`NaN` → `0`, 2-decimal default, custom decimal places, returns a JS `number` (not a string), integers, zero, negative, very small fractions |

> **Note:** `safeToFixed` always returns a `number` — the result of calling `Number(value.toFixed(n))` — so assertions use `toBe(1.35)` not `toBe('1.35')`.

---

### `uiHelpers.test.js` — `src/utils/uiHelpers.jsx` (41 tests)

Runs in the **jsdom** environment (`// @vitest-environment jsdom`). Covers all 7 exports.

| Function | Tests | Key scenarios |
|---|---|---|
| `getManaSymbol` | 2 | All 6 colour symbols return correct emoji; unknown/empty symbol → `''` |
| `parseManaSymbols` | 8 | `null`/`undefined`/empty → `[]`; single generic; single colour pip; mixed cost; zero-cost `{0}`; five-colour; X cost; plain text without braces |
| `getFetchSymbol` | 2 | All 4 known fetch types return correct badge string; unknown type → `''` |
| `renderManaCost` | 6 | `null`/empty → `[]`; element count matches symbols; colour pip uses `mana-cost-symbol` class; generic uses `mana-cost-generic`; multicolour cost; each element is a valid React element |
| `renderSequenceBody` | 5 | Returns a valid React element; accepts optional `accentColor`; empty sequence array; turn with no actions; turn with life loss |
| `downloadTextFile` | 3 | Anchor element created and `.click()` called once; `.download` filename set correctly; `Blob` constructed with correct content and `text/plain` type |
| `prepareChartData` | 13 | `null` input → `null`; returns object with 4 expected array keys; array length equals `turns`; turn numbers 1-indexed; missing `landsPerTurn` → 0; averages rounded to 2 dp; Lo/Hi std-dev bands; Lo ≥ 0 always; per-colour mana; missing `colorsByTurn`; key-card playability; `+burst` columns present/absent; life-loss bands; missing `stdDev` → 0 |

---

---

### `App.test.jsx` — `src/App.jsx` (46 tests)

Runs in the **jsdom** environment with `@testing-library/react`. Tests the top-level
`MTGMonteCarloAnalyzer` component end-to-end, mocking the heavy-compute modules
(`monteCarlo`, `parseDeckList`) so tests remain fast.

| Describe block | What is checked |
|---|---|
| `Initial render` | Renders without throwing; header title & subtitle present; Data Source / Deck List headings visible; Parse Deck button present; footer notice present; no error banner on first mount |
| `Data Source panel` | Both radio buttons rendered; "Local JSON File" checked by default; file-upload section visible in local mode; file-upload section hidden after switching to Scryfall mode; Scryfall radio becomes checked |
| `Deck List panel` | Textarea renders; placeholder references MTG Arena format; user input reflected in textarea value |
| `Parse Deck flow` | `parseDeckList` called once on button click; deck text passed as first argument; deck statistics (total cards, land count) appear after a successful parse; error banner shown when `parseDeckList` returns `null`; per-card errors surfaced from `deck.errors`; prior error cleared on subsequent clean parse |
| `Run Simulation flow` | After parsing a deck, "Start Simulation" button appears; clicking it invokes `monteCarlo` exactly once |
| `localStorage persistence` | Deck text persisted to `localStorage.slotA.deckText` on change (new nested schema); saved deck text, `apiMode`, and `comparisonMode` all restored on re-mount; `labelA` persisted when changed in comparison mode; defaults used when `localStorage` is empty |
| `Comparison mode` | "Single Deck" and "Compare Two Decks" toggle buttons render; single-deck is default (active class present); clicking Compare renders two `deck-textarea` elements; Deck A/B label inputs default to "Deck A" / "Deck B"; clicking Single Deck reverts to single-deck UI; both Parse Deck buttons independently call `parseDeckList`; "Parsing failed (Deck B)" shown on Deck B null parse; guard error "Please parse Deck B first" fires when only Deck A is parsed before simulation; `monteCarlo` called twice when both decks are parsed and simulation runs |
| `localStorage persistence` (extended) | `turns` saved to `localStorage` when changed via SimulationSettingsPanel; `commanderMode` saved when Commander Mode checkbox is toggled |

> **Setup note:** `vite.config.js` now includes a `test` block (`globals: true`, `environment: 'jsdom'`,
> `setupFiles: ['./tests/setup.js']`). The setup file extends vitest's `expect` with
> `@testing-library/jest-dom` matchers (`toBeInTheDocument`, `toBeChecked`, etc.).

---

## Coverage summary

| File | Tests |
|---|---|
| `cards.test.js` | 77 |
| `cardProcessors.test.js` | 58 |
| `simulationCore.test.js` | 93 |
| `monteCarlo.test.js` | 56 |
| `deckParser.test.js` | 30 |
| `math.test.js` | 22 |
| `uiHelpers.test.js` | 41 |
| `App.test.jsx` | 46 |
| **Total** | **423** |

## What is not yet tested

- Individual panel components (`src/components/`)
