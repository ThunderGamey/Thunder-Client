# Thunder Shaders

Optional, adjustable post-processing for the 3D world. Off by default. Open it with
**Right Shift → Shaders**.

Source: `thunder/thunder-shaders.js` (included into the Thunder block by `thunder/build.js`).

## What changes in the game, and what does not

- **Shaders OFF (default):** the render hook calls the original `renderWorld` and returns. No GL
  call, no allocation, no per-frame work beyond one `if`. Anything left over from a previous ON
  period is freed once.
- **Shaders ON:** after the world is drawn, one screen-space pass processes the finished image.
  The HUD, crosshair, chat, menus and every GUI screen are drawn **after** it, so they stay sharp
  and untouched.
- Nothing else in Minecraft's world renderer is modified: no chunk, entity, lighting, sky or
  resource-pack code is touched. `assets.epk` is unchanged.

## Renderer hook (verified against this `classes.js`)

Everything below is checked by `thunder/build.js` on every build, using the base file's own
deobfuscation table. The build fails if any name does not match.

| JS name | Java | Kind | Why |
|---|---|---|---|
| `Fjk` | `net.minecraft.client.renderer.EntityRenderer.renderWorld` | `@hook` (the only new hook) | the post-process runs right after it returns |
| `HEl` | static written by `PlatformOpenGL.setCurrentContext` | `@staticset` | the game's own WebGL context |
| `HEv` | static written by `PlatformOpenGL.setCurrentContext` | `@staticset` | its GLES version: 200 = WebGL 1, 300 = WebGL 2 |
| `HEh` `HEi` `HEj` `HEk` | statics written by `GlStateManager.viewport` | `@staticset` | the viewport cache |
| `KPa` | static written by `GlStateManager.colorMask` | `@staticset` | the color-mask cache (bits r=1 g=2 b=4 a=8) |

How it fits into a frame, as the compiled code does it:

1. `EntityRenderer.updateCameraAndRender` (`FjZ`) calls `renderWorld` (`Fjk`) once per frame,
   only while a world is loaded. That call is the only caller of `Fjk`.
2. `renderWorld` draws sky, terrain, entities, particles, the hand and first-person overlays into
   Eaglercraft's back buffer. The back buffer is its own framebuffer (`PlatformRuntime` creates
   it; `_wglBindFramebuffer(null)` binds it) with an RGBA8 color renderbuffer and a 32-bit float
   depth renderbuffer.
3. **The Thunder pass runs here.**
4. `updateCameraAndRender` then composites the HUD, which Eaglercraft renders into
   `GameOverlayFramebuffer` every 75–125 ms. After that come the crosshair, notifications and
   the open GUI screen.
5. `WebGLBackBuffer.flipBuffer` blits the back buffer to the canvas.

Other points checked in the compiled code:

- There is no vanilla `ShaderGroup`/`Framebuffer` post-shader system in this build; Eaglercraft
  removed it. Only the deferred pipeline's frustum class survived.
- `renderWorld` can suspend the TeaVM thread (texture loads). The wrapper keeps no state, so a
  suspended call resumes through it correctly, and the pass only runs after a normal return.
- In-game, `GlStateManager.viewport` and `GlStateManager.colorMask` are the only code that sets
  the GL viewport and color mask. The other raw callers are the early loading screen and the
  WebGL 1 presenter. So their caches are exact, and reading them avoids two synchronous GL queries
  per frame.

### Single-copy and integrity checks (build.js)

- every `@hook` is installed exactly once in the Thunder source, and its original function is
  defined exactly once in the base;
- the output is the base plus exactly one Thunder block (prefix and suffix byte-identical), and it
  parses;
- `// @include thunder-shaders.js` is expanded in place (one level, each file once), so the
  shader module shares the client scope but lives in its own file.

## The pipeline

WebGL 2 only (GLSL ES 3.00). Every pass is one attribute-less full-screen triangle.

1. **Scene copy.** The world image is copied out of the back buffer (`blitFramebuffer`) into a
   texture.
2. **Bloom chain** (only when Bloom or Ambient Glow is on):
   - **Bright pass.** Four taps, each thresholded separately so textured lights such as glowstone
     keep their bright texels. The alpha channel carries plain scene brightness.
   - **Adaptive threshold.** The threshold follows the scene's average brightness, measured on the
     GPU into a 1×1 texture and eased over ~0.6 s. At night it is low (0.45), so torches, lava and
     glowstone glow. In bright scenes it is high (0.9), so a clear daytime sky does not wash out.
   - **Dual-filter blur.** The image is downsampled `levels` times (5 taps each), then upsampled
     back (8-tap tent), mixing each level in.
3. **Composite.** One full-screen pass applies every enabled effect, adds a 1/255 dither against
   banding, and writes the result back into the back buffer.
4. **Motion blur** (only when on): the composite goes to an off-screen target, is blitted back,
   and becomes the next frame's history.
5. **State restore.** Framebuffers, viewport, program, vertex array, texture units 0–3 and their
   samplers, the enable flags and the color mask are read before the pass and put back exactly.
   Eaglercraft caches GL state (`GlStateManager`, `EaglercraftGPU`), so leaving anything changed
   would make the game draw with the wrong state. After a failure, the `finally` block still
   restores it.

Programs compile on first use. With `KHR_parallel_shader_compile`, frames never wait for them;
the effect simply starts a frame or two later. Only the effects that are on are compiled into the
composite program (one variant per combination, cached).

## Effects

All strengths are percentages, multiplied by the master **Intensity** (0–100 %). At 0 % the pass
is skipped entirely.

| Effect | Default | What it does |
|---|---|---|
| Bloom | on, 55 % | Soft glow around bright light (torches, lava, glowstone, the sun). Adaptive threshold, see above. |
| Color Grading | on, 60 % | Warm neutral highlights and cool shadows, then vibrance (dull colors gain the most saturation). The tint is weighted by (1 − chroma), so saturated colors such as the sky keep their hue. |
| Contrast | on, 45 % | S-curve on luminance, applied by scaling the color, so hue and saturation are preserved and nothing clips. |
| Vignette | on, 45 % | Slightly darker screen edges. |
| Ambient Glow | on, 50 % | Wide, soft spill of bright light into the surroundings, plus a small lift in very dark scenes. |
| Motion Blur | off, 35 % | Blends in the previous frame. The weight is scaled by frame time, so the trail looks the same at any FPS; at very low FPS it therefore almost disappears. The history resets after hitches over 0.5 s. |

Defaults: Shaders off, Intensity 70 %, Quality MEDIUM, Auto quality on, Target FPS 30.

## Quality presets

The presets only change bloom workload: the resolution the blur runs at, and how many blur levels
there are. The effects look the same at every preset; lower presets give a slightly softer bloom.

| Preset | Bloom resolution | Blur levels | Passes / frame | Work at 1280×720 |
|---|---|---|---|---|
| LOW | 1/8 | 3 | 10 | 1.88 MPx |
| MEDIUM | 1/4 | 4 | 12 | 2.00 MPx |
| HIGH | 1/2 | 6 | 16 | 2.46 MPx |
| CUSTOM | 1/2, 1/4 or 1/8 | 1–7 | depends | depends |
| PERFORMANCE (auto / Performance Mode) | none | none | 2 | 1.84 MPx |

Notes:

- Motion Blur adds one pass (+1 full frame of pixels).
- The copy and the composite are always full resolution, so they are the fixed floor of
  ~1.84 MPx at 1280×720.
- At 1440p and above, bloom runs one resolution step lower automatically.
- Picking LOW, MEDIUM or HIGH also sets the two CUSTOM sliders to that preset's values. Moving a
  CUSTOM slider switches the preset to CUSTOM.

Measured cost of the pass alone ("Measure cost" in the Performance card): the GPU is synchronized
with a 1-pixel `readPixels` before and after the pass, because WebGL's `finish()` does not wait in
Chrome. Headless Chromium with SwiftShader (a CPU renderer, far slower than any real GPU),
1280×720, 30 frames per measurement, three runs:

| Preset | ms per frame |
|---|---|
| LOW | 38.2, 41.4, 53.1 |
| MEDIUM | 50.8, 46.0, 52.1 |
| HIGH | 54.6, 64.5 (the first run hit the old 10 s limit) |

On this CPU renderer the full-resolution copy and composite, which are identical at every preset,
dominate. So LOW and MEDIUM overlap within run-to-run noise, while HIGH is consistently the most
expensive. The deterministic workload differs as in the table above (10 / 12 / 16 passes,
1.88 / 2.00 / 2.46 MPx). None of this is representative of a real GPU, where the same full-screen
passes typically cost well under a millisecond.

## Auto quality and the FPS safety net

The render hook times every world frame. Each second of rendering gives one FPS sample.
Decisions use the median of recent samples, so one hitch or spike does not trigger anything. A
gap over 2 s (hidden tab, world loading, save) is skipped, and after 3 s the measurement starts
over.

- **Starting point:** software renderers (SwiftShader, llvmpipe, …) start at LOW. A device seen
  before starts at the level it settled on last time; this is stored per GPU name in
  `localStorage["thunderShaderAuto_v1"]`.
- **Step down:** with Auto quality on, if the median of 5 samples is below the target FPS, the
  allowed level drops one step (FULL → MEDIUM → LOW → PERFORMANCE), and 3 more samples are
  measured.
  - If FPS did not improve by at least 5 %, the step is undone: shaders were not the bottleneck.
    It is not retried for 60 s.
- **Step up:** with a median of 6 samples at 1.5× the target, after 10 s the level rises one step.
  It is undone, and blocked for 2 min, if FPS then falls below the target.
- **Explicit choice wins:** choosing a preset or a CUSTOM value resets auto to FULL.
- **Last resort, also with Auto quality off:** FPS stays very low even at the lightest level
  (under 10 FPS with Auto quality off; under max(12, target/2) at PERFORMANCE with it on).
  - The effect is skipped for 3 s to measure FPS without it.
  - If that is at least 20 % better, shaders **pause**, and the menu says so ("Paused • FPS was
    too low with shaders on this device"). Changing any shader setting, or switching Shaders off
    and on, resumes them.
  - If it is not better, nothing is paused.
- **Performance Mode** (switch): forces the lightest level (grading, contrast and vignette only)
  regardless of auto.

Every decision is logged with its reason in `ThunderClient.shaders.log`, and the last 12 FPS
samples are in `ThunderClient.shaders.fpsLog`.

## Fallbacks

| Situation | Result |
|---|---|
| The game runs on WebGL 1 (no WebGL 2) | Status "Not available … needs WebGL 2". Nothing is drawn; the game renders normally. |
| A shader fails to compile or link | Status "Stopped after an error: …". GL state is restored, resources are freed, the game renders normally. Switching Shaders off and on retries. |
| A GL error in the first frame after (re)allocating targets | Treated like a compile failure (checked with two `getError` calls per re-layout only). |
| Any exception in the pass | State is restored (`finally`), the pipeline stops for the session, and the game keeps rendering. |
| WebGL context lost | Resources are dropped; status "Stopped". |

## Settings

Stored with the other Thunder settings in `localStorage["thunderClientSettings_v6"]`. Only
values that differ from the defaults are saved.

| Key | Default | Meaning |
|---|---|---|
| `shaders` | false | master switch |
| `shIntensity` | 70 | master intensity % |
| `shPreset` | 1 | 0 LOW, 1 MEDIUM, 2 HIGH, 3 CUSTOM |
| `shBloomRes`, `shBloomLevels` | 2, 4 | CUSTOM: bloom at 1/2^n, blur levels |
| `shAuto`, `shTargetFps`, `shPerf` | true, 30, false | auto quality, its target, Performance Mode |
| `shBloom`/`shBloomStr` … `shMotion`/`shMotionStr` | see Effects | per-effect switch and strength |

**Reset Shader Settings** (two clicks) restores every shader setting except the ON/OFF switch,
and forgets the level auto quality learned. **Reset all** in the menu footer also switches
shaders off.

## Limitations of Eaglercraft 1.12 (this build)

- **No HDR.** The world is rendered into an RGBA8 back buffer, so bloom works from 0–1 colors. The
  adaptive threshold is what separates a torch at night from a sunlit wall.
- **Only the final image is used.** There are no normals, sky mask, light direction or shadow maps
  here. Real shadows, SSAO, volumetric light, reflections or waving plants would need changes to
  the world renderer itself; this module deliberately does not make them.
- **Depth is not used yet.** The back buffer does have a 32-bit float depth renderbuffer. A future
  effect could copy it with `blitFramebuffer(DEPTH_BUFFER_BIT)` into a matching depth texture, for
  fog or depth of field.
- **WebGL 2 is required**, and the game falls back to WebGL 1 on some very old devices.
- **Motion blur has no motion vectors.** It is frame blending. At low FPS it almost disappears,
  by design.
- **Menus.** Shaders only apply while a world is loaded; the main menu and loading screens are not
  processed.

## Adding a new effect (architecture)

1. Add an entry to `SH_EFFECTS` in `thunder-shaders.js`. Give it an id, its on/strength setting
   keys, a `max`, a uniform name, and one GLSL block that modifies `vec3 c` (the pixel color).
   Blocks run in array order inside the composite pass. Available inside the block: `v_uv`,
   `luma()`, `u_scene`, `u_bloomTex`, `u_wideTex`, `u_histTex`, `u_aspect`.
2. Set `needs:'chain'` if the effect reads the blurred levels, or `needs:'history'` if it reads the
   previous frame. Resources are allocated only when some enabled effect needs them.
3. Add its two settings to `DEFAULTS` in `thunder-client.js`, and a card to `MODULES` (the cards
   at the end of `thunder-shaders.js`).

The composite program for each effect combination is generated and cached automatically.
`ThunderClient.shaders.selfTest()` compiles every combination and reports failures.

### Development aids (console)

- `ThunderClient.shaders.debug = 1 | 2 | 3` shows the bloom texture, the wide glow level or the
  blurred brightness; set it to 0 to return.
- `ThunderClient.shaders.tune` holds the bloom thresholds, knee, scatter and adaptation speed.
  They take effect live.
- `ThunderClient.shaders.measure(30)` resolves with the average cost of the pass in ms.
- `ThunderClient.shaders.state`, `.level`, `.passes`, `.mpx`, `.fps`, `.log` give live status.

## What was tested, and where

Test environment: headless Chromium 141 with SwiftShader (software WebGL 2) at 1280×720, driven
by Playwright. It ran the exact `classes.js` and `index-js.html` of this commit, served from the
repository checkout, with no test code injected.

- The game loads; singleplayer loads.
- **Multiplayer path:** Direct Connect to a local WebSocket test server. The client sends its
  real Eaglercraft 1.12 login handshake, then reports the expected handshake failure from the test
  server. The public servers are not reachable from the test machine.
- Right Shift opens and closes the menu, and the mouse is re-locked afterwards.
- **OFF vs ON:** shaders OFF runs zero pipeline frames. Intensity 0 % and OFF match the baseline
  within animation noise. 35 / 70 / 100 % change the image progressively; mean difference
  3.8 / 7.1 / 9.9 of 255 in a sky-and-sun view.
- **Presets and settings:** LOW / MEDIUM / HIGH change passes, pixels and measured cost. Settings
  persist across a reload. Reset Shader Settings works.
- **Failure handling:** a deliberately broken shader stops the pipeline cleanly, with no GL error
  and the game rendering normally, and it recovers with the switch. `getError()` is 0 after
  shader frames.
- **Self-test:** all 70 shader programs compile.
- **FPS safety:** the pause triggered on its own on the software renderer, with its log entries.
- **Input:** W moves the player with shaders on. Mouse look turns the camera with shaders on and
  off. In this headless browser Playwright's own mouse moves carry no pointer-lock movement, so
  `movementX` events were dispatched on the game canvas instead; that is what the browser
  delivers under pointer lock.
- **Auto quality logic:** verified deterministically by simulating seven FPS scenarios through
  the exact controller source.
- **WebGL 1 fallback:** a second Chromium instance was started with WebGL 2 disabled and a fresh
  profile, and a new world was created. The game ran on WebGL 1.0. Switching Shaders on showed
  "Not available • needs WebGL 2", ran zero pipeline frames, and the game kept rendering normally.
  The 39 `texParameter` INVALID_ENUM warnings WebGL 1 prints are identical with the clean base
  build, so they are Eaglercraft's own.

Not tested: real GPUs, phones, Firefox and Safari, an actual multiplayer server, or long play
sessions.
