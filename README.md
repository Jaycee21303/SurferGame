# Neon Hell: Corridor

A neon-drenched, browser-first corridor shooter inspired by Doom corridors and Tron grids. Strafe a glowing trench in first-person, snap headshots with a central reticle, and ride escalating waves of hellspawn.

## Play
Open `index.html` locally or deploy the repository to GitHub Pages. No build tooling or external assets required.

## Controls
- **Move:** WASD / Arrow Keys (strafe + pitch)
- **Fire:** Hold Space or Left Click (auto-fire)
- **Pause:** P or the on-screen button

## Flow
- Enemies stream down a neon trench. Strafe to dodge, aim with the mouse, and melt them before they breach your armor.
- Distance raises the wave count, tightening spawn timings and enemy health.
- Practice mode keeps the vibe without punishing damage.

## Structure
- `index.html` — Minimal markup and overlays for the corridor briefing.
- `style.css` — Tron-inspired HUD and panel styling for GitHub Pages.
- `main.js` — Canvas renderer, pseudo-3D projection, enemy waves, and firing logic.

## Notes
- Tuned for a 1200x720 canvas but scales fluidly down to mobile widths.
- Pure canvas — instant loads and pages-friendly.
