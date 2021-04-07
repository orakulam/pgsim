# pgsim

pgsim is a build simulator for the excellent MMORPG, Project Gorgon (https://projectgorgon.com/). It works by collecting all aspects of a build (abilities, items, mods on items), simulating combat, and reporting on it (overall DPS, damage by type, etc.).

It's very much in an early alpha state. It will likely break on certain item mods, will probably sim things incorrectly sometimes, and the prod server will probably just crash sometimes. It's part of the fun!

The output report includes several sections:
- The `SIM` section lists every action that happened in the simulation. If you sim a build that you have exactly in-game, then the damage numbers in this section _should_ match up to what you see in-game. If they don't, tell me!
- The `NOTES` section lists warnings for your build and what's currently supported. Many of these warnings are okay (things like `Ignored base item mod: {MAX_ARMOR}{6}`, which doesn't matter since we don't simulate your character's tankiness), but others may be impactful to the simulated DPS of your build. For warnings that do impact your build, please notify me so I can check it out and get it fixed!
- The `SUMMARY` section gives a breakdown of your build's DPS, and damage by source and damage type. Given the variety of resistances and immunities in Project Gorgon, DPS by damage type is very important to understand how viable your build is.

Link to use it: https://pgsim.herokuapp.com

Need help? File an issue here on GitHub, or ping `Valius` on the Project Gorgon Discord or in-game.

Want to help? I'd love it, hit me up!

## Simulator

### Setup

1. Set up your local Rust dev environment: https://www.rust-lang.org/tools/install
2. Run the test suite to make sure everything works: `cargo test`

### Running in CLI Mode

The simulator can run from the command line by passing a JSON config file with sim options.

Try it out with the very simple sample config: `cargo run config.json`

### Running in Server Mode

The simulator can run as a web server by passing the `--serve` flag. This is how it runs in production and responds to requests from the client.

Try it out: `cargo run -- --serve`

## Client

The web client is located in `./web`

### Setup

1. Set up your local Node environment
2. Install dependencies: `npm install`
3. Build PG data files for use by the client (this creates a smaller set of transformed data to avoid loading so much in the browser): `node buildWebData.js`
4. Run in dev mode: `npm run dev`
5. Build files in order for the server to serve them up: `npm run build`

## Acknowledgements

Yaffy's awesome write-ups in this thread were the basis for the core damage calculation: https://forum.projectgorgon.com/showthread.php?1801-Damage-Calculation-Formula-amp-Why-Deadlier-Weapons-are-so-Strong
