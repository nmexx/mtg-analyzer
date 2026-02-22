# MTG Monte Carlo Analyzer — Planned Improvements

> **Complexity key** (unimplemented items only)
> `[Low]` — isolated change, ≤ ~50 lines, no new data structures
> `[Medium]` — touches 2–4 files, new logic or UI component required
> `[High]` — cross-cutting change, new architecture or significant new state
> `[Very High]` — multi-session effort, requires new subsystem or major refactor

---

## Performance / Architecture

1. **Move simulation to a Web Worker** `[High]` *(superseded by #24 below)*
   - The `monteCarlo` loop runs on the main thread inside a `setTimeout`, which blocks the UI on high iterations.
   - A Web Worker would allow a real progress bar and prevent the browser from freezing.

2. **Split App.jsx into modules** --------DONE
   - The file is 4000+ lines and mixes simulation engine, data processing, and UI.
   - Extract: `SimulationEngine.js`, `DeckParser.js`, and separate panel components (`LandsPanel`, `ResultsPanel`, `SequencesPanel`, etc.)

3. **`useMemo`/`useCallback` for expensive recalculations** `[Low]`
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

6. **"First playable by turn X" summary table** --------DONE
   - Table below the Key Cards chart showing the earliest turn each card crosses 50%, 80%, and 95% cumulative playability.
   - Pure display addition; reads directly from the existing `keyCardPlayability` per-turn arrays.

7. **Standard deviation bands on charts** --------DONE
   - Only averages are currently reported.
   - Adding ± std. deviation to the lands/mana charts would show consistency vs. raw average.

8. **On-Play vs. On-Draw toggle** `[Low]`
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

11. **Scry / cantrip modeling** `[Medium]`
    - Cards like Brainstorm, Ponder, Serum Visions meaningfully improve land-hit rates.
    - Even a simplified "look at top N cards, keep best land" heuristic would improve fidelity for blue decks.

12. **Threshold-aware `selectBestLand` ordering** `[Medium]`
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

16. **Multi-card combo tracking** `[Medium]`
    - Key cards are currently tracked independently.
    - Add a "require all of" combo group: report the % of games where *all* selected cards in a group are simultaneously castable on the same turn.
    - High value for combo decks (e.g. Thassa's Oracle + Demonic Consultation both available by turn 3).

17. **"On-curve" playability** --------DONE
    - Added `keyCardOnCurvePlayability` and `keyCardOnCurveCMC` to `monteCarlo.js` results.
    - Tracks per-iteration whether each key card is castable on exactly the turn equal to its CMC.
    - Displayed as a summary table below the Key Cards chart in `ResultsPanel.jsx`, colour-coded green/amber/red.

18. **Land flood / screw rate tracking** --------DONE
    - Configurable thresholds (default: flood ≥5 lands by T5, screw ≤2 lands by T3) exposed in the settings panel.
    - `monteCarlo.js` computes `floodRate` / `screwRate` from the raw per-iteration land arrays before averaging.
    - Displayed as colour-coded rate badges (blue / orange) inside the Lands per Turn panel.

19. **Opening hand land distribution histogram** `[Low]`
    - Bar chart of how often kept hands contain exactly 0–7 lands after mulligans.
    - Requires storing one integer per iteration at the mulligan step; chart is a simple bar.
    - Makes mulligan strategy tuning concrete and visual.

20. **Card draw / cantrip land-thinning** `[Medium]`
    - Spells with a `drawsCards: N` flag (Night's Whisper, Sign in Blood, Harmonize, etc.) should draw N cards from the library during `castSpells`.
    - Complements existing scry modeling (item 11) and improves fidelity for black/blue midrange.

---

## New — UX

21. **Shareable URL** --------DONE

22. **Named simulation presets** `[Medium]`
    - Extend LocalStorage persistence (item 9) to allow saving and loading named configs.
    - Example presets: "cEDH 33-land", "Aggro 20-land 60-card", "Budget Midrange".
    - Restores both card selections and all simulation settings at once.

23. **Deck health warnings panel** `[Medium]`
    - Post-simulation, surface plain-language alerts based on thresholds, e.g.:
      - *"Average green mana by turn 2 is 0.2 — [Noble Hierarch] is only 18% castable on curve."*
      - *"Cumulative life loss exceeds 10 by turn 4 in 60% of games."*
      - *"Land screw rate (≤2 lands by turn 3) is 12%."*
    - Low implementation cost; high communication value for less experienced users.

---

## New — Performance / Architecture

24. **Web Worker with real progress bar** `[High]` *(highest-ROI unfinished item from #1)*
    - At 10k iterations the UI hitches noticeably; blocking becomes severe at 50k+.
    - Offload the `monteCarlo` loop to a Worker, post progress messages back, and render a live % bar.
    - The engine is already pure and config-driven — it can be transferred with a single `import`.

25. **Batch / ranked deck comparison (N variants)** `[Very High]`
    - Extend the current A/B mode to support N named deck slots.
    - Run all variants and display a sortable summary table ranked by a chosen metric (e.g. key-card T3 playability, average mana T4, life loss T5).
    - Useful for iterating 20 vs 22 vs 24 land counts, or comparing different ramp packages.

---

## Bug Fixes (Completed)

- **Deck label removed from single-deck input** — the redundant "Deck" label above the deck textarea in single-deck mode has been removed.

- **No-quantity lines default to 1** — lines without a leading number (e.g. `Lightning Bolt` instead of `1 Lightning Bolt`) now parse as a single copy instead of being silently ignored.

- **MDFC double-count in Total Cards** — Modal double-faced land cards (e.g. `Hengegate Pathway // Mistgate Pathway`) were stored in both `lands[]` and `spells[]` (the spell face is needed for key-card selection), causing them to be counted twice in `totalCards`. The `isMDFCSpellSide` flag is now excluded from the total.

---

## New — Simulation Accuracy (Code-Audit Findings)

26. **Hand size limit not enforced** `[Low]`
    - The simulation never discards down to 7 cards at end of turn.
    - Ramp spells that put lands into hand (`landsToHand`) and normal draws can push hand size above 7 indefinitely, inflating key-card playability probabilities on longer-turn runs.
    - Fix: after casting spells each turn, discard excess cards (preferring lands if flooded, spells if screwed).

27. **Chrome Mox / Mox Diamond imprint/discard ignores key cards** `[Low]`
    - `castSpells` always imprints `nonLandsInHand[0]` and discards the first available land for Mox Diamond with no awareness of which cards are tracked key cards.
    - A real player never imprints/discards a key card when a lower-value card is available.
    - Fix: sort imprint/discard candidates to deprioritize cards in `selectedKeyCards`.

28. **Mana Vault upkeep payment never modeled** `[Medium]`
    - Once Mana Vault is tapped, the simulator applies its damage every upkeep indefinitely.
    - A real player pays {4} to untap it when spare mana is available (typically turns 3+), eliminating ongoing damage.
    - Fix: in the upkeep phase, check if `manaAvailable.total >= 4` after untap and, if so, untap the Vault and skip the damage for that turn.

29. **Pain land damage is unconditional** `[Low]`
    - `calculateBattlefieldDamage` deals damage from all pain lands on every turn 1–5 regardless of whether they were actually tapped for colored mana.
    - Real pain lands only deal damage when tapped for a colored pip; tapping for {C} or sitting untapped is free.
    - Fix: track a `tappedForColor` flag when `tapManaSources` taps a pain land for a colored pip, and only count those in `calculateBattlefieldDamage`.

30. **Shock land payment threshold is hardcoded** `[Low]`
    - `playLand` always pays 2 life to bring a shock land in untapped if `turn <= 6`, unconditionally.
    - A configurable strategy (e.g. "only shock turns 1–3", "never shock below 5 life") would better reflect real play and is a direct accuracy lever for life-total analysis.
    - Fix: add a `shockStrategy` config option (`always` / `early_only` / `never`) respected by `playLand` and exposed in the UI settings panel.

31. **Fetch→shock tapped-state check uses pre-fetch battlefield** `[Medium]`
    - When a fetch land is activated in Phase 5 and retrieves a shock land, `doesLandEnterTapped` evaluates the shock using the battlefield state *before* the fetch resolved.
    - This means the land-count and subtype checks that govern shock/check/battle land conditions are slightly wrong for the turn the fetch fires.
    - Fix: call `doesLandEnterTapped` after splicing the fetch out of the battlefield but before pushing the fetched land, so the snapshot accurately reflects the post-fetch board state.
