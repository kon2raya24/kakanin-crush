# Kakanin Crush

**Ubos-Benta!** Match-3, Pinoy style, in 3D. Swap puto, kutsinta, sapin-sapin, bibingka, ube halaya and suman on Lola Pacing's bilao at her fiesta stall, and sell out before your moves run out.

**Play:** https://kakanin-crush.vercel.app

## How to play

- **Drag** a kakanin onto a neighbour, or **tap** one and then the other, to swap them. On a keyboard: arrows move, Space picks up, arrows swap.
- Line up 3 or more of the same to clear them. A swap that matches nothing slides back and costs nothing.
- **Sandok** (4 in a line) clears a whole row or column. **Kaldero** (an L or T) bursts the 3×3 around it. **Bilao ng Lahat** (5 in a line) clears every kakanin of the kind you swap it with.
- Swap two specials together for a combo, up to two Bilao ng Lahat clearing the whole board.
- **Latik** sticks under some kakanin: match on top to clean it.
- Finish the order with moves to spare and Lola calls an **Ubos-Benta**: every move left becomes a Sandok.

## San Roque

The first town has 15 levels on a sari-sari street at golden hour. More towns, Lola's orders, the daily bilao, endless and Karera modes come in the next phases (see `docs/superpowers/specs/`).

## Run locally

```sh
python3 -m http.server 8000
```

Tests (Node 20+): `node --test test/*.test.mjs`. They cover the rules, the levels (and their balance by a bot), saves and the offline cache. `node tools/check.mjs` runs the browser checks.

Made by [Lemmuel Turaya](https://kon2raya.netlify.app). The 3D street uses CC0 scans from Poly Haven; everything else is drawn and synthesized in code.

## License

MIT
