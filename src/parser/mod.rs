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
    RangeFlatDamage {
        min_damage: i32,
        max_damage: i32,
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
    KeywordFlatDamageBuff {
        keyword: String,
        damage: i32,
        duration: i32,
    },
    // KeywordDamageModBuff {
    //     keyword: String,
    //     damage_mod: f32,
    //     duration: i32,
    // },
    VulnerabilityDamageModDebuff {
        damage_type: DamageType,
        damage_mod: f32,
        duration: i32,
    },
    VulnerabilityFlatDamageDebuff {
        damage_type: DamageType,
        damage: i32,
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
    range_flat_damage: Regex,
    damage_mod: Regex,
    proc_damage_mod: Regex,
    dot_damage: Regex,
    restore_health: Regex,
    restore_armor: Regex,
    restore_power: Regex,
    damage_type: Regex,
    racials: Regex,
    damage_type_buff: Regex,
    keyword_next_attack_buff: Regex,
    keyword_core_attack_buff: Regex,
    keyword_nip_buff: Regex,
    vulnerability_damage_mod_debuff: Regex,
    vulnerability_flat_damage_debuff: Regex,
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
            flat_damage: Regex::new(r"(?:deal|deals|[dD]amage) \+?(?P<damage>[0-9]+) ?(?:$|\.|and|damage|armor damage|direct damage|direct health damage)").unwrap(),
            proc_flat_damage:  Regex::new(r"(?P<chance>[0-9]+)% chance to deal \+(?P<damage>[0-9]+) damage").unwrap(),
            range_flat_damage: Regex::new(r"between \+?(?P<min_damage>[0-9]+) and \+?(?P<max_damage>[0-9]+) extra damage").unwrap(),
            damage_mod: Regex::new(r"(?:deals|[dD]amage) \+?(?P<damage>[0-9]+)% ?(?:$|damage|and)").unwrap(),
            proc_damage_mod:  Regex::new(r"(?P<chance>[0-9]+)% chance to deal \+(?P<damage>[0-9]+)% damage").unwrap(),
            dot_damage:
                Regex::new(r"(?:deal|deals|deals an additional) \+?(?P<damage>[0-9]+).*(?:damage over|damage to melee attackers)")
                    .unwrap(),
            restore_health:
                Regex::new(r"(?:restore|restores|regain|heals|heals you for) \+?(?P<restore>[0-9]+) [hH]ealth")
                    .unwrap(),
            restore_armor:
                Regex::new(r"(?:restore|restores|and|heals you for) \+?(?P<restore>[0-9]+) [aA]rmor").unwrap(),
            restore_power:
                Regex::new(r"(?:restore|restores) \+?(?P<restore>[0-9]+) [pP]ower").unwrap(),
            damage_type: Regex::new(r"[dD]amage(?:| type) becomes (?P<damage_type>[a-zA-Z]*)").unwrap(),
            racials: Regex::new(r"(?:Humans|Orcs|Elves|Dwarves|Rakshasa) gain \+?(?:[0-9]+) Max (?:Health|Hydration|Metabolism|Power|Armor|Bodyheat)").unwrap(),
            damage_type_buff: Regex::new(r"(?P<damage_type>Slashing) damage \+(?P<damage_mod>[0-9]+)% for (?P<duration>[0-9]+) seconds").unwrap(),
            keyword_next_attack_buff: Regex::new(r"next attack to deal \+?(?P<damage>[0-9]+) damage if it is a (?P<keyword>Werewolf) (?:ability|attack)").unwrap(),
            keyword_core_attack_buff: Regex::new(r"Core Attack Damage \+?(?P<damage>[0-9]+) for (?P<duration>[0-9]+) seconds").unwrap(),
            keyword_nip_buff: Regex::new(r"Nip boosts the damage of Basic, Core, and Nice attacks \+?(?P<damage>[0-9]+) for (?P<duration>[0-9]+) seconds").unwrap(),
            vulnerability_damage_mod_debuff: Regex::new(r"(?P<damage_mod>[0-9]+)% more vulnerable to (?P<damage_type>Electricity) damage for (?P<duration>[0-9]+) seconds").unwrap(),
            vulnerability_flat_damage_debuff: Regex::new(r"suffer \+?(?P<damage>[0-9]+) damage from direct (?P<damage_type>Cold) attacks for (?P<duration>[0-9]+) seconds").unwrap(),
        }
    }

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
            || effect_desc.contains("reuse time")
            || effect_desc.contains("Reuse Time")
            || effect_desc.contains("Rage")
            || effect_desc.contains("rage")
            || effect_desc.contains("total damage against Demons")
            || effect_desc.contains("hits all enemies within 5 meters")
            || effect_desc.contains("deal -1 damage for")
            || effect_desc.contains("8-second delay")
            || effect_desc.contains("Evasion")
            || effect_desc.contains("Max Armor")
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
            // Specifically block this from applying to "next attack" buffs as well
            if !effect_desc.contains("your next attack to") {
                new_effects.push(ItemEffect::FlatDamage(
                    caps.name("damage")
                        .unwrap()
                        .as_str()
                        .parse::<i32>()
                        .unwrap(),
                ));
            }
        }
        if let Some(caps) = self.regex.damage_mod.captures(effect_desc) {
            new_effects.push(ItemEffect::DamageMod(
                caps.name("damage")
                    .unwrap()
                    .as_str()
                    .parse::<f32>()
                    .unwrap()
                    / 100.0,
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
        if let Some(caps) = self.regex.range_flat_damage.captures(effect_desc) {
            new_effects.push(ItemEffect::RangeFlatDamage {
                min_damage: caps
                    .name("min_damage")
                    .unwrap()
                    .as_str()
                    .parse::<i32>()
                    .unwrap(),
                max_damage: caps
                    .name("max_damage")
                    .unwrap()
                    .as_str()
                    .parse::<i32>()
                    .unwrap(),
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
        if let Some(caps) = self.regex.keyword_next_attack_buff.captures(effect_desc) {
            new_effects.push(ItemEffect::KeywordFlatDamageBuff {
                keyword: caps.name("keyword").unwrap().as_str().to_string(),
                damage: caps
                    .name("damage")
                    .unwrap()
                    .as_str()
                    .parse::<i32>()
                    .unwrap(),
                duration: 1,
            });
        }
        if let Some(caps) = self.regex.keyword_core_attack_buff.captures(effect_desc) {
            new_effects.push(ItemEffect::KeywordFlatDamageBuff {
                keyword: "CoreAttack".to_string(),
                damage: caps
                    .name("damage")
                    .unwrap()
                    .as_str()
                    .parse::<i32>()
                    .unwrap(),
                duration: caps
                    .name("duration")
                    .unwrap()
                    .as_str()
                    .parse::<i32>()
                    .unwrap(),
            });
        }
        if let Some(caps) = self.regex.keyword_nip_buff.captures(effect_desc) {
            let damage = caps
                .name("damage")
                .unwrap()
                .as_str()
                .parse::<i32>()
                .unwrap();
            let duration = caps
                .name("duration")
                .unwrap()
                .as_str()
                .parse::<i32>()
                .unwrap();
            new_effects.push(ItemEffect::KeywordFlatDamageBuff {
                keyword: "BasicAttack".to_string(),
                damage,
                duration,
            });
            new_effects.push(ItemEffect::KeywordFlatDamageBuff {
                keyword: "CoreAttack".to_string(),
                damage,
                duration,
            });
            new_effects.push(ItemEffect::KeywordFlatDamageBuff {
                keyword: "NiceAttack".to_string(),
                damage,
                duration,
            });
        }
        if let Some(caps) = self
            .regex
            .vulnerability_damage_mod_debuff
            .captures(effect_desc)
        {
            new_effects.push(ItemEffect::VulnerabilityDamageModDebuff {
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
        if let Some(caps) = self
            .regex
            .vulnerability_flat_damage_debuff
            .captures(effect_desc)
        {
            new_effects.push(ItemEffect::VulnerabilityFlatDamageDebuff {
                damage_type: DamageType::from_str(caps.name("damage_type").unwrap().as_str())
                    .expect("Failed to parse damage type string as enum"),
                damage: caps
                    .name("damage")
                    .unwrap()
                    .as_str()
                    .parse::<i32>()
                    .unwrap(),
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
        let extra = caps.name("extra").unwrap().as_str();
        if !extra.is_empty() {
            item_mods.warnings.push(format!("pgsim doesn't handle extra attribute modifiers and assumes they are all active: {}", effect_desc));
        }
        let effect;
        if attribute.starts_with("BOOST") {
            effect =
                ItemEffect::FlatDamage(caps.name("mod").unwrap().as_str().parse::<i32>().unwrap());
        } else if attribute.starts_with("MOD") {
            effect =
                ItemEffect::DamageMod(caps.name("mod").unwrap().as_str().parse::<f32>().unwrap());
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
        effects.push(effect);
    }

    fn is_explicitly_ignored(&self, effect_desc: &str) -> bool {
        self.regex.racials.is_match(effect_desc)
            || effect_desc.contains("Combat XP when feeling")
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
            || effect_desc.contains("Provoke Undead causes your minions to deal")
            || effect_desc
                .contains("Shield Team causes all targets' Survival Utility abilities to restore")
            || effect_desc.contains("Psi Health Wave grants all targets")
            || effect_desc.contains("If Screech, Sonic Burst, or Deathscream deal Trauma damage")
            || effect_desc.contains("Frenzy boosts targets'")
            || effect_desc.contains("Power every 20 seconds")
            || effect_desc.contains("Power every 5 seconds")
            || effect_desc.contains("Health every 5 seconds")
            || effect_desc.contains("Chance to Ignore Knockbacks")
            || effect_desc.contains("Major Healing abilities")
            || effect_desc.contains("After using Doe Eyes, your next attack deals")
            || effect_desc.contains("damage to undead")
            || effect_desc.contains("mitigation")
            || effect_desc.contains("Mitigation")
            || effect_desc.contains("Indirect Nature and Indirect Electricity damage")
            || effect_desc.contains("Indirect Poison and Indirect Trauma damage")
            || effect_desc.contains("Toxic Irritant boosts your Nice Attack Damage")
            || effect_desc.contains("Melee attacks deal")
            || effect_desc.contains("Max Power")
            || effect_desc.contains("Max Health")
            || effect_desc.starts_with("Fairies gain")
            || effect_desc.starts_with("(Wax)")
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
            || effect_desc.starts_with("{ABILITY_RESETTIME_")
            || effect_desc.starts_with("{SKILL_RESETTIME_")
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
            || effect_desc.starts_with("{FLY_INCOMBAT_COST_PER_SEC}")
            || effect_desc.starts_with("{NONCOMBAT_SPRINT_BOOST}")
            || effect_desc.starts_with("{JUMP_BURST}")
            || effect_desc.starts_with("{SWIM_FASTSPEED_BOOST}")
            || effect_desc.starts_with("{SPRINT_BOOST}")
    }
}

#[cfg(test)]
mod tests;
