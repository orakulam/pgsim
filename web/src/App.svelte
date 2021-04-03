<script lang="ts">
	import data from './data.json';

	let report;
	let processNextHashChange = true;
	let state = {
		skill1: '',
		skill1Abilities: [],
		skill2: '',
		skill2Abilities: [],
		slots: [],
		itemMods: {},
		simLength: 30,
	}

	const foundSlots = [];
	for (const item of data.items) {
		if (!foundSlots.includes(item.slot)) {
			foundSlots.push(item.slot);
			state.slots.push({
				name: item.slot,
			});
		}
	}

	// Check for hash on initial load
	if (window.location.hash !== '') {
		hashchange();
	}

	function hashchange() {
		if (processNextHashChange && window.location.hash !== '') {
			const hash = window.location.hash.substring(1);
			try {
				let stateFromHash = JSON.parse(atob(hash));
				state = stateFromHash;
			} catch (e) {
				console.log('Invalid state from hash', hash);
			}
		} else {
			processNextHashChange = true;
		}
	}

	function updateHash() {
		processNextHashChange = false;
		window.location.hash = btoa(JSON.stringify(state));
	}

	function skillChanged() {
		state.itemMods = {};
	}

	function itemModChange(e, mod) {
		const checked = e.target.checked;
		if (checked) {
			state.itemMods[mod.id] = mod.tierId;
		} else {
			delete state.itemMods[mod.id];
		}
	}

	async function run() {
		// Get simulation length
		let simLength = 30;
		if (!isNaN(Number(state.simLength))) {
			simLength = Number(state.simLength);
		}
		// Get equipped items
		let items = [];
		for (const slot of state.slots) {
			if (slot.item) {
				items.push(slot.item);
			}
		}
		// Get equipped item mods
		let itemMods = [];
		for (const [modId, tierId] of Object.entries(state.itemMods)) {
			itemMods.push([modId, tierId]);
		}
		let configJson = {
			abilities: state.skill1Abilities.concat(state.skill2Abilities),
			items,
			itemMods,
			simLength,
		};
		console.log('Run sim', configJson);
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

<svelte:window on:hashchange={hashchange}/>

<main>
	<h1>pgsim</h1>
	<div>
		<h3>Skill 1</h3>
		<select bind:value={state.skill1} on:change={() =>{ skillChanged(); updateHash() }}>
			<option>None</option>
			{#each data.skills as skill}
				<option value={skill.name}>
					{skill.name}
				</option>
			{/each}
		</select>
		{#if state.skill1}
			{#each data.abilities as ability}
				{#if ability.skill === state.skill1}
					<label>
						<input type=checkbox bind:group={state.skill1Abilities} value={ability.internalName} on:change={updateHash}>
						{ability.name}
					</label>
				{/if}
			{/each}
		{/if}
	</div>
	<div>
		<h3>Skill 2</h3>
		<select bind:value={state.skill2} on:change={() =>{ skillChanged(); updateHash() }}>
			<option>None</option>
			{#each data.skills as skill}
				<option value={skill.name}>
					{skill.name}
				</option>
			{/each}
		</select>
		{#if state.skill2}
			{#each data.abilities as ability}
				{#if ability.skill === state.skill2}
					<label>
						<input type=checkbox bind:group={state.skill2Abilities} value={ability.internalName} on:change={updateHash}>
						{ability.name}
					</label>
				{/if}
			{/each}
		{/if}
	</div>
	<div>
		{#each state.slots as slot, slotIndex}
			<div>
				<h3>{slot.name}</h3>
				<select bind:value={slot.item} on:change={updateHash}>
					{#each data.items as item}
						{#if item.slot === slot.name}
							<option value={item.id}>
								{item.name}
							</option>
						{/if}
					{/each}
				</select>
				{#each data.itemMods as mod}
					{#if mod.skill === state.skill1 || mod.skill === state.skill2}
						{#if mod.slots.includes(slot.name)}
							<label>
								<input type=checkbox on:change={e => { itemModChange(e, mod); updateHash() }} value={mod.id}>
								{mod.effect}
							</label>
						{/if}
					{/if}
				{/each}
			</div>
		{/each}
	</div>
	<div>
		Sim length: <input bind:value={state.simLength} on:change={updateHash}>
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