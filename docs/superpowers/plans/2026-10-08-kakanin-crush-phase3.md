# Kakanin Crush — Phase 3: The Campaign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (native, as before). Steps use checkbox syntax.

**Goal:** The spec's campaign:
- towns 2–6 (75 new levels) on a continuing difficulty curve
- every blocker: dahon, the gata/asukal ingredients, langgam, kahon ng gata
- earned boosters
- the town map with star gates
- Lola's orders as story panels between towns
- the recipe album

It ships in two milestones:
- **A:** blockers, boosters, map, and towns 2–3
- **B:** towns 4–6, story, album

**Architecture:**
- The rules (`game.mjs`) gain blocker cells, segment gravity, deliveries, ant spread and a booster call, all pure and seeded as before.
- Levels move into per-town data files.
- One calibration tool tunes every level against both bots.
- The view gets blocker meshes and per-town scene themes (Hollow Blocks' graded backdrops and grades).
- The page gains a town map. Story portraits are rendered in-engine from the Mixamo cast already on disk (Lipat-Bahay's), with simple stand-ins on Pages.

**Spec:** `docs/superpowers/specs/2026-10-08-kakanin-crush-design.md` §2 (blockers, goals), §4 (towns, boosters, story, album), §5 (balance, as amended).

## Global Constraints

- Everything from phases 1–2 applies:
  - the commit trailer
  - `node --test test/*.test.mjs`
  - `tools/check.mjs` with a server on 5520
  - `?instant` for bot runs
  - Taglish
  - no build step
- **Cell codes:** kakanin 0–5, `BILAO = 6`, `GATA = 7`, `ASUKAL = 8`, `KAHON = 9`, `LANGGAM = 10`, `EMPTY = -1`.
  - Per-cell layers: `latik` (Uint8Array), `wrap` (Uint8Array: 1 = dahon), `crate` (Uint8Array hp, for KAHON cells).
- **Gravity:**
  - Holes (mask 0) are passed through, as in phase 1.
  - Barriers stop falls: KAHON, LANGGAM, and wrapped pieces.
  - A column splits into segments at its barriers. Each segment packs down and refills from its own top, so new pieces appear from just under a barrier.
  - `spawns` entries become `[i, kind, n, top]`, where `top` is the segment's top row.
- **Saves:** the key stays `kakanin.v1`. New fields (`boosters`, `granted`, `album`, `seen`) are cleaned like the rest, and old saves load unchanged.
- **Assets:**
  - Town backdrops `bd_noon`, `bd_dusk`, `bd_night` and `bd_storm` are copied from `../hollow-blocks/assets/env/sky/` and committed (CC0).
  - Story cast models `bunso`, `tatay`, `kikay`, `nanay` and `nonoy` are copied from `../lipat-bahay/assets/people/` into git-ignored `assets/people` (Vercel-only, like Lola).
- **sw VERSION:** `kakanin-v3` at milestone A, `kakanin-v4` at milestone B.

## Rules additions (Task 1)

**Blockers:**

| Blocker | Rule |
|---|---|
| **dahon** (`wrap[i] = 1`) | The piece can't be swapped and doesn't fall (a barrier). It can still be part of a match. A clear on it or next to it unwraps it instead of clearing it. The goal `{type:'dahon'}` is all wraps freed. |
| **kahon** (`cell = KAHON`, `crate[i]` hp 1–3) | Not swappable, a barrier. Each adjacent clear, or a blast on it, takes 1 hp; at 0 the cell empties. The goal `{type:'kahon'}` is all crates gone. |
| **langgam** (`cell = LANGGAM`) | Not swappable, a barrier. An adjacent clear or a blast removes it. If a whole turn clears no ant, one ant spreads to a random neighbouring plain piece (seeded). The goal `{type:'langgam'}` is all ants gone. A level loses if ants fill every movable cell (an `antsWin` event). |
| **ingredients** (`GATA`, `ASUKAL`) | Swappable, never match, never cleared by blasts, fall normally. An ingredient that reaches its column's lowest cell is delivered and removed. The goal `{type:'deliver', kind:'gata'\|'asukal', n}`. Levels set `ingredients: { gata, asukal, onBoard }`, and refill spawns one at a column top while fewer than `onBoard` are on the board and more are owed. |

- "Adjacent" hits come from cells cleared by a match. Blast cells hit what they cover. Each blocker takes at most one hit per cascade step.

**Events:**
- Each `step` gains `hits: [[i, what, left]]`, where `what` is `'wrap'`, `'crate'` or `'ant'`, and `delivered: [[i, kind]]`.
- After a turn: `{type:'ants', from, to}` when ants spread.

**Boosters:** `useBooster(g, kind, target) → { ok, events }`. They don't cost a move.

| Booster | Effect |
|---|---|
| `pamaypay` | a forced shuffle |
| `sandok` | turns the plain piece at `target` into a Sandok (orientation by rng) |
| `merienda` | +5 moves |
| `siyanse` | clears `target` as if blasted (a blocker takes a hit), then the board settles |

## Tasks

### Task 1: Rules, test-first, in `test/game.test.mjs`

**Tests:**
- segment gravity, including refill under a barrier and the 4-field spawns
- dahon: can't swap, stays put, unwraps on a nearby or direct clear
- kahon hp
- langgam: cleared by a nearby clear, spreads after a quiet turn, `antsWin`
- ingredients: never match, survive blasts, delivered at the bottom, spawn up to `onBoard`, goal counting
- each booster, and the invalid booster targets (no throw)
- determinism with blockers
- the phase 1–2 tests stay green

**Implementation:** `game.mjs`. `createGame` reads the new level fields:
- `wrap`: strings with `'w'`
- `crates`: strings with `'1'`–`'3'`
- `ants`: strings with `'a'`
- `ingredients`

Validation in `levels.mjs` covers the new fields.

### Task 2: Bots and calibration for any town

- Casual bot scoring adds blocker hits (×2) and ingredient descent (×1 per row moved down) and deliveries (×4).
- The strong bot's `value()` already reads `goals[].got / need`, so it covers the new goals as long as the rules keep `got` current.
- `tools/calibrate.mjs <levelId…>` generalises the phase 2 calibrator:
  - tune moves toward the band's middle
  - scale goal counts if needed
  - require strong ≥ 0.8 on 150 fresh seeds
  - write the stars `[1, casual p50, strong p75]` back into the town file
- **Bands:** for town `t` (2..6) and level `j` (1..15), `lo = 0.62 − 0.30·(j−1)/14 − 0.02·(t−2)` and `hi = lo + 0.2`. That gives town 2 a curve from 62–82% at its first level down to 32–52% at its 15th, and each later town about 2% harder.
- `test/balance.test.mjs` iterates every town's levels, with strong-bot checks on 150 fresh seeds. Its runtime is kept under 90 s; if needed it samples every other level, and the `--all` mode runs in `tools/balance.mjs`.

### Task 3: View — blockers, deliveries, boosters

- **Meshes:**
  - the dahon wrap: a banana-leaf band with a twine tie around the piece
  - the kahon: a wooden crate with gata cans stencilled on it, one plank cracking per lost hp
  - langgam: a cluster of small animated ants on a leaf
  - gata: a halved coconut
  - asukal: a small sack of muscovado
- **Animations:** unwrap (leaf peels away), crate cracks and splinters, ants scatter, an ingredient's delivery (it drops through the bilao rim with a coin sound), ant spread (ants march over).
- **Beats:** `hit`, `deliver`, `ants`. `audio.mjs` gets sounds for each.
- **Boosters:** a PAMPALAKAS signboard with four buttons and their counts. Targeted boosters enter a pick mode: the next tap applies it, and Esc cancels.
- The flat fallback draws the same blockers simply.

### Task 4: Towns and scenes (milestone A: towns 2–3; B: 4–6)

**Town data:** `src/towns/san-roque.mjs` (moved from `levels.mjs`), `palengke.mjs`, `simbahan.mjs`, `dagat.mjs`, `bundok.mjs`, `pista.mjs`. Each exports `{ TOWN, LEVELS }`, and `levels.mjs` re-exports the full `LEVELS`, `TOWNS` and `BANDS`.

| Town | Setting | Grade | New blocker |
|---|---|---|---|
| 2. Palengke ng Malinta | market at noon, `bd_noon` | noon | dahon |
| 3. Simbahan plaza | after Simbang Gabi, `bd_dusk` | dusk | ingredients |
| 4. Bayang Dagat | beach town at sunset | golden, sea-blue fog | langgam |
| 5. Lungsod ng Bundok | misty, `bd_storm` | storm, fog | kahon |
| 6. Pista ng Bayan | night, `bd_night`, lanterns lit | night | all together |

`stall3d` takes a theme: backdrop, grade, fog, sun colour and intensity, and lanterns.

**Each town's 15 levels:**
- levels 1–3 introduce the town's blocker gently
- levels 4–14 mix it with what came before
- level 15 is the finale

Masks come from a shared pool (`bilao`, `ring`, `hole`, `cross`, `diamond`, `twin`). Calibration sets moves and stars.

- [ ] **Checks:** every level validates; boards start still and playable; balance is in band; screenshots of each town's scene.

### Task 5: Map, progression, boosters earned, saves

- **The town map** replaces the San Roque grid: town cards along a road, each opening its 15-level grid.
- **Gates:** town `t` opens after the previous town's level 15 is cleared, plus `12·(t−1)` total stars. A locked card shows the stars still needed.
- **Boosters earned:** one booster of a rotating kind per 10 total stars, capped at 3 each (`granted` tracks thresholds already paid out).
- **Saves:** the new fields, cleaned like the old ones; a phase-2 save loads with its stars intact.
- [ ] **Tests:** progress unit tests (gates, grants, old-save load); browser checks for the map, a gate, using a booster, and level select.

### Milestone A ship

- `kakanin-v3`, then the review, merge, deploy, live checks, Tambayan, memory.

### Task 6: Story and album (milestone B)

- **Portraits:** rendered once in-engine from the Mixamo cast (an idle pose, camera on the face) into data URLs. The cast:

  | Role | Model |
  |---|---|
  | Lola | lola |
  | the apo | bunso |
  | Mang Ben, the jeepney driver | tatay |
  | the titas | kikay, nanay |
  | Kapitan Dado | nonoy |
  | Aling Nena, the rival | kikay, recoloured |

  On Pages (no people files), portraits fall back to drawn silhouettes.
- **Story panels:** before each town's first level and after its finale, 3–5 panels with a portrait, a name and a Taglish line, plus Skip. Some levels are customer orders and show the customer's portrait and line in the intro.
- **Album:** each cleared town adds a dish card: the dish, a one-line note on the real kakanin, and the town's stars. It opens from the map.
- [ ] **Checks:** the panels show and skip; the album opens; the portrait fallback works without people files.

### Milestone B ship

- `kakanin-v4`, then the review, merge, deploy, live checks, Tambayan, memory.
