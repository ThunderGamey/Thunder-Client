# Thunder Client build

Thunder Client is created and owned by Jayvardhan Ginni (ThunderGamey).

`classes.js` is generated. Edit `thunder/thunder-client.js` (and `thunder/thunder-hud.js`,
`thunder/thunder-shaders.js`, `thunder/thunder-world.js`, `thunder/thunder-lan.js`,
`thunder/thunder-title.js`, `thunder/thunder-theme.js`, `thunder/thunder-packs.js`,
`thunder/thunder-items.js`, `thunder/thunder-items-data.js`, `thunder/thunder-hitfx.js` and
`thunder/thunder-perf.js`, which it pulls in with `// @include`),
then run:

```
node thunder/build.js
```

This inserts the Thunder block into the clean Eaglercraft 1.12.2 build
(`backups/classes.clean-base.js`, md5 `eb9c9477f8a04f25e4af424c5aaaf6ee`) and writes
`classes.js`. It also stamps `index-js.html` with a cache-busting version of that exact file.

Before writing anything the build refuses to continue unless:

- the base is clean (no Thunder code in it);
- every obfuscated game name used by the Thunder source is listed in its header
  (`@hook`, `@use`, `@virtual`, `@static`, `@staticset`, `@set`, `@clinit`, `@field`, `@runtime`) and
  each one maps to the stated Java method/class in that base. The mapping comes from the base's
  own deobfuscation table (the data Eaglercraft uses to print readable stack traces), so no name
  is guessed. `@staticset` names a static field written by one specific method (for example the
  WebGL context, set by `PlatformOpenGL.setCurrentContext`);
- every game function the Thunder source replaces is declared `@hook`, installed exactly once, and
  defined exactly once in the base; the only other game names it may assign are static fields
  declared `@set` (checked like `@static`: the two cached world shader sources);
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

- `thunder-hud.js` - the HUD widgets (FPS, CPS, coordinates, direction, speed, food, sprint,
  clock, memory, potion effects, keystrokes). With HUD Style on each is a Thunder box (dark glass,
  cyan edge; keys light up cyan while held), drawn by the game's own GUI code. Right Shift > HUD >
  HUD Style & Layout > Edit HUD Layout opens the HUD editor over the game: drag a box to move it
  (it snaps to the edges and the centre lines), scroll over it to resize it (50-300 %), right-click
  it to put it back, Esc or Done to finish. Positions are stored as a fraction of the free space
  on each axis (`localStorage["thunderHudLayout_v1"]`), so a box against an edge stays there in any
  window size. The pause menu, which opens when the mouse is released, is not drawn while editing.
- `thunder-client.js` - HUD, Right Shift menu, settings, the hooks listed in its header. Among
  them: Hand Item Size (scales the real first-person sword/shield through
  `ItemRenderer.renderItemInFirstPerson` + `renderItemSide`, first-person transforms only),
  Hitboxes (`RenderManager.debugBoundingBox`, kept in sync with F3+B), and a fix for a data-loss
  bug in the base runtime: deleting a world or resource pack also deleted every other world or
  pack whose folder name starts the same way (deleting "New World" wiped "New World-" and
  "New World 2"). Folder listings now end at the folder's "/"
  (`Filesystem$FilesystemHandleWrapper.eaglerIterate`, in the page and in the world Worker).
- `thunder-title.js` - the title screen: the owner line "Thunder Client by Jayvardhan Ginni
  (ThunderGamey)" above the version text, Thunder splash texts (most of the time; Visual >
  Thunder Title Screen > Thunder splash texts), and an animated storm drawn where the game draws its
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
  - Writing the packs uses no game code, and only opens the storage after the game has created it.
  - Thunder 1.21.11 is then switched on once per browser, the way Options > Resource Packs > Done
    does it (`ResourcePackRepository.setRepositories`, `GameSettings.resourcePacks`, saved to
    options.txt, resources reloaded), below any packs already on. Switched off later, it stays
    off (`localStorage["thunderPack121On"]`). Thunder PvP is never switched on for the player.
  - A pack the player deletes stays deleted.
  - A pack whose zip changed (hash in `packs/packs.json`) is updated in place; when 1.21.11 was
    on, the resources are reloaded once so the new version shows straight away.
  - Right Shift > Utility > Built-in Resource Packs shows the status and can add them again.

  The packs themselves are built by `thunder/packs/build_packs.py`; see
  [packs/README.md](packs/README.md).
- `thunder-items.js` - Newer Items on Servers (Right Shift > Visual, on by default). A newer server
  sends every item 1.12 does not have (mace, spears, wind charge, netherite gear, ...) as an old
  item named like "1.21.11 Netherite Spear", and keeps the real id in the item's data
  (`VB|Protocol<newer>To<older>|id`, read with `NBTTagCompound.hasKey` / `getInteger` and turned
  back into the item by `thunder-items-data.js`, made by `thunder/packs/item_ids.py`). For such an
  item, the model
  `item/thunder/<name in lower_case_words>` from the resource packs is drawn instead
  (`RenderItem.getItemModelWithOverrides`): in the GUI, in the hand (`<name>_in_hand` first, the
  long spears), on the ground and on other players. Worn netherite, copper and turtle armor named
  that way gets the pack's armor texture (`LayerArmorBase.renderArmorLayer` +
  `getArmorResource`). Items without such a name, or when no loaded pack has the model, are left
  to the game. The models are in Thunder 1.21.11 (see [packs/README.md](packs/README.md)). The
  card's "Check the item in my hand" says what the held item was seen as.
- `thunder-hitfx.js` - Right Shift > Visual > Thunder Hits and Hit Particles (both off by default).
  `Minecraft.clickMouse` is wrapped to read what you left-clicked; between frames (runOnGame) the
  game's own `EntityLightningBolt` is made "effect only" in your client's world at that spot
  (`World.addWeatherEffect`; it cannot burn or hurt anything and the server never hears of it),
  flickering a few times, with a quieter thunder crack (`WorldClient.playSound`). Hit Particles
  adds `ParticleManager.emitParticleAtEntity` bursts (crit, magic, flame, hearts, sparkles, end
  rod or totem) on the player or mob you hit. Options: also on blocks, sound, time between bolts,
  particle type and amount.
- `thunder-perf.js` - Max FPS (Right Shift > Utility): one click applies the fastest settings.
  - Game settings: render distance 6 or less, Fast graphics, smooth lighting, clouds and entity
    shadows off, minimal particles and unlimited framerate. These go through the game's own
    setters and are saved to options.txt.
  - Thunder settings: shaders off, plain menu backgrounds, Low title quality.
  - In a world it counts frames with VSync on and off for a few seconds each and keeps the faster
    one. VSync off helps a strong GPU but can flood a weak one: on a software GPU it went from
    60 to about 10 FPS.
  - Undo restores the previous settings.

  The FPS HUD module now shows the game's own frame count (what F3 shows) instead of the
  browser's animation-frame rate.
- `thunder-shaders.js` - optional shader/post-processing system (Right Shift > Shaders). How it
  hooks the renderer, the pipeline, presets, FPS safety and limits: [SHADERS.md](SHADERS.md).
- `thunder-world.js` - world shader effects that follow the Shaders switch: Waving Plants (grass,
  flowers, crops, leaves, vines) and Water (waves, sky reflections, sun glints), added to
  Eaglercraft's own terrain shader; and See-through Leaves (Visual tab). How: [SHADERS.md](SHADERS.md).
- `thunder-lan.js` - Friends: open a singleplayer world to friends with a join code and join a
  friend's world (EaglerSPRelay signalling + WebRTC, bridged to the integrated server's player
  channels). How to use it, how it works, what was tested and the limits:
  [NETWORKING.md](NETWORKING.md).

## Backups

- `backups/classes.clean-base.js` - clean Eaglercraft 1.12.2 (u0) JS build, the build input.
- `backups/classes.thunder-v4-working.js` - the Thunder build that was live before v6.
