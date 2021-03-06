use super::*;

#[test]
fn calculate_item_mods_all_implemented() {
    // This test ensures all mods are implemented (handled, handled with warnings, or specifically ignored)
    // It's intended to run with new versions of game data to easily implement new mods (as well as check for regressions)
    let parser = Parser::new();
    let mut not_implemented = vec![];
    for (item_mod_id, item_mod) in &parser.data.item_mods {
        for (tier_id, tier) in &item_mod.tiers {
            let item_mods =
                parser.calculate_item_mods(&vec![], &vec![(item_mod_id.clone(), tier_id.clone())]);
            let mut total_things_parsed = 0;
            for (_, effects) in &item_mods.icon_id_effects {
                total_things_parsed += effects.len();
            }
            for (_, effects) in &item_mods.attribute_effects {
                total_things_parsed += effects.len();
            }
            total_things_parsed += item_mods.warnings.len();
            total_things_parsed += item_mods.not_implemented.len();
            assert_eq!(item_mods.not_implemented.len(), 0);
            if total_things_parsed == 0 && tier.effect_descs.len() > 0 {
                not_implemented.push(format!(
                    "Failed to parse anything from item mod: {:#?}, {:#?}",
                    tier.effect_descs, item_mods
                ));
            }
        }
    }
    not_implemented.sort();
    assert_eq!(not_implemented.len(), 0, "{}", not_implemented[0]);
}

#[test]
fn test_important_special_infos() {
    let parser = Parser::new();
    let effects = parser.get_effects_from_special_info(
        &mut vec![],
        "Target takes +20% Electricity damage from future attacks for 30 seconds",
    );
    assert_eq!(
        effects.unwrap()[0],
        Effect::Buff(Buff {
            remaining_duration: 30,
            effect: BuffEffect::DamageTypeDamageModBuff {
                damage_type: DamageType::Electricity,
                damage_mod: 0.2,
            }
        })
    );
    let effects = parser.get_effects_from_special_info(
        &mut vec![],
        "For 15 seconds, additional Infinite Legs attacks deal +18 damage",
    );
    assert_eq!(
        effects.unwrap()[0],
        Effect::Buff(Buff {
            remaining_duration: 15,
            effect: BuffEffect::KeywordFlatDamageBuff {
                keyword: "InfiniteLegs".to_string(),
                damage: 18,
            }
        })
    );
    let effects = parser.get_effects_from_special_info(
        &mut vec![],
        "You and your allies' melee attacks deal +10 damage for 10 seconds",
    );
    assert_eq!(
        effects.unwrap()[0],
        Effect::Buff(Buff {
            remaining_duration: 10,
            effect: BuffEffect::KeywordFlatDamageBuff {
                keyword: "Melee".to_string(),
                damage: 10,
            }
        })
    );
    let effects = parser.get_effects_from_special_info(
        &mut vec![],
        "For 10 seconds, all targets deal +35% Crushing damage",
    );
    assert_eq!(
        effects.unwrap()[0],
        Effect::Buff(Buff {
            remaining_duration: 10,
            effect: BuffEffect::DamageTypeDamageModBuff {
                damage_type: DamageType::Crushing,
                damage_mod: 0.35,
            }
        })
    );
    let effects = parser.get_effects_from_special_info(
        &mut vec![],
        "Target takes 15% more damage from Crushing for 20 seconds",
    );
    assert_eq!(
        effects.unwrap()[0],
        Effect::Debuff(Debuff {
            remaining_duration: 20,
            effect: DebuffEffect::VulnerabilityDamageModDebuff {
                damage_type: DamageType::Crushing,
                damage_mod: 0.15,
            }
        })
    );
    let effects = parser.get_effects_from_special_info(
        &mut vec![],
        "You and nearby allies deal +22% Trauma damage for 10 seconds",
    );
    assert_eq!(
        effects.unwrap()[0],
        Effect::Buff(Buff {
            remaining_duration: 10,
            effect: BuffEffect::DamageTypeDamageModBuff {
                damage_type: DamageType::Trauma,
                damage_mod: 0.22,
            }
        })
    );
    let effects = parser.get_effects_from_special_info(
        &mut vec![],
        "For 5 seconds, you gain Direct Poison Damage +30 and Indirect Poison Damage +6 per tick",
    );
    assert_eq!(
        effects.clone().unwrap()[0],
        Effect::Buff(Buff {
            remaining_duration: 5,
            effect: BuffEffect::DamageTypeFlatDamageBuff {
                damage_type: DamageType::Poison,
                damage: 30,
            }
        })
    );
    assert_eq!(
        effects.unwrap()[1],
        Effect::Buff(Buff {
            remaining_duration: 5,
            effect: BuffEffect::DamageTypePerTickDamageBuff {
                damage_type: DamageType::Poison,
                damage: 6,
            }
        })
    );
    let effects = parser.get_effects_from_special_info(&mut vec![], "Target's Poison attacks deal +12 damage, and Poison damage-over-time attacks deal +1 per tick.");
    assert_eq!(
        effects.clone().unwrap()[0],
        Effect::Buff(Buff {
            remaining_duration: 60,
            effect: BuffEffect::DamageTypeFlatDamageBuff {
                damage_type: DamageType::Poison,
                damage: 12,
            }
        })
    );
    assert_eq!(
        effects.unwrap()[1],
        Effect::Buff(Buff {
            remaining_duration: 60,
            effect: BuffEffect::DamageTypePerTickDamageBuff {
                damage_type: DamageType::Poison,
                damage: 1,
            }
        })
    );
}

#[test]
fn calculate_attribute_effect_desc() {
    let parser = Parser::new();
    let mut item_mods = ItemMods {
        icon_id_effects: HashMap::new(),
        attribute_effects: HashMap::new(),
        warnings: vec![],
        not_implemented: vec![],
    };
    parser.calculate_attribute_effect_desc(&mut item_mods, "{BOOST_SKILL_SWORD}{5}");
    assert_eq!(item_mods.icon_id_effects.len(), 0);
    assert_eq!(item_mods.warnings.len(), 0);
    assert_eq!(item_mods.not_implemented.len(), 0);
    assert_eq!(item_mods.attribute_effects["BOOST_SKILL_SWORD"].len(), 1);
    assert_eq!(
        item_mods.attribute_effects["BOOST_SKILL_SWORD"][0],
        Effect::FlatDamage(5)
    );
    parser.calculate_attribute_effect_desc(&mut item_mods, "{MOD_SKILL_SWORD}{0.1}");
    assert_eq!(item_mods.attribute_effects["MOD_SKILL_SWORD"].len(), 1);
    assert_eq!(
        item_mods.attribute_effects["MOD_SKILL_SWORD"][0],
        Effect::DamageMod(0.1)
    );
    parser.calculate_attribute_effect_desc(
        &mut item_mods,
        "{MOD_PIERCING_DIRECT}{0.1}{AnimalHandling}",
    );
    assert_eq!(item_mods.warnings.len(), 1);
    assert_eq!(item_mods.attribute_effects["MOD_PIERCING_DIRECT"].len(), 1);
    assert_eq!(
        item_mods.attribute_effects["MOD_PIERCING_DIRECT"][0],
        Effect::DamageMod(0.1)
    );
}

fn test_icon_id_effect(
    parser: &Parser,
    effect_desc: &str,
    icon_ids: Vec<i32>,
    mut test_effects: Vec<Effect>,
    warnings_length: usize,
) {
    let mut item_mods = ItemMods {
        icon_id_effects: HashMap::new(),
        attribute_effects: HashMap::new(),
        warnings: vec![],
        not_implemented: vec![],
    };
    assert!(
        icon_ids.len() > 0,
        "no icon IDs: effect_desc = {}",
        effect_desc
    );
    parser.calculate_icon_id_effect_desc(&mut item_mods, effect_desc);
    for icon_id in &icon_ids {
        if *icon_id == 108 {
            // If it's 108, then we just need to check warnings below, because it's a skipped generic mod
            continue;
        }
        assert!(
            item_mods.icon_id_effects.contains_key(&icon_id),
            "item_mods didn't contain icon_id: effect_desc = {}, item_mods = {:#?}, icon_ids = {:#?}",
            effect_desc,
            item_mods,
            icon_ids,
        );
        let effects = item_mods.icon_id_effects.get_mut(&icon_id).unwrap();
        assert_eq!(test_effects.len(), effects.len(), "item_mods had a different number of effects than it should: effect_desc = {}, test_effects = {:#?}, effects = {:#?}, warnings = {:#?}", effect_desc, test_effects, effects, item_mods.warnings);
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
        "item_mods had an incorrect number of warnings: effect_desc = {}, test_effects = {:#?}, warnings = {:#?}",
        effect_desc,
        test_effects,
        item_mods.warnings,
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
            Effect::FlatDamage(50),
            Effect::DamageType(DamageType::Trauma),
        ],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3204><icon=3203>Psi Power Wave and Psi Adrenaline Wave instantly restore 9 power to you",
        vec![3204, 3203],
        vec![
            Effect::RestorePower(9),
        ],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3327>Pain Bubble deals +5 damage and restores 40 armor to you",
        vec![3327],
        vec![Effect::FlatDamage(5), Effect::RestoreArmor(40)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3691><icon=3704>Bun-Fu Strike deals +4 damage and hastens the current reset timer of Bun-Fu Blitz by 1 seconds",
        vec![3691, 3704],
        vec![Effect::FlatDamage(4)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2192>Blocking Stance restores 4 Power to you",
        vec![2192],
        vec![Effect::RestorePower(4)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3473>Look At My Hammer restores +15 armor to you",
        vec![3473],
        vec![Effect::RestoreArmor(15)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3481>Heart Thorn restores 14 armor to you",
        vec![3481],
        vec![Effect::RestoreArmor(14)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3045>Decapitate deals +50 damage to non-Elite targets",
        vec![3045],
        vec![Effect::FlatDamage(50)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3541>Sonic Burst has a 60% chance to deal +10% damage to all targets",
        vec![3541],
        vec![Effect::ProcDamageMod {
            damage_mod: 0.1,
            chance: 0.6,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2191>Deflective Spin heals 6 Health over 60 seconds",
        vec![2191],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2198>Life Steal deals 50 Psychic damage over 10 seconds",
        vec![2198],
        vec![Effect::DotDamage {
            damage: 50,
            damage_type: DamageType::Psychic,
            duration: 10,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3555>If you use Premeditated Doom while standing near your Web Trap, you gain +15% Spider Skill Base Damage for 20 seconds",
        vec![3555],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3204>Psi Adrenaline Wave increases all targets' Slashing damage +2% for 20 seconds",
        vec![3204],
        vec![Effect::Buff(Buff {
            remaining_duration: 20,
            effect: BuffEffect::DamageTypeDamageModBuff {
                damage_type: DamageType::Slashing,
                damage_mod: 0.02,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3783>Fairy Fire's damage type becomes Fire, and it deals an additional 15 Fire damage over 10 seconds",
        vec![3783],
        vec![
            Effect::DamageType(DamageType::Fire),
            Effect::DotDamage {
                damage: 15,
                damage_type: DamageType::Fire,
                duration: 10,
            },
        ],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3698>Hare Dash restores 8 Armor to you",
        vec![3698],
        vec![Effect::RestoreArmor(8)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3024><icon=3443>Flashing Strike and Hacking Blade Damage +6%",
        vec![3024, 3443],
        vec![Effect::DamageMod(0.06)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3525>Blizzard deals 14 armor damage and generates -10 Rage",
        vec![3525],
        vec![Effect::FlatDamage(14)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3448>Infuriating Bash generates no Rage and lowers Rage by 100",
        vec![3448],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2182>Your Extra Heart mutation causes the target to regain +5 Power every 20 seconds",
        vec![2182],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3430>Spark of Death deals +1 damage and renders target 10% more vulnerable to Electricity damage for 30 seconds",
        vec![3430],
        vec![Effect::FlatDamage(1),
            Effect::Debuff(Debuff {
            remaining_duration: 30,
            effect: DebuffEffect::VulnerabilityDamageModDebuff {
                damage_type: DamageType::Electricity,
                damage_mod: 0.1,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3784>Pixie Flare deals +7 damage, and deals +33% total damage against Demons",
        vec![3784],
        vec![Effect::FlatDamage(7)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3785>Fae Conduit also heals 10 Health every 5 seconds",
        vec![3785],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3546><icon=3553>Combo: Rip+Any Melee+Any Giant Bat Attack+Tear: final step hits all targets within 5 meters and deals +5 damage.",
        vec![3546, 3553],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3402>Gripjaw has a 70% chance to deal +20% damage",
        vec![3402],
        vec![Effect::ProcDamageMod {
            damage_mod: 0.2,
            chance: 0.7,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2198>Life Steal restores 4 Health",
        vec![2198],
        vec![Effect::RestoreHealth(4)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2113>Many Cuts hits all enemies within 5 meters",
        vec![2113],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3301>Poison Arrow makes target's attacks deal -1 damage for 10 seconds",
        vec![3301],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3499>Ice Spear deals between +1 and +20 extra damage (randomly determined)",
        vec![3499],
        vec![Effect::RangeFlatDamage {
            min_damage: 1,
            max_damage: 20,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3476>Latent Charge deals +5 direct damage. In addition, the target takes a second full blast of delayed Electricity damage after an 8-second delay",
        vec![3476],
        vec![
            Effect::FlatDamage(5),
        ],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2256>Shadow Feint causes your next attack to deal +12 damage if it is a Werewolf ability",
        vec![2256],
        vec![Effect::Buff(Buff {
            remaining_duration: 1,
            effect: BuffEffect::KeywordFlatDamageBuff {
                keyword: "Werewolf".to_string(),
                damage: 12,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2180>Your Knee Spikes mutation causes kicks to deal an additional +5% damage",
        vec![2180],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3454>Fire Shield deals +12 Fire damage to melee attackers",
        vec![3454],
        vec![Effect::DotDamage {
            damage: 12,
            damage_type: DamageType::Fire,
            duration: 0,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3637>Hurl Lightning Damage +10 and Reuse Time -1 second",
        vec![3637],
        vec![Effect::FlatDamage(10)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3799>Power Glyph restores +5 Health",
        vec![3799],
        vec![Effect::RestoreHealth(5)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=108>Chance to Ignore Knockbacks +33%, Chance to Ignore Stuns +20%",
        vec![108],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2237>Provoke Undead causes your minions to deal +8% damage for 10 seconds, but also take 35 damage over 10 seconds",
        vec![2237],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3202><icon=3746>Psi Health Wave and Psi Armor Wave instantly restore 10 armor to you",
        vec![3202, 3746],
        vec![Effect::RestoreArmor(10)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3704>Bun-Fu Strike deals +10% damage and reuse time is -1 second",
        vec![3704],
        vec![Effect::DamageMod(0.1)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3457>Shield Team causes all targets' Survival Utility abilities to restore 16 Armor to them. Lasts 20 seconds",
        vec![3457],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2219>Antler Slash heals you for 1 health",
        vec![2219],
        vec![Effect::RestoreHealth(1)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3302><icon=3301><icon=3309>Fire Arrow, Poison Arrow, and Acid Arrow Damage +6%",
        vec![3302, 3301, 3309],
        vec![Effect::DamageMod(0.06)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2131>For 10 seconds, Frenzy boosts targets' indirect damage +1",
        vec![2131],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3421>Pin generates no Rage and reduces Rage by 50",
        vec![3421],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3746>Psi Health Wave grants all targets +6 Mitigation vs. Electricity, Acid, and Nature attacks for 20 seconds",
        vec![3746],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3542><icon=3544><icon=3544>If Screech, Sonic Burst, or Deathscream deal Trauma damage, that damage is boosted +15% per tick",
        vec![3542, 3544],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3320>Snare Arrow restores 2 Health and 2 Armor to you",
        vec![3320],
        vec![Effect::RestoreHealth(2), Effect::RestoreArmor(2)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=108>All Major Healing abilities targeting you restore +10 Health (while Cow skill active)",
        vec![108],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3525>You regain 15 Health when using Blizzard",
        vec![3525],
        vec![Effect::RestoreHealth(15)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3774>Lethal Force deals 40 additional Fire damage over 8 seconds",
        vec![3774],
        vec![Effect::DotDamage {
            damage: 40,
            damage_type: DamageType::Fire,
            duration: 8,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3704>Bun-Fu Strike reduces target's rage by 30, then reduces it by 30 more after a 5 second delay",
        vec![3704],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2153>After using Doe Eyes, your next attack deals +10 damage",
        vec![2153],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3443>Flashing Strike deals +22 damage to undead",
        vec![3443],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3017>Sanguine Fangs suddenly deals 35 Trauma damage after an 8-second delay",
        vec![3017],
        vec![Effect::DelayedDamage {
            damage: 35,
            damage_type: DamageType::Trauma,
            delay: 8,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3312>Bow Bash gives you +1 mitigation of any physical damage for 20 seconds. (This effect does not stack with itself.)",
        vec![3312],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3044>Fast Talk taunts -60 and reduces Rage by 100",
        vec![3044],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3465>Nimble Limbs grants your pet +1 mitigation vs. physical (slashing, piercing, and crushing) attacks for 15 seconds",
        vec![3465],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3401>Inject Venom heals you for 2 health",
        vec![3401],
        vec![Effect::RestoreHealth(2)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3782>Astral Strike causes all targets to suffer +12 damage from direct Cold attacks for 10 seconds",
        vec![3782],
        vec![Effect::Debuff(Debuff {
            remaining_duration: 10,
            effect: DebuffEffect::VulnerabilityFlatDamageDebuff {
                damage_type: DamageType::Cold,
                damage: 12,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2132>Double Claw Damage +13",
        vec![2132],
        vec![Effect::FlatDamage(13)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3547><icon=3553>Bat Stability provides +10% Projectile Evasion for 10 seconds",
        vec![3547, 3553],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3601>Surge Cut deals 35 Trauma damage over 10 seconds",
        vec![3601],
        vec![Effect::DotDamage {
            damage: 35,
            damage_type: DamageType::Trauma,
            duration: 10,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2222>Positive Attitude increases your Core Attack Damage +10 for 15 seconds",
        vec![2222],
        vec![Effect::Buff(Buff {
            remaining_duration: 15,
            effect: BuffEffect::KeywordFlatDamageBuff {
                keyword: "CoreAttack".to_string(),
                damage: 10,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3047>Precision Pierce deals +5 direct health damage and further reduces target's Rage by 30",
        vec![3047],
        vec![Effect::FlatDamage(5)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2175>Healing Mist restores 4 power",
        vec![2175],
        vec![Effect::RestorePower(4)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3046><icon=3024>Hacking Blade and Debilitating Blow deal 48 Trauma damage over 12 seconds",
        vec![3046, 3024],
        vec![Effect::DotDamage {
            damage: 48,
            damage_type: DamageType::Trauma,
            duration: 12,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2232>Mudbath restores 7 armor to the target",
        vec![2232],
        vec![Effect::RestoreArmor(7)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3044>Fast Talk heals you for 10 armor",
        vec![3044],
        vec![Effect::RestoreArmor(10)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3795>Nip boosts the damage of Basic, Core, and Nice attacks +5 for 6 seconds. (This buff does not stack with itself.)",
        vec![3795],
        vec![
            Effect::Buff(Buff {
                remaining_duration: 6,
                effect: BuffEffect::KeywordFlatDamageBuff {
                    keyword: "BasicAttack".to_string(),
                    damage: 5,
                },
            }),
            Effect::Buff(Buff {
                remaining_duration: 6,
                effect: BuffEffect::KeywordFlatDamageBuff {
                    keyword: "CoreAttack".to_string(),
                    damage: 5,
                },
            }),
            Effect::Buff(Buff {
                remaining_duration: 6,
                effect: BuffEffect::KeywordFlatDamageBuff {
                    keyword: "NiceAttack".to_string(),
                    damage: 5,
                },
            }),
        ],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2209>Room-Temperature Ball deals Darkness damage and causes +24 damage over 12 seconds",
        vec![2209],
        vec![
            Effect::DamageType(DamageType::Darkness),
        ],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2120>Ring of Fire deals +8% damage but has a 5% chance to deal 50 fire damage to YOU",
        vec![2120],
        vec![Effect::DamageMod(0.08)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2118>Psychoanalyze causes the target to take +1 damage from Psychic attacks for 60 seconds",
        vec![2118],
        vec![Effect::Debuff(Debuff {
            remaining_duration: 60,
            effect: DebuffEffect::VulnerabilityFlatDamageDebuff {
                damage_type: DamageType::Psychic,
                damage: 1,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2240><icon=2105>Cobra Strike and Mamba Strike restore 10 Armor to you",
        vec![2240, 2105],
        vec![Effect::RestoreArmor(10)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3017>Sanguine Fangs deals +14% Crushing damage and doesn't cause the target to yell for help",
        vec![3017],
        vec![Effect::DamageMod(0.14)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3458>Strategic Preparation boosts your in-combat Armor regeneration +2 for 20 seconds",
        vec![3458],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3666>Rally restores 20 Armor after a 20 second delay",
        vec![3666],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3754>Deadly Emission Deals +30 Nature damage over 10 seconds and Taunts +25",
        vec![3754],
        vec![Effect::DotDamage {
            damage: 30,
            damage_type: DamageType::Nature,
            duration: 10,
        }],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2237>Provoke Undead deals 12 damage to your minions, who then deal +5 damage for 10 seconds",
        vec![2237],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3252>Incubated Spiders have a 6% chance to avoid being hit by burst attacks",
        vec![3252],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=108>Your attacks deal +1 damage to Canines",
        vec![108],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=108>Your attacks deal +1 damage to Humans",
        vec![108],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3496>Your Cold Sphere's Rage attack deals +35 damage",
        vec![3496],
        vec![Effect::FlatDamage(35)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3527><icon=3491>You regain 6 Power after using Ice Nova or Shardblast",
        vec![3527, 3491],
        vec![Effect::RestorePower(6)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2190>Double Hit causes your next attack to deal +15 damage if it is a Crushing attack",
        vec![2190],
        vec![Effect::Buff(Buff {
            remaining_duration: 1,
            effect: BuffEffect::DamageTypeFlatDamageBuff {
                damage_type: DamageType::Crushing,
                damage: 15,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2149>Stampede boosts your Slashing/Crushing/Piercing Mitigation vs. Elites +2 for 30 seconds (stacks up to 5 times)",
        vec![2149],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3698>Hare Dash restores 5 Power over 15 seconds",
        vec![3698],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3803>Spirit Bolt deals +6 damage and there's a 50% chance it deals +10% damage",
        vec![3803],
        vec![
            Effect::FlatDamage(6),
            Effect::ProcDamageMod {
                damage_mod: 0.1,
                chance: 0.5,
            },
        ],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2127>Fire Walls have +11 Max Health",
        vec![2127],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3320>Snare Arrow raises target's Max Rage by 120, requiring more Rage to use their Rage Abilities",
        vec![3320],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3479>Your Healing Sanctuary heals +5 health and buffs Melee Accuracy +5",
        vec![3479],
        vec![Effect::RestoreHealth(5)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2107>Super Fireball causes the target to take +11% damage from indirect Fire (this effect does not stack with itself)",
        vec![2107],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3773><icon=3768>Apprehend deals +10 damage and hastens the current reuse timer of Controlled Burn by 0.5 seconds (so it can be used again more quickly)",
        vec![3773, 3768],
        vec![Effect::FlatDamage(10)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3785>Fae Conduit restores +1 Power every 5 seconds",
        vec![3785],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3697><icon=3751>Love Tap hastens the current reuse timer of Carrot Power by 1 second",
        vec![3697, 3751],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3407>Cow's Bash inflicts bugs on the target, dealing 20 Nature damage over 10 seconds",
        vec![3407],
        vec![Effect::DotDamage {
            damage: 20,
            damage_type: DamageType::Nature,
            duration: 10,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2237>Provoke Undead causes your minions to deal +5 damage for 10 seconds",
        vec![2237],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3204><icon=3203>Psi Power Wave and Psi Adrenaline Wave restore 16 power to all targets after a 25 second delay",
        vec![3204, 3203],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3753>Forest Challenge damage is +12 and reuse time is -1 second",
        vec![3753],
        vec![Effect::FlatDamage(12)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2117>Pouncing Rake deals +14 Armor damage",
        vec![2117],
        vec![Effect::FlatDamage(14)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2259>When Skulk is used, you recover 15 Health and all enemies within 10 meters are taunted -100",
        vec![2259],
        vec![Effect::RestoreHealth(15)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3481>Heart Thorn coats the target in stinging insects that deal 36 Nature damage over 12 seconds",
        vec![3481],
        vec![Effect::DotDamage {
            damage: 36,
            damage_type: DamageType::Nature,
            duration: 12,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=108>Signature Support abilities restore 5 Power to all allies within 20 meters",
        vec![108],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3500>Tundra Spikes deals +5% damage, gains +1 Accuracy, and lowers targets' Evasion by -2 for 20 seconds",
        vec![3500],
        vec![Effect::DamageMod(0.05)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3638>Thunderstrike heals you for 2 health",
        vec![3638],
        vec![Effect::RestoreHealth(2)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3544>Screech deals +13 damage",
        vec![3544],
        vec![Effect::FlatDamage(13)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3734>Triage costs no Power to cast and restores +5 Health, but takes +1 second to channel",
        vec![3734],
        vec![Effect::RestoreHealth(5)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3804>Trick Foxes have +8 Max Health and their Rage Attacks deal +20 damage",
        vec![3804],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2184><icon=2178><icon=2171>Bomb attacks deal +5 damage and hasten the current reuse timer of Healing Mist by 0.5 seconds",
        vec![2184, 2178],
        vec![Effect::FlatDamage(5)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3672>Blast of Despair causes your Nice Attacks to deal +10 damage for 10 seconds",
        vec![3672],
        vec![Effect::Buff(Buff {
            remaining_duration: 10,
            effect: BuffEffect::KeywordFlatDamageBuff {
                keyword: "NiceAttack".to_string(),
                damage: 10,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2151>Bounding Escape grants you +7% Projectile Evasion for 10 seconds",
        vec![2151],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2250>Grunt of Abeyance restores 2 Power to all targets",
        vec![2250],
        vec![Effect::RestorePower(2)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3204><icon=3202>Psi Armor Wave and Psi Adrenaline Wave restore 15 armor to all targets after a 25 second delay",
        vec![3204, 3202],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3629>Blood of the Pack causes you and your allies' attacks to deal +5 damage for 30 seconds",
        vec![3629],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=108>Slashing Mitigation +1, Piercing Mitigation +1, Crushing Mitigation +1 while Shield skill active",
        vec![108],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3046><icon=2113>Many Cuts and Debilitating Blow Damage +3",
        vec![3046, 2113],
        vec![Effect::FlatDamage(3)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3783>Fairy Fire causes your next attack to deal +8 damage if it's a Psychic, Electricity, or Fire attack",
        vec![3783],
        vec![
            Effect::Buff(Buff {
                remaining_duration: 1,
                effect: BuffEffect::DamageTypeFlatDamageBuff {
                    damage_type: DamageType::Psychic,
                    damage: 8,
                },
            }),
            Effect::Buff(Buff {
                remaining_duration: 1,
                effect: BuffEffect::DamageTypeFlatDamageBuff {
                    damage_type: DamageType::Electricity,
                    damage: 8,
                },
            }),
            Effect::Buff(Buff {
                remaining_duration: 1,
                effect: BuffEffect::DamageTypeFlatDamageBuff {
                    damage_type: DamageType::Fire,
                    damage: 8,
                },
            }),
        ],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3525><icon=3500>Tundra Spikes and Blizzard Damage +6.5%",
        vec![3525, 3500],
        vec![Effect::DamageMod(0.065)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3803>Spirit Bolt Damage +15 and range is +5 meters",
        vec![3803],
        vec![Effect::FlatDamage(15)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3665><icon=3664><icon=3663>All bard songs restore 7 Health to YOU every 4 seconds",
        vec![3665, 3664, 3663],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3557>Web Trap boosts your movement speed by 2 for 10 seconds",
        vec![3557],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3499>Ice Spear heals you for 6 health after a 15 second delay",
        vec![3499],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3665>Song of Discord reduces targets' Rage by -10 every 2 seconds",
        vec![3665],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3573>Seismic Impact hits all targets within 8 meters and deals +3% damage",
        vec![3573],
        vec![Effect::DamageMod(0.03)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3546><icon=3553>Rip and Tear deal +3 damage and hasten the current reuse timer of Drink Blood by 1 second",
        vec![3546, 3553],
        vec![Effect::FlatDamage(3)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3690>Rabbit Scratch deals Trauma damage (instead of Slashing), and deals up to +8 damage (randomly determined)",
        vec![3690],
        vec![Effect::DamageType(DamageType::Trauma), Effect::RangeFlatDamage {
            min_damage: 0,
            max_damage: 8,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3555>Premeditated Doom restores 14 health after a 10-second delay",
        vec![3555],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3254>After using Grappling Web, you are immune to Knockback effects for 12 seconds",
        vec![3254],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3650><icon=3649><icon=3648><icon=3647>Crossbow abilities boost your Epic Attack Damage +10% for 15 seconds",
        vec![3650, 3649, 3647],
        vec![Effect::Buff(Buff {
            remaining_duration: 15,
            effect: BuffEffect::KeywordDamageModBuff {
                keyword: "EpicAttack".to_string(),
                damage_mod: 0.1,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3663><icon=3665>Whenever you take damage from an enemy, you gain Song of Discord Damage +3% and Song of Resurgence Healing +3 for 20 seconds. (Stacks up to 12x)",
        vec![3663, 3665],
        vec![Effect::DamageMod(0.03)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=108>Your attacks deal +1 damage to Orcs",
        vec![108],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=108>Hammer attacks have a 1% chance to Knock Down targets whose Rage meter is at least 66% full",
        vec![108],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2188>Redirect causes target to bleed, dealing 40 Trauma damage over 8 seconds",
        vec![2188],
        vec![Effect::DotDamage {
            damage: 40,
            damage_type: DamageType::Trauma,
            duration: 8,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3315>Aimed Shot deals +6% damage and boosts your Accuracy +5 for 10 seconds",
        vec![3315],
        vec![Effect::DamageMod(0.06)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2160>Animal Handling pets recover +2 Armor every five seconds (whether in combat or not)",
        vec![2160],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3630>Mangling Shot causes target to take +4% damage from Piercing for 10 seconds",
        vec![3630],
        vec![Effect::Debuff(Debuff {
            remaining_duration: 10,
            effect: DebuffEffect::VulnerabilityDamageModDebuff {
                damage_type: DamageType::Piercing,
                damage_mod: 0.04,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3429>Wave of Darkness deals +8 damage and reuse timer is -1 second",
        vec![3429],
        vec![Effect::FlatDamage(8)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2152>Deer Kick implants insect eggs in the target. Future Deer Kicks by any deer cause target to take 35 Nature damage over 5 seconds",
        vec![2152],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3322><icon=2110>Hip Throw and Bodyslam deal +5% damage and generate -20 Rage",
        vec![3322, 2110],
        vec![Effect::DamageMod(0.05)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3727>When Castigate is used on an undead target, it has a 25% chance to stun the target",
        vec![3727],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2258>Frostball slows target's movement by 25% and deals +2 damage",
        vec![2258],
        vec![Effect::FlatDamage(2)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2255>Harmlessness confuses the target about which enemy is which, permanently shuffling their hatred levels toward all enemies they know about",
        vec![2255],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3768>Apprehend deals +5 damage, and damage type is changed to Electricity",
        vec![3768],
        vec![
            Effect::FlatDamage(5),
            Effect::DamageType(DamageType::Electricity),
        ],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3443>Flashing Strike deals +25% damage and gives you 50% resistance to Darkness damage for 4 seconds",
        vec![3443],
        vec![Effect::DamageMod(0.25)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3595>Slice has a 40% chance to deal +10% damage and restore 10 armor",
        vec![3595],
        vec![
            Effect::RestoreArmor(10),
            Effect::ProcDamageMod {
                damage_mod: 0.1,
                chance: 0.4,
            },
        ],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2152><icon=2154>Combo: Deer Bash+Any Melee+Any Melee+Deer Kick: final step hits all enemies within 5 meters and deals +10 damage.",
        vec![2152, 2154],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2247><icon=3753>Forest Challenge and King of the Forest power cost is -5",
        vec![2247, 3753],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2255>Harmlessness restores 21 armor to you",
        vec![2255],
        vec![Effect::RestoreArmor(21)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2233><icon=2115>Parry and Riposte Damage +5% and Power Cost -1",
        vec![2233, 2115],
        vec![Effect::DamageMod(0.05)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3782>Astral Strike's damage type becomes Fire, and it deals an additional 25 damage over 10 seconds",
        vec![3782],
        vec![Effect::DamageType(DamageType::Fire), Effect::DotDamage {
            damage: 25,
            damage_type: DamageType::Fire,
            duration: 10,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3746>Psi Health Wave heals all targets for 14 health after a 25 second delay",
        vec![3746],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3046><icon=2113>Many Cuts and Debilitating Blow deal +14 damage to Arthropods (such as spiders, mantises, and beetles)",
        vec![3046, 2113],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3402>Gripjaw deals +6% damage and hastens the current reset timer of Grappling Web by 1.5 seconds",
        vec![3402],
        vec![Effect::DamageMod(0.06)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3476><icon=3475>Leaping Smash and Latent Charge boost your Core Attack damage +12 for 6 seconds",
        vec![3476, 3475],
        vec![Effect::Buff(Buff {
            remaining_duration: 6,
            effect: BuffEffect::KeywordFlatDamageBuff {
                keyword: "CoreAttack".to_string(),
                damage: 12,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3627>Infuriating Fist generates no Rage and instead reduces Rage by 65",
        vec![3627],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3046>Debilitating Blow deals +10 damage and causes your Core Attacks to deal +7 damage for 7 seconds",
        vec![3046],
        vec![Effect::FlatDamage(10), Effect::Buff(Buff {
            remaining_duration: 7,
            effect: BuffEffect::KeywordFlatDamageBuff {
                keyword: "CoreAttack".to_string(),
                damage: 7,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3407>Cow's Bash restores 3 Power to you",
        vec![3407],
        vec![Effect::RestorePower(3)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2116>Pep Talk removes ongoing Poison effects (up to 3 dmg/sec)",
        vec![2116],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2115>Parry hits all enemies within 5 meters, dealing an additional +3 damage",
        vec![2115],
        vec![Effect::FlatDamage(3)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2196>Heal Undead restores +7 Health/Armor and boosts your next attack +5 if it is a Darkness attack",
        vec![2196],
        vec![
            Effect::RestoreHealth(7),
            Effect::Buff(Buff {
                remaining_duration: 1,
                effect: BuffEffect::DamageTypeFlatDamageBuff {
                    damage_type: DamageType::Darkness,
                    damage: 5,
                },
            }),
        ],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3322><icon=2110>Hip Throw deals +12 armor damage",
        vec![3322, 2110],
        vec![Effect::FlatDamage(12)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=108>Nice Attacks deal +2 damage and cause the target's next Rage Attack to deal -25% damage (debuff cannot stack with itself)",
        vec![108],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3626>Agonize deals +36 Psychic damage over 12 seconds",
        vec![3626],
        vec![Effect::DotDamage {
            damage: 36,
            damage_type: DamageType::Psychic,
            duration: 12,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3690>Rabbit Scratch restores 1 Armor to you",
        vec![3690],
        vec![Effect::RestoreArmor(1)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2241>Bruising Blow deals Trauma damage instead of Crushing, and targets suffer +5% damage from other Trauma attacks for 20 seconds",
        vec![2241],
        vec![Effect::DamageType(DamageType::Trauma), Effect::Debuff(Debuff {
            remaining_duration: 20,
            effect: DebuffEffect::VulnerabilityDamageModDebuff {
                damage_type: DamageType::Trauma,
                damage_mod: 0.05,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3204>Psi Adrenaline Wave increases all targets' Electricity damage +2% for 20 seconds",
        vec![3204],
        vec![Effect::Buff(Buff {
            remaining_duration: 20,
            effect: BuffEffect::DamageTypeDamageModBuff {
                damage_type: DamageType::Electricity,
                damage_mod: 0.02,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3270>Panic Charge boosts the damage of all your attacks +2 for 20 seconds",
        vec![3270],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3600>Backstab steals 7 health from the target and gives it to you",
        vec![3600],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3430>Electrify restores 8 Health to you",
        vec![3430],
        vec![Effect::RestoreHealth(8)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3592>Blur Cut restores 6 Health after a 15 second delay",
        vec![3592],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2116>Pep Talk removes ongoing Fire effects (up to 3 dmg/sec)",
        vec![2116],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2204><icon=2112>While Unarmed skill active: 10% of all Acid, Poison, and Nature damage you take is mitigated and added to the damage done by your next Kick at a 100% rate",
        vec![2204, 2112],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3471>Pound To Slag deals +32 damage if target's Rage is at least 66% full",
        vec![3471],
        vec![Effect::FlatDamage(32)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2224>Pig Bite has a 3% chance to deal +40 damage and hit all targets within 5 meters",
        vec![2224],
        vec![Effect::ProcFlatDamage {
            damage: 40,
            chance: 0.03,
        }],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3427>Death's Hold causes target to take +5% damage from Darkness for 15 seconds",
        vec![3427],
        vec![Effect::Debuff(Debuff {
            remaining_duration: 15,
            effect: DebuffEffect::VulnerabilityDamageModDebuff {
                damage_type: DamageType::Darkness,
                damage_mod: 0.05,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2253>Tough Hoof deals 9 Trauma damage to the target each time they attack and damage you (within 8 seconds)",
        vec![2253],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3203>Psi Power Wave instantly restores 5 power to all targets",
        vec![3203],
        vec![Effect::RestorePower(5)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2250>Grunt of Abeyance restores 4 Armor to all targets",
        vec![2250],
        vec![Effect::RestoreArmor(4)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3444><icon=3047>Precision Pierce and Heart Piercer restore 3 Health to you",
        vec![3444, 3047],
        vec![Effect::RestoreHealth(3)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3480>Regrowth restores 6 Power",
        vec![3480],
        vec![Effect::RestorePower(6)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2246>Pummeling Hooves deals +5% damage and taunts +125",
        vec![2246],
        vec![Effect::DamageMod(0.05)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3734>Triage gives the target +4% Melee Evasion for 10 seconds",
        vec![3734],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=108>Your projectile attacks deal +6 damage to Elite enemies",
        vec![108],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3440>You Were Adopted deals +10% damage and Power cost is -3",
        vec![3440],
        vec![Effect::DamageMod(0.1)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3421>Pin deals +10 damage and has +3 Accuracy (which cancels out the Evasion that certain monsters have)",
        vec![3421],
        vec![Effect::FlatDamage(10)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3480>Regrowth restores +10 Health and conjures a magical field on the target that mitigates 10% of all physical damage they take for 1 minute (or until 100 damage is mitigated)",
        vec![3480],
        vec![Effect::RestoreHealth(10)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3525>Blizzard deals +1% damage, generates -90 Rage and taunts -80",
        vec![3525],
        vec![Effect::DamageMod(0.01)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3775>Privacy Field also deals its damage when you are hit by burst attacks, and damage is +10",
        vec![3775],
        vec![Effect::DotDamage {
            damage: 10,
            damage_type: DamageType::Electricity,
            duration: 0,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3469>After using Wild Endurance, your next use of Feed Pet restores +15 Health/Armor",
        vec![3469],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3492><icon=3586><icon=3499><icon=3505>All Ice Magic attacks that hit a single target have a 33% chance to deal +11% damage",
        vec![3492, 3586, 3499, 3505],
        vec![Effect::ProcDamageMod {
            damage_mod: 0.11,
            chance: 0.33,
        }],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3413>Suppress heals you for 15 health",
        vec![3413],
        vec![Effect::RestoreHealth(15)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2259>Skulk boosts the damage of your Core and Nice Attacks +5 for 30 seconds",
        vec![2259],
        vec![
            Effect::Buff(Buff {
                remaining_duration: 30,
                effect: BuffEffect::KeywordFlatDamageBuff {
                    keyword: "CoreAttack".to_string(),
                    damage: 5,
                },
            }),
            Effect::Buff(Buff {
                remaining_duration: 30,
                effect: BuffEffect::KeywordFlatDamageBuff {
                    keyword: "NiceAttack".to_string(),
                    damage: 5,
                },
            }),
        ],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3447>Disrupting Bash causes the target to take +3% damage from Crushing attacks for 8 seconds",
        vec![3447],
        vec![Effect::Debuff(Debuff {
            remaining_duration: 8,
            effect: DebuffEffect::VulnerabilityDamageModDebuff {
                damage_type: DamageType::Crushing,
                damage_mod: 0.03,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3465>Nimble Limbs heals your pet for 7 Health (or Armor if Health is full)",
        vec![3465],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3312>Bow Bash heals you for 1 health",
        vec![3312],
        vec![Effect::RestoreHealth(1)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3772>Warning Jolt restores 1 Power, and ability range is increased 5 meters",
        vec![3772],
        vec![Effect::RestorePower(1)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3454>Fire Shield boosts your direct and indirect Cold mitigation +1 for 20 seconds",
        vec![3454],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3727>Castigate deals Fire damage instead of Psychic, and deals +12% damage to Aberrations",
        vec![3727],
        vec![Effect::DamageType(DamageType::Fire)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3421>Pin heals you for 10 health",
        vec![3421],
        vec![Effect::RestoreHealth(10)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3546>Tear has a 33% chance to deal +10% damage and reset the timer on Screech (so Screech can be used again immediately)",
        vec![3546],
        vec![Effect::ProcDamageMod {
            damage_mod: 0.1,
            chance: 0.33,
        }],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3505>Freeze Solid reduces the Power cost of all Ice Magic abilities -4 for 7 seconds",
        vec![3505],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2131>For 15 seconds, Frenzy boosts targets' receptivity to Major Heals so that they restore +10 Health",
        vec![2131],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2118>Psychoanalyze causes the target to be worth 1% more XP if slain within 60 seconds",
        vec![2118],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3574>Reckless Slam deals +4 damage and taunts -60",
        vec![3574],
        vec![Effect::FlatDamage(4)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2195>Using Raise Zombie on an existing zombie raises its Max Health +8 for 60 seconds (and heals +8)",
        vec![2195],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2106>Finishing Blow gives you 25% resistance to Elemental damage (Fire, Cold, Electricity) for 10 seconds",
        vec![2106],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3483>Brambleskin deals +6 Nature damage to melee attackers",
        vec![3483],
        vec![Effect::DotDamage {
            damage: 6,
            damage_type: DamageType::Nature,
            duration: 0,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3546>Tear has a 50% chance to deal +25% damage",
        vec![3546],
        vec![Effect::ProcDamageMod {
            damage_mod: 0.25,
            chance: 0.5,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2196>Heal Undead restores +4 health/armor and grants target undead +4 Mitigation from all attacks for 8 seconds",
        vec![2196],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3017>Sanguine Fangs causes the target to take +5% damage from Slashing attacks for 15 seconds",
        vec![3017],
        vec![Effect::Debuff(Debuff {
            remaining_duration: 15,
            effect: DebuffEffect::VulnerabilityDamageModDebuff {
                damage_type: DamageType::Slashing,
                damage_mod: 0.05,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2131>Frenzy restores 2 power to all targets",
        vec![2131],
        vec![Effect::RestorePower(2)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2259>Skulk grants you +20% Projectile Evasion",
        vec![2259],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3673>Blast of Defiance reaps +4% of the Health damage to you as healing. The reap cap is +10",
        vec![3673],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3455>Fight Me You Fools boosts Core Attack Damage +25 for 6 seconds",
        vec![3455],
        vec![Effect::Buff(Buff {
            remaining_duration: 6,
            effect: BuffEffect::KeywordFlatDamageBuff {
                keyword: "CoreAttack".to_string(),
                damage: 25,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=108>Signature Support abilities restore 20 Armor to all allies within 20 meters",
        vec![108],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3544>Screech deals 36 Trauma damage over 12 seconds",
        vec![3544],
        vec![Effect::DotDamage {
            damage: 36,
            damage_type: DamageType::Trauma,
            duration: 12,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2174>Your golem minion's Taunting Punch deals +5 damage",
        vec![2174],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3697>Carrot Power boosts the damage from all kicks +10 for 10 seconds",
        vec![3697],
        vec![Effect::Buff(Buff {
            remaining_duration: 10,
            effect: BuffEffect::KeywordFlatDamageBuff {
                keyword: "Kick".to_string(),
                damage: 10,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3785>Fae Conduit's Power cost is -5 and reuse timer is -1 second",
        vec![3785],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3322>Bodyslam deals +5% damage and slows target's movement speed by 45%",
        vec![3322],
        vec![Effect::DamageMod(0.05)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3635>Way of the Hammer grants all targets +5 Direct Mitigation for 10 seconds",
        vec![3635],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2129>Werewolf Bite deals +4% damage and boosts your Nice Attack Damage +5 for 10 seconds",
        vec![2129],
        vec![Effect::DamageMod(0.04), Effect::Buff(Buff {
            remaining_duration: 10,
            effect: BuffEffect::KeywordFlatDamageBuff {
                keyword: "NiceAttack".to_string(),
                damage: 5,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3797>Spirit Pounce Damage +3 and ability hits all enemies within 6 meters",
        vec![3797],
        vec![Effect::FlatDamage(3)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=108>Your attacks deal +1 damage to Constructs",
        vec![108],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3252>Incubated Spiders deal +5% direct damage with each attack",
        vec![3252],
        vec![Effect::DamageMod(0.05)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2222>Positive Attitude boosts your Out-of-Combat Sprint Speed by 4 for 60 seconds",
        vec![2222],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3251>Spit Acid deals +12 armor damage",
        vec![3251],
        vec![Effect::FlatDamage(12)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3312>Bow Bash deals +40 damage and knocks the target backwards, but ability's reuse timer is +3 seconds",
        vec![3312],
        vec![Effect::FlatDamage(40)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2155>Cow's Front Kick causes the next attack that hits you to deal -8% damage",
        vec![2155],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3548><icon=3546>Tear and Virulent Bite deal +6 damage",
        vec![3548, 3546],
        vec![Effect::FlatDamage(6)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3627><icon=2203><icon=2119>Punch, Jab, and Infuriating Fist restore 3 Health to you",
        vec![3627, 2203, 2119],
        vec![Effect::RestoreHealth(3)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3070>System Shock deals +2 damage, generates no Rage, and reduces Rage by 30",
        vec![3070],
        vec![Effect::FlatDamage(2)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3663>Song of Resurgence also restores 1 Power every 4 seconds to each target in range",
        vec![3663],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3401>Inject Venom has a 50% chance to deal +10% damage",
        vec![3401],
        vec![Effect::ProcDamageMod {
            damage_mod: 0.1,
            chance: 0.5,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3627>Infuriating Fist deals +13% damage and taunts +40",
        vec![3627],
        vec![Effect::DamageMod(0.13)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2174>Your golem minion's Rage Mist and Self Sacrifice abilities heal +8 health",
        vec![2174],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2198>Life Steal reaps 5 additional health",
        vec![2198],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3024>Hacking Blade deals +12 Trauma damage over 12 seconds",
        vec![3024],
        vec![Effect::DotDamage {
            damage: 12,
            damage_type: DamageType::Trauma,
            duration: 12,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3442><icon=3017>Spider Bite and Infinite Legs restore 1 Health",
        vec![3442, 3017],
        vec![Effect::RestoreHealth(1)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3694>Play Dead causes all affected enemies to take 30 Psychic damage after a 10-second delay",
        vec![3694],
        vec![Effect::DelayedDamage {
            damage: 30,
            damage_type: DamageType::Psychic,
            delay: 10,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=108>While Unarmed skill is active: any time you Evade an attack, your next attack deals +24 damage",
        vec![108],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3599>Surprise Throw deals +5% damage and stuns the target if they are not focused on you",
        vec![3599],
        vec![Effect::DamageMod(0.05)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3667>Anthem of Avoidance gives all targets +4% Melee Evasion for 8 seconds",
        vec![3667],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3440><icon=2123><icon=2118>Psychoanalyze, Tell Me About Your Mother, and You Were Adopted Damage +15",
        vec![3440, 2123, 2118],
        vec![Effect::FlatDamage(15)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3462>Shrill Command deals +10% damage and reduces the target's Rage by -50",
        vec![3462],
        vec![Effect::DamageMod(0.1)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2228>Strategic Chomp boosts your mitigation versus physical damage +1 for 20 seconds",
        vec![2228],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2221>Soothe boosts the healing from your Major Healing abilities +14 for 10 seconds",
        vec![2221],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2136>Sic Em boosts your pet's Slashing attacks (if any) +10 damage for 10 seconds",
        vec![2136],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3527><icon=3491>You regain 6 Health when using Ice Nova or Shardblast",
        vec![3527, 3491],
        vec![Effect::RestoreHealth(6)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3733>Righteous Flame deals +55 Fire damage over 10 seconds",
        vec![3733],
        vec![Effect::DotDamage {
            damage: 55,
            damage_type: DamageType::Fire,
            duration: 10,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2174>Your golem minion's Invigorating Mist heals 3 health",
        vec![2174],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2192>Blocking Stance boosts your Direct Cold Damage +6% for 30 seconds",
        vec![2192],
        vec![Effect::Buff(Buff {
            remaining_duration: 30,
            effect: BuffEffect::DamageTypeDamageModBuff {
                damage_type: DamageType::Cold,
                damage_mod: 0.06,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2255>Porcine Alertness heals all targets for 7 health after a 15 second delay",
        vec![2255],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2227>Pig Rend deals +60 Trauma damage over 12 seconds",
        vec![2227],
        vec![Effect::DotDamage {
            damage: 60,
            damage_type: DamageType::Trauma,
            duration: 12,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3593>Poisoner's Cut boosts Indirect Poison Damage an additional +1 per tick",
        vec![3593],
        vec![Effect::Buff(Buff {
            remaining_duration: 5,
            effect: BuffEffect::DamageTypePerTickDamageBuff {
                damage_type: DamageType::Poison,
                damage: 1,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3595>Slice ignores mitigation from armor and deals +12 damage",
        vec![3595],
        vec![Effect::FlatDamage(12)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3738>Give Warmth boosts the target's fire damage-over-time by +3 per tick for 60 seconds",
        vec![3738],
        vec![Effect::Buff(Buff {
            remaining_duration: 60,
            effect: BuffEffect::DamageTypePerTickDamageBuff {
                damage_type: DamageType::Fire,
                damage: 3,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3423>Headcracker deals +5 damage, generates no Rage, and reduces Rage by 12",
        vec![3423],
        vec![Effect::FlatDamage(5)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3495><icon=3499>Ice Spear and Ice Lightning damage +11%",
        vec![3495, 3499],
        vec![Effect::DamageMod(0.11)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=108>Your attacks deal +1 damage to Dinosaurs",
        vec![108],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2128>Wind Strike gives you +50% projectile evasion for 5 seconds",
        vec![2128],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=108>Minor Heals restore 11 Armor",
        vec![108],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2136>Sic Em gives both you and your pet +2 Accuracy for 10 seconds",
        vec![2136],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2118>Psychoanalyze restores 10 Armor to you",
        vec![2118],
        vec![Effect::RestoreArmor(10)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3321><icon=3310>Basic Shot and Blitz Shot Damage +8%",
        vec![3321, 3310],
        vec![Effect::DamageMod(0.08)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3597>Gut deals +3 damage and if target is not focused on you, the trauma damage is boosted 25%",
        vec![3597],
        vec![Effect::FlatDamage(3)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3479>Your Healing Sanctuary restores +4 health with each heal",
        vec![3479],
        vec![Effect::RestoreHealth(4)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3045>Decapitate restores 45 armor to you",
        vec![3045],
        vec![Effect::RestoreArmor(45)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3484>Delerium depletes +60 rage and deals +8 damage",
        vec![3484],
        vec![Effect::FlatDamage(8)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3695>Rabbit's Foot grants you and nearby allies +5% Burst Evasion for 10 seconds",
        vec![3695],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3640>Finish It Restores 10 Health",
        vec![3640],
        vec![Effect::RestoreHealth(10)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2221>Soothe further reduces target's Rage by 250",
        vec![2221],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3575>Rib Shatter deals +20 damage to targets that are knocked down",
        vec![3575],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3768>Apprehend causes your Nice Attacks to deal +10 damage for 8 seconds",
        vec![3768],
        vec![Effect::Buff(Buff {
            remaining_duration: 8,
            effect: BuffEffect::KeywordFlatDamageBuff {
                keyword: "NiceAttack".to_string(),
                damage: 10,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2107><icon=3434>Fire Breath and Super Fireball deal +45 damage over 10 seconds",
        vec![2107, 3434],
        vec![Effect::DotDamage {
            damage: 45,
            damage_type: DamageType::Fire,
            duration: 10,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2160>Animal Handling pets' Clever Trick abilities deal +5% damage",
        vec![2160],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3635>Way of the Hammer boosts all targets' Electricity Damage +7% for 10 seconds",
        vec![3635],
        vec![Effect::Buff(Buff {
            remaining_duration: 10,
            effect: BuffEffect::DamageTypeDamageModBuff {
                damage_type: DamageType::Electricity,
                damage_mod: 0.07,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2136>Sic 'Em restores 5 Health to both you and your pet",
        vec![2136],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3747>Flesh to Fuel boosts your Core Attack Damage +13 for 7 seconds",
        vec![3747],
        vec![Effect::Buff(Buff {
            remaining_duration: 7,
            effect: BuffEffect::KeywordFlatDamageBuff {
                keyword: "CoreAttack".to_string(),
                damage: 13,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3549>Drink Blood steals 4 additional health",
        vec![3549],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3454>Fire Shield causes melee attackers to ignite, dealing 30 Fire damage over 10 seconds",
        vec![3454],
        vec![Effect::DotDamage {
            damage: 30,
            damage_type: DamageType::Fire,
            duration: 10,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=108>Whenever you take damage from an enemy, you gain Bard Base Damage +5% for 15 seconds. (Stacks up to 10x)",
        vec![108],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3598>Hamstring Throw deals +10 direct health damage",
        vec![3598],
        vec![Effect::FlatDamage(10)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3801><icon=3798>Blur Step provides +10% Burst Evasion for 20 seconds, and Paradox Trot boosts Sprint Speed +1",
        vec![3801, 3798],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2138>That'll Do restores 12 Health to your pet and 2 Power to you",
        vec![2138],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3413>Suppress deals +7% damage and causes targets to lose an additional 25 Rage",
        vec![3413],
        vec![Effect::DamageMod(0.07)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2256>Shadow Feint reduces the taunt of all your attacks by 5% until you trigger the teleport",
        vec![2256],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2206>Defensive Burst deals +12% damage and raises Basic Attack Damage +5% for 10 seconds",
        vec![2206],
        vec![Effect::DamageMod(0.12)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3462>Shrill Command deals +6% damage and hastens the current reuse timer of Clever Trick by 1 second",
        vec![3462],
        vec![Effect::DamageMod(0.06)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2236>Rebuild Undead restores 10 Health to you",
        vec![2236],
        vec![Effect::RestoreHealth(10)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2196>Heal Undead restores +5 and has a 25% chance to boost targets' mitigation +5 for 8 seconds",
        vec![2196],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2255>Harmlessness restores 7 power to you",
        vec![2255],
        vec![Effect::RestorePower(7)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3421>Pin causes target's attacks to deal -10% damage for 5 seconds",
        vec![3421],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=108>You regenerate +1 Health per tick (every 5 seconds, in and out of combat) while Cow skill active",
        vec![108],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3771>Conditioning Shock deals +6 damage and reuse time is 1 second sooner",
        vec![3771],
        vec![Effect::FlatDamage(6)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3586>Frostbite deals +5 damage and raises the target's Max Rage by 22%, preventing them from using their Rage attacks as often",
        vec![3586],
        vec![Effect::FlatDamage(5)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3496>Your Cold Sphere gains 12 Armor",
        vec![3496],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2230>Pig Punt deals +3% damage and taunts -15",
        vec![2230],
        vec![Effect::DamageMod(0.03)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3774>Lethal Force Damage +10 and Power Cost -2",
        vec![3774],
        vec![Effect::FlatDamage(10)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2102>Barrage costs -1 Power and restores 3 Armor to you",
        vec![2102],
        vec![Effect::RestoreArmor(3)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3505>Freeze Solid resets the timer on Ice Spear (so it can be used again immediately)",
        vec![3505],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2205><icon=2206>Defensive Burst and Defensive Chill restore 10 Armor to you",
        vec![2205, 2206],
        vec![Effect::RestoreArmor(10)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=108>Your attacks deal +1 damage to Incorporeal Creatures",
        vec![108],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3424>Mindreave deals +2 damage and deals Electricity damage instead of Psychic",
        vec![3424],
        vec![
            Effect::FlatDamage(2),
            Effect::DamageType(DamageType::Electricity),
        ],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3697>Carrot Power boosts your Crushing Damage +6% for 10 seconds",
        vec![3697],
        vec![Effect::Buff(Buff {
            remaining_duration: 10,
            effect: BuffEffect::DamageTypeDamageModBuff {
                damage_type: DamageType::Crushing,
                damage_mod: 0.06,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3000>Cosmic Strike deals +10 damage and reuse timer is -1 second",
        vec![3000],
        vec![Effect::FlatDamage(10)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2205><icon=2208>Scintillating Frost and Defensive Chill restore 5 Armor",
        vec![2205, 2208],
        vec![Effect::RestoreArmor(5)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3640>When you are hit, Finish It damage is +4 for 20 seconds (stacks up to 10 times)",
        vec![3640],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3403>Toxinball deals +36 Poison damage to health over 12 seconds",
        vec![3403],
        vec![Effect::DotDamage {
            damage: 36,
            damage_type: DamageType::Poison,
            duration: 12,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3673>Blast of Defiance reaps 5% of the Armor damage done (up to a max of 15), returning it to you as armor",
        vec![3673],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2258><icon=2238>Fireball and Frostball Damage +6%",
        vec![2258, 2238],
        vec![Effect::DamageMod(0.06)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3694>Play Dead restores 15 Health",
        vec![3694],
        vec![Effect::RestoreHealth(15)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3469>Wild Endurance heals your pet for 15 Health (or Armor if Health is full)",
        vec![3469],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3483>Brambleskin increases your Max Armor by +20 for 30 seconds and restores 20 Armor",
        vec![3483],
        vec![Effect::RestoreArmor(20)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2208><icon=3436>Scintillating Flame and Scintillating Frost Damage +14%",
        vec![2208, 3436],
        vec![Effect::DamageMod(0.14)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2200><icon=2199><icon=2201>Summoned Skeletons deal +4% direct damage, but take +100% more damage from any cold attacks",
        vec![2200, 2199, 2201],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3473>After using Look At My Hammer, all other Hammer attacks cost -3 Power for 8 seconds",
        vec![3473],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2195>Raised Zombies deal +6% damage",
        vec![2195],
        vec![Effect::DamageMod(0.06)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2174>Your golem minion's Doom Admixture deals +15 damage",
        vec![2174],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3784>Pixie Flare's attack range is +5, and it deals +15 damage to targets that are covered in Fairy Fire",
        vec![3784],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2222>Positive Attitude increases your Poison Mitigation +1 for 30 seconds",
        vec![2222],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3423><icon=3413>Combo: Suppress+Any Melee+Any Melee+Headcracker: final step stuns the target while dealing +10 damage.",
        vec![3423, 3413],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3738>Give Warmth restores 3 Health and +2 Body Heat",
        vec![3738],
        vec![Effect::RestoreHealth(3)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3447>Disrupting Bash deals +10% damage and taunts +25",
        vec![3447],
        vec![Effect::DamageMod(0.1)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2175>Healing Mist heals +7 Health",
        vec![2175],
        vec![Effect::RestoreHealth(7)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2205><icon=2208><icon=2258>Frostball, Scintillating Frost, and Defensive Chill boost your Nice Attack Damage +16 for 7 seconds",
        vec![2205, 2208, 2258],
        vec![Effect::Buff(Buff {
            remaining_duration: 7,
            effect: BuffEffect::KeywordFlatDamageBuff {
                keyword: "NiceAttack".to_string(),
                damage: 16,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3497>While in Cryogenic Freeze, you are 30% resistant to Fire damage",
        vec![3497],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2141>Get It Off Me heals you for 25 Health after a 15 second delay",
        vec![2141],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3802>Dimensional Snare causes target to take +5% damage from Poison for 15 seconds",
        vec![3802],
        vec![Effect::Debuff(Debuff {
            remaining_duration: 15,
            effect: DebuffEffect::VulnerabilityDamageModDebuff {
                damage_type: DamageType::Poison,
                damage_mod: 0.05,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=108>All Druid abilities have a 7% chance to restore 15 Power to you",
        vec![108],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3446>Stunning Bash causes the target to take 30 Trauma damage over 12 seconds",
        vec![3446],
        vec![Effect::DotDamage {
            damage: 30,
            damage_type: DamageType::Trauma,
            duration: 12,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2253>Tough Hoof has a 66% chance to deal +15% damage and taunt +50",
        vec![2253],
        vec![Effect::ProcDamageMod {
            damage_mod: 0.15,
            chance: 0.66,
        }],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3573>Seismic Impact restores 10 Armor to you",
        vec![3573],
        vec![Effect::RestoreArmor(10)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2155>Cow's Front Kick has a 66% chance to deal +12 damage",
        vec![2155],
        vec![Effect::ProcFlatDamage {
            damage: 12,
            chance: 0.66,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3251>Spit Acid causes your Signature Debuff abilities to deal +12 damage for 8 seconds",
        vec![3251],
        vec![Effect::Buff(Buff {
            remaining_duration: 8,
            effect: BuffEffect::KeywordFlatDamageBuff {
                keyword: "SignatureDebuff".to_string(),
                damage: 12,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=108>Your attacks deal +1 damage to Rodents",
        vec![108],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2176>Freezing Mist restores 13 Armor to you",
        vec![2176],
        vec![Effect::RestoreArmor(13)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2205><icon=2208><icon=2258>Frostball, Scintillating Frost, and Defensive Chill grant +3 Direct and Indirect Cold Protection for 10 seconds",
        vec![2205, 2208, 2258],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3423>After using Headcracker, you take half damage from Psychic attacks for 5 seconds",
        vec![3423],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2205><icon=2206><icon=2120>You regain 2 Power when using Ring of Fire, Defensive Burst, or Defensive Chill",
        vec![2205, 2206, 2120],
        vec![Effect::RestorePower(2)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2140>Monstrous Rage boosts your Slashing attack damage +1% for 8 seconds",
        vec![2140],
        vec![Effect::Buff(Buff {
            remaining_duration: 8,
            effect: BuffEffect::DamageTypeDamageModBuff {
                damage_type: DamageType::Slashing,
                damage_mod: 0.01,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=108>Nice Attacks deal +4 damage and hasten your current Combat Refresh delay by 1 second",
        vec![108],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3431>Revitalize restores +1 Health and removes ongoing Trauma effects (up to 1 dmg/sec)",
        vec![3431],
        vec![Effect::RestoreHealth(1)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3784>Pixie Flare restores 3 Health to you",
        vec![3784],
        vec![Effect::RestoreHealth(3)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3322>Bodyslam heals you for 10 health",
        vec![3322],
        vec![Effect::RestoreHealth(10)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=108>Your attacks deal +1 damage to Felines",
        vec![108],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=108>All Hammer attacks except for Pound have a 10% chance to restore 5 health and armor",
        vec![108],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=108>Your attacks deal +1 damage to Elves",
        vec![108],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3735>Remedy costs -1 Power to cast, its reuse timer is -1 second, and it has a 10% chance to mend a broken bone in the target",
        vec![3735],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3557>While you are near your Web Trap, you recover 4 Health per second",
        vec![3557],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3327>Pain Bubble increases the damage of your ranged attacks by 1% for 10 seconds",
        vec![3327],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3477>Discharging Strike deals +1% damage plus 8% more damage if target's Rage meter is at least 66% full",
        vec![3477],
        vec![Effect::DamageMod(0.01)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2175>Healing Mist hastens the remaining reset timer of Reconstruct by 10 seconds (if Reconstruct is not already ready to use)",
        vec![2175],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3734>Triage gives the target +3% Burst Evasion for 10 seconds",
        vec![3734],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3505>Freeze Solid restores 10 armor to you after a 15 second delay",
        vec![3505],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3463>Shield Team grants all allies 3% evasion of burst attacks for 10 seconds",
        vec![3463],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3418><icon=2140>Monstrous Rage and Unnatural Wrath boost your pet's next attack damage +8",
        vec![3418],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3630>Mangling Shot deals +5% damage and causes target's attacks to deal -1 damage for 20 seconds",
        vec![3630],
        vec![Effect::DamageMod(0.05)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3650><icon=3649><icon=3648><icon=3647>Crossbow abilities restore 15 health after a 15 second delay",
        vec![3650, 3649, 3648, 3647],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=108>Your attacks deal +1 damage to (corporeal) Undead",
        vec![108],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2136>Sic Em boosts your pet's Crushing attacks (if any) +10 damage for 10 seconds",
        vec![2136],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3045>Decapitate deals +10 damage and briefly terrifies the target",
        vec![3045],
        vec![Effect::FlatDamage(10)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3628>Phoenix Strike costs -1 Power and boosts your Direct Fire Damage +5% for 30 seconds",
        vec![3628],
        vec![Effect::Buff(Buff {
            remaining_duration: 30,
            effect: BuffEffect::DamageTypeDamageModBuff {
                damage_type: DamageType::Fire,
                damage_mod: 0.05,
            },
        })],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3455><icon=3642><icon=3449><icon=3448><icon=3447><icon=3446>All Shield Bash Abilities deal +5 damage and hasten the current reuse timer of Fight Me You Fools by 1 second",
        vec![3455, 3642, 3449, 3448, 3447, 3446],
        vec![Effect::FlatDamage(5)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3726>Admonish boosts your Priest Damage +1 for 10 seconds (this effect does not stack with itself)",
        vec![3726],
        vec![Effect::Buff(Buff {
            remaining_duration: 10,
            effect: BuffEffect::KeywordFlatDamageBuff {
                keyword: "Priest".to_string(),
                damage: 1,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2129>Werewolf Bite hits all enemies within 5 meters, but reuse timer is +2 seconds",
        vec![2129],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2256>When you teleport via Shadow Feint, you recover 10 Health",
        vec![2256],
        vec![Effect::RestoreHealth(10)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3444>Heart Piercer deals +3% piercing damage and heals you for 4 health",
        vec![3444],
        vec![Effect::DamageMod(0.03), Effect::RestoreHealth(4)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3695>Rabbit's Foot restores 10 Health to you and nearby allies after a 15 second delay",
        vec![3695],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2110>Hip Throw hits all enemies within 8 meters, but Power cost is +20",
        vec![2110],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2114>Future Pack Attacks to the same target deal +10 damage",
        vec![2114],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3597>Gut deals an additional 10 Trauma damage over 10 seconds if the target is not focused on you",
        vec![3597],
        vec![Effect::DotDamage {
            damage: 10,
            damage_type: DamageType::Trauma,
            duration: 10,
        }],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3667>Anthem of Avoidance gives all targets +8% Burst Evasion for 8 seconds",
        vec![3667],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2123>Tell Me About Your Mother boosts your Epic Attack Damage +10 and reduces the Power cost of your Epic Attacks -4 for 15 seconds",
        vec![2123],
        vec![Effect::Buff(Buff {
            remaining_duration: 15,
            effect: BuffEffect::KeywordFlatDamageBuff {
                keyword: "EpicAttack".to_string(),
                damage: 10,
            },
        })],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3543>Confusing Double heals you for 18 health",
        vec![3543],
        vec![Effect::RestoreHealth(18)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3626>Agonize deals +10% damage and reuse timer is -6 seconds, but the ability deals 15 health damage to YOU",
        vec![3626],
        vec![Effect::DamageMod(0.1)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3203><icon=3202><icon=3746>Psi Health Wave, Armor Wave, and Power Wave restore +1 Health, Armor, and Power respectively every few seconds",
        vec![3203, 3202, 3746],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3671>Blast of Fury deals +10% damage and knocks the target back, but the ability's reuse timer is +2 seconds",
        vec![3671],
        vec![Effect::DamageMod(0.1)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2247>King of the Forest gives you +4 mitigation of any physical damage for 20 seconds",
        vec![2247],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3401>Fill With Bile increases target's direct Poison damage +10",
        vec![3401],
        vec![Effect::Buff(Buff {
            remaining_duration: 60,
            effect: BuffEffect::DamageTypeFlatDamageBuff {
                damage_type: DamageType::Poison,
                damage: 10,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2179>Your Extra Skin mutation causes the target to heal 10 Health every 20 seconds",
        vec![2179],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3640>Finish It Damage +5% and Power Cost -4",
        vec![3640],
        vec![Effect::DamageMod(0.05)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3599><icon=3598><icon=3602>Fan of Blades, Hamstring Throw, and Surprise Throw deal +7% damage and reuse timer is -1 second",
        vec![3599, 3598, 3602],
        vec![Effect::DamageMod(0.07)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3482>Rotskin hits all targets within 10 meters and further debuffs their mitigation -3",
        vec![3482],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3482>Rotskin deals 24 Trauma damage to health over 12 seconds",
        vec![3482],
        vec![Effect::DotDamage {
            damage: 24,
            damage_type: DamageType::Trauma,
            duration: 12,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3432>Reconstruct restores +4 Health and causes the target to take 4 less damage from attacks for 10 seconds",
        vec![3432],
        vec![Effect::RestoreHealth(4)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3735>Remedy restores 5 Armor and mitigates all damage over time by 1 per tick for 10 seconds",
        vec![3735],
        vec![Effect::RestoreArmor(5)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2179>Your Extra Skin mutation provides +3 mitigation from Piercing attacks",
        vec![2179],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2191>Deflective Spin restores 6 Power after a 20 second delay",
        vec![2191],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=108>Your attacks deal +1 damage to Elementals",
        vec![108],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3424>For 15 seconds after using Mindreave, your Major Healing abilities restore +6 Health (this effect does not stack with itself)",
        vec![3424],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3070>System Shock restores 10 Armor to you",
        vec![3070],
        vec![Effect::RestoreArmor(10)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3204>Psi Adrenaline Wave increases all targets' Crushing damage +2% for 20 seconds",
        vec![3204],
        vec![Effect::Buff(Buff {
            remaining_duration: 20,
            effect: BuffEffect::DamageTypeDamageModBuff {
                damage_type: DamageType::Crushing,
                damage_mod: 0.02,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2112><icon=2240>Mamba Strike and Front Kick damage +10",
        vec![2112, 2240],
        vec![Effect::FlatDamage(10)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3495>Ice Lightning causes the target to become 2% more vulnerable to Fire attacks for 7 seconds",
        vec![3495],
        vec![Effect::Debuff(Debuff {
            remaining_duration: 7,
            effect: DebuffEffect::VulnerabilityDamageModDebuff {
                damage_type: DamageType::Fire,
                damage_mod: 0.02,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2127>Fire Walls deal +8 damage per hit",
        vec![2127],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3769>Stun Trap reuse timer is 1 second faster",
        vec![3769],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3309>Fire Arrow deals +7% damage and taunts +50",
        vec![3309],
        vec![Effect::DamageMod(0.07)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3628>For 30 seconds after using Phoenix Strike, your Survival Utility and Major Heal abilities restore 20 Health to you",
        vec![3628],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3464>Clobbering Hoof attacks have a 50% chance to deal +12% damage",
        vec![3464],
        vec![Effect::ProcDamageMod {
            damage_mod: 0.12,
            chance: 0.5,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3670>Moment of Resolve dispels any Slow or Root effects on allies and grants them immunity to Slow and Root effects for 8 seconds",
        vec![3670],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3542>Deathscream deals +15% damage and Power cost is -2, but the ability's range is reduced to 12m",
        vec![3542],
        vec![Effect::DamageMod(0.15)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3704><icon=3752>Bun-Fu Blast deals +6 damage and hastens the current reuse timer of Bun-Fu Strike by 1 seconds",
        vec![3704, 3752],
        vec![Effect::FlatDamage(6)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=108>Core Attacks deal +11 damage and reduce the Power cost of your next Minor Heal ability by -7",
        vec![108],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3675>Entrancing Lullaby deals 35 Trauma damage after a 20 second delay",
        vec![3675],
        vec![Effect::DelayedDamage {
            damage: 35,
            damage_type: DamageType::Trauma,
            delay: 20,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3774>Lethal Force deals +13 damage and reuse time is -3 seconds",
        vec![3774],
        vec![Effect::FlatDamage(13)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3204><icon=3746>Psi Health Wave and Psi Adrenaline Wave instantly heal all targets for 10 health",
        vec![3204, 3746],
        vec![Effect::RestoreHealth(10)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2124>Strike a Nerve deals between 3 and 10 extra damage",
        vec![2124],
        vec![Effect::RangeFlatDamage {
            min_damage: 3,
            max_damage: 10,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=108>Your attacks deal +1 damage to (non-ruminant) Ungulates",
        vec![108],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3773>Controlled Burn costs -4 Power",
        vec![3773],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3487><icon=3486>Slashing Strike and Claw Barrage boost damage from Epic attacks +20 for 10 seconds",
        vec![3487, 3486],
        vec![Effect::Buff(Buff {
            remaining_duration: 10,
            effect: BuffEffect::KeywordFlatDamageBuff {
                keyword: "EpicAttack".to_string(),
                damage: 20,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=108>All fire spells deal up to +10 damage (randomly determined)",
        vec![108],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2109>Molten Veins causes any nearby Fire Walls to recover 12 health",
        vec![2109],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2191><icon=3413>Suppress and Deflective Spin Damage +7%",
        vec![2191, 3413],
        vec![Effect::DamageMod(0.07)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2172>You heal 1 health and 1 armor every other second while under the effect of Haste Concoction",
        vec![2172],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3783>Fairy Fire damage is +4 and attack range is +5",
        vec![3783],
        vec![Effect::FlatDamage(4)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3596>Venomstrike deals an additional 24 Poison damage over 12 seconds",
        vec![3596],
        vec![Effect::DotDamage {
            damage: 24,
            damage_type: DamageType::Poison,
            duration: 12,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3691>Bun-Fu Blitz causes the target to take +2% damage from Trauma attacks for 20 seconds",
        vec![3691],
        vec![Effect::Debuff(Debuff {
            remaining_duration: 20,
            effect: DebuffEffect::VulnerabilityDamageModDebuff {
                damage_type: DamageType::Trauma,
                damage_mod: 0.02,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3000>Cosmic Strike deals +20 damage, generates no Rage, and removes 40 Rage",
        vec![3000],
        vec![Effect::FlatDamage(20)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2233>Riposte restores 5 armor",
        vec![2233],
        vec![Effect::RestoreArmor(5)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3730>Unfetter allows free-form movement while leaping, and if the target can fly, fly speed is boosted +0.3 m/s for 20 seconds",
        vec![3730],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3601>Surge Cut restores +6 Health to you",
        vec![3601],
        vec![Effect::RestoreHealth(6)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3674>Thunderous Note causes the target to take +6% damage from Nature attacks for 15 seconds",
        vec![3674],
        vec![Effect::Debuff(Debuff {
            remaining_duration: 15,
            effect: DebuffEffect::VulnerabilityDamageModDebuff {
                damage_type: DamageType::Nature,
                damage_mod: 0.06,
            }
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3802>Dimensional Snare deals Fire damage (instead of Darkness) and ignites the target, dealing 24 Fire damage over 12 seconds",
        vec![3802],
        vec![Effect::DamageType(DamageType::Fire), Effect::DotDamage {
            damage: 24,
            damage_type: DamageType::Fire,
            duration: 12,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2210>Moo of Determination restores +6 armor",
        vec![2210],
        vec![Effect::RestoreArmor(6)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3548>Virulent Bite deals 12 Trauma damage over 12 seconds and also has a 25% chance to deal +16% immediate Piercing damage",
        vec![3548],
        vec![Effect::DotDamage {
            damage: 12,
            damage_type: DamageType::Trauma,
            duration: 12,
        }, Effect::ProcDamageMod {
            damage_mod: 0.16,
            chance: 0.25,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3799>Power Glyph restores 5 additional Power after a 6-second delay",
        vec![3799],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2118>Psychoanalyze deals between 10 and 60 extra damage",
        vec![2118],
        vec![Effect::RangeFlatDamage {
            min_damage: 10,
            max_damage: 60,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2188>For 60 seconds after using Redirect, First Aid heals you +15",
        vec![2188],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2200><icon=2199><icon=2201>Summoned Skeletal Archers and Mages deal +6% direct damage, but are instantly destroyed by ANY Nature Damage",
        vec![2200, 2199, 2201],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3549>For 30 seconds after using Drink Blood, all Nature attacks deal +3 damage",
        vec![3549],
        vec![Effect::Buff(Buff {
            remaining_duration: 30,
            effect: BuffEffect::DamageTypeFlatDamageBuff {
                damage_type: DamageType::Nature,
                damage: 3,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3782>Astral Strike's reuse timer is -1 secs, and damage is boosted +5% vs Elite enemies",
        vec![3782],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3495>Ice Lightning boosts your Core Attack Damage +10 for 7 seconds",
        vec![3495],
        vec![Effect::Buff(Buff {
            remaining_duration: 7,
            effect: BuffEffect::KeywordFlatDamageBuff {
                keyword: "CoreAttack".to_string(),
                damage: 10,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3735>Remedy restores 6 Armor",
        vec![3735],
        vec![Effect::RestoreArmor(6)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3772>Warning Jolt restores 1 Armor and taunts +25",
        vec![3772],
        vec![Effect::RestoreArmor(1)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2150>Chew Cud increases your mitigation versus Crushing, Slashing, and Piercing attacks +3 for 10 seconds",
        vec![2150],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2131>Frenzy gives all targets +4 absorption of any physical damage for 20 seconds",
        vec![2131],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3738>Give Warmth causes the target's next attack to deal +13 damage if it is a Fire attack",
        vec![3738],
        vec![Effect::Buff(Buff {
            remaining_duration: 1,
            effect: BuffEffect::DamageTypeFlatDamageBuff {
                damage_type: DamageType::Fire,
                damage: 13,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2230>Pig Punt causes the target to ignore you for 3 seconds, or until you attack it again",
        vec![2230],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=108>If you are using the Priest skill and you have not been attacked in the past 15 seconds, your Power Regeneration is +5 (meaning you recover this Power every 5 seconds, in and out of combat)",
        vec![108],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=108>Your attacks deal +1 damage to Fey",
        vec![108],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2190>Double Hit ignites the target, dealing 18 Fire damage over 12 seconds",
        vec![2190],
        vec![Effect::DotDamage {
            damage: 18,
            damage_type: DamageType::Fire,
            duration: 12,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=108>Your melee attacks deal +6 damage to Elite enemies",
        vec![108],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2189>Lunge hits all enemies within 5 meters, but deals -50% damage and reuse timer is +2 seconds",
        vec![2189],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3594>Fending Blade deals +7 damage and reduces Rage by 30",
        vec![3594],
        vec![Effect::FlatDamage(7)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3421>Pin boosts Core Attack and Nice Attack Damage +8 for 7 seconds",
        vec![3421],
        vec![
            Effect::Buff(Buff {
                remaining_duration: 7,
                effect: BuffEffect::KeywordFlatDamageBuff {
                    keyword: "CoreAttack".to_string(),
                    damage: 8,
                },
            }),
            Effect::Buff(Buff {
                remaining_duration: 7,
                effect: BuffEffect::KeywordFlatDamageBuff {
                    keyword: "NiceAttack".to_string(),
                    damage: 8,
                },
            }),
        ],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3784><icon=3782>Astral Strike deals +10 damage and resets the timer on Pixie Flare (so it can be used again immediately)",
        vec![3784, 3782],
        vec![Effect::FlatDamage(10)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3542>Deathscream has a 60% chance to deal +25% damage",
        vec![3542],
        vec![Effect::ProcDamageMod {
            damage_mod: 0.25,
            chance: 0.6,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2208><icon=3436>Scintillating Flame and Scintillating Frost Damage +1 and Power Cost -2",
        vec![2208, 3436],
        vec![Effect::FlatDamage(1)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3778><icon=3773>Controlled Burn and Aggression Deterrent deal +10 damage",
        vec![3778, 3773],
        vec![Effect::FlatDamage(10)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3776>Coordinated Assault causes all allies' melee attacks to deal up to +15 damage (randomly determined for each attack) for 30 seconds",
        vec![3776],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2200><icon=2199><icon=2201>Summoned Skeletons have +8 health",
        vec![2200, 2199, 2201],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3697>Carrot Power's reuse timer is -1 second and chance to consume carrot is -4%",
        vec![3697],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3254>Grappling Web deals 48 Poison damage over 12 seconds",
        vec![3254],
        vec![Effect::DotDamage {
            damage: 48,
            damage_type: DamageType::Poison,
            duration: 12,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=108>While the Shield skill is active, you mitigate 1 point of attack damage for every 20 Armor you have remaining. (Normally, you would mitigate 1 for every 25 Armor remaining.)",
        vec![108],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3631>Restorative Arrow boosts target's Nice Attack and Epic Attack Damage +12 for 10 seconds",
        vec![3631],
        vec![
            Effect::Buff(Buff {
                remaining_duration: 10,
                effect: BuffEffect::KeywordFlatDamageBuff {
                    keyword: "NiceAttack".to_string(),
                    damage: 12,
                },
            }),
            Effect::Buff(Buff {
                remaining_duration: 10,
                effect: BuffEffect::KeywordFlatDamageBuff {
                    keyword: "EpicAttack".to_string(),
                    damage: 12,
                },
            }),
        ],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3483>Brambleskin increases your Max Armor by +20 for 30 seconds and restores 20 Armor",
        vec![3483],
        vec![Effect::RestoreArmor(20)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3496>Your Cold Sphere's attacks deal +2 damage and taunt -3%",
        vec![3496],
        vec![Effect::FlatDamage(2)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3069>Calefaction restores 14 Health",
        vec![3069],
        vec![Effect::RestoreHealth(14)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2150>Chew Cud's chance to consume grass is -4%",
        vec![2150],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3443>Flashing Strike heals you for 3 health",
        vec![3443],
        vec![Effect::RestoreHealth(3)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2253>Tough Hoof immediately restores 13 armor",
        vec![2253],
        vec![Effect::RestoreArmor(13)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3252>Incubated Spiders have +10 armor",
        vec![3252],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3726>Admonish makes the target 1% more vulnerable to Psychic damage for 10 seconds (this effect does not stack with itself)",
        vec![3726],
        vec![Effect::Debuff(Debuff {
            remaining_duration: 10,
            effect: DebuffEffect::VulnerabilityDamageModDebuff {
                damage_type: DamageType::Psychic,
                damage_mod: 0.01,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3486>Slashing Strike deals +6% damage and hastens the current reuse timer of Hip Throw by 2 seconds",
        vec![3486],
        vec![Effect::DamageMod(0.06)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2113>Many Cuts deals +15 armor damage",
        vec![2113],
        vec![Effect::FlatDamage(15)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2193>All Staff attacks have a 1.75% chance to trigger the target's Vulnerability",
        vec![2193],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3672>Blast of Despair restores 4 Armor to you",
        vec![3672],
        vec![Effect::RestoreArmor(4)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2131>Smell Fear deals +6% damage and taunts -30",
        vec![2131],
        vec![Effect::DamageMod(0.06)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2236><icon=2196>Heal Undead and Rebuild Undead restore +6 Health/Armor",
        vec![2236, 2196],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3797>Spirit Pounce Damage +5% and there's a 50% chance target is Stunned",
        vec![3797],
        vec![Effect::DamageMod(0.05)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3730>Unfetter boosts swim speed +0.4 m/s for 20 seconds",
        vec![3730],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2174>Your golem minion's Self Destruct deals +30 damage",
        vec![2174],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3672>Blast of Despair damage is +10% and reduces 10 more Rage",
        vec![3672],
        vec![Effect::DamageMod(0.1)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2209>Room-Temperature Ball Damage +5% and reuse timer -1 second",
        vec![2209],
        vec![Effect::DamageMod(0.05)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2195>Raised Zombies deal +1 damage and speed is +2",
        vec![2195],
        vec![Effect::FlatDamage(1)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3203><icon=3202><icon=3746>Psi Health Wave, Armor Wave, and Power Wave grant all targets +10 Psychic Damage for 60 seconds",
        vec![3203, 3202, 3746],
        vec![Effect::Buff(Buff {
            remaining_duration: 60,
            effect: BuffEffect::DamageTypeFlatDamageBuff {
                damage_type: DamageType::Psychic,
                damage: 10,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3270><icon=3070><icon=3430>Electrify, System Shock, and Panic Charge restore 2 Health after a 15 second delay",
        vec![3270, 3070, 3430],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2147>Moo of Calm restores +6 armor",
        vec![2147],
        vec![Effect::RestoreArmor(6)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3800>Galvanize restores 6 additional Power after a 6-second delay",
        vec![3800],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2150>Chew Cud increases your mitigation versus Crushing, Slashing, and Piercing attacks +3 for 10 seconds",
        vec![2150],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3491>Ice Nova restores 10 Armor to you",
        vec![3491],
        vec![Effect::RestoreArmor(10)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3485>Cloud Sight causes target's attacks to have +5% more chance of missing, but Power cost is +15%",
        vec![3485],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2147>For 30 seconds after you use Moo of Calm, any internal (Poison/Trauma/Psychic) attacks that hit you are reduced by 2. This absorbed damage is added to your next Stampede attack at a 200% rate.",
        vec![2147],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3597>Gut deals +4% damage and reuse timer is -1 second",
        vec![3597],
        vec![Effect::DamageMod(0.04)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2184><icon=2178><icon=2171>All bomb attacks ignite the target, causing them to take 35 fire damage over 10 seconds",
        vec![2184, 2178, 2171],
        vec![Effect::DotDamage {
            damage: 35,
            damage_type: DamageType::Fire,
            duration: 10,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2192>For 60 seconds after using Blocking Stance, First Aid heals you +74",
        vec![2192],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2123>Tell Me About Your Mother causes target's attacks to deal -2 damage for 60 seconds",
        vec![2123],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3555>Premeditated Doom boosts sprint speed +1.5 for 20 seconds",
        vec![3555],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3747>Flesh to Fuel increases your Out of Combat Sprint speed +6 for 15 seconds",
        vec![3747],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3070>System Shock boosts the damage of your Signature Debuffs by +74 for 6 seconds",
        vec![3070],
        vec![Effect::Buff(Buff {
            remaining_duration: 6,
            effect: BuffEffect::KeywordFlatDamageBuff {
                keyword: "SignatureDebuff".to_string(),
                damage: 74,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2230>Pig Punt has a 35% chance to confuse the target about which enemy is which, permanently shuffling their hatred levels toward all enemies they know about",
        vec![2230],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3776>Coordinated Assault causes all allies' Melee attacks to cost -10 Power for 30 seconds",
        vec![3776],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2195>Using Raise Zombie on an existing zombie increases its damage +22% for 60 seconds",
        vec![2195],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2124>Strike a Nerve Damage +65 (this treasure effect is retired and is using a placeholder buff)",
        vec![2124],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3202><icon=3203>Psi Power Wave and Psi Armor Wave cause all targets' melee attacks to cost -4 Power for 20 seconds",
        vec![3202],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3641>Elemental Ward boosts your direct and indirect Electricity damage +14 for 30 seconds",
        vec![3641],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2160>Animal Handling pets absorb some direct damage based on their remaining Armor (absorbing 0% when armor is empty, up to 20% when armor is full)",
        vec![2160],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3069>Calefaction deals 141 additional Fire damage after a 12 second delay",
        vec![3069],
        vec![Effect::DelayedDamage {
            damage: 141,
            damage_type: DamageType::Fire,
            delay: 12,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3301>Poison Arrow increases the damage target takes from Poison by 17% for 10 seconds",
        vec![3301],
        vec![Effect::Debuff(Debuff {
            remaining_duration: 10,
            effect: DebuffEffect::VulnerabilityDamageModDebuff {
                damage_type: DamageType::Poison,
                damage_mod: 0.17,
            }
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2153>For 10 seconds after using Doe Eyes, you mitigate +30 from all attacks, and a further +60 from Elite attacks",
        vec![2153],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3676>Disharmony causes target to deal -8 damage with their next attack",
        vec![3676],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2136>When you use Sic Em, your sprint speed increases by +4.5 for 10 seconds",
        vec![2136],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2231>Squeal boosts sprint speed by 9.5 for 10 seconds",
        vec![2231],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3407>Cow's Bash costs -39 Power",
        vec![3407],
        vec![],
        1,
    );
    //fairy_fire_buff
    test_icon_id_effect(
        &parser,
        "<icon=3458>Strategic Preparation causes your next attack to deal +58 damage if it is a Crushing, Slashing, or Piercing attack",
        vec![3458],
        vec![
            Effect::Buff(Buff {
                remaining_duration: 1,
                effect: BuffEffect::DamageTypeFlatDamageBuff {
                    damage_type: DamageType::Crushing,
                    damage: 58,
                },
            }),
            Effect::Buff(Buff {
                remaining_duration: 1,
                effect: BuffEffect::DamageTypeFlatDamageBuff {
                    damage_type: DamageType::Slashing,
                    damage: 58,
                },
            }),
            Effect::Buff(Buff {
                remaining_duration: 1,
                effect: BuffEffect::DamageTypeFlatDamageBuff {
                    damage_type: DamageType::Piercing,
                    damage: 58,
                },
            }),
        ],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3695>Rabbit's Foot grants you and nearby allies +4% Earned Combat XP for 20 seconds",
        vec![3695],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2113>Many Cuts knocks back targets that have less than a third of their Armor, also dealing +35 damage",
        vec![2113],
        vec![Effect::FlatDamage(35)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3202><icon=3746>Psi Health Wave and Psi Armor Wave instantly heal you for 35 health",
        vec![3202, 3746],
        vec![Effect::RestoreHealth(35)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2206><icon=2209>Room-Temperature Ball and Defensive Burst cause the target's attacks to deal -16 damage for 10 seconds",
        vec![2206, 2209],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2160>Animal Handling pets have +57% Death Avoidance (ignores a fatal attack once; resets after 15 minutes)",
        vec![2160],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3309>Fire Arrow suddenly deals an additional 40 indirect Fire damage after a 12 second delay",
        vec![3309],
        vec![Effect::DelayedDamage {
            damage: 40,
            damage_type: DamageType::Fire,
            delay: 12,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3422>Heed The Stick deals +16% Damage and Taunts +1140",
        vec![3422],
        vec![Effect::DamageMod(0.16)],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3555>Premeditated Doom channeling time is -1 second and boosts your Indirect Poison damage +2 (per tick) for 20 seconds",
        vec![3555],
        vec![Effect::Buff(Buff {
            remaining_duration: 20,
            effect: BuffEffect::DamageTypePerTickDamageBuff {
                damage_type: DamageType::Poison,
                damage: 2,
            }
        })],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3676>Disharmony causes target to deal -1 damage with their next attack",
        vec![3676],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2197>Heart's Power has a 11% chance to not actually consume the heart(s)",
        vec![2197],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3667><icon=3675>Entrancing Lullaby and Anthem of Avoidance cost -10 Power",
        vec![3667, 3675],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3032>Terrifying Bite causes the target to take +16% damage from Poison attacks",
        vec![3032],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2251>Summoned Deer have +38 health",
        vec![2251],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2223>Inspire Confidence increases the damage of all targets' attacks +12 for 30 seconds",
        vec![2223],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2175>Healing Mist heals +111 Armor",
        vec![2175],
        vec![Effect::RestoreArmor(111)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2128>Wind Strike causes your next attack to deal +51 damage",
        vec![2128],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3451>While Bulwark Mode is enabled you recover 3 Power per second",
        vec![3451],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3726>The maximum Power restored by Admonish increases +9",
        vec![3726],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3549>Drink Blood deals +51 Piercing damage",
        vec![3549],
        vec![Effect::FlatDamage(51)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3691><icon=3704><icon=3752>All Bun-Fu moves cost -14 Power",
        vec![3691, 3704, 3752],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2232>Mudbath causes the target to take 7% less damage from all attacks for 10 seconds",
        vec![2232],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2160>Animal Handling pets have +44 Enthusiasm (which boosts XP earned and critical-hit chance)",
        vec![2160],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3670>Moment of Resolve dispels any Stun effects on allies and grants them immunity to Stuns for 8 seconds",
        vec![3670],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2230>Pig Punt has a 65% chance to slow target's movement by 45%",
        vec![2230],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2220>Ridicule boosts movement speed by 1.5 for 6 seconds",
        vec![2220],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2210>For 30 seconds after you use Moo of Determination, any physical (Slashing/Piercing/Crushing) attacks that hit you are reduced by 8. This absorbed damage is added to your next Front Kick.",
        vec![2210],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3525>Blizzard has a 80% chance to cause all sentient targets to flee in terror",
        vec![3525],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3549>Drink Blood costs -17 Power",
        vec![3549],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3631>Restorative Arrow heals YOU for 90 Health",
        vec![3631],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2192>Blocking Stance boosts your Psychic Damage +4.25% for 30 seconds",
        vec![2192],
        vec![Effect::Buff(Buff {
            remaining_duration: 30,
            effect: BuffEffect::DamageTypeDamageModBuff {
                damage_type: DamageType::Psychic,
                damage_mod: 0.0425,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2240><icon=2105>Cobra Strike and Mamba Strike boost your Nice Attack and Signature Debuff ability damage +31 for 7 seconds",
        vec![2240, 2105],
        vec![
            Effect::Buff(Buff {
                remaining_duration: 7,
                effect: BuffEffect::KeywordFlatDamageBuff {
                    keyword: "NiceAttack".to_string(),
                    damage: 31,
                },
            }),
            Effect::Buff(Buff {
                remaining_duration: 7,
                effect: BuffEffect::KeywordFlatDamageBuff {
                    keyword: "SignatureDebuff".to_string(),
                    damage: 31,
                },
            }),
        ],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3305>Long Shot boosts your Armor Regeneration (in-combat) +1 for 15 seconds",
        vec![3305],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3464>Clobbering Hoof infects the target, causing 220 Nature damage over 10 seconds",
        vec![3464],
        vec![Effect::DotDamage {
            damage: 220,
            damage_type: DamageType::Nature,
            duration: 10,
        }],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2156>Graze boosts your out-of-combat sprint speed by 8.5 for 30 seconds",
        vec![2156],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3627><icon=2203><icon=2119>While Unarmed skill is active: 28.5% of all Darkness and Psychic damage you take is mitigated and added to the damage done by your next Punch, Jab, or Infuriating Fist at a 380% rate",
        vec![3627, 2203, 2119],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2160>Animal Handling pets' healing abilities, if any, restore +41% health",
        vec![2160],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3586>Frostbite debuffs target so that 10.5% of their attacks miss and have no effect",
        vec![3586],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2256>Shadow Feint raises your Lycanthropy Base Damage +43% until you trigger the teleport",
        vec![2256],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2114>After using Pack Attack, your Lycanthropy Base Damage increases +25% for 7 seconds or until you are attacked",
        vec![2114],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2201>Summoned Skeletal Swordsmen have +76 armor",
        vec![2201],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3627><icon=2203><icon=2119>While Unarmed skill is active: 19% of all Slashing, Piercing, and Crushing damage you take is mitigated and added to the damage done by your next Punch, Jab, or Infuriating Fist at a 260% rate",
        vec![3627, 2203, 2119],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3586>Frostbite causes target's attacks to deal -17 damage",
        vec![3586],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3254>Grappling Web causes the target to take +12% damage from Poison (both direct and indirect)",
        vec![3254],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3550>Wing Vortex causes targets' next attack to deal -74 damage",
        vec![3550],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2154>Deer Bash has a 5% chance to summon a deer ally for 30 seconds",
        vec![2154],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3473>Look At My Hammer reduces the damage you take from Slashing, Piercing, and Crushing attacks by 15 for 5 seconds",
        vec![3473],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3442>Infinite Legs has a 20% chance to boost Spider Skill Base Damage +10% for 30 seconds",
        vec![3442],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3670>Moment of Resolve boosts targets' Movement Speed +4 for 8 seconds",
        vec![3670],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3795>Nip causes target's next attack to deal -14 damage",
        vec![3795],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3592>Blur Cut grants a 10% chance to ignore stuns for 8 seconds",
        vec![3592],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2251>Summoned Deer have +73 armor",
        vec![2251],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3305>Long Shot boosts your Epic Attack Damage +20% for 15 seconds",
        vec![3305],
        vec![Effect::Buff(Buff {
            remaining_duration: 15,
            effect: BuffEffect::KeywordDamageModBuff {
                keyword: "EpicAttack".to_string(),
                damage_mod: 0.2,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3451>While Bulwark Mode is enabled you recover 7 Armor per second",
        vec![3451],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3669><icon=3665><icon=3664><icon=3663>Your Bard Songs cost -20% Power. In addition, you can use the ability Hymn of Resurrection. (Equipping this item will teach you the ability if needed.)",
        vec![3669, 3665, 3664, 3663],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3768>Apprehend costs -22 Power",
        vec![3768],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3315><icon=3310>Basic Shot and Aimed Shot heal you for 8 health",
        vec![3315, 3310],
        vec![Effect::RestoreHealth(8)],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3694>Play Dead boosts your Psychic attack damage +30 for 20 seconds",
        vec![3694],
        vec![Effect::Buff(Buff {
            remaining_duration: 20,
            effect: BuffEffect::DamageTypeFlatDamageBuff {
                damage_type: DamageType::Psychic,
                damage: 30,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3032>Terrifying Bite boosts sprint speed +1 for 10 seconds",
        vec![3032],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2192>Blocking Stance boosts your Cold Damage +6.25% for 30 seconds",
        vec![2192],
        vec![Effect::Buff(Buff {
            remaining_duration: 30,
            effect: BuffEffect::DamageTypeDamageModBuff {
                damage_type: DamageType::Cold,
                damage_mod: 0.0625,
            },
        })],
        0,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2255>Porcine Alertness gives all targets +30% chance to ignore Stun effects for 20 seconds",
        vec![2255],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2140>See Red increases the damage of your next attack by +47",
        vec![2140],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3785>Fae Conduit also buffs targets' direct Cold, Fire, and Electricity damage +12 for 30 seconds (stacking up to 6 times)",
        vec![3785],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2187>Your Stretchy Spine mutation randomly repairs broken bones twice as often",
        vec![2187],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3632><icon=3480>Regrowth and Pulse of Life Healing +32%",
        vec![3632, 3480],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3775>Privacy Field causes you to recover 13 Power when a melee attack deals damage to you",
        vec![3775],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3775>Privacy Field deals +41 damage to all melee attackers, and the first melee attacker is knocked away",
        vec![3775],
        vec![Effect::DotDamage {
            damage: 41,
            damage_type: DamageType::Electricity,
            duration: 0,
        }],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3321>Blitz Shot and Basic Shot boost your healing from Combat Refreshes +4 for 30 seconds",
        vec![3321],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3751>Love Tap lowers target's aggro toward you by 450",
        vec![3751],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3497>While in Cryogenic Freeze, you are 100% resistant to Poison damage",
        vec![3497],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=2160>For 13 seconds after using Clever Trick, pets' basic attacks have a 15% chance to deal double damage",
        vec![2160],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3771>Conditioning Shock causes target's next ability to deal -6 damage",
        vec![3771],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3500>Tundra Spikes stuns all targets after a 10 second delay",
        vec![3500],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3602>Fan of Blades knocks all targets backwards",
        vec![3602],
        vec![],
        1,
    );
    test_icon_id_effect(
        &parser,
        "<icon=3773>Controlled Burn deals 102 indirect Fire damage over 12 seconds",
        vec![3773],
        vec![Effect::DotDamage {
            damage: 102,
            damage_type: DamageType::Fire,
            duration: 12,
        }],
        0,
    );
}
