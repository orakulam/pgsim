use regex::Regex;
use std::collections::HashMap;
use std::str::FromStr;

pub mod data;
use data::DamageType;
use data::Data;

#[derive(Debug, PartialEq, PartialOrd, Clone)]
pub enum Effect {
    FlatDamage(i32),
    ProcFlatDamage { damage: i32, chance: f32 },
    RangeFlatDamage { min_damage: i32, max_damage: i32 },
    DamageMod(f32),
    ProcDamageMod { damage_mod: f32, chance: f32 },
    DotDamage(i32),
    RestoreHealth(i32),
    RestoreArmor(i32),
    RestorePower(i32),
    DamageType(DamageType),
    Buff(Buff),
    Debuff(Debuff),
}

#[derive(Debug, PartialEq, PartialOrd, Clone)]
pub struct Buff {
    pub remaining_duration: i32,
    pub effect: BuffEffect,
}

#[derive(Debug, PartialEq, PartialOrd, Clone)]
pub enum BuffEffect {
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

#[derive(Debug, PartialEq, PartialOrd, Clone)]
pub struct Debuff {
    pub remaining_duration: i32,
    pub effect: DebuffEffect,
}

#[derive(Debug, PartialEq, PartialOrd, Clone)]
pub enum DebuffEffect {
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

#[derive(Debug, Clone)]
pub struct ItemMods {
    pub icon_id_effects: HashMap<i32, Vec<Effect>>,
    pub attribute_effects: HashMap<String, Vec<Effect>>,
    pub warnings: Vec<String>,
    pub not_implemented: Vec<String>,
}

struct ParserRegex {
    icon_ids: Regex,
    attribute_effects: Regex,
    flat_damage: Regex,
    proc_flat_damage: Regex,
    range_flat_damage: Regex,
    range_up_to_damage: Regex,
    damage_mod: Regex,
    proc_damage_mod: Regex,
    dot_damage: Regex,
    restore_health: Regex,
    restore_armor: Regex,
    restore_power: Regex,
    damage_type: Regex,
    racials: Regex,
    damage_type_damage_mod_buff: Regex,
    damage_type_damage_mod_buff2: Regex,
    damage_type_damage_mod_buff3: Regex,
    damage_type_next_attack_buff: Regex,
    keyword_next_attack_buff: Regex,
    keyword_kick_buff: Regex,
    keyword_core_attack_buff: Regex,
    keyword_nice_attack_buff: Regex,
    keyword_epic_attack_damage_mod_buff: Regex,
    keyword_melee_flat_damage_buff: Regex,
    keyword_signature_debuff_buff: Regex,
    vulnerability_damage_mod_debuff: Regex,
    vulnerability_flat_damage_debuff: Regex,
    nip_buff: Regex,
    fairy_fire_buff: Regex,
    skulk_buff: Regex,
    infinite_legs_buff: Regex,
    poisoners_cut_buff: Regex,
    poisoners_cut_item_buff: Regex,
    give_warmth_buff: Regex,
    fill_with_bile_buff: Regex,
    privacy_field: Regex,
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
        ParserRegex {
            icon_ids: Regex::new(r"<icon=([0-9]+)>").unwrap(),
            attribute_effects: Regex::new(
                r"\{(?P<attribute>[_A-Z]*)\}\{(?P<mod>[+-]?[0-9]*[.]?[0-9]+)\}(?P<extra>$|\{[a-zA-Z]*\})",
            )
            .unwrap(),
            flat_damage: Regex::new(r"(?:deal|deals|[dD]amage|damage is|dealing an additional) \+?(?P<damage>[0-9]+) ?(?:$|\. Damage|and|damage|[aA]rmor damage|direct damage|direct health damage)").unwrap(),
            proc_flat_damage:  Regex::new(r"(?P<chance>[0-9]+)% chance to deal \+(?P<damage>[0-9]+) damage").unwrap(),
            range_flat_damage: Regex::new(r"between \+?(?P<min_damage>[0-9]+) and \+?(?P<max_damage>[0-9]+) extra damage").unwrap(),
            range_up_to_damage: Regex::new(r"up to \+?(?P<max_damage>[0-9]+) damage").unwrap(),
            damage_mod: Regex::new(r"(?:deal|deals|[dD]amage) \+?(?P<damage_mod>[0-9]*[.]?[0-9]+)% ?(?:$|damage|direct damage|and|Crushing damage)").unwrap(),
            proc_damage_mod:  Regex::new(r"(?P<chance>[0-9]+)% (?:chance to deal|chance it deals) \+(?P<damage_mod>[0-9]+)% damage").unwrap(),
            dot_damage:
                Regex::new(r"(?:deal|deals|Deals|deals an additional|causes|dealing|target to take) \+?(?P<damage>[0-9]+).*(?:damage over|damage to melee attackers|Nature damage over|Trauma damage over|Poison damage to health over)")
                    .unwrap(),
            restore_health:
                Regex::new(r"(?:restore|[rR]estores|regain|heals|heals you for|recover) \+?(?P<restore>[0-9]+) [hH]ealth")
                    .unwrap(),
            restore_armor:
                Regex::new(r"(?:restore|restores|and|heals you for) \+?(?P<restore>[0-9]+) [aA]rmor").unwrap(),
            restore_power:
                Regex::new(r"(?:restore|restores|regain) \+?(?P<restore>[0-9]+) [pP]ower").unwrap(),
            damage_type: Regex::new(r"(?:becomes|deals|changed to) (?P<damage_type>Trauma|Fire|Darkness|Electricity)").unwrap(),
            racials: Regex::new(r"(?:Humans|Orcs|Elves|Dwarves|Rakshasa) gain \+?(?:[0-9]+) Max (?:Health|Hydration|Metabolism|Power|Armor|Bodyheat)").unwrap(),
            damage_type_damage_mod_buff: Regex::new(r"(?P<damage_type>Slashing|Electricity|Cold|Crushing|Slashing|Fire)(?:| attack) [dD]amage \+(?P<damage_mod>[0-9]+)% for (?P<duration>[0-9]+) seconds").unwrap(),
            damage_type_damage_mod_buff2: Regex::new(r"\+(?P<damage_mod>[0-9]+)% ?(?:|damage from) (?P<damage_type>Piercing|Electricity|Trauma) (?:for|damage from future attacks for|damage for) (?P<duration>[0-9]+) seconds").unwrap(),
            damage_type_damage_mod_buff3: Regex::new(r"For (?P<duration>[0-9]+) seconds, all targets deal \+(?P<damage_mod>[0-9]+)% (?P<damage_type>Crushing) damage").unwrap(),
            damage_type_next_attack_buff: Regex::new(r"next attack(?:| to deal) \+?(?P<damage>[0-9]+)(?:| damage) if it is a (?P<damage_type>Crushing|Darkness) (?:ability|attack)").unwrap(),
            keyword_next_attack_buff: Regex::new(r"next attack(?:| to deal) \+?(?P<damage>[0-9]+)(?:| damage) if it is a (?P<keyword>Werewolf) (?:ability|attack)").unwrap(),
            keyword_kick_buff: Regex::new(r"all kicks \+?(?P<damage>[0-9]+) for (?P<duration>[0-9]+) seconds").unwrap(),
            keyword_core_attack_buff: Regex::new(r"Core Attack(?:s to deal| [dD]amage) \+?(?P<damage>[0-9]+) (?:for|damage for) (?P<duration>[0-9]+) seconds").unwrap(),
            keyword_nice_attack_buff: Regex::new(r"Nice Attack(?:s to deal| [dD]amage) \+?(?P<damage>[0-9]+) (?:for|damage for) (?P<duration>[0-9]+) seconds").unwrap(),
            keyword_epic_attack_damage_mod_buff: Regex::new(r"boost your Epic Attack Damage \+(?P<damage_mod>[0-9]+)% for (?P<duration>[0-9]+) seconds").unwrap(),
            keyword_melee_flat_damage_buff: Regex::new(r"You and your allies' melee attacks deal \+?(?P<damage>[0-9]+) damage for (?P<duration>[0-9]+) seconds").unwrap(),
            keyword_signature_debuff_buff: Regex::new(r"Signature Debuff abilities to deal \+?(?P<damage>[0-9]+) damage for (?P<duration>[0-9]+) seconds").unwrap(),
            vulnerability_damage_mod_debuff: Regex::new(r"(?P<damage_mod>[0-9]+)% (?:more vulnerable to|damage from other|damage from) (?P<damage_type>Electricity|Trauma|Darkness|Crushing|Slashing|Poison) ?(?:|damage|attacks) for (?P<duration>[0-9]+) seconds").unwrap(),
            vulnerability_flat_damage_debuff: Regex::new(r"(?:suffer|take) \+?(?P<damage>[0-9]+) damage from(?:| direct) (?P<damage_type>Cold|Psychic) attacks for (?P<duration>[0-9]+) seconds").unwrap(),
            nip_buff: Regex::new(r"Nip boosts the damage of Basic, Core, and Nice attacks \+?(?P<damage>[0-9]+) for (?P<duration>[0-9]+) seconds").unwrap(),
            fairy_fire_buff: Regex::new(r"Fairy Fire causes your next attack to deal \+?(?P<damage>[0-9]+) damage if it's a Psychic, Electricity, or Fire attack").unwrap(),
            skulk_buff: Regex::new(r"Skulk boosts the damage of your Core and Nice Attacks \+?(?P<damage>[0-9]+) for (?P<duration>[0-9]+) seconds").unwrap(),
            infinite_legs_buff: Regex::new(r"For (?P<duration>[0-9]+) seconds, additional Infinite Legs attacks deal \+?(?P<damage>[0-9]+) damage").unwrap(),
            poisoners_cut_buff: Regex::new(r"For (?P<duration>[0-9]+) seconds, you gain Direct Poison Damage \+?(?P<damage>[0-9]+) and Indirect Poison Damage \+?(?P<per_tick_damage>[0-9]+) per tick").unwrap(),
            poisoners_cut_item_buff: Regex::new(r"Poisoner's Cut boosts Indirect Poison Damage an additional \+?(?P<per_tick_damage>[0-9]+) per tick").unwrap(),
            give_warmth_buff: Regex::new(r"Give Warmth boosts the target's fire damage-over-time by \+?(?P<per_tick_damage>[0-9]+) per tick for (?P<duration>[0-9]+) seconds").unwrap(),
            fill_with_bile_buff: Regex::new(r"Target's Poison attacks deal \+?(?P<damage>[0-9]+) damage, and Poison damage-over-time attacks deal \+?(?P<per_tick_damage>[0-9]+) per tick.").unwrap(),
            privacy_field: Regex::new(r"Privacy Field also deals its damage when you are hit by burst attacks, and damage is \+?(?P<damage>[0-9]+)").unwrap(),
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
            not_implemented: vec![],
        };

        for item_id in equipped_items {
            match self.data.items.get(item_id) {
                Some(item) => {
                    if let Some(effect_descs) = &item.effect_descs {
                        for effect_desc in effect_descs {
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
                                if self.regex.icon_ids.is_match(effect_desc) {
                                    self.calculate_icon_id_effect_desc(&mut item_mods, effect_desc);
                                } else if self.regex.attribute_effects.is_match(effect_desc) {
                                    self.calculate_attribute_effect_desc(
                                        &mut item_mods,
                                        effect_desc,
                                    );
                                } else {
                                    if self.regex.racials.is_match(effect_desc)
                                        || effect_desc.contains("Combat XP when feeling")
                                        || effect_desc.contains("Indirect Nature and Indirect Electricity damage")
                                        || effect_desc.contains("Indirect Poison and Indirect Trauma damage")
                                        || effect_desc.contains("Toxic Irritant boosts your Nice Attack Damage")
                                        || effect_desc.contains("Melee attacks deal")
                                        || effect_desc.contains("Max Power")
                                        || effect_desc.contains("Max Health")
                                        || effect_desc.contains("While Spider skill is active, gain Direct Poison and Acid Mitigation")
                                        || effect_desc.starts_with("Fairies gain")
                                        || effect_desc.starts_with("(Wax)") {
                                        item_mods.warnings.push(format!(
                                            "Ignored generic item mod: {}",
                                            effect_desc
                                        ));
                                    } else {
                                        item_mods.not_implemented.push(format!(
                                            "Unknown type of effect desc: {}",
                                            effect_desc
                                        ));
                                    }
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

    pub fn get_effects_from_special_info(
        &self,
        warnings: &mut Vec<String>,
        special_info: &str,
    ) -> Option<Vec<Effect>> {
        let effects = self.get_effects_and_add_warnings_from_desc(warnings, special_info);
        if !effects.is_empty() {
            Some(effects)
        } else {
            None
        }
    }

    fn calculate_icon_id_effect_desc(&self, item_mods: &mut ItemMods, effect_desc: &str) {
        // Specifically ignore icon_id 108s for now (generic mods of some flavor)
        if effect_desc.contains("<icon=108>") {
            item_mods
                .warnings
                .push(format!("Ignored generic mod: {}", effect_desc));
            return;
        }
        let new_effects =
            self.get_effects_and_add_warnings_from_desc(&mut item_mods.warnings, effect_desc);
        // This is an Icon ID style effect desc
        for caps in self.regex.icon_ids.captures_iter(effect_desc) {
            let icon_id = caps.get(1).unwrap().as_str().parse::<i32>().unwrap();
            // Get current effects, or insert an empty vec
            let effects = item_mods.icon_id_effects.entry(icon_id).or_insert(vec![]);
            // Extend current effects vec with our new list of effects
            effects.extend(new_effects.clone());
        }
    }

    fn get_effects_and_add_warnings_from_desc(
        &self,
        warnings: &mut Vec<String>,
        effect_desc: &str,
    ) -> Vec<Effect> {
        // Add warnings that prevent further parsing of the effect desc
        let not_supported_tests = vec![
            "Power over",
            "Power every",
            "Health every",
            "Health over",
            "after a 5 second delay",
            "after a 6-second delay",
            "after a 10-second delay",
            "after a 15 second delay",
            "after a 20 second delay",
            "after a 25 second delay",
            "every 2 seconds",
            "every other seconds",
            "every few seconds",
            "every 4 seconds",
            "every 5 seconds",
            "every five seconds",
            "boosts your movement speed",
            "Sprint Speed",
            "Combo: ",
            "Provoke Undead",
            "Shield Team causes all targets' Survival Utility abilities to restore",
            "Frenzy boosts targets'",
            "After using Doe Eyes, your next attack deals",
            "damage to undead",
            "Strategic Preparation boosts your in-combat Armor regeneration",
            "damage from indirect Fire",
            "Rage Attacks",
            "Blood of the Pack causes you and your allies' attacks to deal",
            "Knockback",
            "Future Deer Kicks",
            "undead",
            "Arthropods",
            "Harmlessness confuses the target",
            "Panic Charge boosts the damage of all your attacks",
            "steals",
            "reaps",
            "While Unarmed skill active",
            "damage to the target each time they attack and damage you",
            "After using Wild Endurance, your next",
            "Nimble Limbs heals your pet",
            "more XP",
            "causes the next attack that hits you to deal",
            "golem minion",
            "your pet",
            "evasion",
            "knocked down",
            "Summoned Skeletons",
            "damage to targets that are covered in Fairy Fire",
            "near your Web Trap",
        ];
        for test in not_supported_tests {
            if effect_desc.contains(test) {
                warnings.push(format!(
                    "Not supported, matched against \"{}\": {}",
                    test, effect_desc
                ));
                return vec![];
            }
        }
        // Add warnings
        let partially_supported_tests = vec![
            "taunt",
            "If you use Premeditated Doom while standing near your Web Trap",
            "chance to avoid being hit by burst attacks",
            "For 12 seconds after using Infinite Legs",
            "Chew Cud increases your mitigation versus all attacks by Elites",
            "When you are hit, Finish It damage is",
            "When Skulk is used, you recover",
            "Your Knee Spikes mutation causes kicks to deal an additional",
            "Coordinated Assault grants all allies",
            "Squeal uniformly diminishes all targets' entire aggro lists",
            "Psi Health Wave grants all targets",
            "If Screech, Sonic Burst, or Deathscream deal Trauma damage",
            "Major Healing abilities",
            "mitigation",
            "Mitigation",
            "Protection",
            "take half damage",
            "mitigates",
            "target is not focused on you",
            "terrifies the target",
            "to non-Elite targets",
            "reset timer",
            "reset the timer",
            "reuse time",
            "Reuse Time",
            "resets the timer",
            " rage",
            "total damage against Demons",
            "within 5 meters",
            "within 6 meters",
            "deal -1 damage for",
            "8-second delay",
            "doesn't cause the target to yell for help",
            "takes +1 second to channel",
            "Evasion",
            "Max Armor",
            "Max Health",
            "Accuracy",
            "range",
            "stacks",
            "Stacks",
            "slows",
            "gives you 50% resistance to Darkness damage",
            "resistant to Fire damage",
            "power cost",
            "Power cost",
            "Power Cost",
            "Power and",
            "Hammer attacks cost",
            "removes ongoing",
            "that hit a single target",
            "damage to Aberrations",
            "resistance",
            "stuns the target if they are not focused on you",
            "raises Basic Attack Damage",
            "Pin causes target's attacks to deal",
            "Your Cold Sphere gains",
            "Body Heat",
        ];
        for test in partially_supported_tests {
            if effect_desc.contains(test) {
                warnings.push(format!(
                    "Partially supported, matched against \"{}\": {}",
                    test, effect_desc
                ));
                // We only care about the first warning, otherwise it gets spammy
                // TODO: Could refine this a bit in the future
                break;
            }
        }
        // Special logic warnings
        if warnings.len() == 0 && !effect_desc.contains("Monstrous") && effect_desc.contains("Rage")
        {
            warnings.push(format!(
                "Partially supported, matched against \"Rage\": {}",
                effect_desc
            ));
        }
        // Collect all item effects
        let mut effects = vec![];
        if let Some(caps) = self.regex.flat_damage.captures(effect_desc) {
            // Specific exclusions
            if !effect_desc.contains("<icon=3672>")
                && !effect_desc.contains("<icon=2224>")
                && !effect_desc.contains("<icon=3775>")
                && !effect_desc.contains("<icon=2155>")
                && !effect_desc.contains("Apprehend causes your Nice Attacks to deal")
                && !effect_desc.contains("Fire Breath and Super Fireball deal")
                && !effect_desc.contains("melee attacks deal")
                && !effect_desc.contains("For 5 seconds, you gain Direct Poison Damage")
                && !effect_desc.contains("Target's Poison attacks deal")
                && !effect_desc.contains("Spit Acid causes your Signature Debuff abilities to deal")
                && !effect_desc.contains("additional Infinite Legs attacks")
            {
                // Specifically block this from applying to "next attack" buffs as well
                if !effect_desc.contains("your next attack to") {
                    effects.push(Effect::FlatDamage(Parser::get_cap_number(&caps, "damage")));
                }
            }
        }
        if let Some(caps) = self.regex.proc_damage_mod.captures(effect_desc) {
            effects.push(Effect::ProcDamageMod {
                damage_mod: Parser::get_cap_damage_mod(&caps, "damage_mod"),
                chance: Parser::get_cap_damage_mod(&caps, "chance"),
            });
        // Hard to differentiate between these two, so we use an else if here since they never seem to coexist
        } else if let Some(caps) = self.regex.damage_mod.captures(effect_desc) {
            // Specific exclusions
            if !effect_desc.contains("<icon=3727>")
                && !effect_desc.contains("For 10 seconds, all targets deal")
            {
                effects.push(Effect::DamageMod(Parser::get_cap_damage_mod(
                    &caps,
                    "damage_mod",
                )));
            }
        }
        if let Some(caps) = self.regex.dot_damage.captures(effect_desc) {
            effects.push(Effect::DotDamage(Parser::get_cap_number(&caps, "damage")));
        }
        if let Some(caps) = self.regex.restore_health.captures(effect_desc) {
            effects.push(Effect::RestoreHealth(Parser::get_cap_number(
                &caps, "restore",
            )));
        }
        if let Some(caps) = self.regex.restore_armor.captures(effect_desc) {
            effects.push(Effect::RestoreArmor(Parser::get_cap_number(
                &caps, "restore",
            )));
        }
        if let Some(caps) = self.regex.restore_power.captures(effect_desc) {
            effects.push(Effect::RestorePower(Parser::get_cap_number(
                &caps, "restore",
            )));
        }
        if let Some(caps) = self.regex.proc_flat_damage.captures(effect_desc) {
            effects.push(Effect::ProcFlatDamage {
                damage: Parser::get_cap_number(&caps, "damage"),
                chance: Parser::get_cap_damage_mod(&caps, "chance"),
            });
        }
        if let Some(caps) = self.regex.range_flat_damage.captures(effect_desc) {
            effects.push(Effect::RangeFlatDamage {
                min_damage: Parser::get_cap_number(&caps, "min_damage"),
                max_damage: Parser::get_cap_number(&caps, "max_damage"),
            });
        }
        if let Some(caps) = self.regex.range_up_to_damage.captures(effect_desc) {
            effects.push(Effect::RangeFlatDamage {
                min_damage: 0,
                max_damage: Parser::get_cap_number(&caps, "max_damage"),
            });
        }
        if let Some(caps) = self.regex.damage_type.captures(effect_desc) {
            effects.push(Effect::DamageType(
                DamageType::from_str(Parser::get_cap_string(&caps, "damage_type"))
                    .expect("Failed to parse damage type string as enum"),
            ));
        }
        if let Some(caps) = self.regex.damage_type_damage_mod_buff.captures(effect_desc) {
            effects.push(Effect::Buff(Buff {
                remaining_duration: Parser::get_cap_number(&caps, "duration"),
                effect: BuffEffect::DamageTypeDamageModBuff {
                    damage_type: DamageType::from_str(Parser::get_cap_string(&caps, "damage_type"))
                        .expect("Failed to parse damage type string as enum"),
                    damage_mod: Parser::get_cap_damage_mod(&caps, "damage_mod"),
                },
            }));
        }
        if let Some(caps) = self
            .regex
            .damage_type_damage_mod_buff2
            .captures(effect_desc)
        {
            effects.push(Effect::Buff(Buff {
                remaining_duration: Parser::get_cap_number(&caps, "duration"),
                effect: BuffEffect::DamageTypeDamageModBuff {
                    damage_type: DamageType::from_str(Parser::get_cap_string(&caps, "damage_type"))
                        .expect("Failed to parse damage type string as enum"),
                    damage_mod: Parser::get_cap_damage_mod(&caps, "damage_mod"),
                },
            }));
        }
        if let Some(caps) = self
            .regex
            .damage_type_damage_mod_buff3
            .captures(effect_desc)
        {
            effects.push(Effect::Buff(Buff {
                remaining_duration: Parser::get_cap_number(&caps, "duration"),
                effect: BuffEffect::DamageTypeDamageModBuff {
                    damage_type: DamageType::from_str(Parser::get_cap_string(&caps, "damage_type"))
                        .expect("Failed to parse damage type string as enum"),
                    damage_mod: Parser::get_cap_damage_mod(&caps, "damage_mod"),
                },
            }));
        }
        if let Some(caps) = self
            .regex
            .damage_type_next_attack_buff
            .captures(effect_desc)
        {
            effects.push(Effect::Buff(Buff {
                remaining_duration: 1,
                effect: BuffEffect::DamageTypeFlatDamageBuff {
                    damage_type: DamageType::from_str(Parser::get_cap_string(&caps, "damage_type"))
                        .expect("Failed to parse damage type string as enum"),
                    damage: Parser::get_cap_number(&caps, "damage"),
                },
            }));
        }
        if let Some(caps) = self.regex.keyword_next_attack_buff.captures(effect_desc) {
            effects.push(Effect::Buff(Buff {
                remaining_duration: 1,
                effect: BuffEffect::KeywordFlatDamageBuff {
                    keyword: Parser::get_cap_string(&caps, "keyword").to_string(),
                    damage: Parser::get_cap_number(&caps, "damage"),
                },
            }));
        }
        if let Some(caps) = self.regex.keyword_kick_buff.captures(effect_desc) {
            effects.push(Effect::Buff(Buff {
                remaining_duration: Parser::get_cap_number(&caps, "duration"),
                effect: BuffEffect::KeywordFlatDamageBuff {
                    keyword: "Kick".to_string(),
                    damage: Parser::get_cap_number(&caps, "damage"),
                },
            }));
        }
        if let Some(caps) = self.regex.keyword_core_attack_buff.captures(effect_desc) {
            effects.push(Effect::Buff(Buff {
                remaining_duration: Parser::get_cap_number(&caps, "duration"),
                effect: BuffEffect::KeywordFlatDamageBuff {
                    keyword: "CoreAttack".to_string(),
                    damage: Parser::get_cap_number(&caps, "damage"),
                },
            }));
        }
        if let Some(caps) = self.regex.keyword_nice_attack_buff.captures(effect_desc) {
            effects.push(Effect::Buff(Buff {
                remaining_duration: Parser::get_cap_number(&caps, "duration"),
                effect: BuffEffect::KeywordFlatDamageBuff {
                    keyword: "NiceAttack".to_string(),
                    damage: Parser::get_cap_number(&caps, "damage"),
                },
            }));
        }
        if let Some(caps) = self
            .regex
            .keyword_epic_attack_damage_mod_buff
            .captures(effect_desc)
        {
            effects.push(Effect::Buff(Buff {
                remaining_duration: Parser::get_cap_number(&caps, "duration"),
                effect: BuffEffect::KeywordDamageModBuff {
                    keyword: "EpicAttack".to_string(),
                    damage_mod: Parser::get_cap_damage_mod(&caps, "damage_mod"),
                },
            }));
        }
        if let Some(caps) = self
            .regex
            .keyword_melee_flat_damage_buff
            .captures(effect_desc)
        {
            effects.push(Effect::Buff(Buff {
                remaining_duration: Parser::get_cap_number(&caps, "duration"),
                effect: BuffEffect::KeywordFlatDamageBuff {
                    keyword: "Melee".to_string(),
                    damage: Parser::get_cap_number(&caps, "damage"),
                },
            }));
        }
        if let Some(caps) = self
            .regex
            .keyword_signature_debuff_buff
            .captures(effect_desc)
        {
            effects.push(Effect::Buff(Buff {
                remaining_duration: Parser::get_cap_number(&caps, "duration"),
                effect: BuffEffect::KeywordFlatDamageBuff {
                    keyword: "SignatureDebuff".to_string(),
                    damage: Parser::get_cap_number(&caps, "damage"),
                },
            }));
        }
        if let Some(caps) = self
            .regex
            .vulnerability_damage_mod_debuff
            .captures(effect_desc)
        {
            effects.push(Effect::Debuff(Debuff {
                remaining_duration: Parser::get_cap_number(&caps, "duration"),
                effect: DebuffEffect::VulnerabilityDamageModDebuff {
                    damage_type: DamageType::from_str(Parser::get_cap_string(&caps, "damage_type"))
                        .expect("Failed to parse damage type string as enum"),
                    damage_mod: Parser::get_cap_damage_mod(&caps, "damage_mod"),
                },
            }));
        }
        if let Some(caps) = self
            .regex
            .vulnerability_flat_damage_debuff
            .captures(effect_desc)
        {
            effects.push(Effect::Debuff(Debuff {
                remaining_duration: Parser::get_cap_number(&caps, "duration"),
                effect: DebuffEffect::VulnerabilityFlatDamageDebuff {
                    damage_type: DamageType::from_str(Parser::get_cap_string(&caps, "damage_type"))
                        .expect("Failed to parse damage type string as enum"),
                    damage: Parser::get_cap_number(&caps, "damage"),
                },
            }));
        }
        if let Some(caps) = self.regex.nip_buff.captures(effect_desc) {
            let damage = Parser::get_cap_number(&caps, "damage");
            let duration = Parser::get_cap_number(&caps, "duration");
            effects.push(Effect::Buff(Buff {
                remaining_duration: duration,
                effect: BuffEffect::KeywordFlatDamageBuff {
                    keyword: "BasicAttack".to_string(),
                    damage,
                },
            }));
            effects.push(Effect::Buff(Buff {
                remaining_duration: duration,
                effect: BuffEffect::KeywordFlatDamageBuff {
                    keyword: "CoreAttack".to_string(),
                    damage,
                },
            }));
            effects.push(Effect::Buff(Buff {
                remaining_duration: duration,
                effect: BuffEffect::KeywordFlatDamageBuff {
                    keyword: "NiceAttack".to_string(),
                    damage,
                },
            }));
        }
        if let Some(caps) = self.regex.fairy_fire_buff.captures(effect_desc) {
            let damage = Parser::get_cap_number(&caps, "damage");
            effects.push(Effect::Buff(Buff {
                remaining_duration: 1,
                effect: BuffEffect::DamageTypeFlatDamageBuff {
                    damage_type: DamageType::Psychic,
                    damage,
                },
            }));
            effects.push(Effect::Buff(Buff {
                remaining_duration: 1,
                effect: BuffEffect::DamageTypeFlatDamageBuff {
                    damage_type: DamageType::Electricity,
                    damage,
                },
            }));
            effects.push(Effect::Buff(Buff {
                remaining_duration: 1,
                effect: BuffEffect::DamageTypeFlatDamageBuff {
                    damage_type: DamageType::Fire,
                    damage,
                },
            }));
        }
        if let Some(caps) = self.regex.skulk_buff.captures(effect_desc) {
            let damage = Parser::get_cap_number(&caps, "damage");
            let duration = Parser::get_cap_number(&caps, "duration");
            effects.push(Effect::Buff(Buff {
                remaining_duration: duration,
                effect: BuffEffect::KeywordFlatDamageBuff {
                    keyword: "CoreAttack".to_string(),
                    damage,
                },
            }));
            effects.push(Effect::Buff(Buff {
                remaining_duration: duration,
                effect: BuffEffect::KeywordFlatDamageBuff {
                    keyword: "NiceAttack".to_string(),
                    damage,
                },
            }));
        }
        if let Some(caps) = self.regex.infinite_legs_buff.captures(effect_desc) {
            effects.push(Effect::Buff(Buff {
                remaining_duration: Parser::get_cap_number(&caps, "duration"),
                effect: BuffEffect::KeywordFlatDamageBuff {
                    keyword: "InfiniteLegs".to_string(),
                    damage: Parser::get_cap_number(&caps, "damage"),
                },
            }));
        }
        if let Some(caps) = self.regex.poisoners_cut_buff.captures(effect_desc) {
            let duration = Parser::get_cap_number(&caps, "duration");
            effects.push(Effect::Buff(Buff {
                remaining_duration: duration,
                effect: BuffEffect::DamageTypeFlatDamageBuff {
                    damage_type: DamageType::Poison,
                    damage: Parser::get_cap_number(&caps, "damage"),
                },
            }));
            effects.push(Effect::Buff(Buff {
                remaining_duration: duration,
                effect: BuffEffect::DamageTypePerTickDamageBuff {
                    damage_type: DamageType::Poison,
                    damage: Parser::get_cap_number(&caps, "per_tick_damage"),
                },
            }));
        }
        if let Some(caps) = self.regex.poisoners_cut_item_buff.captures(effect_desc) {
            effects.push(Effect::Buff(Buff {
                remaining_duration: 5,
                effect: BuffEffect::DamageTypePerTickDamageBuff {
                    damage_type: DamageType::Poison,
                    damage: Parser::get_cap_number(&caps, "per_tick_damage"),
                },
            }));
        }
        if let Some(caps) = self.regex.give_warmth_buff.captures(effect_desc) {
            effects.push(Effect::Buff(Buff {
                remaining_duration: Parser::get_cap_number(&caps, "duration"),
                effect: BuffEffect::DamageTypePerTickDamageBuff {
                    damage_type: DamageType::Fire,
                    damage: Parser::get_cap_number(&caps, "per_tick_damage"),
                },
            }));
        }
        if let Some(caps) = self.regex.fill_with_bile_buff.captures(effect_desc) {
            effects.push(Effect::Buff(Buff {
                remaining_duration: 60,
                effect: BuffEffect::DamageTypeFlatDamageBuff {
                    damage_type: DamageType::Poison,
                    damage: Parser::get_cap_number(&caps, "damage"),
                },
            }));
            effects.push(Effect::Buff(Buff {
                remaining_duration: 60,
                effect: BuffEffect::DamageTypePerTickDamageBuff {
                    damage_type: DamageType::Poison,
                    damage: Parser::get_cap_number(&caps, "per_tick_damage"),
                },
            }));
        }
        if let Some(caps) = self.regex.privacy_field.captures(effect_desc) {
            effects.push(Effect::DotDamage(Parser::get_cap_number(&caps, "damage")));
        }
        effects
    }

    fn get_cap_string<'a>(caps: &'a regex::Captures, name: &str) -> &'a str {
        caps.name(name).unwrap().as_str()
    }

    fn get_cap_number(caps: &regex::Captures, name: &str) -> i32 {
        caps.name(name).unwrap().as_str().parse::<i32>().unwrap()
    }

    fn get_cap_damage_mod(caps: &regex::Captures, name: &str) -> f32 {
        caps.name(name).unwrap().as_str().parse::<f32>().unwrap() / 100.0
    }

    fn calculate_attribute_effect_desc(&self, item_mods: &mut ItemMods, effect_desc: &str) {
        if effect_desc.contains("_COST_MOD}")
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
        {
            item_mods
                .warnings
                .push(format!("Ignored attribute mod: {}", effect_desc));
            return;
        }
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
            effect = Effect::FlatDamage(caps.name("mod").unwrap().as_str().parse::<i32>().unwrap());
        } else if attribute.starts_with("MOD") {
            effect = Effect::DamageMod(caps.name("mod").unwrap().as_str().parse::<f32>().unwrap());
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
}

#[cfg(test)]
mod tests;
