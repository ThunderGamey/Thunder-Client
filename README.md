# ABOUT

This project is a version of eaglercraftX based on Minecraft 1.12, specifically optimized for performance. It is legally licensed under the MIT License.

## Key Features

* **Version 1.12:** Built upon the core features of Minecraft version 1.12.
* **Performance Focused:** Engineered for enhanced performance and efficiency.

## Thunder Client

- **`index-js.html`** - Thunder Client on the Eaglercraft 1.12 JavaScript runtime: custom HUD,
  Right Shift menu (HUD, combat, movement, visual options including Hand Item Size and Hitboxes),
  optional Mellow-style shaders, an animated Thunder title screen (storm clouds, lightning, sparks
  and a blocky skyline that shift with the mouse, and the THUNDER CLIENT logo), Thunder menus
  everywhere (storm backgrounds, glass lists, Thunder buttons, sliders and text boxes), and **Friends**:
  open your singleplayer world to friends with a join code (Esc > Open to Friends) and join a
  friend's world from Right Shift > Friends.
  Source and build: [`thunder/`](thunder/README.md), shaders:
  [`thunder/SHADERS.md`](thunder/SHADERS.md), Friends: [`thunder/NETWORKING.md`](thunder/NETWORKING.md).
- **`index.html`** - the original WASM-GC launcher (unchanged).
- **`packs/`** - Thunder's two built-in resource packs, which appear in Options > Resource Packs
  the first time the client is opened:
  - **Thunder 1.21.11**: Minecraft 1.21.11 textures converted for 1.12.
  - **Thunder PvP**: small totem, low fire, wireframe crystals and a clean hotbar. Put it above
    Thunder 1.21.11.

  What is in them and how they are built: [`thunder/packs/README.md`](thunder/packs/README.md).
- **`Thunder-Updated-Textures-FIXED.zip`** - the older Thunder resource pack (newer-style
  textures for 1.12), checked with the Pack Doctor (`thunder-pack-doctor.html`).

## License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT).
