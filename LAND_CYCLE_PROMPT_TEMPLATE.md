# Land Cycle Implementation Prompt Template

> Copy this file, fill in every `[PLACEHOLDER]` block, and paste the result as
> your implementation request.  Delete any section that does not apply to the
> cycle you are implementing.  The more detail you provide, the better the
> implementation will be.

---

## 1. Land Cycle Overview

**Cycle name (as it appears in `Lands.js`):** `[PLACEHOLDER — e.g. "Tango Lands (Battle for Zendikar)"]`

**Representative card(s):**
```
[PLACEHOLDER — paste one or two example card names, e.g. "Canopy Vista", "Prairie Stream"]
```

**Full oracle text of a representative card:**
```
[PLACEHOLDER — paste the exact Scryfall oracle text, e.g.:
"Canopy Vista enters the battlefield tapped unless you control two or more basic lands.
{T}: Add {G} or {W}."]
```

**Number of cards in the cycle:** `[PLACEHOLDER — e.g. 5, 10]`

**Colour pairs / identities covered:**
```
[PLACEHOLDER — list all colour pairs, e.g. W/G, U/R, B/G, …]
```

---

## 2. Mechanics to Model

> Answer yes/no and add detail for each question.

| Question | Answer |
|---|---|
| Does it ETB tapped unconditionally? | [yes / no] |
| Does it ETB tapped conditionally? | [yes / no — if yes, state the condition] |
| Does it pay life on ETB? | [yes / no — if yes, state the amount and condition] |
| Does it produce mana with an activation cost (e.g. {1},{T})? | [yes / no — if yes, state the cost and what it produces] |
| Does it produce different amounts of mana depending on board state? | [yes / no — if yes, describe] |
| Does it require a specific land type on the battlefield? | [yes / no — if yes, state which type and what it unlocks] |
| Does it sacrifice itself or other permanents? | [yes / no — if yes, describe trigger and effect] |
| Does it interact with life totals (beyond ETB shock)? | [yes / no — if yes, describe] |
| Does it care about the number of lands you control? | [yes / no — if yes, state the threshold and effect] |
| Does it have an ETB trigger that puts cards into hand / graveyard? | [yes / no — if yes, describe] |
| Does it produce mana of a chosen colour (like Thriving lands)? | [yes / no — if yes, describe the choice timing and constraints] |
| Any other unusual mechanic? | [yes / no — if yes, describe] |

---

## 3. Desired Simulation Behaviour

> Describe in plain English what the sim should do.  Reference comparable
> already-implemented cycles where relevant (see `land_behaviour.md` for the
> full list).

**ETB tapped rule:**
```
[PLACEHOLDER — e.g. "Enter tapped unless two or more basic lands are already on
the battlefield (same as Battle Lands / §3.4 in land_behaviour.md)."]
```

**Mana production rule:**
```
[PLACEHOLDER — e.g. "Produce one of its two colours unconditionally.  No
activation cost, no condition."]
```

**Special interactions (if any):**
```
[PLACEHOLDER — e.g. "When this land is tapped for mana, deal 1 life loss.
Model the same way as Pain Lands (§3.6) — charge on turns 1–5."]
```

**Simplification / assumption to document:**
```
[PLACEHOLDER — e.g. "Always assumed to be untapped from turn 3 onward because
players nearly always control two basics by then.  This over-counts mana
availability by ~5% on turns 1–2."]
```

---

## 4. Files to Touch

> Tick off the files that will need changes.  All five are usually required for
> any new cycle.

- [ ] `Card_Archive/Lands.js`  — add / update the cycle entry and `sim_flags`
- [ ] `src/simulation/landData.js`  — export a new named Set if a new flag is introduced
- [ ] `src/simulation/cardProcessors.js`  — import new Set(s); attach new boolean flags on the returned card object
- [ ] `src/simulation/simulationCore.js`  — add branching logic inside the relevant function(s):
  - [ ] `doesLandEnterTapped()` — if ETB tapped logic changed
  - [ ] `calculateManaAvailability()` — if mana production logic changed
  - [ ] `playLand()` — if an on-play trigger/effect applies
  - [ ] `calculateBattlefieldDamage()` — if recurring life-loss applies
- [ ] `land_behaviour.md`  — new catalogue row, new §3.x section, new assumptions row, new §11 note
- [ ] `tests/simulationCore.test.js`  — new test group(s) (see §5 below)

---

## 5. Tests to Add

> For each mechanic, describe a test case with the expected outcome.  These
> become the `it(...)` blocks in `simulationCore.test.js`.

### 5.1 ETB Tapped Tests (inside `describe('doesLandEnterTapped')`)

```
Test 1: "[PLACEHOLDER — e.g. enters TAPPED when condition is NOT met]"
  Setup:   [describe the minimal battlefield / turn state]
  Expects: doesLandEnterTapped returns true

Test 2: "[PLACEHOLDER — e.g. enters UNTAPPED when condition IS met]"
  Setup:   [describe the minimal battlefield / turn state]
  Expects: doesLandEnterTapped returns false
```

### 5.2 Mana Production Tests (inside `describe('calculateManaAvailability')`)

```
Test 1: "[PLACEHOLDER — e.g. produces {C} when condition not met]"
  Setup:   [describe battlefield]
  Expects: total = X, colors.[Y] = Z

Test 2: "[PLACEHOLDER — e.g. produces two coloured pips when condition met]"
  Setup:   [describe battlefield]
  Expects: total = X, sources[0].produces = [...]
```

### 5.3 Play-Trigger Tests (inside `describe('playLand')`) — if applicable

```
Test 1: "[PLACEHOLDER — e.g. ETB trigger fires and log shows expected action]"
  Setup:   [hand, battlefield, library, parsedDeck, keyCardNames]
  Expects: bf[0].card.[property], log.actions contains [string]
```

### 5.4 Life-Loss Tests (inside `describe('calculateBattlefieldDamage')`) — if applicable

```
Test 1: "[PLACEHOLDER — e.g. life loss is charged on turn ≤ 5]"
  Setup:   [battlefield with new land type, turn = 3]
  Expects: total = X

Test 2: "[PLACEHOLDER — e.g. life loss is NOT charged after turn 5]"
  Setup:   [same battlefield, turn = 6]
  Expects: total = 0
```

---

## 6. `land_behaviour.md` Additions

### 6.1 Catalogue row (§2.1 or §2.2 or new §2.x)

```
| [Cycle name] | `[new flag]: true` | [one-line description, reference §3.x] |
```

### 6.2 New §3.x section text

```
### 3.[N] [Cycle Name]

[Two to four sentences describing the simulation rule, any simplification, and
which function implements it.]
```

### 6.3 Assumptions table row (§10)

```
| [Cycle name] | [The specific assumption / simplification made] |
```

### 6.4 Future improvements row (§11) — optional

```
- **[Cycle name] improvement** – [description of a more accurate model that could
  be implemented later].
```

---

## 7. Git Commit Message

Paste this as your final commit after all files are saved and tests pass:

```
feat(sim): implement [CYCLE NAME] land logic

- Card_Archive/Lands.js: add `[NEW_FLAG]: true` to '[Cycle Name]' cycle
- landData.js: export [NEW_SET_NAME] set
- cardProcessors.js: attach `[newFlag]` (and related fields) to processLand output
- simulationCore.js ([FUNCTION_1]): [one-line description of what changed]
- simulationCore.js ([FUNCTION_2]): [one-line description of what changed]
- land_behaviour.md: add §3.[N] [Cycle Name], update assumptions table
- tests/simulationCore.test.js: [N] new tests for [cycle name] in
  [describe blocks touched]

Assumption: [state the key simplification in one sentence].
Tests: [total] passed, 0 failed.
```

---

## 8. Checklist Before Submitting

- [ ] `npm test` passes with 0 failures
- [ ] New flag is lowercase-keyed in `LAND_DATA` (all map keys must be lowercase)
- [ ] `produces[]` is populated for every new card (fallback to `color_identity` if Scryfall text is missing)
- [ ] `land_behaviour.md` catalogue, §3.x, §10 assumptions row all updated
- [ ] Git commit message matches the format in §7

---

## Reference: Key Locations by Function

| What you want to change | File | Function / section |
|---|---|---|
| ETB tapped decision | `simulationCore.js` | `doesLandEnterTapped()` |
| Mana amount / colour produced | `simulationCore.js` | `calculateManaAvailability()` |
| On-play trigger (ETB effect) | `simulationCore.js` | `playLand()` |
| Recurring life loss | `simulationCore.js` | `calculateBattlefieldDamage()` |
| Land selection priority | `simulationCore.js` | `selectBestLand()` |
| Fetch target preference | `simulationCore.js` | `findBestLandToFetch()` |
| Boolean flag on card object | `cardProcessors.js` | `processLand()` return object |
| Named Set of land names | `landData.js` | bottom of file (`export const …`) |
| Cycle definition + sim_flags | `Card_Archive/Lands.js` | matching `name:` entry in `cycles[]` |
