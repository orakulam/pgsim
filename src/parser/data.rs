use serde::de::IntoDeserializer;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use strum_macros::EnumString;

type SkillName = String;
type AbilityName = String;
type InternalAbilityName = String;

fn empty_string_as_none<'de, D, T>(de: D) -> Result<Option<T>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: serde::Deserialize<'de>,
{
    let opt = Option::<String>::deserialize(de)?;
    let opt = opt.as_ref().map(String::as_str);
    match opt {
        None | Some("") => Ok(None),
        Some(s) => T::deserialize(s.into_deserializer()).map(Some),
    }
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
struct Skill {
    combat: bool,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
pub struct Ability {
    pub skill: SkillName,
    pub name: AbilityName,
    pub internal_name: InternalAbilityName,
    prerequisite: Option<InternalAbilityName>,
    #[serde(rename = "IconID")]
    pub icon_id: i32,
    pub keywords: Option<Vec<String>>,
    level: i32,
    #[serde(deserialize_with = "empty_string_as_none")]
    pub damage_type: Option<DamageType>,
    #[serde(rename = "PvE")]
    pub pve: AbilityPvE,
    pub reset_time: f32,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
pub struct AbilityPvE {
    pub damage: Option<i32>,
    pub health_specific_damage: Option<i32>,
    pub armor_specific_damage: Option<i32>,
    pub attributes_that_delta_damage: Option<Vec<String>>,
    pub attributes_that_mod_base_damage: Option<Vec<String>>,
    pub attributes_that_mod_damage: Option<Vec<String>>,
    #[serde(rename = "DoTs")]
    pub dots: Option<Vec<AbilityDot>>,
}

#[derive(
    Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Hash, EnumString,
)]
pub enum DamageType {
    Slashing,
    Crushing,
    Piercing,
    Trauma,
    Nothingness,
    Nature,
    Potion,
    Fire,
    Cold,
    Poison,
    Regeneration,
    Darkness,
    Acid,
    Electricity,
    Psychic,
    Smiting,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
pub struct AbilityDot {
    pub damage_per_tick: i32,
    pub duration: i32,
    pub num_ticks: i32,
    #[serde(deserialize_with = "empty_string_as_none")]
    pub damage_type: Option<DamageType>,
    attributes_that_delta: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
pub struct ItemMod {
    pub skill: SkillName,
    pub tiers: HashMap<String, ItemModEffect>,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
pub struct ItemModEffect {
    pub effect_descs: Vec<String>,
    skill_level_prereq: i32,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "PascalCase")]
pub struct Item {
    pub name: String,
    pub effect_descs: Option<Vec<String>>,
}

pub struct Data {
    skills: HashMap<String, Skill>,
    pub abilities: HashMap<String, Ability>,
    pub item_mods: HashMap<String, ItemMod>,
    pub items: HashMap<String, Item>,
}

impl Data {
    pub fn load() -> Data {
        let skills: HashMap<String, Skill> = serde_json::from_str(
            &fs::read_to_string("./data/skills.json").expect("Unable to read skills.json"),
        )
        .unwrap();
        let abilities: HashMap<String, Ability> = serde_json::from_str(
            &fs::read_to_string("./data/abilities.json").expect("Unable to read abilities.json"),
        )
        .unwrap();
        let item_mods: HashMap<String, ItemMod> = serde_json::from_str(
            &fs::read_to_string("./data/tsysclientinfo.json")
                .expect("Unable to read tsysclientinfo.json"),
        )
        .unwrap();
        let items: HashMap<String, Item> = serde_json::from_str(
            &fs::read_to_string("./data/items.json").expect("Unable to read items.json"),
        )
        .unwrap();

        Data {
            skills,
            abilities,
            item_mods,
            items,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_data_files() {
        let data = Data::load();
        assert!(data.skills.len() > 150);
        assert!(data.abilities.len() > 3300);
        assert!(data.item_mods.len() > 1500);
        assert!(data.skills["Sword"].combat == true);
        assert!(data.abilities["ability_5911"].name == "Sword Slash 7");
        assert!(data.abilities["ability_5911"].pve.damage == Some(133));
        assert!(data.item_mods["power_1004"].skill == "Sword");
        assert!(
            data.item_mods["power_1004"].tiers["id_8"].effect_descs[0]
                == "<icon=3445><icon=2121>Sword Slash and Thrusting Blade restore 18 armor"
        );
    }
}
