use std::collections::HashMap;
use legion::{world::SubWorld, *};
use rand::prelude::*;

use super::{
    Activity, ActivitySource, Debuffs, Debuff, DebuffEffect, Buffs, Buff, BuffEffect, Enemy, Player, PlayerAbilities, PlayerAbility, Report,
    TICK_LENGTH_IN_SECONDS,
};
use crate::parser::{data::DamageType, ItemEffect, ItemMods};

pub fn build_schedule() -> Schedule {
    Schedule::builder()
        .add_system(tick_buffs_system())
        .add_system(tick_debuffs_system())
        .add_system(use_ability_system())
        .add_system(cooldown_system())
        .build()
}

#[system(for_each)]
fn tick_buffs(buffs: &mut Buffs) {
    for (_, buffs) in &mut buffs.0 {
        for buff in buffs {
            // Reduce remaining duration on the debuff
            buff.remaining_duration -= TICK_LENGTH_IN_SECONDS;
        }
    }
    // Remove expired buffs
    buffs.0.retain(|_, buffs| {
        // Remove any buffs with no remaining duration
        buffs.retain(|buff| buff.remaining_duration != 0);
        buffs.len() != 0
    });
}

#[system(for_each)]
fn tick_debuffs(report: &mut Report, debuffs: &mut Debuffs) {
    for (ability_name, debuffs) in &mut debuffs.0 {
        for debuff in debuffs {
            // Reduce remaining duration on the debuff
            debuff.remaining_duration -= TICK_LENGTH_IN_SECONDS;
            // Handle any per-tick effects (mostly just dots need this)
            match debuff.effect {
                DebuffEffect::Dot { damage_per_tick, damage_type, tick_per } => {
                    // It's time to deal dot damage
                    if debuff.remaining_duration % tick_per == 0 {
                        report.activity.push(Activity {
                            ability_name: ability_name.clone(),
                            damage: damage_per_tick,
                            damage_type: damage_type,
                            source: ActivitySource::DoT,
                        });
                    }
                },
                _ => (),
            };
        }
    }
    // Remove expired debuffs
    debuffs.0.retain(|_, debuffs| {
        // Remove any debuffs with no remaining duration
        debuffs.retain(|debuff| debuff.remaining_duration != 0);
        debuffs.len() != 0
    });
}

#[system(for_each)]
#[read_component(Enemy)]
#[write_component(Report)]
#[write_component(Debuffs)]
fn use_ability(
    world: &mut SubWorld,
    _player: &Player,
    player_abilities: &mut PlayerAbilities,
    buffs: &mut Buffs,
    #[resource] item_mods: &ItemMods,
) {
    // Query enemy components
    let mut enemy_query = <(&Enemy, &mut Report, &mut Debuffs)>::query();
    let (_, report, enemy_debuffs) = enemy_query
        .iter_mut(world)
        .next()
        .expect("failed to get target");
    // Calculate current buff (on the player) and debuff (on the enemy) damage mods
    let mut current_damage_type_buffs_to_damage_mod: HashMap<DamageType, f32> = HashMap::new();
    for (_, buffs) in &buffs.0 {
        for buff in buffs {
            match buff.effect {
                BuffEffect::DamageTypeBuff { damage_mod, damage_type } => {
                    current_damage_type_buffs_to_damage_mod.insert(damage_type, damage_mod);
                }
            }
        }
    }
    let mut current_damage_type_vulnerabilities_to_damage_mod: HashMap<DamageType, f32> = HashMap::new();
    for (_, debuffs) in &enemy_debuffs.0 {
        for debuff in debuffs {
            match debuff.effect {
                DebuffEffect::VulnerabilityDebuff { damage_mod, damage_type } => {
                    current_damage_type_vulnerabilities_to_damage_mod.insert(damage_type, damage_mod);
                },
                // We only care about vulnerability
                _ => (),
            }
        }
    }
    // Find best ability to use
    let mut max_potential_power = 0;
    let mut max_index = None;
    let mut max_calculated_damage = None;
    let mut max_calculated_damage_type = None;
    let mut max_calculated_buffs = None;
    let mut max_calculated_debuffs = None;
    for (index, player_ability) in player_abilities.abilities.iter().enumerate() {
        if player_ability.cooldown == 0.0 {
            // Get damage mods from current buffs
            let mut current_buff_damage_mod = 0.0;
            if let Some(damage_mod) = current_damage_type_buffs_to_damage_mod.get(&player_ability.damage_type) {
                current_buff_damage_mod += damage_mod;
            }
            // Get damage mods from enemy debuffs
            let mut current_vulnerability_damage_mod = 0.0;
            if let Some(damage_mod) = current_damage_type_vulnerabilities_to_damage_mod.get(&player_ability.damage_type) {
                current_vulnerability_damage_mod += damage_mod;
            }
            // Calculate damage
            let (calculated_damage, calculated_damage_type, calculated_buffs, calculated_debuffs) = calculate_ability(player_ability, item_mods, current_buff_damage_mod, current_vulnerability_damage_mod);
            let buff_power = calculated_buffs.iter().fold(0, |acc, debuff| {
                acc + match debuff.effect {
                    // Very basic attempt at calculating the power of these kind of buffs
                    BuffEffect::DamageTypeBuff { damage_mod, damage_type: _ } => (damage_mod * 100.0) as i32
                }
            });
            let debuff_power = calculated_debuffs.iter().fold(0, |acc, debuff| {
                acc + match debuff.effect {
                    DebuffEffect::Dot { damage_per_tick, damage_type: _, tick_per } => damage_per_tick * (debuff.remaining_duration / tick_per),
                    // Very basic attempt at calculating the power of these kind of debuffs
                    DebuffEffect::VulnerabilityDebuff { damage_mod, damage_type: _ } => (damage_mod * 100.0) as i32
                }
            });
            let potential_power = calculated_damage + buff_power + debuff_power;
            if potential_power > max_potential_power {
                max_potential_power = potential_power;
                max_index = Some(index);
                max_calculated_damage = Some(calculated_damage);
                max_calculated_damage_type = Some(calculated_damage_type);
                max_calculated_buffs = Some(calculated_buffs);
                max_calculated_debuffs = Some(calculated_debuffs);
            }
        }
    }
    if let Some(max_index) = max_index {
        let player_ability = &mut player_abilities.abilities[max_index];
        // Add buffs, if any
        let max_calculated_buffs = max_calculated_buffs.expect("selected ability value was None");
        if !max_calculated_buffs.is_empty() {
            buffs.0.insert(player_ability.name.clone(), max_calculated_buffs);
        }
        // Add debuffs, if any
        let max_calculated_debuffs = max_calculated_debuffs.expect("selected ability value was None");
        if !max_calculated_debuffs.is_empty() {
            enemy_debuffs.0.insert(player_ability.name.clone(), max_calculated_debuffs);
        }
        // Add to report
        report.activity.push(Activity {
            ability_name: player_ability.name.clone(),
            damage: max_calculated_damage.expect("selected ability value was None"),
            damage_type: max_calculated_damage_type.expect("selected ability value was None"),
            source: ActivitySource::Direct,
        });
        // Set cooldown
        player_ability.cooldown = player_ability.reset_time;
    }
}

#[system(for_each)]
fn cooldown(player_abilities: &mut PlayerAbilities) {
    for player_ability in player_abilities.abilities.iter_mut() {
        player_ability.cooldown -= TICK_LENGTH_IN_SECONDS as f32;
        // If cooldown is less than 0, set it to 0
        player_ability.cooldown = player_ability.cooldown.max(0.0);
    }
}

fn calculate_ability(
    player_ability: &PlayerAbility,
    item_mods: &ItemMods,
    current_buff_damage_mod: f32,
    current_vulnerability_damage_mod: f32,
) -> (i32, DamageType, Vec<Buff>, Vec<Debuff>) {
    // Add item mods to damage calc
    let mut calculated_damage_type = player_ability.damage_type;
    let mut calculated_buffs = vec![];
    let mut calculated_debuffs = player_ability.debuffs.clone();
    let mut dot_flat_damage = 0;
    let mut flat_damage = 0;
    let mut damage_mod = 0.0;
    let mut base_damage_mod = 0.0;
    // Main calc: ((ability_base_damage+flat_damage)*(1+damage_mod)*(1+target_weakness))+(ability_base_damage*base_damage_multiplier)
    // Icon ID mods
    if let Some(effects) = item_mods.icon_id_effects.get(&player_ability.icon_id) {
        for effect in effects {
            match effect {
                ItemEffect::FlatDamage(value) => flat_damage += value,
                ItemEffect::DamageMod(value) => damage_mod += value,
                ItemEffect::DotDamage(value) => dot_flat_damage += value,
                ItemEffect::DamageType(damage_type) => calculated_damage_type = *damage_type,
                ItemEffect::RestoreHealth(_) => (), // TODO: Handle
                ItemEffect::RestoreArmor(_) => (), // TODO: Handle
                ItemEffect::RestorePower(_) => (), // TODO: Handle
                ItemEffect::ProcFlatDamage { damage, chance } => {
                    // Roll proc and add damage if we succeeded
                    if thread_rng().gen::<f32>() > *chance {
                        flat_damage += damage;
                    }
                },
                ItemEffect::ProcDamageMod { damage_mod: proc_damage_mod, chance } => {
                    // Roll proc and add damage mod if we succeeded
                    if thread_rng().gen::<f32>() > *chance {
                        damage_mod += proc_damage_mod;
                    }
                },
                ItemEffect::DamageTypeBuff { damage_type, damage_mod, duration } => {
                    calculated_buffs.push(Buff {
                        remaining_duration: *duration,
                        effect: BuffEffect::DamageTypeBuff {
                            damage_type: *damage_type,
                            damage_mod: *damage_mod,
                        },
                    });
                }
                ItemEffect::VulnerabilityDebuff { damage_type, damage_mod, duration } => {
                    calculated_debuffs.push(Debuff {
                        remaining_duration: *duration,
                        effect: DebuffEffect::VulnerabilityDebuff {
                            damage_type: *damage_type,
                            damage_mod: *damage_mod,
                        },
                    });
                }
            }
        }
    }
    // Base damage mods
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
    // Damage mods
    for attribute in &player_ability.damage_attributes {
        if let Some(effects) = item_mods.attribute_effects.get(attribute) {
            for effect in effects {
                match effect {
                    ItemEffect::FlatDamage(value) => flat_damage += value,
                    ItemEffect::DamageMod(value) => damage_mod += value,
                    _ => panic!("Found non-FlatDamage or DamageMod effect in damage_attributes, this shouldn't happen"),
                }
            }
        }
    }
    // Damage type mods
    if let Some(effects) = item_mods.attribute_effects.get(&format!("BOOST_{:?}", player_ability.damage_type).to_uppercase()) {
        for effect in effects {
            match effect {
                ItemEffect::FlatDamage(value) => flat_damage += value,
                _ => panic!("Found non-FlatDamage effect in damage type boost, this shouldn't happen"),
            }
        }
    }
    if let Some(effects) = item_mods.attribute_effects.get(&format!("MOD_{:?}", player_ability.damage_type).to_uppercase()) {
        for effect in effects {
            match effect {
                ItemEffect::DamageMod(value) => damage_mod += value,
                _ => panic!("Found non-DamageMod effect in damage type mod, this shouldn't happen"),
            }
        }
    }
    // Apply damage mods to dots
    for debuff in &mut calculated_debuffs {
        match debuff.effect {
            DebuffEffect::Dot { ref mut damage_per_tick, damage_type, tick_per: _ } => {
                // Find dot damage modifiers based on the damage type of the dot
                let mut dot_damage_mod = 0.0;
                if let Some(effects) = item_mods.attribute_effects.get(&format!("MOD_{:?}_INDIRECT", damage_type).to_uppercase()) {
                    for effect in effects {
                        match effect {
                            ItemEffect::DamageMod(value) => dot_damage_mod += value,
                            _ => panic!("Found non-DamageMod effect in indirect damage type mod, this shouldn't happen"),
                        }
                    }
                }
                *damage_per_tick = ((*damage_per_tick + dot_flat_damage) as f32 * (1.0 + dot_damage_mod)) as i32;
            },
            // We only care about damaging dot debuffs
            _ => (),
        };
    }
    // Calculate damage
    let calculated_damage = (((player_ability.damage + flat_damage) as f32
        * (1.0 + current_buff_damage_mod + damage_mod)
        * (1.0 + current_vulnerability_damage_mod))
        + (player_ability.damage as f32 * base_damage_mod))
        .round() as i32;

    (calculated_damage, calculated_damage_type, calculated_buffs, calculated_debuffs)
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::Sim;
    use crate::parser::Parser;

    #[test]
    fn calculate_ability_matches_ingame() {
        let parser = Parser::new();
        let player_ability = Sim::get_player_ability(&parser, &mut vec![], "Slice6").unwrap();

        let item_mods = parser.calculate_item_mods(&vec![], &vec![]);
        let (calculated_damage, _, _, calculated_debuffs) = calculate_ability(&player_ability, &item_mods, 0.0, 0.0);
        assert_eq!(calculated_damage, 189);
        match calculated_debuffs[0].effect {
            DebuffEffect::Dot { damage_per_tick, damage_type, tick_per } => {
                assert_eq!(damage_per_tick, 0);
                assert_eq!(damage_type, DamageType::Poison);
                assert_eq!(tick_per, 2);
            },
            _ => ()
        };

        let item_mods = parser.calculate_item_mods(
            &vec![
                // Elven Dirk
                "item_45712".to_string(),
            ],
            &vec![
                // Knife Base Damage +30%
                ("power_16001".to_string(), "id_6".to_string()),
                // Slice deals 85 Poison damage over 10 seconds
                ("power_16061".to_string(), "id_9".to_string()),
                // Knife Base Damage +25%
                ("power_16001".to_string(), "id_5".to_string()),
                // Indirect Poison/Trauma Damage +36%
                ("power_16003".to_string(), "id_12".to_string()),
                // Slice Damage +24%
                ("power_16101".to_string(), "id_10".to_string()),
            ],
        );
        let (calculated_damage, _, _, calculated_debuffs) = calculate_ability(&player_ability, &item_mods, 0.0, 0.0);
        assert_eq!(calculated_damage, 362);
        match calculated_debuffs[0].effect {
            DebuffEffect::Dot { damage_per_tick, damage_type, tick_per } => {
                assert_eq!(damage_per_tick, 115);
                assert_eq!(damage_type, DamageType::Poison);
                assert_eq!(tick_per, 2);
            },
            _ => ()
        };
    }
}