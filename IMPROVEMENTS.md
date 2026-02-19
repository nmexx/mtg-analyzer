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

4. **Deck Comparison Mode (A/B)** --------DONE
   - Multiple `// comparison mode` placeholder comments already exist throughout the file.
   - Run two decks side-by-side with diff'd charts — the largest incomplete feature.

5. **Mana Curve Chart** --------DONE
   - No CMC distribution chart exists.
   - Show spells grouped by CMC (standard deckbuilding metric); trivially added with existing Recharts infrastructure.

6. **"First playable by turn X" summary table**
   - For each key card, show the earliest turn where playability crosses configurable thresholds (e.g. 50%, 80%, 95%).
   - Complements the full per-turn chart with a quick-read summary.

7. **Standard deviation bands on charts** --------DONE
   - Only averages are currently reported.
   - Adding ± std. deviation to the lands/mana charts would show consistency vs. raw average.

8. **On-Play vs. On-Draw toggle**
   - Non-commander mode already skips the draw on turn 0 (on the play).
   - An explicit toggle would let users measure the concrete impact of going second.

9. **LocalStorage deck persistence** --------DONE
   - The deck text and all settings are lost on page refresh.
   - Saving to `localStorage` is a quick, high-value UX improvement.

---

## Simulation Accuracy

10. **Color pip reliability analysis** --------DONE
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

---

## New — Simulation Accuracy

16. **Multi-card combo tracking**
    - Key cards are currently tracked independently.
    - Add a "require all of" combo group: report the % of games where *all* selected cards in a group are simultaneously castable on the same turn.
    - High value for combo decks (e.g. Thassa's Oracle + Demonic Consultation both available by turn 3).

17. **"On-curve" playability**
    - Separate from general cumulative playability, track the % of games where a key card is castable on *exactly* the turn matching its CMC.
    - The current metric shows a 3-drop at 90% on turn 7; the meaningful question is turn 3.

18. **Land flood / screw rate tracking**
    - Track per-iteration whether the game hit defined thresholds: ≥ N lands by turn T (flood) or ≤ N lands by turn T (screw).
    - Report as a % alongside the averages — directly answers "am I running too many/few lands?" in a way averages cannot.

19. **Opening hand land distribution histogram**
    - Bar chart of how often kept hands contain exactly 0–7 lands after mulligans.
    - Makes mulligan strategy tuning concrete and visual.

20. **Card draw / cantrip land-thinning**
    - Spells with a `drawsCards: N` flag (Night's Whisper, Sign in Blood, Harmonize, etc.) should draw N cards from the library during `castSpells`.
    - Complements existing scry modeling (item 11) and improves fidelity for black/blue midrange.

---

## New — UX

21. **Shareable URL**
    - Encode deck text + all simulation settings into the URL hash using `LZ-string` compression or `btoa`.
    - Anyone clicking the link gets an identical pre-filled simulation — zero backend required.

22. **Named simulation presets**
    - Extend LocalStorage persistence (item 9) to allow saving and loading named configs.
    - Example presets: "cEDH 33-land", "Aggro 20-land 60-card", "Budget Midrange".
    - Restores both card selections and all simulation settings at once.

23. **Deck health warnings panel**
    - Post-simulation, surface plain-language alerts based on thresholds, e.g.:
      - *"Average green mana by turn 2 is 0.2 — [Noble Hierarch] is only 18% castable on curve."*
      - *"Cumulative life loss exceeds 10 by turn 4 in 60% of games."*
      - *"Land screw rate (≤2 lands by turn 3) is 12%."*
    - Low implementation cost; high communication value for less experienced users.

---

## New — Performance / Architecture

24. **Web Worker with real progress bar** *(highest-ROI unfinished item from #1)*
    - At 10k iterations the UI hitches noticeably; blocking becomes severe at 50k+.
    - Offload the `monteCarlo` loop to a Worker, post progress messages back, and render a live % bar.
    - The engine is already pure and config-driven — it can be transferred with a single `import`.

25. **Batch / ranked deck comparison (N variants)**
    - Extend the current A/B mode to support N named deck slots.
    - Run all variants and display a sortable summary table ranked by a chosen metric (e.g. key-card T3 playability, average mana T4, life loss T5).
    - Useful for iterating 20 vs 22 vs 24 land counts, or comparing different ramp packages.
