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

Add in item mods
    Finish tests for each item mode (even if they don't pass)
    Work through and make each one pass
Review all TODOs, any that need to be addressed before alpha? Reviewed once, do one last pass
Clean up this comment block
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
