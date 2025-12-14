# Cube Run: Trenchfire

A cubefield-style trench runner rebuilt for GitHub Pages. Drift with asteroid-inspired handling, spray unlimited bolts, and thread ever-tighter cube walls while dueling trench sentries to chase distance.

## Play
Open `index.html` locally or deploy the repository to GitHub Pages. No build steps or dependencies.

## Controls
- **Move:** WASD / Arrow Keys (momentum-based)
- **Fire:** Hold Space / K (unlimited)
- **Pause:** P or the on-screen button

## Flow
- **Launch Run:** Endless scoring sprint with accelerating cube walls, enemy craft, and a growing multiplier.
- **Practice Loop:** Same feel without worrying about separate progression.

Maintain your multiplier by dodging or blasting cubes and hostile enemies. Colliding or taking laser hits drains shields and hull; break apart and the run ends with an explosion.

## Structure
- `index.html` — Markup and overlays for launch/game over.
- `style.css` — HUD, cards, and backdrop styling.
- `main.js` — Canvas loop, pseudo-3D projection, spawning, collisions, and controls.

## Notes
- Tuned for 1200x720 canvas; scales fluidly down to mobile widths.
- Pure canvas — instant loads and GitHub Pages friendly.
