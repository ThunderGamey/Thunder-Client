# Thunder Client build

`classes.js` is generated. Edit `thunder/thunder-client.js` (and `thunder/thunder-shaders.js`,
`thunder/thunder-lan.js`, `thunder/thunder-title.js`, `thunder/thunder-theme.js` and
`thunder/thunder-packs.js`, which it pulls in with `// @include`), then run:

```
node thunder/build.js
```

This inserts the Thunder block into the clean Eaglercraft 1.12.2 build
(`backups/classes.clean-base.js`, md5 `eb9c9477f8a04f25e4af424c5aaaf6ee`) and writes
`classes.js`. It also stamps `index-js.html` with a cache-busting version of that exact file.

Before writing anything the build refuses to continue unless:

- the base is clean (no Thunder code in it);
- every obfuscated game name used by the Thunder source is listed in its header
  (`@hook`, `@use`, `@virtual`, `@static`, `@staticset`, `@clinit`, `@field`, `@runtime`) and
  each one maps to the stated Java method/class in that base. The mapping comes from the base's
  own deobfuscation table (the data Eaglercraft uses to print readable stack traces), so no name
  is guessed. `@staticset` names a static field written by one specific method (for example the
  WebGL context, set by `PlatformOpenGL.setCurrentContext`);
- every game function the Thunder source replaces is declared `@hook`, installed exactly once, and
  defined exactly once in the base;
- the output is the base plus exactly one inserted block (everything around it byte-identical),
  and it parses.

## Building on a different base

If you have another clean Eaglercraft 1.12 `classes.js` (for example your `classes(3).js`):

```
node thunder/build.js --base "path/to/classes(3).js"
```

If that file is a different compile, the build stops and lists every name that does not match
(and what that base calls the method instead) instead of producing a broken file.

Requirements: Node 18+ and the `acorn` parser (`npm install --no-save acorn`).

## Subsystems

- `thunder-client.js` - HUD, Right Shift menu, settings, the hooks listed in its header. Among
  them: Hand Item Size (scales the real first-person sword/shield through
  `ItemRenderer.renderItemInFirstPerson` + `renderItemSide`, first-person transforms only),
  Hitboxes (`RenderManager.debugBoundingBox`, kept in sync with F3+B), and a fix for a data-loss
  bug in the base runtime: deleting a world or resource pack also deleted every other world or
  pack whose folder name starts the same way (deleting "New World" wiped "New World-" and
  "New World 2"). Folder listings now end at the folder's "/"
  (`Filesystem$FilesystemHandleWrapper.eaglerIterate`, in the page and in the world Worker).
- `thunder-title.js` - the title screen: an animated storm drawn where the game draws its
  panorama (`GuiMainMenu.renderSkybox`): sky glow, two layers of clouds, lightning with branches,
  sparks, far hills and a blocky Minecraft skyline with trees, each layer moving by its own amount
  with the mouse. Two WebGL 2 passes (clouds at reduced resolution, then one full-resolution
  pass) with the same GL state save/restore as the shaders; Auto quality steps down on slow
  machines; any error falls back to the vanilla panorama. The logo textures
  (`minecraft.png`/`edition.png`) are swapped for THUNDER / CLIENT pixel art; turning the logo
  off restores the game's own. Right Shift > Visual > Thunder Title Screen: on/off, logo,
  lightning, parallax strength, quality. The storm is made once per frame into its own texture
  (at half size on Low, and only every other frame while Low is still slow) and copied wherever
  it is shown.
- `thunder-theme.js` - Thunder Menus: every menu in the Thunder style. The dirt behind menus
  (`GuiScreen.drawBackground`) becomes the storm; lists (worlds, servers, options, packs, ...)
  get the storm under a see-through glass area and repaint it in their header and footer
  (`GuiSlot.overlayBackground`); buttons and sliders draw from a Thunder copy of the button rows
  of `widgets.png` while `GuiButton.drawButton` runs (the hotbar keeps the real one), with white
  labels; text boxes, the Edit Profile boxes and the Credits panel are recoloured. Right Shift >
  Visual > Thunder Menus: on/off, storm or plain dark backgrounds (fastest), Thunder buttons.
- `thunder-packs.js` - the built-in resource packs (Thunder 1.21.11 and Thunder PvP, in
  `packs/`). On first start they are written into the game's own resource pack storage and
  `resourcepacks/manifest.json`, exactly as the game's own import would write them, so they
  appear in Options > Resource Packs.
  - It uses no game code, and only opens the storage after the game has created it.
  - A pack the player deletes stays deleted.
  - A pack whose zip changed (hash in `packs/packs.json`) is updated in place.
  - Right Shift > Utility > Built-in Resource Packs shows the status and can add them again.

  The packs themselves are built by `thunder/packs/build_packs.py`; see
  [packs/README.md](packs/README.md).
- `thunder-shaders.js` - optional shader/post-processing system (Right Shift > Shaders). How it
  hooks the renderer, the pipeline, presets, FPS safety and limits: [SHADERS.md](SHADERS.md).
- `thunder-lan.js` - Friends: open a singleplayer world to friends with a join code and join a
  friend's world (EaglerSPRelay signalling + WebRTC, bridged to the integrated server's player
  channels). How to use it, how it works, what was tested and the limits:
  [NETWORKING.md](NETWORKING.md).

## Backups

- `backups/classes.clean-base.js` - clean Eaglercraft 1.12.2 (u0) JS build, the build input.
- `backups/classes.thunder-v4-working.js` - the Thunder build that was live before v6.
