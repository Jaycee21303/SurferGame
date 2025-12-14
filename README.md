# Trenchfire: Starfall Run

A fast, canvas-driven trench run shooter built for GitHub Pages. Fly the trench, carve up interceptors, and deliver the finishing shot against the Core Gate.

## Play
Open `index.html` locally or deploy the repository to GitHub Pages. Everything is client-side — no build steps or dependencies.

## Controls
- **Move:** WASD / Arrow Keys
- **Boost:** Shift
- **Fire:** Space / K
- **Pause:** P or the on-screen button

## Modes & Flow
- **Launch Sortie:** Story flow across three escalating levels finishing with the Core Gate encounter.
- **Practice Loop:** Endless scoring loop to master handling without level progression.

Keep your multiplier alive by chaining hits. Shields soften impacts; hull damage ends the run.

## Structure
- `index.html` — Markup and UI overlays.
- `style.css` — Neon-inspired HUD, cards, and canvas framing.
- `main.js` — Game loop, spawning, collision, and rendering.

## Notes
- The game is tuned for 1200x720 but scales fluidly down to mobile widths.
- No assets are required; everything is drawn in WebGL-free canvas for instant loads.
