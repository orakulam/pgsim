use actix_web::{get, post, web, App, HttpResponse, HttpServer, Responder};
use std::sync::Mutex;
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
-Set up heroku hosting
-There's some places where the app will fully crash if the config is wrong, fix that
    -Write test with intentionally bad configs (bad skill names, etc.)
Add in item mods
    Parse each item mod type, and either be able to handle it or explicitly ignore it (if it's something we don't care about yet, like evasion)
        IconID parsing
        Mod parsing
    Apply parsed mods to abilities when I prep them for use in Sim (check my spreadsheet for the math on how to add damage mods up properly)
        Handle mods in sims, not beforehand, to handle proc chance (less performant, but who cares)
        There's a todo to handle remaining mod types, make sure to do that
    More tests for "cacualate damage" to make sure it adds up right
    Things I may not be covering right
        "{BOOST_ABILITY_GUT}{110}" is a flat damage thing, not a mod
Review all TODOs
Write up a few real simulations (maybe my current rabbit/unarmed build) as examples (include on in web client)
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

struct ActixState {
    parser: Mutex<Parser>,
}

#[post("/api/v1/sim")]
async fn echo(mut config: web::Json<SimConfig>, data: web::Data<ActixState>) -> impl Responder {
    let parser = data.parser.lock().expect("Failed to lock parser mutex");
    if config.sim_length > 600 {
        config.sim_length = 600;
    }
    let report = Sim::run(&*parser, &*config);
    HttpResponse::Ok().body(report)
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    if let Some(arg) = env::args().nth(1) {
        let parser = Parser::new();
        // Serve a web service
        if arg == "--serve" {
            // Get the port number to listen on
            let port = env::var("PORT")
                .unwrap_or_else(|_| "3000".to_string())
                .parse::<u16>()
                .expect("PORT must be a number");

            let data = web::Data::new(ActixState {
                parser: Mutex::new(parser),
            });

            HttpServer::new(move || {
                App::new()
                    .app_data(data.clone())
                    .service(echo)
                    .service(actix_files::Files::new("/", "./web/public").index_file("index.html"))
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
            let report = Sim::run(&parser, &config);
            println!("{}", report);
            Ok(())
        }
    } else {
        println!("Pass config file path as the first argument");
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn basic_config() {
        let parser = Parser::new();
        let config = SimConfig {
            abilities: vec![
                "SwordSlash7".to_string(),
                "Decapitate6".to_string(),
                "FlashingStrike7".to_string(),
                "HackingBlade5".to_string(),
                "FinishingBlow5".to_string(),
                "ThrustingBlade5".to_string(),
                "FastTalk4".to_string(),
                "Soothe6".to_string(),
                "StrikeANerve6".to_string(),
                "Psychoanalyze6".to_string(),
                "YouWereAdopted6".to_string(),
                "ButILoveYou3".to_string(),
            ],
            items: vec![
                "item_44207".to_string(),
            ],
            item_mods: vec![("power_1203".to_string(), "id_16".to_string())],
            sim_length: 30
        };
        let report = Sim::run(&parser, &config);
        assert!(report.len() > 0);
    }

    #[test]
    fn invalid_ability_in_config() {
        let parser = Parser::new();
        let config = SimConfig {
            abilities: vec![
                "ThisAbilityDoesNotExist".to_string(),
            ],
            items: vec![],
            item_mods: vec![],
            sim_length: 30
        };
        let report = Sim::run(&parser, &config);
        assert!(report.contains("Failed to find ability by internal name: ThisAbilityDoesNotExist"));
    }

    #[test]
    fn invalid_item_in_config() {
        let parser = Parser::new();
        let config = SimConfig {
            abilities: vec![
                "SwordSlash7".to_string(),
            ],
            items: vec!["InvalidItemId".to_string()],
            item_mods: vec![],
            sim_length: 30
        };
        let report = Sim::run(&parser, &config);
        assert!(report.contains("Tried to use invalid item ID: InvalidItemId"));
    }

    #[test]
    fn invalid_item_mod_in_config() {
        let parser = Parser::new();
        let config = SimConfig {
            abilities: vec![
                "SwordSlash7".to_string(),
            ],
            items: vec![],
            item_mods: vec![("InvalidItemModId".to_string(), "id_16".to_string())],
            sim_length: 30
        };
        let report = Sim::run(&parser, &config);
        assert!(report.contains("Tried to use invalid item mod ID: InvalidItemModId"));
    }

    #[test]
    fn invalid_item_mod_tier_in_config() {
        let parser = Parser::new();
        let config = SimConfig {
            abilities: vec![
                "SwordSlash7".to_string(),
            ],
            items: vec![],
            item_mods: vec![("power_1203".to_string(), "InvalidItemModTierId".to_string())],
            sim_length: 30
        };
        let report = Sim::run(&parser, &config);
        assert!(report.contains("Tried to use invalid item mod tier ID: power_1203, InvalidItemModTierId"));
    }
}
