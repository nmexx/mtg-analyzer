# MTG Monte Carlo Deck Analyzer

A Monte Carlo simulation tool for Magic: The Gathering deck analysis. Paste in any MTG Arena-format deck list and run thousands of simulated opening hands to measure mana consistency, ramp efficiency, and key-card playability across the early turns of the game.

---

## Requirements

- Node.js 18+
- npm

---

## Getting Started

### Install dependencies

```bash
npm install
```

### Run the development server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. The page hot-reloads on every file save.

### Build for production

```bash
npm run build
```

Vite compiles and minifies the app into the `dist/` folder. All assets are relative-pathed (`base: './'` in `vite.config.js`), so the `dist/` folder can be dropped onto any static web host or opened directly from the filesystem.

### Preview the production build locally

```bash
npm run preview
```

Serves the contents of `dist/` on [http://localhost:4173](http://localhost:4173) — useful for verifying the build before deploying.

### Run tests

```bash
npm test          # single run
npm run test:watch  # watch mode
```

Tests are written with [Vitest](https://vitest.dev/) and cover the simulation engine, card processors, deck parser, and mana math utilities.

---

## Tech Stack

| Layer | Library |
|---|---|
| UI framework | React 18 |
| Build tool | Vite 5 + `@vitejs/plugin-react` |
| Charts | Recharts 2 |
| PNG export | html2canvas |
| URL compression | lz-string |
| Testing | Vitest |
| Card data | Scryfall API / local JSON |

---

## Features

### Deck Input & Parsing
- Accepts standard **MTG Arena export format** (`4 Lightning Bolt`, `3 Island`, etc.)
- Lines without a leading quantity (e.g. `Lightning Bolt`) are treated as a single copy (quantity 1)
- **MDFC lands** (e.g. `Hengegate Pathway // Mistgate Pathway`) are correctly counted once in the total card count; the spell face is stored separately for key-card selection without inflating the total
- Automatically classifies every card into its simulation role: land, mana artifact, mana creature, exploration effect, ramp spell, ritual, cost reducer, or non-mana spell
- Reports deck statistics (total cards, land count, land percentage)
- Surfaces parse errors inline without blocking the rest of the UI

### Card Data Source
- **Local JSON mode** — load a Scryfall Default Cards JSON file (up to ~300 MB) for fully offline lookups
- **Scryfall API fallback** — live card lookups when no local file is loaded
- Cards are cached in a lookup map so each name is only fetched once per session
- **API rate limiting** — soft warning at 60 Scryfall calls per session; hard block at 150 to respect API usage limits

### Land Detection & Display
- Detects and labels every major land cycle: basics, shock lands, fetch lands, fast lands, slow lands, battle lands, check lands, bounce lands, crowd lands, filter lands, pain lands, MDFC lands, Verge lands, Horizon lands, and more
- Shows mana production colours and fetch target types as badges on each land row
- Hover any card name to see a **Scryfall card image tooltip**

### Deck Statistics Panel
After parsing, a statistics panel breaks down the deck across multiple dimensions:
- **Land analysis** — counts of always-untapped, always-tapped, conditional, and fetch lands
- **Average CMC** of non-land spells
- **Ramp & acceleration count** and percentage of deck
- **Mana source breakdown** — bar chart of sources by category (lands, artifacts, creatures, ramp, rituals, exploration)
- **Colour identity** — pip-frequency analysis across all non-land cards

### Toggleable Card Categories
Each mana-producing category can be enabled/disabled wholesale or per-card:
- **Mana Artifacts** (Sol Ring, Arcane Signet, etc.)
- **Mana Creatures** (Birds of Paradise, Llanowar Elves, etc.)
- **Exploration Effects** (Exploration, Azusa, Oracle of Mul Daya, etc.)
- **Ramp Spells** — three sub-categories, all toggleable per-card:
  - **Green ramp** (Nature's Lore, Three Visits, Farseek, Rampant Growth, Cultivate, Kodama's Reach, Harrow, Skyshroud Claim, Explosive Vegetation, Hour of Promise, Traverse the Outlands, Boundless Realms, Reshape the Earth, and more)
  - **White catch-up ramp** (Tithe, Gift of Estates, Land Tax, Weathered Wayfarer, Knight of the White Orchid, Loyal Warhound, Oreskos Explorer, Boreas Charger, Archaeomancer's Map) — fetch Plains-subtype lands; creature/enchantment ramp cards stay on the battlefield (ETB fetch fires on cast turn)
  - **Colorless ramp** (Wayfarer's Bauble, Wanderer's Twig, Expedition Map, Armillary Sphere, Journeyer's Kite, Pilgrim's Eye, Burnished Hart, Solemn Simulacrum) — artifact/creature ramp that requires an activation cost on top of the cast cost; the engine verifies `cast cost + activation cost ≤ available mana` before playing
- **Rituals** (Dark Ritual, Cabal Ritual, etc.)
- **Cost Reducers** (Emerald Medallion, Goblin Electromancer, Baral, Helm of Awakening, Urza's Incubator, etc.) — reduce the generic portion of matching spell costs; cast before mana producers each turn so their discount applies to everything else in the turn; discounts stack
- **Draw Spells** (115+ cards supported, powered by `card_data/Card_Draw.js`):
  - **Per-turn permanents** — Rhystic Study, Mystic Remora, Phyrexian Arena, Sylvan Library, Necropotence, Azami Lady of Scrolls, Howling Mine, Font of Mythos, Dark Prophecy, etc. — these stay on the battlefield and draw cards each upkeep (`avgCardsPerTurn`, may be fractional). The amount drawn can be overridden per-card.
  - **One-shot spells** — Brainstorm, Ponder, Preordain, Night's Whisper, Harmonize, Wheel of Fortune, Windfall, Concentration, Distant Visions, etc. — cast from hand and draw their `netCardsDrawn` immediately, then go to the graveyard.
  - **Override modes**: default (from card data), one-time draw (fixed amount), per-turn draw (fixed per-upkeep). Use this to model conditional draws like Rhystic Study at a lower rate when opponents pay the `{1}`.

### Key Card Selection
- Mark any non-land spell as a **key card** to track its castability turn by turn
- Per-turn castability is computed in two modes:
  - **Regular** — mana from permanents on the battlefield only
  - **Burst** — regular mana plus any ritual or Mox-style artifact still in hand
- **Cost reducer discounts** — if a cost-reducer permanent is on the battlefield, its discount is applied to effective CMC before the castability check (`effectiveCmc = max(0, cmc − discount)`); only generic mana is discounted, colored-pip requirements are unchanged
- **On-curve playability** — a single headline percentage for each key card: how often it can be cast on the turn equal to its CMC

### Simulation Engine
- Configurable **iteration count** (default 10,000; range 1,000–100,000)
- Configurable **number of turns** to simulate (default 7; up to 15)
- Configurable **opening hand size** / **maximum hand size** (default 7) — at end of each turn the engine discards down to this limit; flood state → discard lands first; normal/screw → discard highest-CMC spells first
- Configurable **maximum play sequences** to record per turn for the sequence explorer
- **Commander Mode** — switches to a 100-card singleton ruleset; draws on turn 1; enables crowd-land untapped logic for multiplayer
- Full per-turn statistics with **standard deviations** for every numeric output
- Bipartite colour-pip matching ensures a card's specific colour requirements are verified against distinct mana sources — not just total mana
- **Cast order within Phase 6**: (0) cost reducers → (1) mana producers (artifacts+creatures+exploration) → (2) ramp spells → (3) draw spells; each sub-phase loops greedily until nothing more can be cast

### Flood & Screw Tracking
- **Mana flood rate** — percentage of games where the battlefield has ≥ N lands by turn T
- **Mana screw rate** — percentage of games where the battlefield has ≤ N lands by turn T
- Both thresholds (N lands, turn T) are fully configurable per simulation run

### Mulligan Logic
- Optional mulligan simulation with two supported rule sets:
  - **London Mulligan** — draw 7, put back N cards (bottom decisions are optimised for land count). In **Commander mode** the first mulligan is free — you draw 7 fresh cards without bottoming any (N=0).
  - **Vancouver Mulligan** — draw 6/5/… cards directly. In **Commander mode** the first redraw is still 7 cards.
- Configurable **mulligan strategy**:
  - **Conservative** — only mull zero-land or seven-land hands
  - **Balanced** — mull hands with < 2 or > 5 lands unless a cheap spell is present
  - **Aggressive** — mull any hand outside 2–4 lands
  - **Custom** — set explicit min/max land thresholds and an "early plays" requirement

### Results & Charts
All charts are interactive Recharts line graphs rendered per turn:
- **Lands in play** — average total and untapped lands on the battlefield each turn (with standard deviation band)
- **Available mana** — average total mana (lands + ramp) each turn
- **Per-colour mana** — average availability of each of the five colours per turn
- **Life loss** — average cumulative life paid from shock lands, fetch lands, pain lands, Horizon lands, MDFC lands, Ancient Tomb, Mana Vault, and Mana Crypt
- **Key card playability** — per-card probability (%) of being castable each turn (regular and burst overlays)

Summary statistics displayed alongside charts:
- Total iterations run, hands kept, mulligan rate
- Flood rate and screw rate at the configured thresholds
- On-curve playability percentage per key card

### Comparison Mode
Switch to **Compare Two Decks** mode to run both decks through the same simulation settings simultaneously:
- Side-by-side deck input panels with customisable Deck A / Deck B labels
- All card-category panels rendered in two-column layout via `ComparisonRow`
- **Overlay charts** in `ComparisonResultsPanel` plot both decks on shared axes (solid = Deck A, dashed = Deck B):
  - Lands per turn, untapped lands per turn
  - Total mana per turn
  - Cumulative life loss
  - Key card playability (each deck's key cards can differ)
- **Delta summary** — final-turn difference in lands, mana, and life loss between the two decks

### Play Sequence Explorer
- Select any turn to see the most common card sequence that led to that state
- Full turn-by-turn action log: draws, land plays, ramp casts, fetch activations, spell casts
- Separate sequences captured for regular-mana and burst-mana playability

### Shareable URLs
- The complete app state (deck lists, settings, key cards, comparison mode) is compressed with **LZ-String** and encoded into the URL hash
- Share a link to let someone else load your exact configuration instantly
- State falls back to `localStorage` when no hash is present

### Persistence
- All settings (deck text, simulation config, mulligan rules, flood/screw thresholds, comparison mode) are automatically saved to `localStorage`
- State is restored on page reload with no manual action required

### Export
- **PNG export** — captures the full results section as a PNG image via html2canvas
- **CSV export** — downloads a spreadsheet of per-turn averages (lands, mana, life loss, per-colour mana, key card playability) for further analysis; in comparison mode both decks are merged into a single file with labelled columns

### Theme
- **Dark / Light mode toggle** in the toolbar; preference is saved to `localStorage`
- Theme is applied before first paint to avoid flash of unstyled content

### Tutorial Page
- `tutorial.html` — a standalone "How It Works" page explaining the Monte Carlo method, all core assumptions, land cycle behaviour, mulligan logic, key-card playability, and flood/screw tracking
- Linked from the main app toolbar; uses the same CSS theme as the main app

---

## Project Structure

```
src/
  App.jsx                       Main application shell and state
  index.css                     Global styles and theme variables
  components/
    ArtifactsPanel.jsx          Mana-artifact toggle panel
    CardTooltip.jsx             Scryfall image hover tooltip
    ComparisonResultsPanel.jsx  Overlay charts for A/B comparison mode
    ComparisonRow.jsx           Two-column comparison layout primitive
    CreaturesPanel.jsx          Mana-creature toggle panel
    CostReducersPanel.jsx        Cost-reducer toggle panel
    DeckStatisticsPanel.jsx     Post-parse stats: CMC, land breakdown, colour identity
    ExplorationPanel.jsx        Exploration-effect toggle panel
    LandsPanel.jsx              Land display with colour/fetch badges
    RampSpellsPanel.jsx         Ramp-spell toggle panel
    ResultsPanel.jsx            Single-deck charts and export buttons
    RitualsPanel.jsx            Ritual toggle panel
    SimulationSettingsPanel.jsx Iteration count, turns, mulligan, flood/screw settings
    SpellsPanel.jsx             Key-card selector for non-land spells
  parser/
    deckParser.js               MTG Arena format parser
  simulation/
    cardProcessors.js           Card classification and property extraction
    landData.js                 Known land sets (fetches, shocks, etc.)
    monteCarlo.js               Core simulation loop
    simulationCore.js           Hand/turn evaluation helpers
  utils/
    math.js                     Statistical helpers
    uiHelpers.jsx               Mana symbol rendering, chart data prep
card_data/                      Curated card data files for simulation classification
  Artifacts.js
  CostReducers.js
  Exploration_Effects.js
  Fetch_Lands.js
  Lands.js
  Mana_Dorks.js
  Ramp_Spells.js
  Rituals.js
tests/                          Vitest unit tests
tutorial.html                   Standalone "How It Works" documentation page
documentation/
  land_behaviour.md             Developer reference — land cycle ETB logic and assumptions
  IMPROVEMENTS.md               Planned and completed improvements backlog
```

---

## License

Card names, mana symbols, and card data © Wizards of the Coast. This tool is fan-made and not affiliated with or endorsed by Wizards of the Coast.

