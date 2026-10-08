# Kakanin Crush: Design

Date: 2026-10-08. Status: approved in conversation section by section; awaiting review of this written spec.

## 1. Intent

A Candy Crush-style match-3 game reimagined with Filipino kakanin, at the same level of design and UI/UX as Hollow Blocks (real 3D, physical materials, a full 3D scene, Hollow Blocks' HUD). It joins the Tambayan Arcade series of Pinoy-reimagined classics.

**What the user said:**
- Pick: Candy Crush → Kakanin Crush.
- The pieces should match the level of Hollow Blocks' blocks, and so should the background and UI/UX. Both approved after live prototypes, kept in `.superpowers/brainstorm/`.
- Modes: campaign map, daily, endless and Lola's orders story, "more that can you offer or make no limits".
- Lola: both a 3D Mixamo Lola at the stall and illustrated portraits for story.
- Architecture: option A, a full 3D game built on Hollow Blocks' view code.

**Assumptions** (stated in the conversation, not contradicted):
- A free portal game: no lives or energy timers, no purchases, retry forever.
- Taglish UI like the other games.
- Phone portrait and desktop are both first-class.
- Shipped in phases, each one playable and deployed.

**Success:**
- Playing it feels like a polished commercial match-3. A player who knows Hollow Blocks sees the same quality bar.
- Every level is winnable and its difficulty is checked by a bot before it ships.

## 2. Rules engine: `src/game.mjs`

- Pure and seeded (mulberry32, as in the series): `step(state, move) → { state, events }`. The view and audio only read the state and the events. The same seed and moves replay exactly; `hashState` exists for tests and the Daily.
- **Board:** 9×9 by default. A per-level mask of holes shapes it (bilao, banig, llanera).
- **Kakanin:** puto, kutsinta, sapin-sapin, bibingka, ube halaya, suman. Each level uses 4–6 of them.
- **A move:** swap two orthogonal neighbours. If it makes no match (and isn't a special-with-special), it reverts and doesn't cost a move.
- **Resolution:** the steps below repeat until the board is stable. Each pass is one "cascade step" in the events.
  1. find matches
  2. create specials at the swap or match point
  3. clear, and set off specials
  4. damage blockers
  5. drop
  6. refill from the top using the level's spawn table
- **Specials:**
  - **Sandok** (4 in a line): clears its row or column, along the matched line's axis.
  - **Kaldero** (L or T): 3×3 burst.
  - **Bilao ng Lahat** (5 in a line): clears every piece of the kind it's swapped with.
  - **Combos:**
    - Sandok+Sandok: a cross.
    - Sandok+Kaldero: three rows and three columns.
    - Kaldero+Kaldero: 5×5.
    - Bilao+special: every piece of that kind becomes that special, then fires.
    - Bilao+Bilao: the whole board clears.
- **Blockers:**
  - **latik:** a layer under a piece, 1–2 deep, cleaned by a match on top.
  - **dahon:** a wrapped piece that can't move; one adjacent match unwraps it.
  - **langgam:** spreads to one neighbouring tile at the end of any turn in which none was cleared.
  - **kahon ng gata:** a crate, 1–3 hits from adjacent matches or blasts.
  - **ingredients** (gata, asukal): delivered when they reach a bottom cell.
- **Goals:** any mix of: collect N of a kakanin, clear all latik, deliver ingredients, reach a score. They must be met within the move limit.
- **End of level:** leftover moves become random Sandoks that fire in turn ("Ubos-Benta!") for bonus points.
- **Fairness:**
  - refills never create a match by themselves
  - no valid move → a deterministic shuffle ("Ayusin natin!")
  - the hint finds a valid move (the view shows it after a few idle seconds)
- Integers only. No real-time logic in the rules, except Karera's clock, which the view feeds in as ticks.

## 3. View, UI and feel

- **The scene:** built on Hollow Blocks' code: lighting, the photographed sky, scanned surfaces, props, post effects (ambient occlusion, bloom, grade per time of day), quality tiers that drop automatically, and `?flat=1` as the 2D fallback.
  - Lola's stall: a tolda, bamboo posts, the "KAKANIN NI LOLA PACING" sign, banderitas, string lights, and side trays of kakanin for sale.
  - Each town has its own setting and time of day (Section 4).
- **The camera:** behind the counter; the bilao fills the lower two-thirds and the street shows above. Small pushes on big cascades; a celebration shot for Ubos-Benta.
- **The kakanin:** the prototype's six models, refined: the ube in a llanera shape, steam that works with the post effects. Each has its own idle motion: the puto bobs, the kutsinta wobbles, the sapin-sapin shimmers.
  - The specials read clearly: a Sandok across the piece, a steaming Kaldero lid, a glowing mini-bilao.
- **Input:**
  - drag toward a neighbour, or tap-tap
  - mouse the same way
  - keyboard: arrows move a cursor, Space picks up or drops
  - an invalid swap wobbles back
  - input is ignored while the board settles
- **HUD**, in Hollow Blocks' style:
  - slanted chips for puntos and best score
  - a banner for the level name
  - wooden signboards with orange headers: KAILANGAN (goals), GALAW (moves), BITUIN (star meter), PAMPALAKAS (boosters)
  - phones: the bilao fills the width and the signboards become a strip above it
  - desktop: the signboards stand beside the stall
- **Juice:**
  - pops with crumbs and sparkles, and pieces flying to their goal
  - cascade callouts: Sarap! Linamnam! Panalo! Ubos-Benta!
  - Lola's Mixamo reactions: cheer, clap, fanning, a "hay naku" on a near-miss; never a taunt
  - synthesized kulintang-and-rondalla music, cascade pitch rising, a crunch per kakanin, a limiter
  - phone haptics
- **Screens:** title, town map, level intro (goals plus a Lola tip), results (stars, the tray sold), settings, the recipe album, and story panels with illustrated Lola. Taglish throughout.

## 4. Content and progression

- **Kampanya:** 6 towns × 15 levels = 90.

  | Town | Setting | New blocker |
  |---|---|---|
  | 1. San Roque | sari-sari street at golden hour | latik |
  | 2. Palengke ng Malinta | market at noon | dahon |
  | 3. Simbahan plaza | dusk | ingredients |
  | 4. Bayang Dagat | beach town at sunset | langgam |
  | 5. Lungsod ng Bundok | misty mountain town | kahon ng gata |
  | 6. Pista ng Bayan | lantern-lit night fiesta | all together |

  - Each town ends with a Tindera Showdown or event level.
  - **Level data** lives in `src/levels.mjs`: mask, kinds, blockers, goals, moves, star thresholds, seed.
- **Stars:** 1–3 per level. Stars unlock town gates, and every 10 stars earns a booster.
- **Boosters** are earned, never bought, at most 3 of each:
  - Pamaypay: reshuffle
  - Sandok sa Kamay: place a Sandok
  - Merienda: +5 moves
  - Siyanse: smash one piece or blocker
- **Lola's orders (story):** 3–5 illustrated panels between towns. Cast: Lola, her apo, a jeepney driver, the tsismosa titas, the barangay captain, and Aling Nena (the rival vendor). Some levels are customer orders. Each town adds a dish to the recipe album, with a one-line note on the real kakanin.
- **Daily bilao:** a seed from the Manila date, a fixed goal, one scored attempt (practice after), and a share line with emoji squares.
- **Walang Katapusan:** no move limit; ants creep in over time, and the game ends when the board is overrun. Best score is saved.
- **Karera:** 90 seconds for the best score; big combos add time.
- **Tindera Showdown:** Aling Nena takes turns (dropping latik, stealing pieces). Finish your order before she finishes hers.
- **Pista events:** rotating weekly twist levels (all Kaldero, gravity flipped, three kakanin only), chosen by the date. No server.
- **Saving:** local storage (wrapped in try/catch) holds progress, stars, boosters, bests, the album and settings. Nothing is sent anywhere except share text the player copies.

## 5. Testing, balance and shipping

- **Unit tests** (`node --test`):
  - match shapes, special creation, every combo, blockers, drop and refill, refills that never self-match, shuffles, goals, end of level, Ubos-Benta
  - determinism (state hash)
  - level validity: reachable cells, achievable goals, ordered star thresholds
  - the Daily seed
  - recovery from corrupt saves
  - the PWA offline file list
- **The bot** (`src/bot.mjs`): it scores every legal swap (goal progress, specials, blockers, cascades) with one move of lookahead.
  - **Balance** (amended 2026-10-08 after the user's play-test: "the gameplay there is no challenge at all"): each level gets many seeded runs, measured against a casual, human-like bot that sees only the match its swap makes; the strong bot (it sees refills) guarantees fairness. Targets:
    - casual-bot win rate by level: 1 at 80–95%, 2–3 at 65–85%, 4–6 at 50–70%, 7–10 at 40–60%, 11–14 at 30–50%, 15 at 25–45%; later towns continue the curve
    - the strong bot wins ≥80% on every level (skill always wins)
    - a 3-star must be possible on every level, checked on seeds the thresholds weren't tuned on
    - no level may depend on luck alone
  - The bot also drives the title demo and the headless checks.
- **Browser checks** (headless Chrome): desktop and phone portrait screenshots of every screen; drag, tap-tap and keyboard input; no page errors; stable GPU memory across restarts; the quality step-down; `?flat=1`. Every screenshot gets looked at before claiming done.
- **Shipping each phase:**
  - repo `kon2raya24/kakanin-crush`; Vercel at `kakanin-crush.vercel.app` or the nearest free name; GitHub Pages as a mirror
  - Mixamo assets are Vercel-only, as in Hollow Blocks, so Pages shows a stand-in Lola
  - the Tambayan entry with a thumbnail
  - the portfolio update only with the user's OK
  - the service worker version bumped on every change

## 6. Phases

Each phase gets its own plan, written from what the previous one taught.

1. **Engine and San Roque:** the rules, specials, latik, the 15 levels of town 1, the 3D stall, the HUD, the bot, tests and the deploy.
2. **Lola and juice:** the Mixamo session (with the user's go-ahead), Lola's reactions, particles, callouts, audio and the results screen.
3. **The campaign:** towns 2–6, all blockers, the town map, the story panels with illustrated Lola, the album and boosters.
4. **Modes:** Daily, Walang Katapusan, Karera.
5. **Events:** Tindera Showdown and Pista events.
6. **Polish and listing:** phone tuning, accessibility, Tambayan, and the portfolio (with OK).

## 7. Risks

- **Phone performance with a full 3D scene:** mitigated by Hollow Blocks' quality tiers, shared geometry and materials, and the 2D fallback.
- **Board readability at a tilted camera:** play-test the camera angle on a phone in phase 1 before building more.
- **Mixamo figures can look off** (Bantay Bakuran was dropped for its looks): Lola comes in phase 2, judged by screenshots, with the illustrated portraits as the fallback.
- **The name:** "Crush" in a match-3 title echoes Candy Crush. It's descriptive, but worth confirming before wide promotion; "Kakanin Pop" would be an alternative.
- **Balance across 90 levels:** the bot's checks gate every level. Levels get tuned by data, not by hand-guessing.
