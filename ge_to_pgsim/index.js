const fs = require('fs');

let geData = {"selectedMods":{"firstSkillMods":{"header":"Knife","mods":{"Head":["Knife Base Damage +50%","Poisoner's Cut Damage +64%","Gut Damage +138"],"Chest":["Blur Cut deals 145 Poison damage over 10 seconds","Slice deals 175 Poison damage over 10 seconds","Slice Damage +44%"],"Legs":["Poisoner's Cut has a 50% chance to deal +143% damage","Poisoner's Cut boosts Indirect Poison Damage an additional +16 per tick","Slice ignores mitigation from armor and deals +96 damage"],"Hands":["Venomstrike has a 50% chance to stun the target and deal +60 damage","Slice has a 40% chance to deal +57% damage and restore 105 armor"],"Feet":["Slice deals 175 Poison damage over 10 seconds","Slice Damage +44%","Venomstrike Damage +52%"],"Ring":["Poisoner's Cut Damage +64%","Venomstrike deals an additional 240 Poison damage over 12 seconds"],"Necklace":["Indirect Poison Damage +60%, Indirect Trauma Damage +60%","Poisoner's Cut has a 50% chance to deal +143% damage"],"MainHand":["Knife Base Damage +50%","Venomstrike deals an additional 240 Poison damage over 12 seconds"],"OffHand":["Indirect Poison Damage +60%, Indirect Trauma Damage +60%","Poisoner's Cut boosts Indirect Poison Damage an additional +16 per tick","Venomstrike Damage +52%"]}},"secondSkillMods":{"header":"Druid","mods":{"Head":["Druid Skill Base Damage +50%"],"Chest":["Rotskin Armor Damage +56%","Heart Thorn coats the target in stinging insects that deal 378 Nature damage over 12 seconds","Cloud Sight covers the target in insects that deal 312 Nature damage over 12 seconds"],"Legs":["Indirect Nature Damage +48%","Heart Thorn coats the target in stinging insects that deal 378 Nature damage over 12 seconds","Heart Thorn deals Poison damage (instead of Nature) and also deals 330 Poison damage over 12 seconds","Toxinball deals +234 Poison damage to health over 12 seconds"],"Hands":["Toxinball deals +234 Poison damage to health over 12 seconds","Heart Thorn deals Poison damage (instead of Nature) and also deals 330 Poison damage over 12 seconds","Brambleskin deals +120 Nature damage to melee attackers"],"Feet":["Heart Thorn Damage +94%","Rotskin Armor Damage +56%","Delerium Damage +66%","Brambleskin deals +120 Nature damage to melee attackers"],"Ring":["Fill With Bile increases target's direct Poison damage +67"],"Necklace":["Cloud Sight and Delerium Damage +44%","Toxinball Damage +79%"],"MainHand":["Druid Skill Base Damage +50%","Indirect Nature Damage +48%","Cloud Sight covers the target in insects that deal 312 Nature damage over 12 seconds","Toxinball Damage +79%"],"OffHand":["Cloud Sight and Delerium Damage +44%","Rotskin deals +24% damage and boosts your Nice Attack Damage +103 for 10 seconds"]}},"genericMods":{"header":"Generic","mods":{"Head":[],"Chest":[],"Legs":[],"Hands":["Poison Damage (Direct&Per-Tick) +20"],"Feet":[],"Ring":[],"Necklace":[],"MainHand":[],"OffHand":[]}},"enduranceMods":{"header":"Endurance","mods":{"Head":[],"Chest":[],"Legs":[],"Hands":[],"Feet":[],"Ring":[],"Necklace":[],"MainHand":[],"OffHand":[]}},"shamanicInfusionMods":{"header":"Shamanic Infusion","mods":{"Head":[],"Chest":[],"Legs":[],"Hands":[],"Feet":[],"Ring":[],"Necklace":[],"MainHand":[],"OffHand":[]}}},"currentlySelectedAbilities":{"hotbar1":[{"name":"Opening Thrust 9","description":"A quick distracting attack with the knife that sets up subsequent attacks.","icon":"/icons/icon_3590.png","attackType":" Basic","attributes":{"Min Level":81,"Power Cost":0,"Reuse Time":2,"Range":4,"Damage":"128 Slashing","Special":"Your Knife Base Damage is boosted by 15% for your next attack.","Accuracy":null},"skill":"Knife","relevantMods":["Knife Base Damage +50%","Knife Base Damage +50%"]},{"name":"Blur Cut 8","description":"A weak attack that can confuse your opponents about how best to counter-attack you. This attack generates no enemy Rage.","icon":"/icons/icon_3592.png","attributes":{"Min Level":74,"Power Cost":24,"Reuse Time":8,"Range":4,"Damage":"196 Slashing","Enrages Target":"0%","Special":"You gain +14% Melee Evasion for 5 seconds.","Accuracy":null},"skill":"Knife","relevantMods":["Knife Base Damage +50%","Blur Cut deals 145 Poison damage over 10 seconds","Knife Base Damage +50%"]},{"name":"Slice 9","description":"A strong attack.","icon":"/icons/icon_3595.png","attributes":{"Min Level":83,"Power Cost":46,"Reuse Time":9,"Range":4,"Damage":"391 Slashing","Accuracy":null},"skill":"Knife","relevantMods":["Knife Base Damage +50%","Slice deals 175 Poison damage over 10 seconds","Slice Damage +44%","Slice ignores mitigation from armor and deals +96 damage","Slice has a 40% chance to deal +57% damage and restore 105 armor","Slice deals 175 Poison damage over 10 seconds","Slice Damage +44%","Knife Base Damage +50%"]},{"name":"Gut 8","description":"A knife to the stomach or other vulnerable spot. Causes bleeding if the enemy is caught off guard.","icon":"/icons/icon_3597.png","attackType":" Core","attributes":{"Min Level":75,"Power Cost":35,"Reuse Time":10,"Range":4,"Damage Health":"235 Piercing","Accuracy":null},"skill":"Knife","relevantMods":["Knife Base Damage +50%","Gut Damage +138","Knife Base Damage +50%"]},{"name":"Poisoner's Cut 5","description":"A distracting motion whose main aim is to give you time to add poison to your blade for your next maneuver.","icon":"/icons/icon_3593.png","attributes":{"Min Level":75,"Power Cost":43,"Reuse Time":8,"Range":4,"Damage":"235 Slashing","Special":"For 5 seconds, you gain Direct Poison Damage +50 and Indirect Poison Damage +10 per tick.","Accuracy":null},"skill":"Knife","relevantMods":["Knife Base Damage +50%","Poisoner's Cut Damage +64%","Poisoner's Cut has a 50% chance to deal +143% damage","Poisoner's Cut boosts Indirect Poison Damage an additional +16 per tick","Poisoner's Cut Damage +64%","Poisoner's Cut has a 50% chance to deal +143% damage","Knife Base Damage +50%","Poisoner's Cut boosts Indirect Poison Damage an additional +16 per tick"]},{"name":"Venomstrike 8","description":"A vicious attack that injects poison deep into the enemy's body.","icon":"/icons/icon_3596.png","attackType":" Nice","attributes":{"Min Level":77,"Power Cost":62,"Reuse Time":10,"Range":4,"Damage":"408 Poison","Accuracy":null},"skill":"Knife","relevantMods":["Knife Base Damage +50%","Venomstrike has a 50% chance to stun the target and deal +60 damage","Venomstrike Damage +52%","Venomstrike deals an additional 240 Poison damage over 12 seconds","Knife Base Damage +50%","Venomstrike deals an additional 240 Poison damage over 12 seconds","Venomstrike Damage +52%","Rotskin deals +24% damage and boosts your Nice Attack Damage +103 for 10 seconds"]}],"hotbar2":[{"name":"Delerium 8","description":"Poison the target's mind, sapping their focus.","icon":"/icons/icon_3484.png","attackType":" Nice","attributes":{"Min Level":79,"Power Cost":44,"Reuse Time":10,"Range":20,"Damage":"307 Poison","Rage":-760,"Enrages Target":"0%","Accuracy":null},"skill":"Druid","relevantMods":["Druid Skill Base Damage +50%","Delerium Damage +66%","Cloud Sight and Delerium Damage +44%","Druid Skill Base Damage +50%","Cloud Sight and Delerium Damage +44%","Rotskin deals +24% damage and boosts your Nice Attack Damage +103 for 10 seconds"]},{"name":"Heart Thorn 9","description":"Plant a seed in the target that leaves them weakened.","icon":"/icons/icon_3481.png","abilityType":"Signature Debuff","attributes":{"Min Level":81,"Power Cost":54,"Reuse Time":15,"Range":20,"Damage":"272 Nature","Special":"Target's attacks deal -45 damage for 15 seconds.","Accuracy":null},"skill":"Druid","relevantMods":["Druid Skill Base Damage +50%","Heart Thorn coats the target in stinging insects that deal 378 Nature damage over 12 seconds","Heart Thorn coats the target in stinging insects that deal 378 Nature damage over 12 seconds","Heart Thorn deals Poison damage (instead of Nature) and also deals 330 Poison damage over 12 seconds","Heart Thorn deals Poison damage (instead of Nature) and also deals 330 Poison damage over 12 seconds","Heart Thorn Damage +94%","Druid Skill Base Damage +50%"]},{"name":"Cloud Sight 6","description":"Cause tiny organisms to grow on the target's eyes, making it difficult for them to fight.","icon":"/icons/icon_3485.png","attributes":{"Min Level":72,"Power Cost":49,"Reuse Time":10,"Range":4,"Damage":"309 Nature","Special":"For 10 seconds, target's attacks have a 10% chance to miss. (This effect does not stack with other druids' castings.)","Accuracy":null},"skill":"Druid","relevantMods":["Druid Skill Base Damage +50%","Cloud Sight covers the target in insects that deal 312 Nature damage over 12 seconds","Cloud Sight and Delerium Damage +44%","Druid Skill Base Damage +50%","Cloud Sight covers the target in insects that deal 312 Nature damage over 12 seconds","Cloud Sight and Delerium Damage +44%"]},{"name":"Fill With Bile 5","description":"You or an ally become more virulent and toxic.","icon":"/icons/icon_3401.png","attributes":{"Min Level":75,"Power Cost":61,"Reuse Time":60,"Range":20,"Special":"Target's Poison attacks deal +72 damage, and Poison damage-over-time attacks deal +6 per tick.","Accuracy":null},"skill":"Druid","relevantMods":["Druid Skill Base Damage +50%","Fill With Bile increases target's direct Poison damage +67","Druid Skill Base Damage +50%"]},{"name":"Toxinball 8","description":"Fling an orb of poison.","icon":"/icons/icon_3403.png","attackType":" Core","attributes":{"Min Level":75,"Power Cost":35,"Reuse Time":8,"Range":30,"Damage":"202 Poison","Accuracy":null},"skill":"Druid","relevantMods":["Druid Skill Base Damage +50%","Toxinball deals +234 Poison damage to health over 12 seconds","Toxinball deals +234 Poison damage to health over 12 seconds","Toxinball Damage +79%","Druid Skill Base Damage +50%","Toxinball Damage +79%"]},{"name":"Rotskin 8","description":"Deplete the target's defenses, rotting them from within. They suffer extra damage from each attack.","icon":"/icons/icon_3482.png","special":[{"AttributesThatDelta":["BUFF_DELTA_ROTSKIN"],"Label":"Target's mitigation reduced","Suffix":"for 30 seconds","Value":-56}],"attributes":{"Min Level":76,"Power Cost":36,"Reuse Time":15,"Range":20,"Damage Armor":"339 Nature","Accuracy":null},"skill":"Druid","relevantMods":["Druid Skill Base Damage +50%","Rotskin Armor Damage +56%","Rotskin Armor Damage +56%","Druid Skill Base Damage +50%","Rotskin deals +24% damage and boosts your Nice Attack Damage +103 for 10 seconds"]}]},"modStatus":{"Head":{},"Chest":{},"Legs":{},"Hands":{},"Feet":{},"Ring":{},"Necklace":{},"MainHand":{},"OffHand":{}}};

let abilities = JSON.parse(fs.readFileSync('../data/abilities.json'));
let itemMods = JSON.parse(fs.readFileSync('../data/tsysclientinfo.json'));

let configJson = {
    abilities: [],
    items: [],
    itemMods: [],
    simLength: 30,
};

const getAbilityInternalNames = (geAbilities) => {
    return geAbilities.map((geAbility) => {
        for (const ability of Object.values(abilities)) {
            if (ability.Name === geAbility.name) {
                return ability.InternalName;
            }
        }
    });
}

configJson.abilities = getAbilityInternalNames(geData.currentlySelectedAbilities.hotbar1).concat(getAbilityInternalNames(geData.currentlySelectedAbilities.hotbar2));

const reBaseDamageAttribute = /(.*) Base Damage \+([0-9]*)/;
const reDamageAttribute = /(.*) Damage \+([0-9]*)/;
// Well, this sure is a nested loop
for (const category of Object.values(geData.selectedMods)) {
    for (const modArray of Object.values(category.mods)) {
        for (const geModText of modArray) {
            let searchText = geModText;
            let baseDamageMatch = geModText.match(reBaseDamageAttribute);
            let damageMatch = geModText.match(reDamageAttribute);
            if (baseDamageMatch) {
                searchText = `{MOD_SKILL_${baseDamageMatch[1].toUpperCase()}}{${baseDamageMatch[2] / 100}}`;
            } else if (damageMatch) {
                searchText = `{MOD_ABILITY_${damageMatch[1].replace(' ', '').toUpperCase()}}{${damageMatch[2] / 100}}`;
            }
            let found = false;
            for (const [modId, mod] of Object.entries(itemMods)) {
                for (const [tierId, tier] of Object.entries(mod.Tiers)) {
                    for (const effectDesc of tier.EffectDescs) {
                        if (effectDesc.includes(searchText)) {
                            configJson.itemMods.push([modId, tierId]);
                            found = true;
                        }
                    }
                }
            }
            if (!found) {
                console.log("Failed to find", geModText, searchText);
            }
        }
    }
}

console.log(configJson);