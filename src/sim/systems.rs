use legion::{world::SubWorld, *};

use super::{
    Activity, ActivitySource, Debuffs, Debuff, DebuffEffect, Enemy, Player, PlayerAbilities, PlayerAbility, Report,
    TICK_LENGTH_IN_SECONDS,
};
use crate::parser::{data::DamageType, ItemEffect, ItemMods};

pub fn build_schedule() -> Schedule {
    Schedule::builder()
        .add_system(tick_debuffs_system())
        .add_system(use_ability_system())
        .add_system(cooldown_system())
        .build()
}

#[system(for_each)]
fn tick_debuffs(report: &mut Report, debuffs: &mut Debuffs) {
    for (ability_name, debuffs) in &mut debuffs.0 {
        for debuff in debuffs {
            // Reduce remaining duration on the debuff
            debuff.remaining_duration -= TICK_LENGTH_IN_SECONDS;
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
                }
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
    #[resource] item_mods: &ItemMods,
) {
    // Find best ability to use
    let mut max_potential_power = 0;
    let mut max_index = None;
    for (index, player_ability) in player_abilities.abilities.iter().enumerate() {
        if player_ability.cooldown == 0.0 {
            let (calculated_damage, calculated_damage_type, calculated_debuffs) = calculate_ability(player_ability, item_mods);
            let debuff_power = calculated_debuffs.iter().fold(0, |acc, debuff| {
                acc + match debuff.effect {
                    DebuffEffect::Dot { damage_per_tick, damage_type: _, tick_per } => damage_per_tick * (debuff.remaining_duration / tick_per),
                }
            });
            let potential_power = calculated_damage + debuff_power;
            if potential_power > max_potential_power {
                max_potential_power = potential_power;
                max_index = Some(index);
            }
        }
    }
    if let Some(max_index) = max_index {
        let player_ability = &mut player_abilities.abilities[max_index];
        // Query enemy components
        let mut enemy_query = <(&Enemy, &mut Report, &mut Debuffs)>::query();
        let (_, report, debuffs) = enemy_query
            .iter_mut(world)
            .next()
            .expect("failed to get target");
        // Add item mods to damage calc
        // TODO: We could cache this value from our above loop to find the best one, but it's a bit more complicated (faster though)
        let (calculated_damage, calculated_damage_type, calculated_debuffs) = calculate_ability(player_ability, item_mods);
        // Add debuffs, if any
        if !calculated_debuffs.is_empty() {
            debuffs.0.insert(player_ability.name.clone(), calculated_debuffs);
        }
        // Add to report
        report.activity.push(Activity {
            ability_name: player_ability.name.clone(),
            damage: calculated_damage,
            damage_type: calculated_damage_type,
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
) -> (i32, DamageType, Vec<Debuff>) {
    // Add item mods to damage calc
    let mut calculated_damage_type = player_ability.damage_type;
    let mut calculated_debuffs = player_ability.debuffs.clone();
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

    (calculated_damage, calculated_damage_type, calculated_debuffs)
}