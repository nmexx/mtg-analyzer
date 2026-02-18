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
| Testing | Vitest |
| Card data | Scryfall API / local JSON |

---

## Features

### Deck Input & Parsing
- Accepts standard **MTG Arena export format** (`4 Lightning Bolt`, `3 Island`, etc.)
- Automatically classifies every card into its simulation role: land, mana artifact, mana creature, exploration effect, ramp spell, ritual, or non-mana spell
- Reports deck statistics (total cards, land count, land percentage)
- Surfaces parse errors inline without blocking the rest of the UI

### Card Data Source
- **Local JSON mode** — load a Scryfall Default Cards JSON file (up to 1 GB) for fully offline lookups
- **Scryfall API fallback** — live card lookups when no local file is loaded
- Cards are cached in a lookup map so each name is only fetched once per session

### Land Detection & Display
- Detects and labels basic lands, shock lands, fetch lands, fast lands, check lands, battle lands, bounce lands, and crowd lands
- Shows mana production colors and fetch target types as badges on each land row
- Hover any card name to see a **Scryfall card image tooltip**

### Toggleable Card Categories
Each mana-producing category can be enabled/disabled wholesale or individually per card:
- **Mana Artifacts** (Sol Ring, Arcane Signet, etc.)
- **Mana Creatures** (Birds of Paradise, Llanowar Elves, etc.)
- **Exploration Effects** (Exploration, Azusa, Oracle of Mul Daya, etc.)
- **Ramp Spells** (Cultivate, Rampant Growth, Kodama's Reach, etc.)
- **Rituals** (Dark Ritual, Cabal Ritual, etc.)

### Key Card Selection
- Mark any non-land spell as a **key card** to track its playability over time
- The simulation records the turn-by-turn probability that each key card can be cast

### Simulation Engine
- Configurable **iteration count** (default 10,000; higher for tighter confidence intervals)
- Configurable **number of turns** to simulate (default 7)
- Configurable **opening hand size** (default 7)
- Configurable **maximum play sequences** to record per turn for the sequence explorer
- **Commander Mode** — switches to a 100-card singleton ruleset and adjusts crowd-land logic for a multiplayer environment
- Fetch land searching is modeled with color-awareness
- Bounce lands, shock lands, fast lands, check lands, battle lands, and crowd lands all have dedicated enter-tapped logic

### Mulligan Logic
- Optional mulligan simulation with two supported rule sets:
  - **London Mulligan** — draw 7, put back N cards
  - **Vancouver Mulligan** — draw 6/5/…, scry 1 on a kept hand
- Configurable **mulligan strategy**: Aggressive, Balanced, or Conservative
- **Custom mulligan rules** — set per-turn thresholds for minimum lands and maximum lands required to keep a hand

### Results & Charts
All charts are interactive Recharts line graphs rendered per turn:
- **Lands in play** — average lands on battlefield each turn
- **Available mana** — average total mana (lands + ramp) each turn
- **Life loss from shock/pain lands** — average cumulative life paid
- **Key card playability** — per-card probability (%) of being castable by each turn

Summary statistics displayed alongside charts:
- Total iterations run
- Hands kept (after mulligans)
- Mulligan rate (when mulligan logic is enabled)

### Play Sequence Explorer
- Select any turn and see the most common card sequences that led to that turn's mana state
- Helps identify which mana sources matter most in practice

### Export
- **PNG export** — captures the full results section as a PNG image via html2canvas
- **CSV export** — downloads a spreadsheet of per-turn averages (lands, mana, life loss, key card playability) for further analysis in Excel or similar tools

---

## Project Structure

```
src/
  App.jsx                   Main application shell and state
  components/               UI panel components
    ArtifactsPanel.jsx
    CardTooltip.jsx         Scryfall image hover tooltip
    CreaturesPanel.jsx
    ExplorationPanel.jsx
    LandsPanel.jsx
    RampSpellsPanel.jsx
    ResultsPanel.jsx        Charts and export buttons
    RitualsPanel.jsx
    SimulationSettingsPanel.jsx
    SpellsPanel.jsx
  parser/
    deckParser.js           MTG Arena format parser
  simulation/
    cardProcessors.js       Card classification and property extraction
    landData.js             Known land sets (fetches, shocks, etc.)
    monteCarlo.js           Core simulation loop
    simulationCore.js       Hand/turn evaluation helpers
  utils/
    math.js                 Statistical helpers
    uiHelpers.jsx           Mana symbol rendering, chart data prep
Card_Archive/               Curated card lists for classification
tests/                      Vitest unit tests
```

---

## License

Card names, mana symbols, and card data © Wizards of the Coast. This tool is fan-made and not affiliated with or endorsed by Wizards of the Coast.
