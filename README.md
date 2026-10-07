# Drop Dash

A polio-awareness endless runner built on the project's original plain JavaScript/WebGL architecture. The railway, scenery, character, enemies, and collectible textures are generated at runtime; no reference image is used as a background.

## Run

Open `index.html`, or run `npm run dev` and visit http://127.0.0.1:4173. No dependencies or bundler are required. On PowerShell with restricted script execution, use `npm.cmd`.

## Controls

- Left/right arrows or A/D: switch lanes
- Up, W, or Space: jump over viruses and low barricades
- Down or S: slide under overhead barricades
- P or Escape: pause/resume; Q: end run
- Swipe or use the on-screen buttons on mobile
- G: grayscale; F: brief lighting effect

Blue POLIO drops award 25 points. Shield absorbs one hit (18-second duration). Speed Boost grants speed and collision protection, Double Score doubles distance and drop points, and Magnet collects nearby drops across lanes; these last 10 seconds. Best scores persist locally when storage is available. Music is opt-in. Hiding the browser tab pauses the run.

## Validation

`npm run build` and `npm run lint` perform JavaScript syntax and local entry-point asset checks. This static site has no compilation step or external lint dependency. `npm test` runs gameplay regression tests with Node's built-in test runner. `node scripts/browser-check.cjs` performs a headless Chrome smoke check on Windows while the dev server is running, producing ignored desktop/mobile screenshots.

The existing mesh factories, WebGL buffer initialization, draw helper, shader utilities, lane constants, and music are reused. `runner-scene.js` adds generated scenery and shared meshes; `main.js` manages the endless lifecycle. Original legacy factories and assets remain available.
