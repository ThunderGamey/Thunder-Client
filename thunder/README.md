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

- `index-js.html` (the page) - the Thunder loading screen: a storm (clouds, rain, lightning, a
  thunder with every flash) with the logo and a loading bar, shown the moment the page opens.
  `classes.js` is loaded with `defer`, so the page draws while it downloads. The bar follows the
  real start-up (`window.main` defined, then `TC.boot()`: the game object exists, a menu has been
  on screen for three frames, the built-in packs are no longer busy). Browsers allow sound only
  after the first click or key press, and the game itself waits for one before it starts its
  sound (its own click screen is under the loading screen), so while sound is locked the screen
  says CLICK ANYWHERE TO START and lets clicks through to the game; once the first menu is up,
  clicks stop at the loading screen. Then the THUNDER CLIENT splash strikes three times and the
  storm clears. The loading screen sits on `<html>`, not `<body>`, because the game empties
  `<body>` (its container) when it starts. A crash report, or the tap-to-launch box of mobile
  browsers, is never hidden.
- `thunder-boot.js` - `TC.boot()` for the loading screen, and Quick Start (Right Shift > Utility,
  on): `Minecraft.displayGuiScreen` opens the title screen instead of the Eaglercraft Edit Profile
  screen the game opens at start (Edit Profile stays a button on the title screen), and leaves out
  the default-username reminder.
- `thunder-combat.js` - Totem Counter and Pickup Notifier (HUD boxes, movable in the HUD editor;
  pickups come from the game's own "item collected" message, `SPacketCollectItem.processPacket`,
  so only real pickups show), Target Crosshair (aiming at a player within reach: the crosshair,
  drawn again from the same texture in red, and a lock-on frame; "Mobs too" option) and Shield
  Status (the off-hand shield slot glows in the ready colour, or the disabled colour with a fill
  that drains as the axe cooldown from `CooldownTracker` runs out; colours are swatches).
- `thunder-tweaks.js` - No Enchant Glint (`ItemStack.hasEffect` and
  `LayerArmorBase.renderEnchantedGlint`), No Rain (`EntityRenderer.renderRainSnow` and
  `addRainParticles`: no rain, splashes or rain sounds) and No Pumpkin Blur
  (`GuiIngame.renderPumpkinOverlay`).
- `thunder-zoom.js` - Zoom (Utility): hold C (or tap it with "Toggle"); the FOV of the world
  (not the hand) is divided in the `getFOVModifier` wrapper, glides in and out, the mouse wheel
  zooms further while zoomed (the event never reaches the game, so the hotbar stays), and mouse
  sensitivity is lowered with the zoom and put back exactly when it ends or a screen opens.
- `thunder-qol.js` - Toggle Sneak (`MovementInputFromOptions.updatePlayerMoveState`), Clear Chat
  (black boxes left out while `GuiNewChat.drawChat` runs), Password Hider (the chat box draws
  `/login ****`; the text itself is unchanged), Show Own Name Tag (the `canRenderName` prototype
  slot of `RenderLivingBase`, third person), Crystal Optimizer (an end crystal you hit is removed
  on your screen at once after `PlayerControllerMP.attackEntity`), XP Orb Clumping (only the first
  orb in each half-block cell is drawn per frame), Fast XP (no right-click delay with a bottle o'
  enchanting in hand; off by default) and Menu Sounds (open / close sounds of the Right Shift menu).
- `thunder-minimap.js` - Minimap (top corner, north up, players as dots, coordinates) and World
  Map (M: full screen, drag and scroll). Both are drawn from the chunks the game has loaded:
  the heightmap top block of every column in its map colour (`getMapColor`), shaded by the height
  of the block to its north; under a roof near the top of the world (the Nether) it looks down
  from your own height. A few chunks are read per frame, nearest first, again every 20 s; the map
  is kept for the session only. The HUD boxes on the minimap's side start below it, and in the top
  right it moves down while the game shows toasts (advancements, recipes, tutorial hints).
- `thunder-extras.js` - Shulker Preview (a 9 x 3 panel with the box's items and counts under its
  tooltip, read with the game's own `ItemStackHelper`; `GuiScreen.renderToolTip` is wrapped and
  its prototype slot pointed at the wrapper, since the creative inventory calls it by name) and
  Boat View 360 (`EntityBoat.applyYawToEntity` keeps turning your body with the boat but no longer
  clamps your view to 105 degrees).
- `thunder-hud.js` - the HUD widgets (FPS, CPS, coordinates, direction, speed, food, sprint,
  clock, memory, potion effects, keystrokes). With HUD Style on each is a Thunder box (dark glass,
  cyan edge; keys light up cyan while held), drawn by the game's own GUI code. Right Shift > HUD >
  HUD Style & Layout > Edit HUD Layout opens the HUD editor over the game: drag a box to move it
  (it snaps to the edges and the centre lines), scroll over it to resize it (50-300 %), right-click
  it to put it back, Esc or Done to finish. Positions are stored as a fraction of the free space
  on each axis (`localStorage["thunderHudLayout_v1"]`), so a box against an edge stays there in any
  window size. The pause menu, which opens when the mouse is released, is not drawn while editing.
  The Right Shift menu, the HUD editor and the world map all release the mouse, and the game
  answers by opening its pause menu; when one of them was opened during play, closing the last one
  closes that pause menu again (`displayGuiScreen(null)` on the game thread), so you are straight
  back in the game. A pause menu or inventory you opened yourself stays open.
- `thunder-client.js` - HUD, Right Shift menu, settings, the hooks listed in its header. Among
  them: Hand Item Size (scales the real first-person sword/shield through
  `ItemRenderer.renderItemInFirstPerson` + `renderItemSide`, first-person transforms only),
  Hitboxes (`RenderManager.debugBoundingBox`, kept in sync with F3+B), and a fix for a data-loss
  bug in the base runtime: deleting a world or resource pack also deleted every other world or
  pack whose folder name starts the same way (deleting "New World" wiped "New World-" and
  "New World 2"). Folder listings now end at the folder's "/"
  (`Filesystem$FilesystemHandleWrapper.eaglerIterate`, in the page and in the world Worker).
- `thunder-title.js` - the title screen: the owner line "Thunder Client by ThunderGamey" above
  the version text, Thunder splash texts (most of the time; Visual >
  Thunder Title Screen > Thunder splash texts), and an animated storm drawn where the game draws its
  panorama (`GuiMainMenu.renderSkybox`): sky glow, two layers of clouds, lightning with branches,
  sparks, far hills and a blocky Minecraft skyline with trees, each layer moving by its own amount
  with the mouse. Two WebGL 2 passes (clouds at reduced resolution, then one full-resolution
  pass) with the same GL state save/restore as the shaders; Auto quality steps down on slow
  machines; any error falls back to the vanilla panorama. The logo textures
  (`minecraft.png`/`edition.png`) are swapped for THUNDER / CLIENT pixel art; turning the logo
  off restores the game's own. Left-clicking the storm (on the title screen, or behind any menu
  that shows it) sends a bolt down to exactly where you clicked, with a thunder crack. Right
  Shift > Visual > Thunder Title Screen: on/off, logo, lightning, lightning where you click,
  storm sounds, parallax strength, quality. The storm is made once per frame into its own texture
  (at half size on Low, and only every other frame while Low is still slow) and copied wherever
  it is shown.
- `thunder_ambient.js` (next to `index-js.html`, not in `classes.js`) - every sound the page
  makes outside the game, made in the browser (Web Audio, no sound files): `thunder(big, far)`,
  one lightning strike (a zap and crackle, a distorted crack, then a rolling rumble with sub-bass,
  through a compressor), used by the loading screen and by every strike on the title screen (the
  ones you click are heavier; lightning inside the clouds is only a far rumble); the loading
  screen's rain; and the menu ambience (wind, low air, a distant rumble now and then). Nothing is
  scheduled before the browser allows sound, so nothing piles up to play at once later.
  `thunder-title.js` blocks it all while a world or server is open, so none of it plays in game,
  and turns it on or off with Right Shift > Visual > Thunder Title Screen > Storm sounds. The
  build stamps its URL with its own hash like `classes.js`.
- `thunder-theme.js` - Dark Inventories (Visual, on): container screens (inventory, chests,
  furnaces, ...) draw their background texture with a dark colour multiplier set right after it
  is bound, and their grey titles light, with any resource pack. Thunder Menus: every menu in the Thunder style. The dirt behind menus
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
  - A pack whose zip changed (hash in `packs/packs.json`) is updated in place; when that pack is
    switched on, the resources are reloaded once so the new version shows straight away.
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
- `thunder-hitfx.js` - Right Shift > Visual > Hit Effects (off by default).
  `Minecraft.clickMouse` is wrapped to read what you left-clicked; between frames (runOnGame) the
  effect is made on the player or mob you hit: Thunder shock (a jagged little bolt of blue
  enchanted-hit particles from above their head into the body, sparks, and a zap sound), Lightning
  strike (the game's own lightning bolt, effect only, with its crack and rumble), or a burst of
  crit, magic, flame, heart, end rod or totem particles. Only you see and hear it.
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
