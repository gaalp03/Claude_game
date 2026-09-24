# GHOST LOOP

Minimalist neon puzzle-platformer for the browser (CrazyGames-ready). Every attempt you record comes back as a ghost that replays your exact inputs – it presses buttons, holds doors open and becomes a step for you. Solve short 8–14 second levels by layering up to three ghosts.

Built with **Phaser 3** + **Vite**. No image or audio files, no network calls: everything is drawn and synthesized in code.

## Quick start

```bash
npm install
npm run dev      # local dev server → http://localhost:5173
npm test         # vitest: replay determinism, level loader, solvability, daily generator, save
npm run verify   # prints every level's solution check
npm run build    # production build into dist/ (upload the folder contents to CrazyGames)
npm run preview  # serve the production build locally
```

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | ← → / A D | left-bottom ◀ ▶ zones |
| Jump (hold = higher) | Space / ↑ / W | JUMP |
| Record this loop as a ghost | R | REC |
| Restart loop (no recording) | Backspace | ↺ |
| Remove last ghost | Z | UNDO |
| Pause | Esc / P | ‖ (top right) |
| Mute | M | pause menu |

Dying or running out of time restarts the loop without recording; your ghosts are kept.

## Modes

- **Levels** – 12 hand-made levels: 1–3 teach movement, 4–6 introduce a single ghost, 7–12 need 2–3 layered ghosts.
- **Daily Loop** – a level generated from today's date (same for everyone), verified solvable by the simulation before it is served. Finish it to get a Wordle-style result to copy and share, and keep your daily streak.

## Project layout

```
src/core/      deterministic physics, world simulation, replay, level loader, solver, daily generator, save, share
src/levels/    level01..12.json (tile units, each with a verified solution)
src/render/    WorldView – draws the simulation
src/scenes/    Boot, Menu, LevelSelect, Game, Daily
src/ui/        HUD, touch controls, buttons, panels, theme
src/audio/     WebAudio synth sound effects
src/sdk.js     CrazyGames SDK call points (disabled placeholders)
tests/         vitest suites
scripts/       level verification / tracing / daily stats CLI tools
```

Design decisions (in Hungarian) are in [TERV.md](TERV.md).

## CrazyGames SDK

`src/sdk.js` wires `loadingStart/Stop`, `gameplayStart/Stop`, `happytime` and `midgameAd` into the game but keeps them disabled (`SDK_ENABLED = false`). To go live: add the CrazyGames SDK v3 script tag to `index.html` and set the flag to `true`.
