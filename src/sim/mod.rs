use legion::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::parser::{data::DamageType, Parser};

mod systems;

const TICK_LENGTH_IN_SECONDS: i32 = 1;

#[derive(Debug)]
struct Player;

#[derive(Debug)]
struct PlayerAbilities {
    abilities: Vec<PlayerAbility>,
}

#[derive(Debug)]
struct PlayerAbility {
    name: String,
    damage: i32,
    damage_type: DamageType,
    reset_time: f32,
    buffs: Vec<Buff>,
    debuffs: Vec<Debuff>,
    keywords: Vec<String>,
    cooldown: f32,
    icon_id: i32,
    base_damage_attributes: Vec<String>,
    damage_attributes: Vec<String>,
}

#[derive(Debug)]
struct Enemy;

#[derive(Debug)]
struct Report {
    activity: Vec<Activity>,
}

#[derive(Debug)]
struct Buffs(HashMap<String, Vec<Buff>>);

#[derive(Debug, Clone)]
struct Buff {
    remaining_duration: i32,
    effect: BuffEffect,
}

#[derive(Debug, Clone)]
enum BuffEffect {
    DamageTypeDamageModBuff {
        damage_type: DamageType,
        damage_mod: f32,
    },
    DamageTypeFlatDamageBuff {
        damage_type: DamageType,
        damage: i32,
    },
    DamageTypePerTickDamageBuff {
        damage_type: DamageType,
        damage: i32,
    },
    KeywordFlatDamageBuff {
        keyword: String,
        damage: i32,
    },
    KeywordDamageModBuff {
        keyword: String,
        damage_mod: f32,
    },
}

#[derive(Debug)]
struct Debuffs(HashMap<String, Vec<Debuff>>);

#[derive(Debug, Clone)]
struct Debuff {
    remaining_duration: i32,
    effect: DebuffEffect,
}

#[derive(Debug, Clone)]
enum DebuffEffect {
    Dot {
        damage_per_tick: i32,
        damage_type: DamageType,
        tick_per: i32,
    },
    VulnerabilityDamageModDebuff {
        damage_type: DamageType,
        damage_mod: f32,
    },
    VulnerabilityFlatDamageDebuff {
        damage_type: DamageType,
        damage: i32,
    },
}

#[derive(Debug)]
struct Activity {
    ability_name: String,
    damage: i32,
    damage_type: DamageType,
    source: ActivitySource,
}

#[derive(Debug, PartialEq, Eq, Hash)]
enum ActivitySource {
    Direct,
    DoT,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SimConfig {
    pub abilities: Vec<String>,
    pub items: Vec<String>,
    pub item_mods: Vec<(String, String)>,
    pub sim_length: i32,
}

pub struct Sim;

impl Sim {
    pub fn run(parser: &Parser, config: &SimConfig) -> String {
        let mut world = World::default();
        let item_mods = parser.calculate_item_mods(&config.items, &config.item_mods);
        // Copy all the warnings to use in the report later (this is necessary because we give ownership to legion as a resouce)
        let mut report_warnings = item_mods.warnings.clone();
        report_warnings.append(&mut item_mods.not_implemented.clone());
        world.push((
            Player,
            PlayerAbilities {
                abilities: config
                    .abilities
                    .iter()
                    .filter_map(|x| Sim::get_player_ability(&parser, &mut report_warnings, x))
                    .collect(),
            },
            Buffs(HashMap::new()),
        ));
        let enemy: Entity =
            world.push((Enemy, Report { activity: vec![] }, Debuffs(HashMap::new())));

        let mut resources = Resources::default();
        resources.insert(item_mods);

        let mut schedule = systems::build_schedule();

        let number_of_ticks = config.sim_length / TICK_LENGTH_IN_SECONDS;
        for _ in 0..number_of_ticks {
            schedule.execute(&mut world, &mut resources);
        }

        // Report
        // entries return `None` if the entity does not exist
        if let Some(entry) = world.entry(enemy) {
            let mut report_text = vec![];
            let report = entry
                .get_component::<Report>()
                .expect("failed to get report for enemy");
            report_text.push(format!("------ SIM -------"));
            let mut total_damage = 0;
            let mut damage_by_source = HashMap::new();
            let mut damage_by_type = HashMap::new();
            for activity in report.activity.iter() {
                // Accumulate total damage
                total_damage += activity.damage;
                // Accumulate damage by source
                (*damage_by_source.entry(&activity.source).or_insert(0)) += activity.damage;
                // Accumulate damage by type
                (*damage_by_type.entry(&activity.damage_type).or_insert(0)) += activity.damage;
                // Print this sim step
                report_text.push(format!(
                    "{:?}: {} for {}",
                    activity.source, activity.ability_name, activity.damage
                ));
            }
            report_text.push(format!("---- END SIM -----"));
            report_text.push(format!("----- NOTES ------"));
            for warning in report_warnings {
                report_text.push(format!("{}", warning));
            }
            report_text.push(format!("--- END NOTES ----"));
            report_text.push(format!("---- SUMMARY -----"));
            report_text.push(format!("Sim length in seconds: {}", config.sim_length));
            report_text.push(format!("DPS by Source:"));
            for (source, damage) in damage_by_source {
                report_text.push(format!("  {:?}: {}", source, damage / number_of_ticks));
            }
            report_text.push(format!("DPS by Type:"));
            for (damage_type, damage) in damage_by_type {
                report_text.push(format!("  {:?}: {}", damage_type, damage / number_of_ticks));
            }
            report_text.push(format!("Total DPS: {}", total_damage / number_of_ticks));
            report_text.push(format!("-- END SUMMARY ---"));
            report_text.join("\n")
        } else {
            "Failed".to_string()
        }
    }

    fn get_player_ability(
        parser: &Parser,
        warnings: &mut Vec<String>,
        ability_name: &str,
    ) -> Option<PlayerAbility> {
        match parser.internal_name_ability_key_map.get(ability_name) {
            Some(ability_key) => {
                match parser.data.abilities.get(ability_key) {
                    Some(ability) => {
                        if ability.skill == "Unknown" {
                            warnings.push(format!(
                                "Ignored ability from Unknown skill: {}",
                                ability_name
                            ));
                            return None;
                        }
                        let damage = match ability.pve.damage {
                            Some(damage) => damage,
                            None => match ability.pve.health_specific_damage {
                                Some(damage) => damage,
                                None => match ability.pve.armor_specific_damage {
                                    Some(damage) => damage,
                                    None => 0,
                                },
                            },
                        };
                        let mut debuffs = vec![];
                        if let Some(ability_dots) = &ability.pve.dots {
                            for dot in ability_dots {
                                let mut duration = dot.duration;
                                let mut num_ticks = dot.num_ticks;
                                if duration == 0 {
                                    // Override duration for thorns style abilities, since the data doesn't quite give us everything we need
                                    // Basically, we turn thorns abilities into dots that last their duration and tick once per second
                                    // This is pretty rudimentary, but works okay in our single target sim
                                    if ability_name.contains("Brambleskin") {
                                        duration = 30;
                                        num_ticks = 30;
                                    } else if ability_name.contains("FireShield") {
                                        duration = 20;
                                        num_ticks = 20;
                                    } else if ability_name.contains("PhoenixStrike") {
                                        duration = 15;
                                        num_ticks = 15;
                                    } else if ability_name.contains("MoltenVeins") {
                                        duration = 10;
                                        num_ticks = 10;
                                    } else if ability_name.contains("PrivacyField") {
                                        duration = 30;
                                        num_ticks = 30;
                                    } else if ability_name.contains("DrinkBlood") {
                                        duration = 1;
                                    } else {
                                        unimplemented!("Unhandled dot with duration = 0");
                                    }
                                }
                                debuffs.push(Debuff {
                                    remaining_duration: duration,
                                    effect: DebuffEffect::Dot {
                                        damage_per_tick: dot.damage_per_tick,
                                        damage_type: dot
                                            .damage_type
                                            .expect("Tried to sim ability with no damage type"),
                                        tick_per: duration / num_ticks,
                                    },
                                });
                            }
                        }
                        // Collect base damage mods
                        let base_damage_attributes =
                            match &ability.pve.attributes_that_mod_base_damage {
                                Some(attributes) => attributes.clone(),
                                None => vec![],
                            };
                        // Collect damage mods (combine mod and delta, because we adjust for it when parsing rather than here)
                        let mut damage_attributes = match &ability.pve.attributes_that_mod_damage {
                            Some(attributes) => attributes.clone(),
                            None => vec![],
                        };
                        damage_attributes.extend(match &ability.pve.attributes_that_delta_damage {
                            Some(attributes) => attributes.clone(),
                            None => vec![],
                        });
                        let keywords;
                        if let Some(ability_keywords) = &ability.keywords {
                            keywords = ability_keywords.clone();
                        } else {
                            keywords = vec![];
                        }
                        Some(PlayerAbility {
                            name: ability.name.clone(),
                            damage,
                            damage_type: ability
                                .damage_type
                                .expect("Tried to sim ability with no damage type"),
                            reset_time: ability.reset_time,
                            buffs: vec![],
                            debuffs,
                            keywords,
                            cooldown: 0.0,
                            icon_id: ability.icon_id,
                            base_damage_attributes,
                            damage_attributes,
                        })
                    }
                    None => {
                        warnings.push(format!(
                            "Failed to find ability by ability key: {}, {}",
                            ability_name, ability_key
                        ));
                        None
                    }
                }
            }
            None => {
                warnings.push(format!(
                    "Failed to find ability by internal name: {}",
                    ability_name
                ));
                None
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::Parser;

    #[test]
    fn basic_sim_works() {
        let parser = Parser::new();
        let mut world = World::default();
        let item_mods = parser.calculate_item_mods(&vec![], &vec![]);
        world.push((
            Player,
            PlayerAbilities {
                abilities: vec![
                    Sim::get_player_ability(&parser, &mut vec![], "SwordSlash7").unwrap(),
                    Sim::get_player_ability(&parser, &mut vec![], "HackingBlade5").unwrap(),
                ],
            },
            Buffs(HashMap::new()),
        ));
        let enemy: Entity =
            world.push((Enemy, Report { activity: vec![] }, Debuffs(HashMap::new())));

        let mut resources = Resources::default();
        resources.insert(item_mods);

        let mut schedule = systems::build_schedule();

        let number_of_ticks = 5;
        for _ in 0..number_of_ticks {
            schedule.execute(&mut world, &mut resources);
        }
        let entry = world.entry(enemy).unwrap();
        let report = entry.get_component::<Report>().unwrap();
        /*
        Order should be:
        1: Used Hacking Blade 5
        2: Used Sword Slash 7
        3: Idle
        4: Used Sword Slash 7
        5: Idle

        Activity should be:
        1: Hacking Blade
        2: Sword Slash
        3: Hacking Blade dot, idle
        4: Sword Slash
        5: Hacking Blade dot, idle
        */
        assert_eq!(report.activity.len(), 5);
        assert_eq!(report.activity[0].damage, 294);
        assert_eq!(report.activity[0].damage_type, DamageType::Slashing);
        assert_eq!(report.activity[1].damage, 133);
        assert_eq!(report.activity[1].damage_type, DamageType::Slashing);
        assert_eq!(report.activity[2].damage, 30);
        assert_eq!(report.activity[2].damage_type, DamageType::Trauma);
        assert_eq!(report.activity[3].damage, 133);
        assert_eq!(report.activity[3].damage_type, DamageType::Slashing);
        assert_eq!(report.activity[4].damage, 30);
        assert_eq!(report.activity[4].damage_type, DamageType::Trauma);
    }

    #[test]
    fn rotskin_sim() {
        let parser = Parser::new();
        let mut world = World::default();
        let item_mods = parser.calculate_item_mods(&vec![], &vec![]);
        world.push((
            Player,
            PlayerAbilities {
                abilities: vec![Sim::get_player_ability(&parser, &mut vec![], "Rotskin8").unwrap()],
            },
            Buffs(HashMap::new()),
        ));
        let enemy: Entity =
            world.push((Enemy, Report { activity: vec![] }, Debuffs(HashMap::new())));

        let mut resources = Resources::default();
        resources.insert(item_mods);

        let mut schedule = systems::build_schedule();

        schedule.execute(&mut world, &mut resources);

        let entry = world.entry(enemy).unwrap();
        let report = entry.get_component::<Report>().unwrap();

        assert_eq!(report.activity.len(), 1);
        assert_eq!(report.activity[0].damage, 339);
        assert_eq!(report.activity[0].damage_type, DamageType::Nature);
    }

    #[test]
    fn every_ability_works_in_sim() {
        // This doesn't test that the ability is right, it just tests that it works in a general sense (doesn't crash the sim)
        let parser = Parser::new();
        for (_, ability) in &parser.data.abilities {
            if ability.skill == "Unknown" {
                continue;
            }
            let mut world = World::default();
            let item_mods = parser.calculate_item_mods(&vec![], &vec![]);
            world.push((
                Player,
                PlayerAbilities {
                    abilities: vec![Sim::get_player_ability(
                        &parser,
                        &mut vec![],
                        &ability.internal_name,
                    )
                    .unwrap()],
                },
                Buffs(HashMap::new()),
            ));
            world.push((Enemy, Report { activity: vec![] }, Debuffs(HashMap::new())));

            let mut resources = Resources::default();
            resources.insert(item_mods);

            let mut schedule = systems::build_schedule();

            let number_of_ticks = 5;
            for _ in 0..number_of_ticks {
                schedule.execute(&mut world, &mut resources);
            }
        }
    }

    #[test]
    fn ability_cooldowns() {
        let parser = Parser::new();
        let mut world = World::default();
        let item_mods = parser.calculate_item_mods(&vec![], &vec![]);
        let test_ability = PlayerAbility {
            name: "Test".to_string(),
            damage: 294,
            damage_type: DamageType::Slashing,
            reset_time: 10.0,
            buffs: vec![],
            debuffs: vec![Debuff {
                remaining_duration: 12,
                effect: DebuffEffect::Dot {
                    damage_per_tick: 30,
                    damage_type: DamageType::Trauma,
                    tick_per: 2,
                },
            }],
            keywords: vec![],
            cooldown: 0.0,
            icon_id: 3024,
            base_damage_attributes: vec![],
            damage_attributes: vec![],
        };
        let player: Entity = world.push((
            Player,
            PlayerAbilities {
                abilities: vec![test_ability],
            },
            Buffs(HashMap::new()),
        ));
        world.push((Enemy, Report { activity: vec![] }, Debuffs(HashMap::new())));

        let mut resources = Resources::default();
        resources.insert(item_mods);

        let mut schedule = systems::build_schedule();

        for _ in 0..9 {
            schedule.execute(&mut world, &mut resources);
        }

        let entry = world.entry(player).unwrap();
        let player_abilities = entry.get_component::<PlayerAbilities>().unwrap();
        assert_eq!(player_abilities.abilities[0].cooldown, 1.0);

        schedule.execute(&mut world, &mut resources);
        let entry = world.entry(player).unwrap();
        let player_abilities = entry.get_component::<PlayerAbilities>().unwrap();
        assert_eq!(player_abilities.abilities[0].cooldown, 0.0);

        schedule.execute(&mut world, &mut resources);
        let entry = world.entry(player).unwrap();
        let player_abilities = entry.get_component::<PlayerAbilities>().unwrap();
        assert_eq!(player_abilities.abilities[0].cooldown, 9.0);
    }

    #[test]
    fn buff_duration() {
        let parser = Parser::new();
        let mut world = World::default();
        let item_mods = parser.calculate_item_mods(
            &vec![],
            &vec![("power_9602".to_string(), "id_1".to_string())],
        );
        let player: Entity = world.push((
            Player,
            PlayerAbilities {
                abilities: vec![
                    Sim::get_player_ability(&parser, &mut vec![], "AdrenalineWave5").unwrap(),
                ],
            },
            Buffs(HashMap::new()),
        ));
        world.push((Enemy, Report { activity: vec![] }, Debuffs(HashMap::new())));

        let mut resources = Resources::default();
        resources.insert(item_mods);

        let mut schedule = systems::build_schedule();

        for _ in 0..20 {
            schedule.execute(&mut world, &mut resources);
        }

        let entry = world.entry(player).unwrap();
        let buffs = entry.get_component::<Buffs>().unwrap();
        assert_eq!(buffs.0.len(), 1);
        assert_eq!(buffs.0["Psi Adrenaline Wave 5"][0].remaining_duration, 1);
    }

    #[test]
    fn buff_damage_type_mod() {
        let parser = Parser::new();
        let mut world = World::default();
        let item_mods = parser.calculate_item_mods(
            &vec![],
            &vec![("power_9602".to_string(), "id_1".to_string())],
        );
        world.push((
            Player,
            PlayerAbilities {
                abilities: vec![
                    Sim::get_player_ability(&parser, &mut vec![], "SwordSlash7").unwrap(),
                    Sim::get_player_ability(&parser, &mut vec![], "AdrenalineWave5").unwrap(),
                ],
            },
            Buffs(HashMap::new()),
        ));
        let enemy: Entity =
            world.push((Enemy, Report { activity: vec![] }, Debuffs(HashMap::new())));

        let mut resources = Resources::default();
        resources.insert(item_mods);

        let mut schedule = systems::build_schedule();

        for _ in 0..3 {
            schedule.execute(&mut world, &mut resources);
        }
        let entry = world.entry(enemy).unwrap();
        let report = entry.get_component::<Report>().unwrap();

        // First SwordSlash7 does normal base damage
        assert_eq!(report.activity[0].damage, 133);
        assert_eq!(report.activity[0].damage_type, DamageType::Slashing);
        // Second SwordSlash7 does buffed damage from the Slashing damage buff from AdrenalineWave5
        assert_eq!(report.activity[2].damage, 136);
        assert_eq!(report.activity[2].damage_type, DamageType::Slashing);
    }

    #[test]
    fn buff_core_attack_damage() {
        let parser = Parser::new();
        let mut world = World::default();
        let item_mods = parser.calculate_item_mods(
            &vec![],
            &vec![("power_4203".to_string(), "id_1".to_string())],
        );
        world.push((
            Player,
            PlayerAbilities {
                abilities: vec![
                    Sim::get_player_ability(&parser, &mut vec![], "PositiveAttitude5").unwrap(),
                    Sim::get_player_ability(&parser, &mut vec![], "StrikeANerve6").unwrap(),
                ],
            },
            Buffs(HashMap::new()),
        ));
        let enemy: Entity =
            world.push((Enemy, Report { activity: vec![] }, Debuffs(HashMap::new())));

        let mut resources = Resources::default();
        resources.insert(item_mods);

        let mut schedule = systems::build_schedule();

        for _ in 0..9 {
            schedule.execute(&mut world, &mut resources);
        }
        let entry = world.entry(enemy).unwrap();
        let report = entry.get_component::<Report>().unwrap();

        // First StrikeANerve6 does normal base damage
        assert_eq!(report.activity[0].damage, 275);
        // Second StrikeANerve6 does buffed damage from the Core Attack damage buff from PositiveAttitude5
        assert_eq!(report.activity[2].damage, 285);
    }

    #[test]
    fn debuff_duration() {
        let parser = Parser::new();
        let mut world = World::default();
        let item_mods = parser.calculate_item_mods(&vec![], &vec![]);
        let test_ability = PlayerAbility {
            name: "Test".to_string(),
            damage: 294,
            damage_type: DamageType::Slashing,
            reset_time: 60.0,
            buffs: vec![],
            debuffs: vec![Debuff {
                remaining_duration: 12,
                effect: DebuffEffect::Dot {
                    damage_per_tick: 30,
                    damage_type: DamageType::Trauma,
                    tick_per: 2,
                },
            }],
            keywords: vec![],
            cooldown: 0.0,
            icon_id: 3024,
            base_damage_attributes: vec![],
            damage_attributes: vec![],
        };
        world.push((
            Player,
            PlayerAbilities {
                abilities: vec![test_ability],
            },
            Buffs(HashMap::new()),
        ));
        let enemy: Entity =
            world.push((Enemy, Report { activity: vec![] }, Debuffs(HashMap::new())));

        let mut resources = Resources::default();
        resources.insert(item_mods);

        let mut schedule = systems::build_schedule();

        for _ in 0..12 {
            schedule.execute(&mut world, &mut resources);
        }

        let entry = world.entry(enemy).unwrap();
        let debuffs = entry.get_component::<Debuffs>().unwrap();
        assert_eq!(debuffs.0.len(), 1);
        assert_eq!(debuffs.0["Test"][0].remaining_duration, 1);

        schedule.execute(&mut world, &mut resources);
        let entry = world.entry(enemy).unwrap();
        let debuffs = entry.get_component::<Debuffs>().unwrap();
        assert_eq!(debuffs.0.len(), 0);
    }

    #[test]
    fn debuff_duration_resets() {
        let parser = Parser::new();
        let mut world = World::default();
        let item_mods = parser.calculate_item_mods(&vec![], &vec![]);
        let test_ability = PlayerAbility {
            name: "Test".to_string(),
            damage: 294,
            damage_type: DamageType::Slashing,
            reset_time: 3.0,
            buffs: vec![],
            debuffs: vec![Debuff {
                remaining_duration: 12,
                effect: DebuffEffect::Dot {
                    damage_per_tick: 30,
                    damage_type: DamageType::Trauma,
                    tick_per: 2,
                },
            }],
            keywords: vec![],
            cooldown: 0.0,
            icon_id: 3024,
            base_damage_attributes: vec![],
            damage_attributes: vec![],
        };
        world.push((
            Player,
            PlayerAbilities {
                abilities: vec![test_ability],
            },
            Buffs(HashMap::new()),
        ));
        let enemy: Entity =
            world.push((Enemy, Report { activity: vec![] }, Debuffs(HashMap::new())));

        let mut resources = Resources::default();
        resources.insert(item_mods);

        let mut schedule = systems::build_schedule();

        schedule.execute(&mut world, &mut resources);
        let entry = world.entry(enemy).unwrap();
        let debuffs = entry.get_component::<Debuffs>().unwrap();
        assert_eq!(debuffs.0["Test"][0].remaining_duration, 12);
        schedule.execute(&mut world, &mut resources);
        let entry = world.entry(enemy).unwrap();
        let debuffs = entry.get_component::<Debuffs>().unwrap();
        assert_eq!(debuffs.0["Test"][0].remaining_duration, 11);
        schedule.execute(&mut world, &mut resources);
        let entry = world.entry(enemy).unwrap();
        let debuffs = entry.get_component::<Debuffs>().unwrap();
        assert_eq!(debuffs.0["Test"][0].remaining_duration, 10);
        schedule.execute(&mut world, &mut resources);
        let entry = world.entry(enemy).unwrap();
        let debuffs = entry.get_component::<Debuffs>().unwrap();
        assert_eq!(debuffs.0["Test"][0].remaining_duration, 12);
    }

    #[test]
    fn debuff_vulnerability_mod() {
        let parser = Parser::new();
        let mut world = World::default();
        let item_mods = parser.calculate_item_mods(
            &vec![],
            &vec![("power_8003".to_string(), "id_1".to_string())],
        );
        world.push((
            Player,
            PlayerAbilities {
                abilities: vec![
                    Sim::get_player_ability(&parser, &mut vec![], "SparkOfDeath7").unwrap(),
                ],
            },
            Buffs(HashMap::new()),
        ));
        let enemy: Entity =
            world.push((Enemy, Report { activity: vec![] }, Debuffs(HashMap::new())));

        let mut resources = Resources::default();
        resources.insert(item_mods);

        let mut schedule = systems::build_schedule();

        for _ in 0..9 {
            schedule.execute(&mut world, &mut resources);
        }
        let entry = world.entry(enemy).unwrap();
        let report = entry.get_component::<Report>().unwrap();

        // First SparkOfDeath7 does normal base damage
        assert_eq!(report.activity[0].damage, 246);
        assert_eq!(report.activity[0].damage_type, DamageType::Electricity);
        // Second SparkOfDeath7 does buffed damage from the vulnerability applied by SparkOfDeath7
        assert_eq!(report.activity[5].damage, 271);
        assert_eq!(report.activity[5].damage_type, DamageType::Electricity);
    }
}
