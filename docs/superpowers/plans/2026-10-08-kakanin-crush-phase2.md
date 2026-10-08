# Kakanin Crush — Phase 2: Challenge, Sound, Lola and Juice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (native, as in phase 1). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Answer the user's phase 1 play-test ("the sound fx are boring and the gameplay there is no challenge at all") and add Lola, all as one shipped update:
- a real difficulty curve, tuned against a human-like bot
- sampled, layered sound effects, timed to the animation
- the Mixamo Lola at her stall, reacting to play
- more juice
- the phase 1 deferred minors

**Architecture:** The rules (`game.mjs`) don't change except for two engine minors. The bot gains a `casual` mode that sees only the match it makes, like a person. Levels are re-tuned against it. The view calls back per animated event, so `audio.mjs` (rebuilt on Kenney samples plus synth) and Lola (`lola3d.mjs`, using Lipat-Bahay's `people.mjs` loader and `lola.glb`) react on time.

**Spec:** `docs/superpowers/specs/2026-10-08-kakanin-crush-design.md`, amended in Task 1:
- the balance targets move to the human-like bot
- "sounds timed to animation" becomes explicit

**Phase 1 plan** (conventions, file layout): `docs/superpowers/plans/2026-10-08-kakanin-crush-phase1.md`

## Global Constraints

- Everything from phase 1's Global Constraints still applies:
  - the commit trailer
  - no build step
  - integer rules
  - `kakanin.v1` saves
  - Taglish
- Test command: `node --test test/*.test.mjs`. Browser checks: `python3 -m http.server 5520`, then `node tools/check.mjs`.
- **Sounds:** Kenney CC0, from local packs (no downloads):
  - interface: `../tawid-edsa/.scratch/kenney/kenney_interface-sounds`
  - impact: `../tawid-edsa/.scratch/kenney/kenney_impact-sounds`
  - music jingles: `../tawid-edsa/.scratch/kenney/kenney_music-jingles`
  - RPG: `../tawid-edsa/.scratch/kenney/kenney_rpg-audio`
  - casino: `../isang-tira/.scratch/kenney/casino`
- **Sound format:** mono mp3 at 96 kbps, in `assets/sfx/` (committed). The Kenney license text is copied next to them. Total under 600 KB.
- **Lola:** Mixamo, reused from `../lipat-bahay/assets/people/lola.glb` plus `clips.json`.
  - These go in git-ignored `assets/people/` and ship only in the Vercel deploy, as in Lipat-Bahay and Hollow Blocks.
  - Without them (Pages, tests), a simple stand-in Lola is drawn instead.
  - No taunt clips.
- `sw.js` VERSION goes to `kakanin-v2`. The people files are NOT precached (Vercel-only, loaded lazily).

## Review Focus

1. **Sound overlap on big cascades.** Dozens of pops in one step must not clip or pile into noise: there's a limiter, at most 6 voices per step, and pitch varies.
2. **Muting.** Muted means silent, including Lola's clips and the jingles. Unmuting mid-level brings the music back.
3. **Lola never covers the board** on desktop or on phone portrait, and she never blocks picking.
4. **Difficulty is fair.** The strong bot must still win every level at least 80% of the time (skill can always win), and 3 stars must be reachable.
5. **Without `assets/people`** (GitHub Pages, tests), the game must run with the stand-in Lola and no errors.

---

### Task 1: Challenge — a human-like bot, a real difficulty curve, re-tuned levels

**Files:**
- Modify: `src/bot.mjs`, `test/balance.test.mjs`, `tools/balance.mjs`, `src/levels.mjs`
- Modify: the spec's §5 balance targets (amendment)

**Interfaces:**
- `chooseMove(g, { casual = false, r } = {})`. Casual mode:
  - scores each legal swap by step 1 only: cleared pieces, plus 2× those counting toward a goal, plus 2× latik hits, plus 3× specials made
  - picks uniformly among the top 3, using the passed RNG state `r = { s }`, so runs stay deterministic
- `playLevel(level, seed, { casual } = {}) → { won, stars, score, movesLeft }`
- **Targets** (casual bot win rate, 40 runs, seeds `1000 + 7k`):

  | Levels | Casual bot win rate |
  |---|---|
  | 1 | 80–95% |
  | 2–3 | 65–85% |
  | 4–6 | 50–70% |
  | 7–10 | 40–60% |
  | 11–14 | 30–50% |
  | 15 | 25–45% |

- **Fairness:** the strong bot wins ≥80% on every level.
- **Stars:** 2★ at the casual bot's median winning score; 3★ at the strong bot's 75th percentile winning score. The 3-star check runs on seeds `5000 + 7k`, different from the calibration seeds, which removes the circularity the review flagged.

- [ ] **Step 1: Write the failing tests.** In `test/balance.test.mjs`, check per level:
  - the casual win rate is inside its band
  - the strong bot wins at least 80%
  - at least one strong-bot run on seeds `5000 + 7k` gets 3 stars

  Run the tests and see them fail: the casual band is missed on levels 1–6 (85–100% today), and `chooseMove` has no casual mode.
- [ ] **Step 2: Implement casual mode** in `bot.mjs`. `tools/balance.mjs` then prints both bots: win rate, spare moves and score percentiles for each, plus suggested stars `[1, casual p50, strong p75]`.
- [ ] **Step 3: Re-tune `src/levels.mjs`.** Change moves first (±1 per step), until each level's casual rate sits in its band. Where moves alone can't do it without breaking the strong bot's 80% fairness floor, raise a goal count instead.

  Then set the stars from the tool. Keep the level designs: masks, latik and goal types stay as they are.
- [ ] **Step 4: Amend the spec.** In §5, replace the targets with the ones above, and add one line: "measured against a casual, human-like bot; the strong bot guarantees fairness".
- [ ] **Step 5: Run, then commit.** `node --test test/*.test.mjs` passes (keep it under 30 s; the bot runs take milliseconds). Commit the final balance table.

### Task 2: Sounds and juice on time — per-event callbacks from the view

**Files:**
- Modify: `src/view3d.mjs`, `src/render2d.mjs`, `src/main.mjs`, `tools/check.mjs`

**Interfaces:**
- `view.play(events, g, onBeat)`. It calls `onBeat(beat)` as each part animates:
  - `{type:'swap'|'bounce'|'combo'|'shuffle'|'ubos'|'end', ...e}` at the start of that event
  - for each `step` event: `{type:'fire', i, spec}` per fired special as its beam starts, `{type:'pop', step, cleared, latik, made}` as the pieces burst, and `{type:'land', count}` when the falls end
  - `{type:'ubosMake', made}`
- The flat fallback calls the same beats in order, without animation.
- `main.mjs` passes `(b) => { A.event(b); lola.react(b) }`. It stops calling `A.event` for every rules event at swap time.
- Ubos-Benta's Sandoks fire in turn: the view animates `ubosMake` then the following steps sequentially. The deferred minor "they fire together" is fixed visually; the rules are unchanged.

- [ ] **Step 1: Write a failing check.** Add to `tools/check.mjs` a test that records the `onBeat` types for one move through a test hook (`__kc.beats`). Assert the order is `swap` → `pop` → `land`, and that the `pop` arrives at least 100 ms after `swap` at normal speed. Run it and see it fail: no beats exist yet.
- [ ] **Step 2: Implement** the beats in the view and the flat fallback, then rewire `main.mjs`.
- [ ] **Step 3: Run** the checks (all ok), then commit.

### Task 3: Sound effects rebuilt — samples plus a musical layer

**Files:**
- Create: `assets/sfx/*.mp3`, `assets/sfx/LICENSE-kenney-*.txt`, `tools/sfx.sh` (the conversion script, kept for reproducibility)
- Modify: `src/audio.mjs`, `sw.js`, `test/pwa.test.mjs` (precache the sfx)

**The sound design**, each beat as layered samples plus a synth line:

| Beat | Sound |
|---|---|
| select | interface `select_00x` |
| swap | casino `card-slide-1..4` (a soft slide) |
| bounce / invalid | interface `error_004`, quiet |
| pop (per step) | interface `drop_001..004` at most 6 times, staggered 25 ms, with random rate 0.9–1.15; plus a **kulintang-style FM marimba** note per piece kind, climbing a pentatonic step per cascade step; plus casino `chips-stack-1..6` for step 2 and up (the cascade "clink" rises) |
| latik cleaned | impact `footstep_snow_00x` (sticky) |
| special made | interface `maximize_00x`, plus a glass `glass_00x` shimmer |
| Sandok fires | rpg `drawKnife1..3` swish, plus a filtered-noise sweep |
| Kaldero fires | impact `impactBell_heavy_00x` (a pot clang), plus a low thump |
| Bilao ng Lahat fires | glass arpeggio (glass_001..006 rising), plus a synth chime run |
| combo | heavy bell, plus the knife swish, plus a sub drop |
| shuffle | casino `card-shuffle` |
| goal ticked | rpg `handleCoins` (quiet), pitched by goal |
| Ubos-Benta | casino `chips-handle-*` cascade, plus rpg `handleCoins2`, plus a rising synth run |
| win | jingle `PIZZI02` (rises about 9 semitones); for 3 stars add `PIZZI00` as a sting |
| lose | jingle `PIZZI01` (falls about 8 semitones) |
| level start | interface `bong_001` |
| UI buttons | interface `click_00x` |

**The mix:**
- a convolver reverb (a generated 1.2 s decay impulse) on the synth bus and slightly on sfx
- the master limiter stays

**Music:** the kulintang loop gets the FM marimba voice and a soft shaker. Unmuting restores the music bus (the deferred minor).

**Interfaces:**
- `createAudio({ base = 'assets/sfx/' })` loads the samples lazily after `start()`.
- `event(beat)` handles the Task 2 beats.
- If a sample fails to load, that beat falls back to synth only, with no error.

- [ ] **Step 1: Convert and copy the chosen files** with `tools/sfx.sh`: ffmpeg to mono mp3 at 96 kbps, named `sfx/<name>.mp3`. Check the total size is under 600 KB.
- [ ] **Step 2: Extend `test/pwa.test.mjs`** so every `assets/sfx/*.mp3` must be precached. Run it: it fails until `sw.js` lists them.
- [ ] **Step 3: Rewrite `audio.mjs`** as designed, and add the sfx to `sw.js` ASSETS.
- [ ] **Step 4: Add a browser check:** after a move with sound on, `__kc.audioStats()` reports at least 3 sample plays and no load failures.
- [ ] **Step 5: Run** the tests and checks, then commit.

### Task 4: Lola at her stall — Mixamo, reacting to play

**Files:**
- Create: `src/people.mjs` (copied from `../lipat-bahay/src/people.mjs`, unchanged), `src/lola3d.mjs`, `assets/people/` (git-ignored copies of `lola.glb` and `clips.json`)
- Modify: `.gitignore`, `.vercelignore` (it must NOT exclude `assets/people`), `src/view3d.mjs` (scene access), `src/main.mjs`

**Interfaces:**
- `createLola(scene, { base })` returns `{ ready: Promise, react(beat), update(dt), say(text) }`.
- **Placement:** behind the table on the left, at x≈-7.5, z≈-3.6, facing the board and camera. On phone portrait she's outside the view or framed at the left edge, never over the board (Review Focus 3). She's scaled to CAST.lola h 1.5 × the stall scale (about 2.3 world units, tuned by screenshot).
- **Reactions:**

  | Beat | Clip |
  |---|---|
  | level start | waving |
  | idle | happy idle |
  | a tip or bubble shown | talking |
  | special made | clapping |
  | step ≥ 3 | cheering |
  | win | victory |
  | lose | defeated |

  Reactions are throttled so one plays at a time, then she returns to idle.
- **Stand-in:** without `assets/people`, a simple procedural Lola: a duster dress, grey hair bun and apron, made of primitives with two-bone arm waves. No errors.

- [ ] **Step 1: Write a failing check.** In `tools/check.mjs`:
  - `__kc.lola.state()` is `'real'` when `assets/people` exists, and `'standin'` with `?people=0`
  - after a special is made, `__kc.lola.last()` is `'clap'`
  - Lola's projected bounding box doesn't overlap the board's projected box, on desktop and on phone

  Run it and see it fail: there's no Lola yet.
- [ ] **Step 2: Copy the assets and loader;** update `.gitignore` and `.vercelignore`.
- [ ] **Step 3: Implement `lola3d.mjs` and wire it up.** Screenshot desktop and phone, and tune her position and scale until the check passes and she looks right.
- [ ] **Step 4: Run** the checks, then commit.

### Task 5: Juice and the phase 1 deferred minors

**Juice:**
- a camera kick on Kaldero, combos and Bilao ng Lahat (none under reduced motion)
- a white flash on Bilao ng Lahat
- a combo counter in the callout ("x3 Sarap!")
- results stars that animate in one by one with their sounds
- a slim star meter in the phone strip

**The deferred minors:**
- the hint is disabled while busy
- the keyboard cursor skips holes, and `sel` clears when a move is ignored
- setGame reuses tile geometry and materials (no per-restart leak; checked with renderer.info across 4 restarts in the browser check)
- `shuffle()` gets a guaranteed last resort: if 200 tries fail, end the level as lost with a `shuffleFail` event (never seen, but no soft-lock)
- `placeFor` never overwrites a special (it falls back to clearing without making one)
- `check.mjs` gets tighter: rapid input allows exactly 1 swap; width threshold 85%; `matches()` compares dense arrays; a keyboard swap check; a GPU-memory restart check

- [ ] **Step 1: Engine minors, test-first in `test/game.test.mjs`:**
  - a forced shuffle failure ends the game, with no soft-lock
  - a run of all-special cells makes no new special over them

  Run them and see them fail, then fix `game.mjs`.
- [ ] **Step 2: Tighten the browser checks** (they should fail where the code is still loose), then fix the view and main.
- [ ] **Step 3: Add the juice,** take screenshots, and look at them.
- [ ] **Step 4: Run** the tests and checks, then commit.

### Task 6: Ship v2

- [ ] **Step 1:** Bump `sw.js` VERSION to `kakanin-v2`, run all tests and checks, update the README (Lola, sound credits), and commit.
- [ ] **Step 2:** Push. Deploy to Vercel (which includes `assets/people`). Run `tools/check.mjs` against the live site. Check that GitHub Pages runs with the stand-in Lola.
- [ ] **Step 3:** Refresh the Tambayan thumbnail (with Lola in it), and update the memory note.
- [ ] **Step 4:** Do a final whole-branch review with a fresh reviewer, make one fix pass, then merge.
