# Thunder Client build

`classes.js` is generated. Edit `thunder/thunder-client.js`, then run:

```
node thunder/build.js
```

This inserts the Thunder block into the clean Eaglercraft 1.12.2 build
(`backups/classes.clean-base.js`, md5 `eb9c9477f8a04f25e4af424c5aaaf6ee`) and writes
`classes.js`. It also stamps `index-js.html` with a cache-busting version of that exact file.

Before writing anything the build refuses to continue unless:

- the base is clean (no Thunder code in it);
- every obfuscated game name used by the Thunder source is listed in its header
  (`@hook`, `@use`, `@virtual`, `@static`, `@clinit`, `@field`, `@runtime`) and each one maps
  to the stated Java method/class in that base. The mapping comes from the base's own
  deobfuscation table (the data Eaglercraft uses to print readable stack traces), so no name
  is guessed;
- every game function the Thunder source replaces is declared `@hook`;
- the output is the base plus exactly one inserted block, and it parses.

## Building on a different base

If you have another clean Eaglercraft 1.12 `classes.js` (for example your `classes(3).js`):

```
node thunder/build.js --base "path/to/classes(3).js"
```

If that file is a different compile, the build stops and lists every name that does not match
(and what that base calls the method instead) instead of producing a broken file.

Requirements: Node 18+ and the `acorn` parser (`npm install --no-save acorn`).

## Backups

- `backups/classes.clean-base.js` - clean Eaglercraft 1.12.2 (u0) JS build, the build input.
- `backups/classes.thunder-v4-working.js` - the Thunder build that was live before v6.
