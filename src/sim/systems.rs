use legion::{world::SubWorld, *};

use super::{
    Activity, ActivitySource, Dots, Enemy, Player, PlayerAbilities, Report, Sim,
    TICK_LENGTH_IN_SECONDS,
};
use crate::parser::ItemMods;

pub fn build_schedule() -> Schedule {
    Schedule::builder()
        .add_system(tick_dots_system())
        .add_system(use_ability_system())
        .add_system(cooldown_system())
        .build()
}

#[system(for_each)]
fn tick_dots(report: &mut Report, dots: &mut Dots) {
    for (ability_name, dots) in &mut dots.dots_by_ability_name {
        for dot in dots {
            // Progress dot timer
            dot.next_tick_in -= TICK_LENGTH_IN_SECONDS;
            if dot.next_tick_in < 0 {
                panic!(format!("next_tick_in is less than 0, which means we're missing time, likely need to adjust TICK_LENGTH_IN_SECONDS: ability_name = {}, dot = {:#?}", ability_name, dot));
            } else if dot.next_tick_in == 0 {
                // Dot should tick now, add to report
                report.activity.push(Activity {
                    ability_name: ability_name.clone(),
                    damage: dot.damage_per_tick,
                    damage_type: dot.damage_type,
                    source: ActivitySource::DoT,
                });
                // Reduce remaining ticks and set timer
                dot.ticks_remaining -= 1;
                dot.next_tick_in = dot.tick_per;
            }
        }
    }
    // Remove any ability name keys with no remaining dots in the vec
    dots.dots_by_ability_name.retain(|_, dots| {
        // Remove any dots with no remaining ticks
        dots.retain(|dot| dot.ticks_remaining != 0);
        dots.len() != 0
    });
}

#[system(for_each)]
#[read_component(Enemy)]
#[write_component(Report)]
#[write_component(Dots)]
fn use_ability(
    world: &mut SubWorld,
    _player: &Player,
    player_abilities: &mut PlayerAbilities,
    #[resource] item_mods: &ItemMods,
) {
    // println!("item_mods {:#?}", item_mods);
    // Find ability to use
    let player_ability = player_abilities
        .abilities
        .iter_mut()
        .filter(|x| x.cooldown == 0.0)
        .max_by_key(|x| x.potential_power);
    if let Some(player_ability) = player_ability {
        // Query enemy components
        let mut enemy_query = <(&Enemy, &mut Report, &mut Dots)>::query();
        let (_, report, dots) = enemy_query
            .iter_mut(world)
            .next()
            .expect("failed to get target");
        // Add item mods to damage calc
        let (calculated_damage, calculated_damage_type, calculated_dots) =
            Sim::calculate_damage(player_ability, item_mods);
        // Add dots, if any
        if !player_ability.dots.is_empty() {
            // This intentionally overwrites whatever was at this key before, because the Dot should be overwritten and refreshed
            dots.dots_by_ability_name
                .insert(player_ability.name.clone(), calculated_dots);
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
