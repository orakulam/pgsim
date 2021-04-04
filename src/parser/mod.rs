use regex::Regex;
use std::collections::HashMap;
use std::str::FromStr;

pub mod data;
use data::DamageType;
use data::Data;

#[derive(Debug, PartialEq, PartialOrd, Clone)]
pub enum ItemEffect {
    FlatDamage(i32),
    ProcFlatDamage {
        damage: i32,
        chance: f32,
    },
    DamageMod(f32),
    ProcDamageMod {
        damage_mod: f32,
        chance: f32,
    },
    DotDamage(i32),
    RestoreHealth(i32),
    RestoreArmor(i32),
    RestorePower(i32),
    DamageType(DamageType),
    DamageTypeBuff {
        damage_type: DamageType,
        damage_mod: f32,
        duration: i32,
    },
}

#[derive(Debug, Clone)]
pub struct ItemMods {
    pub icon_id_effects: HashMap<i32, Vec<ItemEffect>>,
    pub attribute_effects: HashMap<String, Vec<ItemEffect>>,
    pub warnings: Vec<String>,
    pub ignored: Vec<String>,
    pub not_implemented: Vec<String>,
}

struct ParserRegex {
    icon_ids: Regex,
    attribute_effects: Regex,
    flat_damage: Regex,
    proc_flat_damage: Regex,
    damage_mod: Regex,
    proc_damage_mod: Regex,
    dot_damage: Regex,
    restore_health: Regex,
    restore_armor: Regex,
    restore_power: Regex,
    damage_type: Regex,
    racials: Regex,
    damage_type_buff: Regex,
}

pub struct Parser {
    pub data: Data,
    pub internal_name_ability_key_map: HashMap<String, String>,
    regex: ParserRegex,
}

impl Parser {
    pub fn new() -> Parser {
        let data = Data::load();

        let mut internal_name_ability_key_map = HashMap::new();
        for (ability_key, ability) in &data.abilities {
            internal_name_ability_key_map
                .insert(ability.internal_name.clone(), ability_key.clone());
        }

        Parser {
            data,
            internal_name_ability_key_map,
            regex: Parser::get_parser_regex(),
        }
    }

    fn get_parser_regex() -> ParserRegex {
        // Regexes (it's important to declare these once for performance, so we do it when the parser is loaded)
        //Slashing damage +2% for 20 seconds
        ParserRegex {
            icon_ids: Regex::new(r"<icon=([0-9]+)>").unwrap(),
            attribute_effects: Regex::new(
                r"\{(?P<attribute>[_A-Z]*)\}\{(?P<mod>[+-]?[0-9]*[.]?[0-9]+)\}(?P<extra>$|\{[a-zA-Z]*\})",
            )
            .unwrap(),
            flat_damage: Regex::new(r"(?:deal|deals|[dD]amage) \+?(?P<damage>[0-9]+) ?(?:$|\.|damage|armor damage)").unwrap(),
            proc_flat_damage:  Regex::new(r"(?P<chance>[0-9]+)% chance to deal \+(?P<damage>[0-9]+) damage").unwrap(),
            damage_mod: Regex::new(r"(?:deals|[dD]amage) \+?(?P<damage>[0-9]+)% ?(?:$|damage|and)").unwrap(),
            proc_damage_mod:  Regex::new(r"(?P<chance>[0-9]+)% chance to deal \+(?P<damage>[0-9]+)% damage").unwrap(),
            dot_damage:
                Regex::new(r"(?:deal|deals|deals an additional) \+?(?P<damage>[0-9]+).*damage over")
                    .unwrap(),
            restore_health:
                Regex::new(r"(?:restore|restores|heals|heals you for) \+?(?P<restore>[0-9]+) [hH]ealth")
                    .unwrap(),
            restore_armor:
                Regex::new(r"(?:restore|restores) \+?(?P<restore>[0-9]+) [aA]rmor").unwrap(),
            restore_power:
                Regex::new(r"(?:restore|restores) \+?(?P<restore>[0-9]+) [pP]ower").unwrap(),
            damage_type: Regex::new(r"[dD]amage(?:| type) becomes (?P<damage_type>[a-zA-Z]*)").unwrap(),
            racials: Regex::new(r"(?:Humans|Orcs|Elves|Dwarves|Rakshasa) gain \+?(?:[0-9]+) Max (?:Health|Hydration|Metabolism|Power|Armor|Bodyheat)").unwrap(),
            damage_type_buff: Regex::new(r"(?P<damage_type>Slashing) damage \+(?P<damage_mod>[0-9]+)% for (?P<duration>[0-9]+) seconds").unwrap(),
        }
    }

    // TODO: Clean up unwraps in this series of functions
    pub fn calculate_item_mods(
        &self,
        equipped_items: &Vec<String>,
        equipped_mods: &Vec<(String, String)>,
    ) -> ItemMods {
        let mut item_mods = ItemMods {
            icon_id_effects: HashMap::new(),
            attribute_effects: HashMap::new(),
            warnings: vec![],
            ignored: vec![],
            not_implemented: vec![],
        };

        for item_id in equipped_items {
            match self.data.items.get(item_id) {
                Some(item) => {
                    if let Some(effect_descs) = &item.effect_descs {
                        for effect_desc in effect_descs {
                            // Explicitly ignored mods
                            if self.is_explicitly_ignored(effect_desc) {
                                item_mods
                                    .ignored
                                    .push(format!("Ignored base item mod: {}", effect_desc));
                                continue;
                            }
                            if self.regex.attribute_effects.is_match(effect_desc) {
                                self.calculate_attribute_effect_desc(&mut item_mods, effect_desc);
                            } else {
                                item_mods.not_implemented.push(format!(
                                    "Unknown type of effect desc on base item: {}",
                                    effect_desc
                                ));
                            }
                        }
                    }
                }
                None => item_mods
                    .warnings
                    .push(format!("Tried to use invalid item ID: {}", item_id)),
            };
        }

        for (item_mod_id, tier_id) in equipped_mods {
            match self.data.item_mods.get(item_mod_id) {
                Some(item_mod) => {
                    match item_mod.tiers.get(tier_id) {
                        Some(item_mod_effect) => {
                            for effect_desc in &item_mod_effect.effect_descs {
                                // Explicitly ignored mods
                                if self.is_explicitly_ignored(effect_desc) {
                                    item_mods
                                        .ignored
                                        .push(format!("Ignored mod: {}", effect_desc));
                                    continue;
                                }
                                if self.regex.icon_ids.is_match(effect_desc) {
                                    self.calculate_icon_id_effect_desc(&mut item_mods, effect_desc);
                                } else if self.regex.attribute_effects.is_match(effect_desc) {
                                    self.calculate_attribute_effect_desc(
                                        &mut item_mods,
                                        effect_desc,
                                    );
                                } else {
                                    item_mods.not_implemented.push(format!(
                                        "Unknown type of effect desc: {}",
                                        effect_desc
                                    ));
                                }
                            }
                        }
                        None => item_mods.warnings.push(format!(
                            "Tried to use invalid item mod tier ID: {}, {}",
                            item_mod_id, tier_id
                        )),
                    };
                }
                None => item_mods
                    .warnings
                    .push(format!("Tried to use invalid item mod ID: {}", item_mod_id)),
            };
        }

        item_mods
    }

    fn calculate_icon_id_effect_desc(&self, item_mods: &mut ItemMods, effect_desc: &str) {
        // Add warnings
        if effect_desc.contains("if the target is not focused on you")
            || effect_desc.contains("terrifies the target")
            || effect_desc.contains("to non-Elite targets")
            || effect_desc.contains("reset timer")
            || effect_desc.contains("Rage")
        {
            item_mods
                .warnings
                .push(format!("Partially handled mod: {}", effect_desc));
        }
        if effect_desc.contains("armor damage") {
            item_mods.warnings.push(format!("pgsim doesn't differentiate between regular damage, 'armor damage', and 'health damage': {}", effect_desc));
        }
        // Collect all item effects
        let mut new_effects = vec![];
        if let Some(caps) = self.regex.flat_damage.captures(effect_desc) {
            new_effects.push(ItemEffect::FlatDamage(
                caps.name("damage")
                    .unwrap()
                    .as_str()
                    .parse::<i32>()
                    .unwrap(),
            ));
        }
        if let Some(caps) = self.regex.damage_mod.captures(effect_desc) {
            new_effects.push(ItemEffect::DamageMod(
                caps.name("damage")
                    .unwrap()
                    .as_str()
                    .parse::<f32>()
                    .unwrap() / 100.0,
            ));
        }
        if let Some(caps) = self.regex.dot_damage.captures(effect_desc) {
            new_effects.push(ItemEffect::DotDamage(
                caps.name("damage")
                    .unwrap()
                    .as_str()
                    .parse::<i32>()
                    .unwrap(),
            ));
        }
        if let Some(caps) = self.regex.restore_health.captures(effect_desc) {
            new_effects.push(ItemEffect::RestoreHealth(
                caps.name("restore")
                    .unwrap()
                    .as_str()
                    .parse::<i32>()
                    .unwrap(),
            ));
        }
        if let Some(caps) = self.regex.restore_armor.captures(effect_desc) {
            new_effects.push(ItemEffect::RestoreArmor(
                caps.name("restore")
                    .unwrap()
                    .as_str()
                    .parse::<i32>()
                    .unwrap(),
            ));
        }
        if let Some(caps) = self.regex.restore_power.captures(effect_desc) {
            new_effects.push(ItemEffect::RestorePower(
                caps.name("restore")
                    .unwrap()
                    .as_str()
                    .parse::<i32>()
                    .unwrap(),
            ));
        }
        if let Some(caps) = self.regex.proc_flat_damage.captures(effect_desc) {
            new_effects.push(ItemEffect::ProcFlatDamage {
                damage: caps
                    .name("damage")
                    .unwrap()
                    .as_str()
                    .parse::<i32>()
                    .unwrap(),
                chance: caps
                    .name("chance")
                    .unwrap()
                    .as_str()
                    .parse::<f32>()
                    .unwrap()
                    / 100.0,
            });
        }
        if let Some(caps) = self.regex.proc_damage_mod.captures(effect_desc) {
            new_effects.push(ItemEffect::ProcDamageMod {
                damage_mod: caps
                    .name("damage")
                    .unwrap()
                    .as_str()
                    .parse::<f32>()
                    .unwrap()
                    / 100.0,
                chance: caps
                    .name("chance")
                    .unwrap()
                    .as_str()
                    .parse::<f32>()
                    .unwrap()
                    / 100.0,
            });
        }
        if let Some(caps) = self.regex.damage_type.captures(effect_desc) {
            new_effects.push(ItemEffect::DamageType(
                DamageType::from_str(caps.name("damage_type").unwrap().as_str())
                    .expect("Failed to parse damage type string as enum"),
            ));
        }
        if let Some(caps) = self.regex.damage_type_buff.captures(effect_desc) {
            new_effects.push(ItemEffect::DamageTypeBuff {
                damage_type: DamageType::from_str(caps.name("damage_type").unwrap().as_str())
                    .expect("Failed to parse damage type string as enum"),
                damage_mod: caps
                    .name("damage_mod")
                    .unwrap()
                    .as_str()
                    .parse::<f32>()
                    .unwrap()
                    / 100.0,
                duration: caps
                    .name("duration")
                    .unwrap()
                    .as_str()
                    .parse::<i32>()
                    .unwrap(),
            });
        }

        // This is an Icon ID style effect desc
        for caps in self.regex.icon_ids.captures_iter(effect_desc) {
            let icon_id = caps.get(1).unwrap().as_str().parse::<i32>().unwrap();
            // Get current effects, or insert an empty vec
            let effects = item_mods.icon_id_effects.entry(icon_id).or_insert(vec![]);
            // Extend current effects vec with our new list of effects
            effects.extend(new_effects.clone());
        }
    }

    fn calculate_attribute_effect_desc(&self, item_mods: &mut ItemMods, effect_desc: &str) {
        let caps = self
            .regex
            .attribute_effects
            .captures(effect_desc)
            .expect("Failed to get attribute mods after already checking is_match() is true");
        let attribute = caps.name("attribute").unwrap().as_str();
        let mut modifier = caps.name("mod").unwrap().as_str().parse::<f32>().unwrap();
        let extra = caps.name("extra").unwrap().as_str();
        if !extra.is_empty() {
            item_mods.warnings.push(format!("pgsim doesn't handle extra attribute modifiers and assumes they are all active: {}", effect_desc));
        }
        if attribute.starts_with("BOOST") {
            // BOOST attributes are percentages
            modifier /= 100.0;
        } else if attribute.starts_with("MOD") {
            // No change needed, just cleaner to leave this as an empty if statement
        } else {
            item_mods
                .not_implemented
                .push(format!("Unknown type of attribute mod: {}", effect_desc));
            // Bail out here, since we don't have any modifier to add
            return;
        }
        // Get current effects, or insert an empty vec
        let effects = item_mods
            .attribute_effects
            .entry(attribute.to_string())
            .or_insert(vec![]);
        // Add our damage mod effect
        effects.push(ItemEffect::DamageMod(modifier));
    }

    fn is_explicitly_ignored(&self, effect_desc: &str) -> bool {
        self.regex.racials.is_match(effect_desc)
            || effect_desc.contains("taunt as if they did")
            || effect_desc
                .contains("If you use Premeditated Doom while standing near your Web Trap")
            || effect_desc.contains("chance to avoid being hit by burst attacks")
            || effect_desc.contains("Combo: ")
            || effect_desc.contains("For 12 seconds after using Infinite Legs")
            || effect_desc.contains("Poisoner's Cut boosts Indirect Poison Damage an additional")
            || effect_desc
                .contains("Chew Cud increases your mitigation versus all attacks by Elites")
            || effect_desc.contains("When you are hit, Finish It damage is")
            || effect_desc.contains("sprint speed")
            || effect_desc.contains("Combat XP when feeling Clean")
            || effect_desc.contains("When Skulk is used, you recover")
            || effect_desc.contains("Your Knee Spikes mutation causes kicks to deal an additional")
            || effect_desc.contains("Coordinated Assault grants all allies")
            || effect_desc.contains("Blocking Stance boosts your Direct Cold Damage")
            || effect_desc.contains("Squeal uniformly diminishes all targets' entire aggro lists")
            || effect_desc.contains("Infuriating Bash generates no Rage and lowers Rage by")
            || effect_desc.contains("Your Extra Heart mutation causes the target to regain")
            || effect_desc.starts_with("Fairies gain")
            || effect_desc.contains("_COST_MOD}")
            || effect_desc.starts_with("{MAX_HEALTH}")
            || effect_desc.starts_with("{MAX_ARMOR}")
            || effect_desc.starts_with("{MAX_POWER}")
            || effect_desc.starts_with("{MAX_CLEANLINESS}")
            || effect_desc.starts_with("{MAX_COMMUNITY}")
            || effect_desc.starts_with("{MAX_PEACEABLENESS}")
            || effect_desc.starts_with("{MAX_METABOLISM}")
            || effect_desc.starts_with("{MAX_HYDRATION}")
            || effect_desc.starts_with("{MAX_BREATH}")
            || effect_desc.starts_with("{MAX_INVENTORY_SIZE}")
            || effect_desc.starts_with("{RAGE_INFLICT_MOD}")
            || effect_desc.starts_with("{FALLING_DAMAGE_MOD}")
            || effect_desc.starts_with("{MITIGATION_")
            || effect_desc.starts_with("{DANCE_APPRECIATION_")
            || effect_desc.starts_with("{LOOT_CHANCE_")
            || effect_desc.starts_with("{LOOT_BOOST_CHANCE_")
            || effect_desc.starts_with("{RECIPE_CHANCE_")
            || effect_desc.starts_with("{ABILITY_TAUNT_DELTA_")
            || effect_desc.starts_with("{COMBAT_REGEN_")
            || effect_desc.starts_with("{COMBAT_REFRESH_")
            || effect_desc.starts_with("{EVASION_CHANCE_")
            || effect_desc.starts_with("{ABILITY_RANGE_DELTA_")
            || effect_desc.starts_with("{ABILITY_COST_DELTA_")
            || effect_desc.starts_with("{ABILITY_RESETTIME_DELTA_")
            || effect_desc.starts_with("{MISS_CHANCE")
            || effect_desc.starts_with("{ACCURACY_BOOST")
            || effect_desc.starts_with("{COMBAT_XP_EARNED_MOD}")
            || effect_desc.starts_with("{IGNORE_CHANCE_STUN}")
            || effect_desc.starts_with("{TAUNT_MOD}")
            || effect_desc.starts_with("{BREATH_RESTORED_IN_WATER}")
            || effect_desc.starts_with("{BREATH_RESTORED_ON_LAND}")
            || effect_desc.starts_with("{HYGIENE_BONUS}")
            || effect_desc.starts_with("{IGNORE_CHANCE_KNOCKBACK}")
            || effect_desc.starts_with("{AVOID_DEATH_CHANCE}")
            || effect_desc.starts_with("{FLY_FASTSPEED_BOOST}")
            || effect_desc.starts_with("{FLY_FASTSPEED_COST_PER_SEC}")
            || effect_desc.starts_with("{NONCOMBAT_SPRINT_BOOST}")
            || effect_desc.starts_with("{JUMP_BURST}")
            || effect_desc.starts_with("{SWIM_FASTSPEED_BOOST}")
            || effect_desc.starts_with("{SPRINT_BOOST}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn calculate_item_mods_all_implemented() {
        // This test ensures all mods are implemented (handled, handled with warnings, or specifically ignored)
        // It's intended to run with new versions of game data to easily implement new mods (as well as check for regressions)
        // To work on implementing new mods, run like this: cargo test calculate_item_mods_all_implemented -- --nocapture
        let parser = Parser::new();
        // Accumulate all item mod IDs and tier IDs to test against
        let mut equipped_mods = vec![];
        for (item_mod_id, item_mod) in &parser.data.item_mods {
            for (tier_id, _) in &item_mod.tiers {
                equipped_mods.push((item_mod_id.clone(), tier_id.clone()));
            }
        }
        let mut item_mods = parser.calculate_item_mods(&vec![], &equipped_mods);
        if item_mods.not_implemented.len() > 0 {
            item_mods.not_implemented.sort();
            println!("Not implemented: {:#?}", item_mods.not_implemented.first());
        }
        assert_eq!(item_mods.not_implemented.len(), 0);
    }

    #[test]
    fn calculate_attribute_effect_desc() {
        let parser = Parser::new();
        let mut item_mods = ItemMods {
            icon_id_effects: HashMap::new(),
            attribute_effects: HashMap::new(),
            warnings: vec![],
            ignored: vec![],
            not_implemented: vec![],
        };
        parser.calculate_attribute_effect_desc(&mut item_mods, "{BOOST_SKILL_SWORD}{5}");
        assert_eq!(item_mods.icon_id_effects.len(), 0);
        assert_eq!(item_mods.warnings.len(), 0);
        assert_eq!(item_mods.ignored.len(), 0);
        assert_eq!(item_mods.not_implemented.len(), 0);
        assert_eq!(item_mods.attribute_effects["BOOST_SKILL_SWORD"].len(), 1);
        assert_eq!(
            item_mods.attribute_effects["BOOST_SKILL_SWORD"][0],
            ItemEffect::DamageMod(0.05)
        );
        parser.calculate_attribute_effect_desc(&mut item_mods, "{MOD_SKILL_SWORD}{0.1}");
        assert_eq!(item_mods.attribute_effects["MOD_SKILL_SWORD"].len(), 1);
        assert_eq!(
            item_mods.attribute_effects["MOD_SKILL_SWORD"][0],
            ItemEffect::DamageMod(0.1)
        );
        parser.calculate_attribute_effect_desc(
            &mut item_mods,
            "{MOD_PIERCING_DIRECT}{0.1}{AnimalHandling}",
        );
        assert_eq!(item_mods.warnings.len(), 1);
        assert_eq!(item_mods.attribute_effects["MOD_PIERCING_DIRECT"].len(), 1);
        assert_eq!(
            item_mods.attribute_effects["MOD_PIERCING_DIRECT"][0],
            ItemEffect::DamageMod(0.1)
        );
    }

    fn test_icon_id_effect(
        parser: &Parser,
        effect_desc: &str,
        icon_ids: Vec<i32>,
        mut test_effects: Vec<ItemEffect>,
        warnings_length: usize,
        ignored_length: usize,
    ) {
        let mut item_mods = ItemMods {
            icon_id_effects: HashMap::new(),
            attribute_effects: HashMap::new(),
            warnings: vec![],
            ignored: vec![],
            not_implemented: vec![],
        };
        assert!(
            icon_ids.len() > 0,
            "no icon IDs: effect_desc = {}",
            effect_desc
        );
        // Explicitly ignored mods, so we can test ignore length later
        if parser.is_explicitly_ignored(effect_desc) {
            item_mods
                .ignored
                .push(format!("Ignored mod: {}", effect_desc));
            return;
        }
        parser.calculate_icon_id_effect_desc(&mut item_mods, effect_desc);
        for icon_id in &icon_ids {
            assert!(
                item_mods.icon_id_effects.contains_key(&icon_id),
                "item_mods didn't contain icon_id: effect_desc = {}, item_mods = {:#?}, icon_ids = {:#?}",
                effect_desc,
                item_mods,
                icon_ids,
            );
            let effects = item_mods.icon_id_effects.get_mut(&icon_id).unwrap();
            assert_eq!(test_effects.len(), effects.len(), "item_mods had a different number of effects than it should: effect_desc = {}, test_effects = {:#?}, effects = {:#?}", effect_desc, test_effects, effects);
            // Sort both vectors in order to assert equality
            // There's probably a faster way to do this, but it's just a test
            effects.sort_by(|a, b| a.partial_cmp(b).unwrap());
            test_effects.sort_by(|a, b| a.partial_cmp(b).unwrap());
            // Check each effect for equality
            for (test_effect, effect) in test_effects.iter().zip(effects.iter()) {
                assert_eq!(
                    test_effect,
                    effect,
                    "item_mods had a different effect: effect_desc = {}, test_effect = {:#?}, effect = {:#?}",
                    effect_desc,
                    test_effect,
                    effect,
                );
            }
        }
        assert_eq!(
            item_mods.warnings.len(),
            warnings_length,
            "item_mods had an incorrect number of warnings: effect_desc = {}, test_effects = {:#?}",
            effect_desc,
            test_effects,
        );
        assert_eq!(
            item_mods.ignored.len(),
            ignored_length,
            "item_mods had an incorrect number of ignored effects: effect_desc = {}, test_effects = {:#?}",
            effect_desc,
            test_effects,
        );
    }

    #[test]
    fn calculate_icon_id_effect_desc() {
        // cargo test calculate_icon_id_effect_desc -- --nocapture
        let parser = Parser::new();

        test_icon_id_effect(
            &parser,
            "<icon=3627>Infuriating Fist damage +50. Damage becomes Trauma instead of Crushing",
            vec![3627],
            vec![
                ItemEffect::FlatDamage(50),
                ItemEffect::DamageType(DamageType::Trauma),
            ],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3204><icon=3203>Psi Power Wave and Psi Adrenaline Wave instantly restore 9 power to you",
            vec![3204, 3203],
            vec![
                ItemEffect::RestorePower(9),
            ],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3327>Pain Bubble deals +5 damage and restores 40 armor to you",
            vec![3327],
            vec![ItemEffect::FlatDamage(5), ItemEffect::RestoreArmor(40)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3691><icon=3704>Bun-Fu Strike deals +4 damage and hastens the current reset timer of Bun-Fu Blitz by 1 seconds",
            vec![3691, 3704],
            vec![ItemEffect::FlatDamage(4)],
            1,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2192>Blocking Stance restores 4 Power to you",
            vec![2192],
            vec![ItemEffect::RestorePower(4)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3473>Look At My Hammer restores +15 armor to you",
            vec![3473],
            vec![ItemEffect::RestoreArmor(15)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3481>Heart Thorn restores 14 armor to you",
            vec![3481],
            vec![ItemEffect::RestoreArmor(14)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3045>Decapitate deals +50 damage to non-Elite targets",
            vec![3045],
            vec![ItemEffect::FlatDamage(50)],
            1,
            0,
        );
        // New below
        test_icon_id_effect(
            &parser,
            "<icon=3541>Sonic Burst has a 60% chance to deal +10% damage to all targets",
            vec![3541],
            vec![ItemEffect::ProcDamageMod {
                damage_mod: 0.1,
                chance: 0.6,
            }],
            0,
            0,
        );
        // TODO: Not handling the "over 60 seconds" part
        test_icon_id_effect(
            &parser,
            "<icon=2191>Deflective Spin heals 6 Health over 60 seconds",
            vec![2191],
            vec![ItemEffect::RestoreHealth(6)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2198>Life Steal deals 50 Psychic damage over 10 seconds",
            vec![2198],
            vec![ItemEffect::DotDamage(50)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3555>If you use Premeditated Doom while standing near your Web Trap, you gain +15% Spider Skill Base Damage for 20 seconds",
            vec![3555],
            vec![],
            0,
            1,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3204>Psi Adrenaline Wave increases all targets' Slashing damage +2% for 20 seconds",
            vec![3204],
            vec![ItemEffect::DamageTypeBuff {
                damage_type: DamageType::Slashing,
                damage_mod: 0.02,
                duration: 20,
            }],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3783>Fairy Fire's damage type becomes Fire, and it deals an additional 15 Fire damage over 10 seconds",
            vec![3783],
            vec![
                ItemEffect::DamageType(DamageType::Fire),
                ItemEffect::DotDamage(15),
            ],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3698>Hare Dash restores 8 Armor to you",
            vec![3698],
            vec![ItemEffect::RestoreArmor(8)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3024><icon=3443>Flashing Strike and Hacking Blade Damage +6%",
            vec![3024, 3443],
            vec![ItemEffect::DamageMod(0.06)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3525>Blizzard deals 14 armor damage and generates -10 Rage",
            vec![3525],
            vec![ItemEffect::FlatDamage(14)],
            2,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3448>Infuriating Bash generates no Rage and lowers Rage by 100",
            vec![3448],
            vec![],
            0,
            1,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2182>Your Extra Heart mutation causes the target to regain +5 Power every 20 seconds",
            vec![2182],
            vec![],
            0,
            1,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3430>Spark of Death deals +1 damage and renders target 10% more vulnerable to Electricity damage for 30 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3784>Pixie Flare deals +7 damage, and deals +33% total damage against Demons",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3785>Fae Conduit also heals 10 Health every 5 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3546><icon=3553>Combo: Rip+Any Melee+Any Giant Bat Attack+Tear: final step hits all targets within 5 meters and deals +5 damage.",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3402>Gripjaw has a 70% chance to deal +20% damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2198>Life Steal restores 4 Health",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2113>Many Cuts hits all enemies within 5 meters",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3301>Poison Arrow makes target's attacks deal -1 damage for 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3499>Ice Spear deals between +1 and +20 extra damage (randomly determined)<icon=3476>Latent Charge deals +5 direct damage. In addition, the target takes a second full blast of delayed Electricity damage after an 8-second delay",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2256>Shadow Feint causes your next attack to deal +12 damage if it is a Werewolf ability",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2180>Your Knee Spikes mutation causes kicks to deal an additional +5% damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3454>Fire Shield deals +12 Fire damage to melee attackers",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3637>Hurl Lightning Damage +10 and Reuse Time -1 second",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3799>Power Glyph restores +5 Health",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=108>Chance to Ignore Knockbacks +33%, Chance to Ignore Stuns +20%<icon=2237>Provoke Undead causes your minions to deal +8% damage for 10 seconds, but also take 35 damage over 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3202><icon=3746>Psi Health Wave and Psi Armor Wave instantly restore 10 armor to you",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3704>Bun-Fu Strike deals +10% damage and reuse time is -1 second",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3457>Shield Team causes all targets' Survival Utility abilities to restore 16 Armor to them. Lasts 20 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2219>Antler Slash heals you for 1 health",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3302><icon=3301><icon=3309>Fire Arrow, Poison Arrow, and Acid Arrow Damage +6%",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2131>For 10 seconds, Frenzy boosts targets' indirect damage +1<icon=3421>Pin generates no Rage and reduces Rage by 50",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3746>Psi Health Wave grants all targets +6 Mitigation vs. Electricity, Acid, and Nature attacks for 20 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3542><icon=3544><icon=3541>If Screech, Sonic Burst, or Deathscream deal Trauma damage, that damage is boosted +15% per tick",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3320>Snare Arrow restores 2 Health and 2 Armor to you",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=108>All Major Healing abilities targeting you restore +10 Health (while Cow skill active)<icon=3525>You regain 15 Health when using Blizzard",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3774>Lethal Force deals 40 additional Fire damage over 8 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3704>Bun-Fu Strike reduces target's rage by 30, then reduces it by 30 more after a 5 second delay",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2153>After using Doe Eyes, your next attack deals +10 damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3443>Flashing Strike deals +22 damage to undead",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3017>Sanguine Fangs suddenly deals 35 Trauma damage after an 8-second delay",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3312>Bow Bash gives you +1 mitigation of any physical damage for 20 seconds. (This effect does not stack with itself.)",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3044>Fast Talk taunts -60 and reduces Rage by 100",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3465>Nimble Limbs grants your pet +1 mitigation vs. physical (slashing, piercing, and crushing) attacks for 15 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "(Wax) Melee Attackers suffer 3 indirect Acid damage while Shield skill Active",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3401>Inject Venom heals you for 2 health",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3782>Astral Strike causes all targets to suffer +12 damage from direct Cold attacks for 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2132>Double Claw Damage +13",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3547><icon=3553>Bat Stability provides +10% Projectile Evasion for 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3601>Surge Cut deals 35 Trauma damage over 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2222>Positive Attitude increases your Core Attack Damage +10 for 15 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3047>Precision Pierce deals +5 direct health damage and further reduces target's Rage by 30",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2175>Healing Mist restores 4 power",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3046><icon=3024>Hacking Blade and Debilitating Blow deal 48 Trauma damage over 12 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2232>Mudbath restores 7 armor to the target",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3044>Fast Talk heals you for 10 armor",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2209>Room-Temperature Ball deals Darkness damage and causes +24 damage over 12 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2120>Ring of Fire deals +8% damage but has a 5% chance to deal 50 fire damage to YOU",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2118>Psychoanalyze causes the target to take +1 damage from Psychic attacks for 60 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2240><icon=2105>Cobra Strike and Mamba Strike restore 10 Armor to you",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3017>Sanguine Fangs deals +14% Crushing damage and doesn't cause the target to yell for help",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3458>Strategic Preparation boosts your in-combat Armor regeneration +2 for 20 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3666>Rally restores 20 Armor after a 20 second delay",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3754>Deadly Emission Deals +30 Nature damage over 10 seconds and Taunts +25",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2237>Provoke Undead deals 12 damage to your minions, who then deal +5 damage for 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3252>Incubated Spiders have a 6% chance to avoid being hit by burst attacks",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=108>Your attacks deal +1 damage to Canines",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=108>Your attacks deal +1 damage to Humans",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3496>Your Cold Sphere's Rage attack deals +35 damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3527><icon=3491>You regain 6 Power after using Ice Nova or Shardblast",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2190>Double Hit causes your next attack to deal +15 damage if it is a Crushing attack",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2149>Stampede boosts your Slashing/Crushing/Piercing Mitigation vs. Elites +2 for 30 seconds (stacks up to 5 times)",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3698>Hare Dash restores 5 Power over 15 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3803>Spirit Bolt deals +6 damage and there's a 50% chance it deals +10% damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2127>Fire Walls have +11 Max Health",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3320>Snare Arrow raises target's Max Rage by 120, requiring more Rage to use their Rage Abilities",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "Fairies gain +4 Max Power",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3479>Your Healing Sanctuary heals +5 health and buffs Melee Accuracy +5",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2107>Super Fireball causes the target to take +11% damage from indirect Fire (this effect does not stack with itself)<icon=3773><icon=3768>Apprehend deals +10 damage and hastens the current reuse timer of Controlled Burn by 0.5 seconds (so it can be used again more quickly)",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3785>Fae Conduit restores +1 Power every 5 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3697><icon=3751>Love Tap hastens the current reuse timer of Carrot Power by 1 second",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3407>Cow's Bash inflicts bugs on the target, dealing 20 Nature damage over 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2237>Provoke Undead causes your minions to deal +5 damage for 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3204><icon=3203>Psi Power Wave and Psi Adrenaline Wave restore 16 power to all targets after a 25 second delay",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3753>Forest Challenge damage is +12 and reuse time is -1 second",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2117>Pouncing Rake deals +14 Armor damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2259>When Skulk is used, you recover 15 Health and all enemies within 10 meters are taunted -100<icon=3481>Heart Thorn coats the target in stinging insects that deal 36 Nature damage over 12 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=108>Signature Support abilities restore 5 Power to all allies within 20 meters",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3500>Tundra Spikes deals +5% damage, gains +1 Accuracy, and lowers targets' Evasion by -2 for 20 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3638>Thunderstrike heals you for 2 health",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3544>Screech deals +13 damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3734>Triage costs no Power to cast and restores +5 Health, but takes +1 second to channel",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3804>Trick Foxes have +8 Max Health and their Rage Attacks deal +20 damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2184><icon=2178><icon=2171>Bomb attacks deal +5 damage and hasten the current reuse timer of Healing Mist by 0.5 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3672>Blast of Despair causes your Nice Attacks to deal +10 damage for 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2151>Bounding Escape grants you +7% Projectile Evasion for 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2250>Grunt of Abeyance restores 2 Power to all targets",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3204><icon=3202>Psi Armor Wave and Psi Adrenaline Wave restore 15 armor to all targets after a 25 second delay",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3629>Blood of the Pack causes you and your allies' attacks to deal +5 damage for 30 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=108>Slashing Mitigation +1, Piercing Mitigation +1, Crushing Mitigation +1 while Shield skill active",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3046><icon=2113>Many Cuts and Debilitating Blow Damage +3<icon=3783>Fairy Fire causes your next attack to deal +8 damage if it's a Psychic, Electricity, or Fire attack",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3525><icon=3500>Tundra Spikes and Blizzard Damage +6.5%",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3803>Spirit Bolt Damage +15 and range is +5 meters",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3665><icon=3664><icon=3663>All bard songs restore 7 Health to YOU every 4 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3557>Web Trap boosts your movement speed by 2 for 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3499>Ice Spear heals you for 6 health after a 15 second delay",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3665>Song of Discord reduces targets' Rage by -10 every 2 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3573>Seismic Impact hits all targets within 8 meters and deals +3% damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3546><icon=3553>Rip and Tear deal +3 damage and hasten the current reuse timer of Drink Blood by 1 second",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3690>Rabbit Scratch deals Trauma damage (instead of Slashing), and deals up to +8 damage (randomly determined)",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3555>Premeditated Doom restores 14 health after a 10-second delay",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3254>After using Grappling Web, you are immune to Knockback effects for 12 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3650><icon=3649><icon=3648><icon=3647>Crossbow abilities boost your Epic Attack Damage +10% for 15 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3663><icon=3665>Whenever you take damage from an enemy, you gain Song of Discord Damage +3% and Song of Resurgence Healing +3 for 20 seconds. (Stacks up to 12x)",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "Melee attacks deal +5 damage to Pigs",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=108>Your attacks deal +1 damage to Orcs",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=108>Hammer attacks have a 1% chance to Knock Down targets whose Rage meter is at least 66% full",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2188>Redirect causes target to bleed, dealing 40 Trauma damage over 8 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3315>Aimed Shot deals +6% damage and boosts your Accuracy +5 for 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2160>Animal Handling pets recover +2 Armor every five seconds (whether in combat or not)<icon=3630>Mangling Shot causes target to take +4% damage from Piercing for 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3429>Wave of Darkness deals +8 damage and reuse timer is -1 second",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2152>Deer Kick implants insect eggs in the target. Future Deer Kicks by any deer cause target to take 35 Nature damage over 5 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3322><icon=2110>Hip Throw and Bodyslam deal +5% damage and generate -20 Rage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3727>When Castigate is used on an undead target, it has a 25% chance to stun the target",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2258>Frostball slows target's movement by 25% and deals +2 damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2255>Harmlessness confuses the target about which enemy is which, permanently shuffling their hatred levels toward all enemies they know about",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3768>Apprehend deals +5 damage, and damage type is changed to Electricity",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3443>Flashing Strike deals +25% damage and gives you 50% resistance to Darkness damage for 4 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3595>Slice has a 40% chance to deal +10% damage and restore 10 armor",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2152><icon=2154>Combo: Deer Bash+Any Melee+Any Melee+Deer Kick: final step hits all enemies within 5 meters and deals +10 damage.",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2247><icon=3753>Forest Challenge and King of the Forest power cost is -5",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2255>Harmlessness restores 21 armor to you",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2233><icon=2115>Parry and Riposte Damage +5% and Power Cost -1",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3782>Astral Strike's damage type becomes Fire, and it deals an additional 25 damage over 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3746>Psi Health Wave heals all targets for 14 health after a 25 second delay",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3046><icon=2113>Many Cuts and Debilitating Blow deal +14 damage to Arthropods (such as spiders, mantises, and beetles)<icon=3402>Gripjaw deals +6% damage and hastens the current reset timer of Grappling Web by 1.5 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3476><icon=3475>Leaping Smash and Latent Charge boost your Core Attack damage +12 for 6 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3627>Infuriating Fist generates no Rage and instead reduces Rage by 65<icon=3046>Debilitating Blow deals +10 damage and causes your Core Attacks to deal +7 damage for 7 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3407>Cow's Bash restores 3 Power to you",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2116>Pep Talk removes ongoing Poison effects (up to 3 dmg/sec)",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2115>Parry hits all enemies within 5 meters, dealing an additional +3 damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2196>Heal Undead restores +7 Health/Armor and boosts your next attack +5 if it is a Darkness attack",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3322><icon=2110>Hip Throw deals +12 armor damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=108>Nice Attacks deal +2 damage and cause the target's next Rage Attack to deal -25% damage (debuff cannot stack with itself)",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3626>Agonize deals +36 Psychic damage over 12 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3690>Rabbit Scratch restores 1 Armor to you",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2241>Bruising Blow deals Trauma damage instead of Crushing, and targets suffer +5% damage from other Trauma attacks for 20 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3204>Psi Adrenaline Wave increases all targets' Electricity damage +2% for 20 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3270>Panic Charge boosts the damage of all your attacks +2 for 20 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3600>Backstab steals 7 health from the target and gives it to you",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3430>Electrify restores 8 Health to you",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3592>Blur Cut restores 6 Health after a 15 second delay",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2116>Pep Talk removes ongoing Fire effects (up to 3 dmg/sec)",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2204><icon=2112>While Unarmed skill active: 10% of all Acid, Poison, and Nature damage you take is mitigated and added to the damage done by your next Kick at a 100% rate",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3471>Pound To Slag deals +32 damage if target's Rage is at least 66% full",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2224>Pig Bite has a 3% chance to deal +40 damage and hit all targets within 5 meters",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3427>Death's Hold causes target to take +5% damage from Darkness for 15 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2253>Tough Hoof deals 9 Trauma damage to the target each time they attack and damage you (within 8 seconds)",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3203>Psi Power Wave instantly restores 5 power to all targets",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2250>Grunt of Abeyance restores 4 Armor to all targets",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3444><icon=3047>Precision Pierce and Heart Piercer restore 3 Health to you",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3480>Regrowth restores 6 Power",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2246>Pummeling Hooves deals +5% damage and taunts +125<icon=3734>Triage gives the target +4% Melee Evasion for 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=108>Your projectile attacks deal +6 damage to Elite enemies",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3440>You Were Adopted deals +10% damage and Power cost is -3",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3421>Pin deals +10 damage and has +3 Accuracy (which cancels out the Evasion that certain monsters have)",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3480>Regrowth restores +10 Health and conjures a magical field on the target that mitigates 10% of all physical damage they take for 1 minute (or until 100 damage is mitigated)",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3525>Blizzard deals +1% damage, generates -90 Rage and taunts -80",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3775>Privacy Field also deals its damage when you are hit by burst attacks, and damage is +10",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3469>After using Wild Endurance, your next use of Feed Pet restores +15 Health/Armor",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3492><icon=3586><icon=3499><icon=3505>All Ice Magic attacks that hit a single target have a 33% chance to deal +11% damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3413>Suppress heals you for 15 health",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2259>Skulk boosts the damage of your Core and Nice Attacks +5 for 30 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3447>Disrupting Bash causes the target to take +3% damage from Crushing attacks for 8 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3465>Nimble Limbs heals your pet for 7 Health (or Armor if Health is full)",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3312>Bow Bash heals you for 1 health",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3772>Warning Jolt restores 1 Power, and ability range is increased 5 meters",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3454>Fire Shield boosts your direct and indirect Cold mitigation +1 for 20 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3727>Castigate deals Fire damage instead of Psychic, and deals +12% damage to Aberrations",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3421>Pin heals you for 10 health",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3546>Tear has a 33% chance to deal +10% damage and reset the timer on Screech (so Screech can be used again immediately)<icon=3505>Freeze Solid reduces the Power cost of all Ice Magic abilities -4 for 7 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2131>For 15 seconds, Frenzy boosts targets' receptivity to Major Heals so that they restore +10 Health",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2118>Psychoanalyze causes the target to be worth 1% more XP if slain within 60 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3574>Reckless Slam deals +4 damage and taunts -60",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2195>Using Raise Zombie on an existing zombie raises its Max Health +8 for 60 seconds (and heals +8)",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2106>Finishing Blow gives you 25% resistance to Elemental damage (Fire, Cold, Electricity) for 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3483>Brambleskin deals +6 Nature damage to melee attackers",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3546>Tear has a 50% chance to deal +25% damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2196>Heal Undead restores +4 health/armor and grants target undead +4 Mitigation from all attacks for 8 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3017>Sanguine Fangs causes the target to take +5% damage from Slashing attacks for 15 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2131>Frenzy restores 2 power to all targets",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2259>Skulk grants you +20% Projectile Evasion",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3673>Blast of Defiance reaps +4% of the Health damage to you as healing. The reap cap is +10",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3455>Fight Me You Fools boosts Core Attack Damage +25 for 6 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=108>Signature Support abilities restore 20 Armor to all allies within 20 meters",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3544>Screech deals 36 Trauma damage over 12 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "(Wax) Max Armor +4 while Shield skill active",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2174>Your golem minion's Taunting Punch deals +5 damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3697>Carrot Power boosts the damage from all kicks +10 for 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3785>Fae Conduit's Power cost is -5 and reuse timer is -1 second",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3322>Bodyslam deals +5% damage and slows target's movement speed by 45%",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3635>Way of the Hammer grants all targets +5 Direct Mitigation for 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2129>Werewolf Bite deals +4% damage and boosts your Nice Attack Damage +5 for 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3797>Spirit Pounce Damage +3 and ability hits all enemies within 6 meters",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=108>Your attacks deal +1 damage to Constructs",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3252>Incubated Spiders deal +5% direct damage with each attack",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2222>Positive Attitude boosts your Out-of-Combat Sprint Speed by 4 for 60 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3251>Spit Acid deals +12 armor damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3312>Bow Bash deals +40 damage and knocks the target backwards, but ability's reuse timer is +3 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2155>Cow's Front Kick causes the next attack that hits you to deal -8% damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3548><icon=3546>Tear and Virulent Bite deal +6 damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3627><icon=2203><icon=2119>Punch, Jab, and Infuriating Fist restore 3 Health to you",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3070>System Shock deals +2 damage, generates no Rage, and reduces Rage by 30",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3663>Song of Resurgence also restores 1 Power every 4 seconds to each target in range",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3401>Inject Venom has a 50% chance to deal +10% damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3627>Infuriating Fist deals +13% damage and taunts +40",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2174>Your golem minion's Rage Mist and Self Sacrifice abilities heal +8 health",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2198>Life Steal reaps 5 additional health",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3024>Hacking Blade deals +12 Trauma damage over 12 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3442><icon=3017>Spider Bite and Infinite Legs restore 1 Health",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3694>Play Dead causes all affected enemies to take 30 Psychic damage after a 10-second delay",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=108>While Unarmed skill is active: any time you Evade an attack, your next attack deals +24 damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3599>Surprise Throw deals +5% damage and stuns the target if they are not focused on you",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3667>Anthem of Avoidance gives all targets +4% Melee Evasion for 8 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3440><icon=2123><icon=2118>Psychoanalyze, Tell Me About Your Mother, and You Were Adopted Damage +15",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3462>Shrill Command deals +10% damage and reduces the target's Rage by -50<icon=2228>Strategic Chomp boosts your mitigation versus physical damage +1 for 20 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2221>Soothe boosts the healing from your Major Healing abilities +14 for 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2136>Sic Em boosts your pet's Slashing attacks (if any) +10 damage for 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3527><icon=3491>You regain 6 Health when using Ice Nova or Shardblast",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3733>Righteous Flame deals +55 Fire damage over 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2174>Your golem minion's Invigorating Mist heals 3 health",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2192>Blocking Stance boosts your Direct Cold Damage +6% for 30 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2255>Porcine Alertness heals all targets for 7 health after a 15 second delay",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2227>Pig Rend deals +60 Trauma damage over 12 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3738>Give Warmth boosts the target's fire damage-over-time by +3 per tick for 60 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3423>Headcracker deals +5 damage, generates no Rage, and reduces Rage by 12",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3495><icon=3499>Ice Spear and Ice Lightning damage +11%<icon=108>Your attacks deal +1 damage to Dinosaurs",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2128>Wind Strike gives you +50% projectile evasion for 5 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=108>Minor Heals restore 11 Armor",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2136>Sic Em gives both you and your pet +2 Accuracy for 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2118>Psychoanalyze restores 10 Armor to you",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3321><icon=3310>Basic Shot and Blitz Shot Damage +8%",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3597>Gut deals +3 damage and if target is not focused on you, the trauma damage is boosted 25%",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3479>Your Healing Sanctuary restores +4 health with each heal",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3045>Decapitate restores 45 armor to you",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3484>Delerium depletes +60 rage and deals +8 damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3695>Rabbit's Foot grants you and nearby allies +5% Burst Evasion for 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3640>Finish It Restores 10 Health",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2221>Soothe further reduces target's Rage by 250",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3575>Rib Shatter deals +20 damage to targets that are knocked down",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3768>Apprehend causes your Nice Attacks to deal +10 damage for 8 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2107><icon=3434>Fire Breath and Super Fireball deal +45 damage over 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2160>Animal Handling pets' Clever Trick abilities deal +5% damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3635>Way of the Hammer boosts all targets' Electricity Damage +7% for 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2136>Sic 'Em restores 5 Health to both you and your pet",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3747>Flesh to Fuel boosts your Core Attack Damage +13 for 7 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3549>Drink Blood steals 4 additional health",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3454>Fire Shield causes melee attackers to ignite, dealing 30 Fire damage over 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=108>Whenever you take damage from an enemy, you gain Bard Base Damage +5% for 15 seconds. (Stacks up to 10x)<icon=3598>Hamstring Throw deals +10 direct health damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3801><icon=3798>Blur Step provides +10% Burst Evasion for 20 seconds, and Paradox Trot boosts Sprint Speed +1",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2138>That'll Do restores 12 Health to your pet and 2 Power to you",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3413>Suppress deals +7% damage and causes targets to lose an additional 25 Rage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2256>Shadow Feint reduces the taunt of all your attacks by 5% until you trigger the teleport",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2206>Defensive Burst deals +12% damage and raises Basic Attack Damage +5% for 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3462>Shrill Command deals +6% damage and hastens the current reuse timer of Clever Trick by 1 second",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2236>Rebuild Undead restores 10 Health to you",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2196>Heal Undead restores +5 and has a 25% chance to boost targets' mitigation +5 for 8 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2255>Harmlessness restores 7 power to you",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3421>Pin causes target's attacks to deal -10% damage for 5 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=108>You regenerate +1 Health per tick (every 5 seconds, in and out of combat) while Cow skill active",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3771>Conditioning Shock deals +6 damage and reuse time is 1 second sooner",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3586>Frostbite deals +5 damage and raises the target's Max Rage by 22%, preventing them from using their Rage attacks as often",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3496>Your Cold Sphere gains 12 Armor",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2230>Pig Punt deals +3% damage and taunts -15",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3774>Lethal Force Damage +10 and Power Cost -2",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2102>Barrage costs -1 Power and restores 3 Armor to you",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3505>Freeze Solid resets the timer on Ice Spear (so it can be used again immediately)",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2205><icon=2206>Defensive Burst and Defensive Chill restore 10 Armor to you",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=108>Your attacks deal +1 damage to Incorporeal Creatures",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3424>Mindreave deals +2 damage and deals Electricity damage instead of Psychic",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3697>Carrot Power boosts your Crushing Damage +6% for 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3000>Cosmic Strike deals +10 damage and reuse timer is -1 second",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2205><icon=2208>Scintillating Frost and Defensive Chill restore 5 Armor",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3640>When you are hit, Finish It damage is +4 for 20 seconds (stacks up to 10 times)",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3403>Toxinball deals +36 Poison damage to health over 12 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3673>Blast of Defiance reaps 5% of the Armor damage done (up to a max of 15), returning it to you as armor",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2258><icon=2238>Fireball and Frostball Damage +6%",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3694>Play Dead restores 15 Health",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "Indirect Nature and Indirect Electricity damage is +5% per tick while Warden skill active",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3469>Wild Endurance heals your pet for 15 Health (or Armor if Health is full)<icon=3483>Brambleskin increases your Max Armor by +20 for 30 seconds and restores 20 Armor",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2208><icon=3436>Scintillating Flame and Scintillating Frost Damage +14%<icon=2200><icon=2199><icon=2201>Summoned Skeletons deal +4% direct damage, but take +100% more damage from any cold attacks",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3473>After using Look At My Hammer, all other Hammer attacks cost -3 Power for 8 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2195>Raised Zombies deal +6% damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2174>Your golem minion's Doom Admixture deals +15 damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3784>Pixie Flare's attack range is +5, and it deals +15 damage to targets that are covered in Fairy Fire",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2222>Positive Attitude increases your Poison Mitigation +1 for 30 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3423><icon=3413>Combo: Suppress+Any Melee+Any Melee+Headcracker: final step stuns the target while dealing +10 damage.",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3795>Nip boosts the damage of Basic, Core, and Nice attacks +5 for 6 seconds. (This buff does not stack with itself.)<icon=3738>Give Warmth restores 3 Health and +2 Body Heat",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3447>Disrupting Bash deals +10% damage and taunts +25<icon=2175>Healing Mist heals +7 Health",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2205><icon=2208><icon=2258>Frostball, Scintillating Frost, and Defensive Chill boost your Nice Attack Damage +16 for 7 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "Fairies gain +1 Max Hydration",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3497>While in Cryogenic Freeze, you are 30% resistant to Fire damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2141>Get It Off Me heals you for 25 Health after a 15 second delay",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3802>Dimensional Snare causes target to take +5% damage from Poison for 15 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=108>All Druid abilities have a 7% chance to restore 15 Power to you",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3446>Stunning Bash causes the target to take 30 Trauma damage over 12 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2253>Tough Hoof has a 66% chance to deal +15% damage and taunt +50Elves earn +1% Combat XP when feeling Clean, but earn NO Combat XP when Dirty",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3573>Seismic Impact restores 10 Armor to you",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2155>Cow's Front Kick has a 66% chance to deal +12 damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3251>Spit Acid causes your Signature Debuff abilities to deal +12 damage for 8 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=108>Your attacks deal +1 damage to Rodents",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2176>Freezing Mist restores 13 Armor to you",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2205><icon=2208><icon=2258>Frostball, Scintillating Frost, and Defensive Chill grant +3 Direct and Indirect Cold Protection for 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3423>After using Headcracker, you take half damage from Psychic attacks for 5 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2205><icon=2206><icon=2120>You regain 2 Power when using Ring of Fire, Defensive Burst, or Defensive Chill",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2140>Monstrous Rage boosts your Slashing attack damage +1% for 8 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=108>Nice Attacks deal +4 damage and hasten your current Combat Refresh delay by 1 second",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3431>Revitalize restores +1 Health and removes ongoing Trauma effects (up to 1 dmg/sec)",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3784>Pixie Flare restores 3 Health to you",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3322>Bodyslam heals you for 10 health",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=108>Your attacks deal +1 damage to Felines",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=108>All Hammer attacks except for Pound have a 10% chance to restore 5 health and armor",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=108>Your attacks deal +1 damage to Elves",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3735>Remedy costs -1 Power to cast, its reuse timer is -1 second, and it has a 10% chance to mend a broken bone in the target",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3557>While you are near your Web Trap, you recover 4 Health per second",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3327>Pain Bubble increases the damage of your ranged attacks by 1% for 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3477>Discharging Strike deals +1% damage plus 8% more damage if target's Rage meter is at least 66% full",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2175>Healing Mist hastens the remaining reset timer of Reconstruct by 10 seconds (if Reconstruct is not already ready to use)",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3734>Triage gives the target +3% Burst Evasion for 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3505>Freeze Solid restores 10 armor to you after a 15 second delay",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3463>Shield Team grants all allies 3% evasion of burst attacks for 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3795>Nip boosts the damage of Basic, Core, and Nice attacks +5 for 6 seconds. (This buff does not stack with itself.)",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3418><icon=2140>Monstrous Rage and Unnatural Wrath boost your pet's next attack damage +8",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3630>Mangling Shot deals +5% damage and causes target's attacks to deal -1 damage for 20 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3650><icon=3649><icon=3648><icon=3647>Crossbow abilities restore 15 health after a 15 second delay",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=108>Your attacks deal +1 damage to (corporeal) Undead",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2136>Sic Em boosts your pet's Crushing attacks (if any) +10 damage for 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3045>Decapitate deals +10 damage and briefly terrifies the target",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3628>Phoenix Strike costs -1 Power and boosts your Direct Fire Damage +5% for 30 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3455><icon=3642><icon=3449><icon=3448><icon=3447><icon=3446>All Shield Bash Abilities deal +5 damage and hasten the current reuse timer of Fight Me You Fools by 1 second",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3726>Admonish boosts your Priest Damage +1 for 10 seconds (this effect does not stack with itself)",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2129>Werewolf Bite hits all enemies within 5 meters, but reuse timer is +2 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2256>When you teleport via Shadow Feint, you recover 10 Health",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3444>Heart Piercer deals +3% piercing damage and heals you for 4 health",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3695>Rabbit's Foot restores 10 Health to you and nearby allies after a 15 second delay",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2110>Hip Throw hits all enemies within 8 meters, but Power cost is +20",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2114>Future Pack Attacks to the same target deal +10 damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3597>Gut deals an additional 10 Trauma damage over 10 seconds if the target is not focused on you",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3667>Anthem of Avoidance gives all targets +8% Burst Evasion for 8 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2123>Tell Me About Your Mother boosts your Epic Attack Damage +10 and reduces the Power cost of your Epic Attacks -4 for 15 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3543>Confusing Double heals you for 18 health",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3626>Agonize deals +10% damage and reuse timer is -6 seconds, but the ability deals 15 health damage to YOU",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3203><icon=3202><icon=3746>Psi Health Wave, Armor Wave, and Power Wave restore +1 Health, Armor, and Power respectively every few seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3671>Blast of Fury deals +10% damage and knocks the target back, but the ability's reuse timer is +2 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2247>King of the Forest gives you +4 mitigation of any physical damage for 20 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3401>Fill With Bile increases target's direct Poison damage +10",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2179>Your Extra Skin mutation causes the target to heal 10 Health every 20 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3640>Finish It Damage +5% and Power Cost -4",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3599><icon=3598><icon=3602>Fan of Blades, Hamstring Throw, and Surprise Throw deal +7% damage and reuse timer is -1 second",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3432>Reconstruct restores +4 Health and causes the target to take 4 less damage from attacks for 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3735>Remedy restores 5 Armor and mitigates all damage over time by 1 per tick for 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2179>Your Extra Skin mutation provides +3 mitigation from Piercing attacks",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2191>Deflective Spin restores 6 Power after a 20 second delay",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=108>Your attacks deal +1 damage to Elementals",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3424>For 15 seconds after using Mindreave, your Major Healing abilities restore +6 Health (this effect does not stack with itself)",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3070>System Shock restores 10 Armor to you",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3204>Psi Adrenaline Wave increases all targets' Crushing damage +2% for 20 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2112><icon=2240>Mamba Strike and Front Kick damage +10<icon=3495>Ice Lightning causes the target to become 2% more vulnerable to Fire attacks for 7 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2127>Fire Walls deal +8 damage per hit",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3769>Stun Trap reuse timer is 1 second faster",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3309>Fire Arrow deals +7% damage and taunts +50",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3628>For 30 seconds after using Phoenix Strike, your Survival Utility and Major Heal abilities restore 20 Health to you",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3482>Rotskin hits all targets within 10 meters and further debuffs their mitigation -3",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3464>Clobbering Hoof attacks have a 50% chance to deal +12% damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3670>Moment of Resolve dispels any Slow or Root effects on allies and grants them immunity to Slow and Root effects for 8 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3542>Deathscream deals +15% damage and Power cost is -2, but the ability's range is reduced to 12m",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3704><icon=3752>Bun-Fu Blast deals +6 damage and hastens the current reuse timer of Bun-Fu Strike by 1 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=108>Core Attacks deal +11 damage and reduce the Power cost of your next Minor Heal ability by -7",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3675>Entrancing Lullaby deals 35 Trauma damage after a 20 second delay",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3774>Lethal Force deals +13 damage and reuse time is -3 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3204><icon=3746>Psi Health Wave and Psi Adrenaline Wave instantly heal all targets for 10 health",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2124>Strike a Nerve deals between 3 and 10 extra damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=108>Your attacks deal +1 damage to (non-ruminant) Ungulates",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3773>Controlled Burn costs -4 Power",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3487><icon=3486>Slashing Strike and Claw Barrage boost damage from Epic attacks +20 for 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=108>All fire spells deal up to +10 damage (randomly determined)<icon=2109>Molten Veins causes any nearby Fire Walls to recover 12 health",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2191><icon=3413>Suppress and Deflective Spin Damage +7%",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2172>You heal 1 health and 1 armor every other second while under the effect of Haste Concoction",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3783>Fairy Fire damage is +4 and attack range is +5<icon=3596>Venomstrike deals an additional 24 Poison damage over 12 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3691>Bun-Fu Blitz causes the target to take +2% damage from Trauma attacks for 20 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3000>Cosmic Strike deals +20 damage, generates no Rage, and removes 40 Rage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2233>Riposte restores 5 armor",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3730>Unfetter allows free-form movement while leaping, and if the target can fly, fly speed is boosted +0.3 m/s for 20 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3601>Surge Cut restores +6 Health to you",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3674>Thunderous Note causes the target to take +6% damage from Nature attacks for 15 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3802>Dimensional Snare deals Fire damage (instead of Darkness) and ignites the target, dealing 24 Fire damage over 12 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2210>Moo of Determination restores +6 armor",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3548>Virulent Bite deals 12 Trauma damage over 12 seconds and also has a 25% chance to deal +16% immediate Piercing damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3799>Power Glyph restores 5 additional Power after a 6-second delay",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2118>Psychoanalyze deals between 10 and 60 extra damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2188>For 60 seconds after using Redirect, First Aid heals you +15<icon=2200><icon=2199><icon=2201>Summoned Skeletal Archers and Mages deal +6% direct damage, but are instantly destroyed by ANY Nature Damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3549>For 30 seconds after using Drink Blood, all Nature attacks deal +3 damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3782>Astral Strike's reuse timer is -1 secs, and damage is boosted +5% vs Elite enemies",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3495>Ice Lightning boosts your Core Attack Damage +10 for 7 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3735>Remedy restores 6 Armor",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3772>Warning Jolt restores 1 Armor and taunts +25<icon=2150>Chew Cud increases your mitigation versus Crushing, Slashing, and Piercing attacks +3 for 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2131>Frenzy gives all targets +4 absorption of any physical damage for 20 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3738>Give Warmth causes the target's next attack to deal +13 damage if it is a Fire attack",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2230>Pig Punt causes the target to ignore you for 3 seconds, or until you attack it again",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=108>If you are using the Priest skill and you have not been attacked in the past 15 seconds, your Power Regeneration is +5 (meaning you recover this Power every 5 seconds, in and out of combat)",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=108>Your attacks deal +1 damage to Fey",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2190>Double Hit ignites the target, dealing 18 Fire damage over 12 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=108>Your melee attacks deal +6 damage to Elite enemies",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2189>Lunge hits all enemies within 5 meters, but deals -50% damage and reuse timer is +2 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3594>Fending Blade deals +7 damage and reduces Rage by 30",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3421>Pin boosts Core Attack and Nice Attack Damage +8 for 7 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3784><icon=3782>Astral Strike deals +10 damage and resets the timer on Pixie Flare (so it can be used again immediately)",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3542>Deathscream has a 60% chance to deal +25% damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2208><icon=3436>Scintillating Flame and Scintillating Frost Damage +1 and Power Cost -2",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3778><icon=3773>Controlled Burn and Aggression Deterrent deal +10 damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3776>Coordinated Assault causes all allies' melee attacks to deal up to +15 damage (randomly determined for each attack) for 30 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2200><icon=2199><icon=2201>Summoned Skeletons have +8 health",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3697>Carrot Power's reuse timer is -1 second and chance to consume carrot is -4%",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3254>Grappling Web deals 48 Poison damage over 12 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=108>While the Shield skill is active, you mitigate 1 point of attack damage for every 20 Armor you have remaining. (Normally, you would mitigate 1 for every 25 Armor remaining.)",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3631>Restorative Arrow boosts target's Nice Attack and Epic Attack Damage +12 for 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3483>Brambleskin increases your Max Armor by +20 for 30 seconds and restores 20 Armor",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3496>Your Cold Sphere's attacks deal +2 damage and taunt -3%",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3069>Calefaction restores 14 Health",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2150>Chew Cud's chance to consume grass is -4%<icon=3443>Flashing Strike heals you for 3 health",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2253>Tough Hoof immediately restores 13 armor",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3252>Incubated Spiders have +10 armor",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3726>Admonish makes the target 1% more vulnerable to Psychic damage for 10 seconds (this effect does not stack with itself)",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3486>Slashing Strike deals +6% damage and hastens the current reuse timer of Hip Throw by 2 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2113>Many Cuts deals +15 armor damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2193>All Staff attacks have a 1.75% chance to trigger the target's Vulnerability",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3672>Blast of Despair restores 4 Armor to you",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2131>Smell Fear deals +6% damage and taunts -30",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2236><icon=2196>Heal Undead and Rebuild Undead restore +6 Health/Armor",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3797>Spirit Pounce Damage +5% and there's a 50% chance target is Stunned",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3730>Unfetter boosts swim speed +0.4 m/s for 20 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2174>Your golem minion's Self Destruct deals +30 damage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3672>Blast of Despair damage is +10% and reduces 10 more Rage",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2209>Room-Temperature Ball Damage +5% and reuse timer -1 second",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2195>Raised Zombies deal +1 damage and speed is +2",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3203><icon=3202><icon=3746>Psi Health Wave, Armor Wave, and Power Wave grant all targets +10 Psychic Damage for 60 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3270><icon=3070><icon=3430>Electrify, System Shock, and Panic Charge restore 2 Health after a 15 second delay",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2147>Moo of Calm restores +6 armor",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3800>Galvanize restores 6 additional Power after a 6-second delay",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2150>Chew Cud increases your mitigation versus Crushing, Slashing, and Piercing attacks +3 for 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3491>Ice Nova restores 10 Armor to you",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3485>Cloud Sight causes target's attacks to have +5% more chance of missing, but Power cost is +15%",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2147>For 30 seconds after you use Moo of Calm, any internal (Poison/Trauma/Psychic) attacks that hit you are reduced by 2. This absorbed damage is added to your next Stampede attack at a 200% rate.",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=3597>Gut deals +4% damage and reuse timer is -1 second",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
        test_icon_id_effect(
            &parser,
            "<icon=2184><icon=2178><icon=2171>All bomb attacks ignite the target, causing them to take 35 fire damage over 10 seconds",
            vec![],
            vec![ItemEffect::FlatDamage(50_000)],
            0,
            0,
        );
    }
}
