use actix_web::{middleware, post, web, App, HttpResponse, HttpServer, Responder};
use std::env;
use std::fs;
use std::sync::Mutex;

mod parser;
use parser::Parser;
mod sim;
use sim::{Sim, SimConfig};

/*
TODO

Big remaining things
    Finish parsing of item mods, and corresponding tests
    Finish damage calculation, dots, buffs, debuffs, etc., and corresponding tests

Remove potential_power and do that calculation on the fly in the sim (more accurate, cleaner code)
Add in item mods
    Parse each item mod type, and either be able to handle it or explicitly ignore it (if it's something we don't care about yet, like evasion)
        IconID parsing
        Mod parsing
    Apply parsed mods to abilities when I prep them for use in Sim (check my spreadsheet for the math on how to add damage mods up properly)
        Handle mods in sims, not beforehand, to handle proc chance (less performant, but who cares)
        There's a todo to handle remaining mod types, make sure to do that
    Refactor Dots on enemy to be generic debuffs (some of which are dots, are vulnerability, etc.)
        Ticks down round by round
    Add generic buffs to player entity
        Ability damage buffs, etc.
    More tests for "cacualate damage" to make sure it adds up right
    Things I may not be covering right
        "{BOOST_ABILITY_GUT}{110}" is a flat damage thing, not a mod
Lots of sim tests
    Cooldowns for buffs, debuffs
    Buff effectiveness (does it really boost damage, for example)
    Debuff effectiveness (does it really cause weakness)
    Debuff as a dot (does it deal damage)
Review all TODOs
Write up the README
    Include client and server notes, mention buildWebData.js
    Mention --serve and CLI mode
Move "TODO Phase 2" items to GitHub Issues
Clean up these comments, anything else
Clean up console logs and anything else in the web client


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
    } else if config.sim_length < 1 {
        config.sim_length = 1;
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
                    .wrap(middleware::Compress::default())
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
            items: vec!["item_44207".to_string()],
            item_mods: vec![("power_1203".to_string(), "id_16".to_string())],
            sim_length: 30,
        };
        let report = Sim::run(&parser, &config);
        assert!(report.len() > 0);
    }

    #[test]
    fn invalid_ability_in_config() {
        let parser = Parser::new();
        let config = SimConfig {
            abilities: vec!["ThisAbilityDoesNotExist".to_string()],
            items: vec![],
            item_mods: vec![],
            sim_length: 30,
        };
        let report = Sim::run(&parser, &config);
        assert!(report.contains("Failed to find ability by internal name: ThisAbilityDoesNotExist"));
    }

    #[test]
    fn invalid_item_in_config() {
        let parser = Parser::new();
        let config = SimConfig {
            abilities: vec!["SwordSlash7".to_string()],
            items: vec!["InvalidItemId".to_string()],
            item_mods: vec![],
            sim_length: 30,
        };
        let report = Sim::run(&parser, &config);
        assert!(report.contains("Tried to use invalid item ID: InvalidItemId"));
    }

    #[test]
    fn invalid_item_mod_in_config() {
        let parser = Parser::new();
        let config = SimConfig {
            abilities: vec!["SwordSlash7".to_string()],
            items: vec![],
            item_mods: vec![("InvalidItemModId".to_string(), "id_16".to_string())],
            sim_length: 30,
        };
        let report = Sim::run(&parser, &config);
        assert!(report.contains("Tried to use invalid item mod ID: InvalidItemModId"));
    }

    #[test]
    fn invalid_item_mod_tier_in_config() {
        let parser = Parser::new();
        let config = SimConfig {
            abilities: vec!["SwordSlash7".to_string()],
            items: vec![],
            item_mods: vec![("power_1203".to_string(), "InvalidItemModTierId".to_string())],
            sim_length: 30,
        };
        let report = Sim::run(&parser, &config);
        assert!(report
            .contains("Tried to use invalid item mod tier ID: power_1203, InvalidItemModTierId"));
    }
}
