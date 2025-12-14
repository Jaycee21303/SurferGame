# Trenchfire: Starfall Run

A fast, canvas-driven trench run shooter built for GitHub Pages. Drift with asteroid-like handling through a narrow exhaust trench, spray unlimited bolts, and slam the core vent before it seals.

## Play
Open `index.html` locally or deploy the repository to GitHub Pages. Everything is client-side — no build steps or dependencies.

## Controls
- **Move:** WASD / Arrow Keys (momentum-based)
- **Fire:** Hold Space / K (unlimited)
- **Pause:** P or the on-screen button

## Modes & Flow
- **Launch Sortie:** Three escalating passes that tighten the trench and end in the Core Vent fight.
- **Practice Loop:** Endless scoring loop to drill handling without level progression.

Maintain your multiplier by chaining hits. Shields soften impacts; hull damage ends the run.

## Structure
- `index.html` — Markup and UI overlays.
- `style.css` — HUD, cards, and trench framing.
- `main.js` — Game loop, spawning, collision, rendering, and flight handling.

## Notes
- Tuned for 1200x720 but scales fluidly down to mobile widths.
- Pure canvas — instant loads and GitHub Pages friendly.
