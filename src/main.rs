use actix_web::{get, post, web, App, HttpResponse, HttpServer, Responder};
use std::env;
use std::fs;

mod parser;
use parser::Parser;
mod sim;
use sim::{Sim, SimConfig};

/*
TODO

-Test run with a set of 12 abilities (may not all be damaging)
-Simulate (with legion probably) an entity that has these abilities, a GCD ticking down (probably just each sim tick is a GCD), cooldowns for each ability, etc.
-Gather ongoing damage from abilities (basic)
    -First direct damage only, no mitigation
-Very basic report of damage done in X time (5 minutes)
-Gather ongoing damage from abilities (advanced)
    -Add DoTs
        -Handle DoTs overlapping (HashMap instead of vec)
    -Also gather DPS by damage type (for combating resistance/immunity)
-Clean up code structure, move to separate files, etc.
    -Separate out parsed structs from any used in the actualy sim
        -Parsed structs -> Item mod damage math -> Saved in "real" Ability structs to use in the sim, in my own format
-Add basic tests
    -Parser tests
    -Sim tests
-Config system to control what gets simulated (abilities and items effectively)
-Add in base item mods
    -Pretty sure base items are calculated separately, like faerie armor?
-Read config from a file
-Accept config file path as argument
Add in item mods
    Parse each item mod type, and either be able to handle it or explicitly ignore it (if it's something we don't care about yet, like evasion)
        IconID parsing
        Mod parsing
    Apply parsed mods to abilities when I prep them for use in Sim (check my spreadsheet for the math on how to add damage mods up properly)
        Handle mods in sims, not beforehand, to handle proc chance (less performant, but who cares)
        There's a todo to handle remaining mod types, make sure to do that
Write up a few real simulations (maybe my current rabbit/unarmed build) as examples
Move "TODO Phase 2" items to GitHub Issues
Clean up these comments, anything else


TODO Phase 2

Base item mods could use more tests
Better sim tests
Smarter application of dots
    Check if the dot is present and try to only re-apply when needed
    Some abilities may mostly be about up front damage even when having a dot though, weigh desire to use the ability based on both upfront and dot damage (re-applying in this case may be better)
Gather ongoing damage from abilities (advanced)
    Healing
    Power regen
    Also gather number of CCs and type (CC per minute or something like that)
Add elapsed time resource and tag each Activity with a timestamp, for things like damage over time graphs
Validate correctness of a built (item slots, number of mods, etc.)
Sim pets
*/

#[post("/api/sim")]
async fn echo(req_body: String) -> impl Responder {
    HttpResponse::Ok().body(req_body)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    if let Some(arg) = env::args().nth(1) {
        // Serve a web service
        if arg == "--serve" {
            // Get the port number to listen on
            let port = env::var("PORT")
                .unwrap_or_else(|_| "3000".to_string())
                .parse::<u16>()
                .expect("PORT must be a number");

            HttpServer::new(|| {
                App::new()
                    .service(echo)
                    .service(actix_files::Files::new("/", "./static").index_file("index.html"))
            })
            .bind(("0.0.0.0", port))?
            .run()
            .await
        // Run in CLI mode from a config file
        } else {
            let parser = Parser::new();
            let config: SimConfig =
                serde_json::from_str(&fs::read_to_string(arg).expect("Unable to read config file"))
                    .unwrap();
            Sim::run(parser, config);
            Ok(())
        }
    } else {
        println!("Pass config file path as the first argument");
        Ok(())
    }
}
