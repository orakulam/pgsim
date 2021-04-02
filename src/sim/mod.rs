use legion::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::parser::{data::DamageType, ItemEffect, ItemMods, Parser};

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
    dots: Vec<Dot>,
    potential_power: i32,
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
struct Dots {
    dots_by_ability_name: HashMap<String, Vec<Dot>>,
}

#[derive(Debug, Clone)]
struct Dot {
    damage_per_tick: i32,
    damage_type: DamageType,
    tick_per: i32,
    next_tick_in: i32,
    ticks_remaining: i32,
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
        // Copy all the warnings to use in the report later
        // TODO: Probably some way to avoid a copy here, but meh
        let mut report_warnings = item_mods.warnings.clone();
        report_warnings.append(&mut item_mods.ignored.clone());
        report_warnings.append(&mut item_mods.not_implemented.clone());
        world.push((
            Player,
            PlayerAbilities {
                abilities: config
                    .abilities
                    .iter()
                    .filter_map(|x| Sim::get_player_ability(&parser, &item_mods, &mut report_warnings, x))
                    .collect(),
            },
        ));
        let enemy: Entity = world.push((
            Enemy,
            Report { activity: vec![] },
            Dots {
                dots_by_ability_name: HashMap::new(),
            },
        ));

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
        item_mods: &ItemMods,
        warnings: &mut Vec<String>,
        ability_name: &str,
    ) -> Option<PlayerAbility> {
        // TODO: Better error messages, mention skill and ability names
        match parser.internal_name_ability_key_map.get(ability_name) {
            Some(ability_key) => {
                match parser.data.abilities.get(ability_key) {
                    Some(ability) => {
                        let damage = match ability.pve.damage {
                            Some(damage) => damage,
                            None => 0,
                        };
                        let mut dots = vec![];
                        if let Some(ability_dots) = &ability.pve.dots {
                            for dot in ability_dots {
                                dots.push(Dot {
                                    damage_per_tick: dot.damage_per_tick,
                                    damage_type: dot
                                        .damage_type
                                        .expect("Tried to sim ability with no damage type"),
                                    tick_per: dot.duration / dot.num_ticks,
                                    next_tick_in: dot.duration / dot.num_ticks,
                                    ticks_remaining: dot.num_ticks,
                                });
                            }
                        }
                        // Collect base damage mods
                        let base_damage_attributes = match &ability.pve.attributes_that_mod_base_damage {
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
                        // TODO: Also calculate healing, power restore potential in potential_power
                        // TODO: I don't love the overall flow here (creating a PlayerAbility first, then modifying it, feels open to bugs later)
                        let mut player_ability = PlayerAbility {
                            name: ability.name.clone(),
                            damage,
                            damage_type: ability
                                .damage_type
                                .expect("Tried to sim ability with no damage type"),
                            reset_time: ability.reset_time,
                            dots,
                            potential_power: 0,
                            cooldown: 0.0,
                            icon_id: ability.icon_id,
                            base_damage_attributes,
                            damage_attributes,
                        };
                        let (calculated_damage, _, calculated_dots) =
                            Sim::calculate_damage(&player_ability, item_mods);
                        let mut calculated_total_dot_damage = 0;
                        for dot in calculated_dots {
                            calculated_total_dot_damage += dot.damage_per_tick * dot.ticks_remaining;
                        }
                        player_ability.potential_power = calculated_damage + calculated_total_dot_damage;
                        Some(player_ability)
                    },
                    None => {
                        warnings.push(format!("Failed to find ability by ability key: {}, {}", ability_name, ability_key));
                        None
                    },
                }
            },
            None => {
                warnings.push(format!("Failed to find ability by internal name: {}", ability_name));
                None
            },
        }
    }

    fn calculate_damage(
        player_ability: &PlayerAbility,
        item_mods: &ItemMods,
    ) -> (i32, DamageType, Vec<Dot>) {
        // Add item mods to damage calc
        let mut calculated_damage_type = player_ability.damage_type;
        let mut calculated_dots = player_ability.dots.clone();
        let mut flat_damage = 0;
        let mut damage_mod = 0.0;
        let mut base_damage_mod = 0.0;
        // Main calc: ((ability_base_damage+flat_damage)*(1+damage_mod)*(1+target_weakness))+(ability_base_damage*base_damage_multiplier)
        // TODO: Lots to finish here, and handle dot mods, other types like cooldown reduction, etc.
        if let Some(effects) = item_mods.icon_id_effects.get(&player_ability.icon_id) {
            for effect in effects {
                match effect {
                    ItemEffect::FlatDamage(value) => flat_damage += value,
                    ItemEffect::DamageMod(value) => damage_mod += value,
                    _ => (), // TODO: Handle these
                }
            }
        }
        for attribute in &player_ability.base_damage_attributes {
            if let Some(effects) = item_mods.attribute_effects.get(attribute) {
                for effect in effects {
                    match effect {
                        ItemEffect::DamageMod(value) => base_damage_mod += value,
                        _ => panic!("Found non-DamageMod effect in base_damage_attributes, this shouldn't happen"),
                    }
                }
            }
        }
        for attribute in &player_ability.damage_attributes {
            if let Some(effects) = item_mods.attribute_effects.get(attribute) {
                for effect in effects {
                    match effect {
                        ItemEffect::DamageMod(value) => damage_mod += value,
                        _ => panic!("Found non-DamageMod effect in damage_attributes, this shouldn't happen"),
                    }
                }
            }
        }
        // TODO: Get real weakness value
        let target_weakness = 0.0;
        let calculated_damage = (((player_ability.damage + flat_damage) as f32
            * (1.0 + damage_mod)
            * (1.0 + target_weakness))
            + (player_ability.damage as f32 * base_damage_mod))
            .round() as i32;

        (calculated_damage, calculated_damage_type, calculated_dots)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn basic_sim_works() {
        let parser = super::super::parser::Parser::new();
        let mut world = World::default();
        let item_mods = parser.calculate_item_mods(&vec![], &vec![]);
        world.push((
            Player,
            PlayerAbilities {
                abilities: vec![
                    Sim::get_player_ability(&parser, &item_mods, &mut vec![], "SwordSlash7").unwrap(),
                    Sim::get_player_ability(&parser, &item_mods, &mut vec![], "HackingBlade5").unwrap(),
                ],
            },
        ));
        let enemy: Entity = world.push((
            Enemy,
            Report { activity: vec![] },
            Dots {
                dots_by_ability_name: HashMap::new(),
            },
        ));

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
}
