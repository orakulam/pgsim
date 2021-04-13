use regex::Regex;
use std::collections::HashMap;
use std::str::FromStr;

pub mod data;
use data::DamageType;
use data::Data;

#[derive(Debug, PartialEq, PartialOrd, Clone)]
pub enum Effect {
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
    DotDamage {
        damage: i32,
        damage_type: DamageType,
        duration: i32,
    },
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
    dot_damage2: Regex,
    dot_damage_thorns: Regex,
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
    keyword_epic_attack_buff: Regex,
    keyword_epic_attack_damage_mod_buff: Regex,
    keyword_melee_flat_damage_buff: Regex,
    keyword_signature_debuff_buff: Regex,
    vulnerability_damage_mod_debuff: Regex,
    vulnerability_damage_mod_debuff2: Regex,
    vulnerability_flat_damage_debuff: Regex,
    nip_buff: Regex,
    pin_buff: Regex,
    restorative_arrow_buff: Regex,
    fairy_fire_buff: Regex,
    skulk_buff: Regex,
    infinite_legs_buff: Regex,
    admonish_buff: Regex,
    poisoners_cut_buff: Regex,
    poisoners_cut_item_buff: Regex,
    premeditated_doom_buff: Regex,
    give_warmth_buff: Regex,
    fill_with_bile_buff: Regex,
    fill_with_bile_item_buff: Regex,
    privacy_field: Regex,
    privacy_field2: Regex,
    fire_breath_super_fireball_dot: Regex,
    bomb_dot: Regex,
    sanguine_fangs_dot: Regex,
    drink_blood_buff: Regex,
    psi_wave_buff: Regex,
    strategic_preparation_buff: Regex,
    cobra_strike_mamba_strike_buff: Regex,
    play_dead_buff: Regex,
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
        let damage_type = r"(?P<damage_type>Slashing|Crushing|Piercing|Trauma|Nothingness|Nature|Potion|Fire|Cold|Poison|Regeneration|Darkness|Acid|Electricity|Psychic|Smiting)";
        ParserRegex {
            icon_ids: Regex::new(r"<icon=([0-9]+)>").unwrap(),
            attribute_effects: Regex::new(
                r"\{(?P<attribute>[_A-Z]*)\}\{(?P<mod>[+-]?[0-9]*[.]?[0-9]+)\}(?P<extra>$|\{[a-zA-Z]*\})",
            )
            .unwrap(),
            flat_damage: Regex::new(r"(?:deal|deals|[dD]amage|damage is|dealing an additional|dealing) \+?(?P<damage>[0-9]+) ?(?:$|\. Damage|and|damage|[aA]rmor damage|direct damage|direct health damage|Piercing damage)").unwrap(),
            proc_flat_damage:  Regex::new(r"(?P<chance>[0-9]+)% chance to deal \+(?P<damage>[0-9]+) damage").unwrap(),
            range_flat_damage: Regex::new(r"between \+?(?P<min_damage>[0-9]+) and \+?(?P<max_damage>[0-9]+) extra damage").unwrap(),
            range_up_to_damage: Regex::new(r"up to \+?(?P<max_damage>[0-9]+) damage").unwrap(),
            damage_mod: Regex::new(r"(?:deal|deals|[dD]amage|damage is) \+?(?P<damage_mod>[0-9]*[.]?[0-9]+)% ?(?:$|[dD]amage|direct damage|and|Crushing damage|piercing damage)").unwrap(),
            proc_damage_mod:  Regex::new(r"(?P<chance>[0-9]+)% (?:chance to deal|chance it deals) \+?(?P<damage_mod>[0-9]*[.]?[0-9]+)% (?:damage|immediate Piercing damage)").unwrap(),
            dot_damage:
                Regex::new(&format!(r"(?:deal|deals|Deals|deals an additional|causes|dealing|target to take|causing|damage plus) \+?(?P<damage>[0-9]+)(?:| additional) {} (?:damage over|damage over|damage to health over|health damage over) (?P<duration>[0-9]+) seconds", damage_type))
                    .unwrap(),
            dot_damage2:
                Regex::new(&format!(r"becomes {}, and it deals an additional \+?(?P<damage>[0-9]+) damage over (?P<duration>[0-9]+) seconds", damage_type))
                    .unwrap(),
            dot_damage_thorns:
                Regex::new(&format!(r"deals \+?(?P<damage>[0-9]+) {} damage to melee attackers", damage_type))
                    .unwrap(),
            restore_health:
                Regex::new(r"(?:restore|[rR]estores|regain|heals|heals you for|heal you for|recover|heal all targets for) \+?(?P<restore>[0-9]+) [hH]ealth")
                    .unwrap(),
            restore_armor:
                Regex::new(r"(?:restore|restores|and|heals|heals you for) \+?(?P<restore>[0-9]+) [aA]rmor").unwrap(),
            restore_power:
                Regex::new(r"(?:restore|restores|regain) \+?(?P<restore>[0-9]+) [pP]ower").unwrap(),
            damage_type: Regex::new(&format!(r"(?:becomes|deals|changed to) {}", damage_type)).unwrap(),
            racials: Regex::new(r"(?:Humans|Orcs|Elves|Dwarves|Rakshasa) gain \+?(?:[0-9]+) Max (?:Health|Hydration|Metabolism|Power|Armor|Bodyheat)").unwrap(),
            damage_type_damage_mod_buff: Regex::new(&format!(r"{}(?:| attack) [dD]amage \+?(?P<damage_mod>[0-9]*[.]?[0-9]+)% for (?P<duration>[0-9]+) seconds", damage_type)).unwrap(),
            damage_type_damage_mod_buff2: Regex::new(&format!(r"\+?(?P<damage_mod>[0-9]*[.]?[0-9]+)% {} (?:for|damage from future attacks for|damage for) (?P<duration>[0-9]+) seconds", damage_type)).unwrap(),
            damage_type_damage_mod_buff3: Regex::new(&format!(r"For (?P<duration>[0-9]+) seconds, all targets deal \+?(?P<damage_mod>[0-9]*[.]?[0-9]+)% {} damage", damage_type)).unwrap(),
            damage_type_next_attack_buff: Regex::new(&format!(r"next attack(?:| to deal) \+?(?P<damage>[0-9]+)(?:| damage) if it is a {} (?:ability|attack)", damage_type)).unwrap(),
            keyword_next_attack_buff: Regex::new(r"next attack(?:| to deal) \+?(?P<damage>[0-9]+)(?:| damage) if it is a (?P<keyword>Werewolf) (?:ability|attack)").unwrap(),
            keyword_kick_buff: Regex::new(r"all kicks \+?(?P<damage>[0-9]+) for (?P<duration>[0-9]+) seconds").unwrap(),
            keyword_core_attack_buff: Regex::new(r"Core Attack(?:s to deal| [dD]amage) \+?(?P<damage>[0-9]+) (?:for|damage for) (?P<duration>[0-9]+) seconds").unwrap(),
            keyword_nice_attack_buff: Regex::new(r"Nice Attack(?:s to deal| [dD]amage) \+?(?P<damage>[0-9]+) (?:for|damage for) (?P<duration>[0-9]+) seconds").unwrap(),
            keyword_epic_attack_buff: Regex::new(r"Epic [aA]ttack(?:s|s to deal| [dD]amage) \+?(?P<damage>[0-9]+) .*for (?P<duration>[0-9]+) seconds").unwrap(),
            keyword_epic_attack_damage_mod_buff: Regex::new(r"your Epic Attack Damage \+?(?P<damage_mod>[0-9]*[.]?[0-9]+)% for (?P<duration>[0-9]+) seconds").unwrap(),
            keyword_melee_flat_damage_buff: Regex::new(r"You and your allies' melee attacks deal \+?(?P<damage>[0-9]+) damage for (?P<duration>[0-9]+) seconds").unwrap(),
            keyword_signature_debuff_buff: Regex::new(r"Signature Debuff(?:s by| abilities to deal) \+?(?P<damage>[0-9]+) (?:for|damage for) (?P<duration>[0-9]+) seconds").unwrap(),
            vulnerability_damage_mod_debuff: Regex::new(&format!(r"(?P<damage_mod>[0-9]+)% (?:more vulnerable to|damage from other|damage from|more damage from) {} ?(?:|damage|attacks) for (?P<duration>[0-9]+) seconds", damage_type)).unwrap(),
            vulnerability_damage_mod_debuff2: Regex::new(&format!(r"target takes from {} by (?P<damage_mod>[0-9]+)% for (?P<duration>[0-9]+) seconds", damage_type)).unwrap(),
            vulnerability_flat_damage_debuff: Regex::new(&format!(r"(?:suffer|take) \+?(?P<damage>[0-9]+) damage from(?:| direct) {} attacks for (?P<duration>[0-9]+) seconds", damage_type)).unwrap(),
            nip_buff: Regex::new(r"Nip boosts the damage of Basic, Core, and Nice attacks \+?(?P<damage>[0-9]+) for (?P<duration>[0-9]+) seconds").unwrap(),
            pin_buff: Regex::new(r"Pin boosts Core Attack and Nice Attack Damage \+?(?P<damage>[0-9]+) for (?P<duration>[0-9]+) seconds").unwrap(),
            restorative_arrow_buff: Regex::new(r"Restorative Arrow boosts target's Nice Attack and Epic Attack Damage \+?(?P<damage>[0-9]+) for (?P<duration>[0-9]+) seconds").unwrap(),
            fairy_fire_buff: Regex::new(r"Fairy Fire causes your next attack to deal \+?(?P<damage>[0-9]+) damage if it's a Psychic, Electricity, or Fire attack").unwrap(),
            skulk_buff: Regex::new(r"Skulk boosts the damage of your Core and Nice Attacks \+?(?P<damage>[0-9]+) for (?P<duration>[0-9]+) seconds").unwrap(),
            infinite_legs_buff: Regex::new(r"For (?P<duration>[0-9]+) seconds, additional Infinite Legs attacks deal \+?(?P<damage>[0-9]+) damage").unwrap(),
            admonish_buff: Regex::new(r"Admonish boosts your Priest Damage \+?(?P<damage>[0-9]+) for (?P<duration>[0-9]+) seconds").unwrap(),
            poisoners_cut_buff: Regex::new(r"For (?P<duration>[0-9]+) seconds, you gain Direct Poison Damage \+?(?P<damage>[0-9]+) and Indirect Poison Damage \+?(?P<per_tick_damage>[0-9]+) per tick").unwrap(),
            poisoners_cut_item_buff: Regex::new(r"Poisoner's Cut boosts Indirect Poison Damage an additional \+?(?P<per_tick_damage>[0-9]+) per tick").unwrap(),
            premeditated_doom_buff: Regex::new(r"Premeditated Doom channeling time is -1 second and boosts your Indirect Poison damage \+?(?P<per_tick_damage>[0-9]+) \(per tick\) for (?P<duration>[0-9]+) seconds").unwrap(),
            give_warmth_buff: Regex::new(r"Give Warmth boosts the target's fire damage-over-time by \+?(?P<per_tick_damage>[0-9]+) per tick for (?P<duration>[0-9]+) seconds").unwrap(),
            fill_with_bile_buff: Regex::new(r"Fill With Bile increases target's direct Poison damage \+?(?P<damage>[0-9]+)").unwrap(),
            fill_with_bile_item_buff: Regex::new(r"Target's Poison attacks deal \+?(?P<damage>[0-9]+) damage, and Poison damage-over-time attacks deal \+?(?P<per_tick_damage>[0-9]+) per tick.").unwrap(),
            privacy_field: Regex::new(r"Privacy Field also deals its damage when you are hit by burst attacks, and damage is \+?(?P<damage>[0-9]+)").unwrap(),
            privacy_field2: Regex::new(r"Privacy Field deals \+?(?P<damage>[0-9]+) damage to all melee attackers, and the first melee attacker is knocked away").unwrap(),
            fire_breath_super_fireball_dot: Regex::new(r"deal \+?(?P<damage>[0-9]+) damage over (?P<duration>[0-9]+) seconds").unwrap(),
            bomb_dot: Regex::new(r"All bomb attacks ignite the target, causing them to take \+?(?P<damage>[0-9]+) fire damage over (?P<duration>[0-9]+) seconds").unwrap(),
            sanguine_fangs_dot: Regex::new(r"Sanguine Fangs deals \+?(?P<damage>[0-9]+) trauma damage over (?P<duration>[0-9]+) seconds").unwrap(),
            drink_blood_buff: Regex::new(&format!(r"For (?P<duration>[0-9]+) seconds after using Drink Blood, all {} attacks deal \+(?P<damage>[0-9]+) damage", damage_type)).unwrap(),
            psi_wave_buff: Regex::new(&format!(r"Psi Health Wave, Armor Wave, and Power Wave grant all targets \+(?P<damage>[0-9]+) {} Damage for (?P<duration>[0-9]+) seconds", damage_type)).unwrap(),
            strategic_preparation_buff: Regex::new(r"Strategic Preparation causes your next attack to deal \+(?P<damage>[0-9]+) damage if it is a Crushing, Slashing, or Piercing attack").unwrap(),
            cobra_strike_mamba_strike_buff: Regex::new(r"Cobra Strike and Mamba Strike boost your Nice Attack and Signature Debuff ability damage \+(?P<damage>[0-9]+) for (?P<duration>[0-9]+) seconds").unwrap(),
            play_dead_buff: Regex::new(r"Play Dead boosts your Psychic attack damage \+(?P<damage>[0-9]+) for (?P<duration>[0-9]+) seconds").unwrap(),
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
            "after a 12 second delay",
            "after a 15 second delay",
            "after a 20 second delay",
            "after a 25 second delay",
            "every 2 seconds",
            "every other seconds",
            "every few seconds",
            "every 4 seconds",
            "every 5 seconds",
            "every five seconds",
            "Movement Speed",
            "boosts your movement speed",
            "boosts movement speed",
            "fly speed",
            "swim speed",
            "sprint speed",
            "Sprint speed",
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
            "more XP",
            "causes the next attack that hits you to deal",
            "golem minion",
            "your pet",
            "Animal Handling pets",
            "evasion",
            "knocked down",
            "Summoned Skeletons",
            "Summoned Skeletal Swordsmen",
            "Summoned Skeletal Archers and Mages",
            "damage to targets that are covered in Fairy Fire",
            "Future Pack Attacks to the same target deal",
            "near your Web Trap",
            "after using Mindreave, your Major Healing abilities",
            "Fire Wall",
            "For 30 seconds after using Phoenix Strike",
            "Moment of Resolve dispels any Slow or Root effects",
            "Controlled Burn costs",
            "while under the effect of Haste Concoction",
            "For 60 seconds after using Redirect",
            "absorption",
            "Pig Punt causes the target to ignore you",
            "Lunge hits all enemies within 5 meters",
            "Coordinated Assault causes all allies' melee attacks",
            "Chew Cud's chance to consume grass",
            "Incubated Spiders have",
            "chance to trigger the target",
            "Heal Undead and Rebuild Undead",
            "For 30 seconds after you use Moo of Calm",
            "For 60 seconds after using Blocking Stance",
            "Tell Me About Your Mother causes target's attacks to deal",
            "chance to confuse the target about which enemy is which",
            "Using Raise Zombie on an existing zombie",
            "retired",
            "Elemental Ward boosts your direct and indirect Electricity damage",
            "Disharmony causes target to deal",
            "Cow's Bash costs",
            "Combat XP",
            "Room-Temperature Ball and Defensive Burst cause the target's attacks to deal",
            "chance to not actually consume the heart",
            "Entrancing Lullaby and Anthem of Avoidance cost",
            "Terrifying Bite causes the target to take",
            "Summoned Deer",
            "summon a deer ally",
            "Inspire Confidence increases the damage of all targets' attacks",
            "Wind Strike causes your next attack to deal",
            "While Bulwark Mode is enabled you recover",
            "The maximum Power restored by Admonish increases",
            "All Bun-Fu moves cost",
            "Mudbath causes the target to take",
            "Moment of Resolve dispels any Stun effects",
            "chance to slow target's movement",
            "For 30 seconds after you use Moo of Determination",
            "chance to cause all sentient targets to flee in terror",
            "Drink Blood costs",
            "Restorative Arrow heals YOU for",
            "Long Shot boosts your Armor Regeneration",
            "Frostbite debuffs target so that",
            "Shadow Feint raises your Lycanthropy Base Damage",
            "After using Pack Attack, your Lycanthropy Base Damage increases",
            "Frostbite causes target's attacks to deal",
            "Grappling Web causes the target to take",
            "Wing Vortex causes targets' next attack to deal",
            "Look At My Hammer reduces the damage you take from Slashing, Piercing, and Crushing attacks",
            "chance to boost Spider Skill Base Damage",
            "Nip causes target's next attack to deal",
            "chance to ignore stuns",
            "chance to ignore Stun effects",
            "Your Bard Songs cost -20% Power",
            "Apprehend costs",
            "See Red increases the damage of your next attack",
            "Fae Conduit also buffs targets' direct Cold, Fire, and Electricity damage",
            "Your Stretchy Spine mutation randomly repairs broken bones twice as often",
            "Regrowth and Pulse of Life Healing",
            "Privacy Field causes you to recover",
            "Blitz Shot and Basic Shot boost your healing from Combat Refreshes",
            "aggro",
            "seconds after using Clever Trick, pets' basic attacks have",
            "Conditioning Shock causes target's next ability to deal",
            "Poison Arrow makes target's attacks deal",
            "Tundra Spikes stuns all targets after",
            "Fan of Blades knocks all targets backwards",
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
            "Taunts",
            "If you use Premeditated Doom while standing near your Web Trap",
            "chance to avoid being hit by burst attacks",
            "For 12 seconds after using Infinite Legs",
            "Chew Cud increases your mitigation versus all attacks by Elites",
            "When you are hit, Finish It damage is",
            "When Skulk is used, you recover",
            "Your Knee Spikes mutation causes kicks to deal an additional",
            "Coordinated Assault grants all allies",
            "Psi Health Wave grants all targets",
            "If Screech, Sonic Burst, or Deathscream deal Trauma damage",
            "Major Healing abilities",
            "mitigation",
            "Mitigation",
            "Protection",
            "take half damage",
            "mitigate",
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
            "resistant to",
            "power cost",
            "Power cost",
            "Power Cost",
            "Power and",
            "Power for",
            "Hammer attacks cost",
            "removes ongoing",
            "that hit a single target",
            "damage to Aberrations",
            "resistance",
            "stuns the target if they are not focused on you",
            "chance target is Stunned",
            "raises Basic Attack Damage",
            "Pin causes target's attacks to deal",
            "Your Cold Sphere gains",
            "Body Heat",
            "less damage from attacks",
            "and speed is",
            "Many Cuts knocks back targets that have less than a third of their Armor",
            "Premeditated Doom channeling time is -1 second",
            "the first melee attacker is knocked away",
            "damage and causes target's attacks to deal",
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
                && !effect_desc.contains("Tell Me About Your Mother boosts your Epic Attack Damage")
                && !effect_desc.contains("Apprehend causes your Nice Attacks to deal")
                && !effect_desc.contains("Fire Breath and Super Fireball deal")
                && !effect_desc.contains("melee attacks deal")
                && !effect_desc.contains("For 5 seconds, you gain Direct Poison Damage")
                && !effect_desc.contains("Target's Poison attacks deal")
                && !effect_desc.contains("Spit Acid causes your Signature Debuff abilities to deal")
                && !effect_desc.contains("additional Infinite Legs attacks")
                && !effect_desc.contains("Fill With Bile increases target's direct Poison damage")
                && !effect_desc.contains("For 30 seconds after using Drink Blood")
                && !effect_desc.contains("Give Warmth causes the target's next attack")
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
            effects.push(Effect::DotDamage {
                damage: Parser::get_cap_number(&caps, "damage"),
                damage_type: DamageType::from_str(Parser::get_cap_string(&caps, "damage_type"))
                    .expect("Failed to parse damage type string as enum"),
                duration: Parser::get_cap_number(&caps, "duration"),
            });
        }
        if let Some(caps) = self.regex.dot_damage2.captures(effect_desc) {
            effects.push(Effect::DotDamage {
                damage: Parser::get_cap_number(&caps, "damage"),
                damage_type: DamageType::from_str(Parser::get_cap_string(&caps, "damage_type"))
                    .expect("Failed to parse damage type string as enum"),
                duration: Parser::get_cap_number(&caps, "duration"),
            });
        }
        if let Some(caps) = self.regex.dot_damage_thorns.captures(effect_desc) {
            effects.push(Effect::DotDamage {
                damage: Parser::get_cap_number(&caps, "damage"),
                damage_type: DamageType::from_str(Parser::get_cap_string(&caps, "damage_type"))
                    .expect("Failed to parse damage type string as enum"),
                duration: 0,
            });
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
            // Specific exclusions
            if !effect_desc.contains("Pin boosts Core Attack and Nice Attack Damage") {
                effects.push(Effect::Buff(Buff {
                    remaining_duration: Parser::get_cap_number(&caps, "duration"),
                    effect: BuffEffect::KeywordFlatDamageBuff {
                        keyword: "NiceAttack".to_string(),
                        damage: Parser::get_cap_number(&caps, "damage"),
                    },
                }));
            }
        }
        if let Some(caps) = self.regex.keyword_epic_attack_buff.captures(effect_desc) {
            // Specific exclusions
            if !effect_desc
                .contains("Restorative Arrow boosts target's Nice Attack and Epic Attack Damage")
            {
                effects.push(Effect::Buff(Buff {
                    remaining_duration: Parser::get_cap_number(&caps, "duration"),
                    effect: BuffEffect::KeywordFlatDamageBuff {
                        keyword: "EpicAttack".to_string(),
                        damage: Parser::get_cap_number(&caps, "damage"),
                    },
                }));
            }
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
            .vulnerability_damage_mod_debuff2
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
        if let Some(caps) = self.regex.pin_buff.captures(effect_desc) {
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
        if let Some(caps) = self.regex.restorative_arrow_buff.captures(effect_desc) {
            let damage = Parser::get_cap_number(&caps, "damage");
            let duration = Parser::get_cap_number(&caps, "duration");
            effects.push(Effect::Buff(Buff {
                remaining_duration: duration,
                effect: BuffEffect::KeywordFlatDamageBuff {
                    keyword: "NiceAttack".to_string(),
                    damage,
                },
            }));
            effects.push(Effect::Buff(Buff {
                remaining_duration: duration,
                effect: BuffEffect::KeywordFlatDamageBuff {
                    keyword: "EpicAttack".to_string(),
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
        if let Some(caps) = self.regex.admonish_buff.captures(effect_desc) {
            effects.push(Effect::Buff(Buff {
                remaining_duration: Parser::get_cap_number(&caps, "duration"),
                effect: BuffEffect::KeywordFlatDamageBuff {
                    keyword: "Priest".to_string(),
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
        if let Some(caps) = self.regex.premeditated_doom_buff.captures(effect_desc) {
            effects.push(Effect::Buff(Buff {
                remaining_duration: Parser::get_cap_number(&caps, "duration"),
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
        }
        if let Some(caps) = self.regex.fill_with_bile_item_buff.captures(effect_desc) {
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
            effects.push(Effect::DotDamage {
                damage: Parser::get_cap_number(&caps, "damage"),
                damage_type: DamageType::Electricity,
                duration: 0,
            });
        }
        if let Some(caps) = self.regex.privacy_field2.captures(effect_desc) {
            effects.push(Effect::DotDamage {
                damage: Parser::get_cap_number(&caps, "damage"),
                damage_type: DamageType::Electricity,
                duration: 0,
            });
        }
        if let Some(caps) = self.regex.fire_breath_super_fireball_dot.captures(effect_desc) {
            effects.push(Effect::DotDamage {
                damage: Parser::get_cap_number(&caps, "damage"),
                damage_type: DamageType::Fire,
                duration: Parser::get_cap_number(&caps, "duration"),
            });
        }
        if let Some(caps) = self.regex.bomb_dot.captures(effect_desc) {
            effects.push(Effect::DotDamage {
                damage: Parser::get_cap_number(&caps, "damage"),
                damage_type: DamageType::Fire,
                duration: Parser::get_cap_number(&caps, "duration"),
            });
        }
        if let Some(caps) = self.regex.sanguine_fangs_dot.captures(effect_desc) {
            effects.push(Effect::DotDamage {
                damage: Parser::get_cap_number(&caps, "damage"),
                damage_type: DamageType::Trauma,
                duration: Parser::get_cap_number(&caps, "duration"),
            });
        }
        if let Some(caps) = self.regex.drink_blood_buff.captures(effect_desc) {
            effects.push(Effect::Buff(Buff {
                remaining_duration: Parser::get_cap_number(&caps, "duration"),
                effect: BuffEffect::DamageTypeFlatDamageBuff {
                    damage_type: DamageType::from_str(Parser::get_cap_string(&caps, "damage_type"))
                        .expect("Failed to parse damage type string as enum"),
                    damage: Parser::get_cap_number(&caps, "damage"),
                },
            }));
        }
        if let Some(caps) = self.regex.psi_wave_buff.captures(effect_desc) {
            effects.push(Effect::Buff(Buff {
                remaining_duration: Parser::get_cap_number(&caps, "duration"),
                effect: BuffEffect::DamageTypeFlatDamageBuff {
                    damage_type: DamageType::from_str(Parser::get_cap_string(&caps, "damage_type"))
                        .expect("Failed to parse damage type string as enum"),
                    damage: Parser::get_cap_number(&caps, "damage"),
                },
            }));
        }
        if let Some(caps) = self.regex.strategic_preparation_buff.captures(effect_desc) {
            let damage = Parser::get_cap_number(&caps, "damage");
            effects.push(Effect::Buff(Buff {
                remaining_duration: 1,
                effect: BuffEffect::DamageTypeFlatDamageBuff {
                    damage_type: DamageType::Crushing,
                    damage,
                },
            }));
            effects.push(Effect::Buff(Buff {
                remaining_duration: 1,
                effect: BuffEffect::DamageTypeFlatDamageBuff {
                    damage_type: DamageType::Slashing,
                    damage,
                },
            }));
            effects.push(Effect::Buff(Buff {
                remaining_duration: 1,
                effect: BuffEffect::DamageTypeFlatDamageBuff {
                    damage_type: DamageType::Piercing,
                    damage,
                },
            }));
        }
        if let Some(caps) = self
            .regex
            .cobra_strike_mamba_strike_buff
            .captures(effect_desc)
        {
            let duration = Parser::get_cap_number(&caps, "duration");
            let damage = Parser::get_cap_number(&caps, "damage");
            effects.push(Effect::Buff(Buff {
                remaining_duration: duration,
                effect: BuffEffect::KeywordFlatDamageBuff {
                    keyword: "NiceAttack".to_string(),
                    damage,
                },
            }));
            effects.push(Effect::Buff(Buff {
                remaining_duration: duration,
                effect: BuffEffect::KeywordFlatDamageBuff {
                    keyword: "SignatureDebuff".to_string(),
                    damage,
                },
            }));
        }
        if let Some(caps) = self.regex.play_dead_buff.captures(effect_desc) {
            effects.push(Effect::Buff(Buff {
                remaining_duration: Parser::get_cap_number(&caps, "duration"),
                effect: BuffEffect::DamageTypeFlatDamageBuff {
                    damage_type: DamageType::Psychic,
                    damage: Parser::get_cap_number(&caps, "damage"),
                },
            }));
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
