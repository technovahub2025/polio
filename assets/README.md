# Doctor boy character

`doctor-boy.glb` is a skinned glTF 2.0 asset built against `texture/player.png` as its visual reference. It retains the rear-facing boy, swept brown hair, white flared doctor coat, round red-cross badge, blue trousers, blue-and-white sneakers, wristband, and blue stethoscope. Unseen surfaces are reconstructed; this is not an exact recovery of the illustrated source model.

The mesh has 21 named joints, weighted knee/elbow/coat transitions, vertex colors, smooth normals, and six portable clips: RUN, JUMP, LAND, SOMERSAULT, IDLE, DEATH. Clips include ground correction; JUMP includes ballistic root motion. There is no PNG billboard, texture stretching, or whole-image animation.

The existing raw WebGL renderer has a player-only loader in `player-asset.js`. It supports the bundled uncompressed GLB layout, not arbitrary glTF extensions. `player-rig.js` evaluates the same skeleton used to bake the clips, adapting its phase to travelled distance and its lean to actual lateral velocity. Gameplay owns lane position, jump height, roll duration and the existing collision capsule. The animated mesh is grounded using precomputed surface-support vertices; weighted cloth vertices are included to avoid penetration when the coat folds. The full tucked mesh is tested against the overhead underside.

Regenerate the asset with `npm run build:player`. No external DCC tool or runtime package is required. The source mesh authoring script is `scripts/build-player.cjs`. The file format follows the [Khronos glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html).

Run `npm test` and `npm run build` for geometry, skinning, animation and gameplay checks. With `npm run dev` running at port 4173, `npm run test:browser` exercises the game in headless Chrome, including actual key input. Screenshots are written to `artifacts/player-animation/`. The browser harness currently uses the installed Windows Chrome path and SwiftShader, so it does not establish a hardware-GPU 60 FPS guarantee.
