<script lang="ts">
	import data from './data.json';

	console.log(data);

	let report;
	let skill1;
	let skill1Abilities = [];
	let skill2;
	let skill2Abilities = [];
	const slots = [];
	let itemMods = {};
	let length = 30;

	const foundSlots = [];
	for (const item of data.items) {
		if (!foundSlots.includes(item.slot)) {
			foundSlots.push(item.slot);
			slots.push({
				name: item.slot,
			});
		}
	}

	function skillChanged() {
		itemMods = {};
	}

	function itemModChange(e, mod) {
		const checked = e.target.checked;
		if (checked) {
			itemMods[mod.id] = mod.tierId;
		} else {
			delete itemMods[mod.id];
		}
	}

	async function run() {
		// Get simulation length
		let simLength = 30;
		if (!isNaN(Number(length))) {
			simLength = Number(length);
		}
		// Get equipped items
		let items = [];
		for (const slot of slots) {
			if (slot.item) {
				items.push(slot.item);
			}
		}
		// Get equipped item mods
		let simMods = [];
		for (const [modId, tierId] of Object.entries(itemMods)) {
			simMods.push([modId, tierId]);
		}
		let configJson = {
			abilities: skill1Abilities.concat(skill2Abilities),
			items,
			itemMods: simMods,
			simLength,
		};
		console.log('run sim', configJson);
		const fetchResponse = await fetch(`/api/v1/sim`, {
			method: 'POST',
			body: JSON.stringify(configJson),
			headers: {
				'Content-Type': 'application/json'
			},
		});
		report = await fetchResponse.text();
	}
</script>

<main>
	<h1>pgsim</h1>
	<div>
		<h3>Skill 1</h3>
		<select bind:value={skill1} on:blur={skillChanged}>
			{#each data.skills as skill}
				<option value={skill.name}>
					{skill.name}
				</option>
			{/each}
		</select>
		{#if skill1}
			{#each data.abilities as ability}
				{#if ability.skill === skill1}
					<label>
						<input type=checkbox bind:group={skill1Abilities} value={ability.internalName}>
						{ability.name}
					</label>
				{/if}
			{/each}
		{/if}
	</div>
	<div>
		<h3>Skill 2</h3>
		<select bind:value={skill2} on:blur={skillChanged}>
			{#each data.skills as skill}
				<option value={skill.name}>
					{skill.name}
				</option>
			{/each}
		</select>
		{#if skill2}
			{#each data.abilities as ability}
				{#if ability.skill === skill2}
					<label>
						<input type=checkbox bind:group={skill2Abilities} value={ability.internalName}>
						{ability.name}
					</label>
				{/if}
			{/each}
		{/if}
	</div>
	<div>
		{#each slots as slot, slotIndex}
			<div>
				<h3>{slot.name}</h3>
				<select bind:value={slot.item}>
					{#each data.items as item}
						{#if item.slot === slot.name}
							<option value={item.id}>
								{item.name}
							</option>
						{/if}
					{/each}
				</select>
				{#each data.itemMods as mod}
					{#if mod.skill === skill1 || mod.skill === skill2}
						{#if mod.slots.includes(slot.name)}
							<label>
								<!-- <input type=checkbox bind:group={slots[slotIndex].itemMods} value={mod.id}> -->
								<input type=checkbox on:change={e => itemModChange(e, mod)} value={mod.id}>
								{mod.effect}
							</label>
						{/if}
					{/if}
				{/each}
			</div>
		{/each}
	</div>
	<div>
		Sim length: <input bind:value={length}>
		<button on:click={run}>Run Simulation</button>
	</div>
	<textarea class="report" bind:value={report}></textarea>
</main>

<style>
	main {
		padding: 1em;
		max-width: 240px;
		margin: 0 auto;
	}

	.report {
		width: 100%;
		min-height: 400px;
	}

	@media (min-width: 640px) {
		main {
			max-width: none;
		}
	}
</style>