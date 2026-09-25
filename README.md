# GHOST LOOP

Minimalist neon puzzle-platformer for the browser (CrazyGames-ready). Every attempt you record comes back as a ghost that replays your exact inputs – it presses buttons, holds doors open and becomes a step for you. Solve short 8–14 second levels by layering up to three ghosts.

Built with **Phaser 3** + **Vite**. No image or audio files, no network calls: everything is drawn and synthesized in code – including the synthwave soundtrack.

## Quick start

```bash
npm install
npm run dev      # local dev server → http://localhost:5173
npm test         # vitest: replay determinism, level loader, solvability, daily generator, save
npm run verify   # prints every level's solution check
npm run build    # production build into dist/ (upload the folder contents to CrazyGames)
npm run preview  # serve the production build locally
```

## CrazyGames upload

```bash
npm run package   # production build → release/ghost-loop-crazygames.zip (index.html at the zip root)
```

Checked for Basic Launch: ~1.4 MB total (≈0.46 MB zipped), single `index.html` entry with relative `./assets/` paths (runs from any subfolder / iframe), auto-starts into its own menu, 16:9 letterboxed and centered at any window size, fully playable with keyboard, mouse or touch, no external requests, links, ads or accounts (the CrazyGames SDK hooks are compiled out while `SDK_ENABLED = false`). Note: the build uses ES modules, so open it over http(s) (`npm run preview`), not by double-clicking `index.html`.

## Run on your LAN / Tailscale

```bash
npm run dev:lan   # vite on 0.0.0.0:5174 (strict port, fails instead of switching if 5174 is taken)
```

Open `http://<your-tailscale-ip>:5174` (find it with `tailscale ip -4`). On Windows allow the port once in an admin PowerShell:

```powershell
New-NetFirewallRule -DisplayName "Ghost Loop dev 5174" -Direction Inbound -Protocol TCP -LocalPort 5174 -Action Allow
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

- **Levels** – 24 hand-made levels in two chapters. Chapter 1 teaches movement, single ghosts, then 2–3 layered ghosts; Chapter 2 (“Paradox”) adds shuttles, crushers, lifts, bridges and timing puzzles.
- **Stars & medals** – every level has 3 stars (clear / par ghosts / gold time) and a medal (bronze → silver → gold → **Beat the Dev**). Your personal best runs alongside you as a golden PB ghost.
- **Profile** – 7 unlockable skins, 16 achievements and lifetime stats.
- **Helpers** – before each loop a dotted preview shows where your ghosts will go; a HUD timeline shows how long each ghost's recording lasts; after 3 loops the pause menu offers **SHOW SOLUTION** (replays the developer solution, skippable).
- **Daily Loop** – a level generated from today's date (same for everyone), verified solvable by the simulation before it is served. Finish it to get a Wordle-style result to copy and share, and keep your daily streak.

## Project layout

```
src/core/      deterministic physics, world simulation, replay, level loader, solver, daily generator, save, share
src/levels/    level01..24.json (tile units, each with a verified solution)
src/render/    WorldView – draws the simulation
src/scenes/    Boot, Menu, LevelSelect, Game, Daily, Profile
src/ui/        HUD, touch controls, buttons, panels, theme
src/audio/     WebAudio synth sound effects
src/sdk.js     CrazyGames SDK call points (disabled placeholders)
tests/         vitest suites
scripts/       level verification, tracing, timing search (solve-timing) and daily stats CLI tools
```

Design decisions (in Hungarian) are in [TERV.md](TERV.md).

## CrazyGames SDK

`src/sdk.js` wires `loadingStart/Stop`, `gameplayStart/Stop`, `happytime` and `midgameAd` into the game but keeps them disabled (`SDK_ENABLED = false`). To go live: add the CrazyGames SDK v3 script tag to `index.html` and set the flag to `true`.
