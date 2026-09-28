# ABOUT

This project is a version of eaglercraftX based on Minecraft 1.12, specifically optimized for performance. It is legally licensed under the MIT License.

## Key Features

* **Version 1.12:** Built upon the core features of Minecraft version 1.12.
* **Performance Focused:** Engineered for enhanced performance and efficiency.

## Owner

Thunder Client is created and owned by **Jayvardhan Ginni (ThunderGamey)**. All Thunder Client
code, textures and designs in this repository (everything under `thunder/`, the Thunder packs in
`packs/` and the Thunder parts of `classes.js`) are by ThunderGamey. Eaglercraft is by lax1dude and
Minecraft and its assets are by Mojang; those parts are not ThunderGamey's.

In the client, the title screen and the Right Shift menu say "ThunderGamey"; the full credit is
in Right Shift > Utility > Readme.

## Thunder Client

- **`index-js.html`** - Thunder Client on the Eaglercraft 1.12 JavaScript runtime. The Thunder
  loading screen (a storm with thunder, the logo and a loading bar that follows the real start-up)
  shows the moment the page opens, and the game starts straight on the title screen (no Edit
  Profile screen every time). A Thunder-style
  HUD you can rearrange (drag boxes to move them, scroll to resize them), Right Shift menu (HUD,
  combat, movement, visual options including Hand Item Size, Hitboxes, See-through Leaves and
  Hit Effects (a thunder shock or lightning on what you hit), and a one-click Max FPS that also
  tests whether VSync on or off is faster on your device); Totem Counter, Pickup Notifier, Target
  Crosshair, Shield Status colours, Zoom (hold C, scroll to zoom further), Minimap and World Map
  (M), Shulker Preview, Toggle Sneak, Clear Chat, Password Hider, Show Own Name Tag, Crystal
  Optimizer, Crystal Tap, Spears like 1.21.11 (the jab with its full reach and the charge work on
  1.21.11 servers), XP Orb Clumping, Fast XP, Boat View 360, No Enchant Glint, No Rain, No Pumpkin Blur,
  Dark Inventories and Thunder menu sounds,
  optional shaders (LOW / MEDIUM / HIGH looks, glowing lava and torches, underwater rays, waving
  plants and leaves, reflective waves on water), an animated Thunder title screen (storm clouds,
  lightning, sparks and a blocky skyline that shift with the mouse, lightning that strikes where
  you click, wind and thunder sounds on the menus only, the THUNDER CLIENT logo and ThunderGamey
  splash texts), Thunder menus
  everywhere (storm backgrounds, glass lists, Thunder buttons, sliders and text boxes), and **Friends**:
  open your singleplayer world to friends with a join code (Esc > Open to Friends) and join a
  friend's world from Right Shift > Friends.
  Source and build: [`thunder/`](thunder/README.md), shaders:
  [`thunder/SHADERS.md`](thunder/SHADERS.md), Friends: [`thunder/NETWORKING.md`](thunder/NETWORKING.md).
- **`index.html`** - the original WASM-GC launcher (unchanged).
- **`packs/`** - Thunder's two built-in resource packs, which appear in Options > Resource Packs
  the first time the client is opened:
  - **Thunder 1.21.11** (switched on for you): Minecraft 1.21.11 textures converted for 1.12. On
    servers it also shows maces, spears, wind charges, netherite gear and the other items added
    since 1.12 with their real textures (they arrive renamed, like "1.21.11 Netherite Spear").
  - **Thunder PvP** (off until you pick it): plain armor and flat swords and tools (netherite
    too), a glowing light-blue totem, small pearls circling the ender pearl, a shining golden
    apple, calmer blocks, clean crit particles, low fire, wireframe crystals and a clean hotbar.
    Put it above Thunder 1.21.11.

  What is in them and how they are built: [`thunder/packs/README.md`](thunder/packs/README.md).
- **`Thunder-Updated-Textures-FIXED.zip`** - the older Thunder resource pack (newer-style
  textures for 1.12), checked with the Pack Doctor (`thunder-pack-doctor.html`).

## License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT).
