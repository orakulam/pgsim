<script lang="ts">
	import { JSONEditor } from 'svelte-jsoneditor';

	export let report;

	let configJson = {
		abilities: [
			"SwordSlash7",
			"Decapitate6",
			"FlashingStrike7",
			"HackingBlade5",
			"FinishingBlow5",
			"ThrustingBlade5",
			"FastTalk4",
			"Soothe6",
			"StrikeANerve6",
			"Psychoanalyze6",
			"YouWereAdopted6",
			"ButILoveYou3"
		],
		items: [
			"item_44207"
		],
		itemMods: [
			["power_1203", "id_16"]
		],
		simLength: 30,
	};

	async function run() {
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
	<JSONEditor bind:json={configJson} />
	<button on:click={run}>Run Simulation</button>
	<textarea class="report" bind:value={report}></textarea>
</main>

<style>
	main {
		text-align: center;
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