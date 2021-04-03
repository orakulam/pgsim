const fs = require('fs');

let abilities = JSON.parse(fs.readFileSync('../data/abilities.json'));
let items = JSON.parse(fs.readFileSync('../data/items.json'));
let skills = JSON.parse(fs.readFileSync('../data/skills.json'));
let itemMods = JSON.parse(fs.readFileSync('../data/tsysclientinfo.json'));

let validSkills = [];

let data = {
    abilities: [],
    items: [],
    skills: [],
    itemMods: [],
};

// Gather all abilities that are a prereq for another ability, so we can exclude them (because if they're a prereq, then they're not the max level available)
const abilityPrereqs = [];
for (const [id, ability] of Object.entries(abilities)) {
    if (ability.Skill !== 'Unknown' && ability.Prerequisite) {
        abilityPrereqs.push(ability.Prerequisite);
    }
}
for (const [id, ability] of Object.entries(abilities)) {
    if (ability.Skill !== 'Unknown' && !abilityPrereqs.includes(ability.InternalName)) {
        data.abilities.push({
            id,
            name: ability.Name,
            internalName: ability.InternalName,
            skill: ability.Skill,
        });
    }
}

for (const [id, item] of Object.entries(items)) {
    if (item.EquipSlot) {
        let slot = item.EquipSlot;
        if (slot === 'OffHandShield') {
            slot = 'OffHand';
        }
        data.items.push({
            id,
            name: item.Name,
            slot,
        });
    }
}

for (const [name, skill] of Object.entries(skills)) {
    if (skill.Combat && !name.includes("Performance_")) {
        data.skills.push({
            name,
        });
        // Add to internal array for use in item mod logic
        validSkills.push(name);
    }
}

for (const [id, mod] of Object.entries(itemMods)) {
    if (validSkills.includes(mod.Skill)) {
        let firstTier;
        let secondTier;
        let maxTier;
        let maxLevel = 0;
        for (const [tierId, tier] of Object.entries(mod.Tiers)) {
            if (tier.SkillLevelPrereq === 80) {
                firstTier = {
                    id: tierId,
                    tier,
                };
            }
            if (tier.SkillLevelPrereq === 75) {
                secondTier =  {
                    id: tierId,
                    tier,
                };
            }
            if (tier.SkillLevelPrereq > maxLevel) {
                maxTier =  {
                    id: tierId,
                    tier,
                };
                maxLevel = tier.SkillLevelPrereq;
            }
        }
        // Select the most relevant tier for this mod
        let tier = firstTier || secondTier || maxTier;
        // Join together multiple effect descriptions
        let effect = tier.tier.EffectDescs.join(', ');
        // Strip off icon ID info
        effect = effect.substring(effect.lastIndexOf('>') + 1);
        data.itemMods.push({
            id,
            skill: mod.Skill,
            slots: mod.Slots,
            tierId: tier.id,
            effect,
        });
    }
}

fs.writeFileSync('./src/data.json', JSON.stringify(data));

console.log('Done');
