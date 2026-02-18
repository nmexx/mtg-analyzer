# MTG Monte Carlo Analyzer — Planned Improvements

## Performance / Architecture

1. **Move simulation to a Web Worker**
   - The `monteCarlo` loop runs on the main thread inside a `setTimeout`, which blocks the UI on high iterations.
   - A Web Worker would allow a real progress bar and prevent the browser from freezing.

2. **Split App.jsx into modules** --------DONE
   - The file is 4000+ lines and mixes simulation engine, data processing, and UI.
   - Extract: `SimulationEngine.js`, `DeckParser.js`, and separate panel components (`LandsPanel`, `ResultsPanel`, `SequencesPanel`, etc.)

3. **`useMemo`/`useCallback` for expensive recalculations**
   - `prepareChartData()`, `buildCompleteDeck()`, and the `LAND_DATA` Sets all run on every render.
   - Memoizing them would eliminate needless recalculations on unrelated state updates.

---

## Missing Features

4. **Deck Comparison Mode (A/B)**
   - Multiple `// comparison mode` placeholder comments already exist throughout the file.
   - Run two decks side-by-side with diff'd charts — the largest incomplete feature.

5. **Mana Curve Chart**
   - No CMC distribution chart exists.
   - Show spells grouped by CMC (standard deckbuilding metric); trivially added with existing Recharts infrastructure.

6. **"First playable by turn X" summary table**
   - For each key card, show the earliest turn where playability crosses configurable thresholds (e.g. 50%, 80%, 95%).
   - Complements the full per-turn chart with a quick-read summary.

7. **Standard deviation bands on charts**
   - Only averages are currently reported.
   - Adding ± std. deviation to the lands/mana charts would show consistency vs. raw average.

8. **On-Play vs. On-Draw toggle**
   - Non-commander mode already skips the draw on turn 0 (on the play).
   - An explicit toggle would let users measure the concrete impact of going second.

9. **LocalStorage deck persistence**
   - The deck text and all settings are lost on page refresh.
   - Saving to `localStorage` is a quick, high-value UX improvement.

---

## Simulation Accuracy

10. **Color pip reliability analysis**
    - `canPlayCard` checks total mana and single-pip counts but doesn't account for competing demands across the same mana sources (e.g. needing `{U}{U}` and `{B}` from the same Watery Grave).
    - A proper color-availability solver would improve accuracy for multicolor decks.

11. **Scry / cantrip modeling**
    - Cards like Brainstorm, Ponder, Serum Visions meaningfully improve land-hit rates.
    - Even a simplified "look at top N cards, keep best land" heuristic would improve fidelity for blue decks.

12. **Threshold-aware `selectBestLand` ordering**
    - Fast lands currently prioritize untapped without checking if you're about to exceed the 2-land threshold.
    - Check/reveal lands similarly don't verify whether the required type is already in hand.
    - The land selection heuristic should be made threshold- and hand-state-aware.

---

## UX / Export

13. **CSV / JSON data export** --------DONE
    - Only PNG export exists.
    - A CSV of the per-turn averages would let users do their own further analysis in spreadsheet tools.

14. **Card image hover preview** --------DONE
    - Add a Scryfall image tooltip on card names using:
      `https://api.scryfall.com/cards/named?exact=CARDNAME&format=image`
    - Makes the interface significantly more informative without any major layout changes.

15. **Extract inline styles to CSS** --------DONE
    - Every element uses inline `style={}` objects, making theming impossible and bloating render output with object allocations.
    - Migrate to CSS modules or a dedicated `styles.css` file.
