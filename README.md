# Socket Strike

Browser prototype for a space shooter where **tetromino bullets must fit enemy socket grids** to deal damage — Tetris placement meets vertical shmup.

## Core loop

1. Move your ship and rotate the next tetromino (`Q` / `E`).
2. Fire the piece upward (`Space`).
3. Enemies expose **pink socket cells** on their hull.
4. When a bullet overlaps matching sockets, those cells lock (**green**) and the enemy takes damage.
5. Partial fits need at least **2 sockets** or **40%** of the enemy's sockets; otherwise the shot passes through.
6. Clear waves; enemies that reach your line end the run.

## Run locally

```bash
cd prototypes/tetris-fit-shooter
python3 -m http.server 8765
```

Open [http://localhost:8765](http://localhost:8765).

Or open `index.html` directly in a modern browser (ES modules).

## Controls

| Key | Action |
|-----|--------|
| ← → | Move |
| Q / E | Rotate next piece |
| Space | Fire |
| R | Restart (after game over) |

## What this prototype proves

- Tetromino-shaped projectiles feel distinct from normal bullets.
- Socket-matching damage is readable and satisfying with color feedback.
- Rotation + positioning adds a light puzzle layer without slowing the shooter pace.

## Stack

Vanilla HTML5 Canvas — no build step, deployable as static files.

## Screenshots

See `screenshots/` in the repo root.

## Follow-ups

- Snap-to-grid on near-miss for clearer "Tetris lock" feel
- Hold-to-preview ghost placement on enemies
- Combo multiplier for full-shape clears
- Power-ups that change piece bag or grant line-clear bombs
- Mobile touch controls + audio
