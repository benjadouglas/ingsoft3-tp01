<script lang="ts">
	let { data } = $props();
</script>

<main class="mx-auto max-w-2xl p-6">
	<h1 class="mb-4 text-2xl font-semibold">Planes</h1>
	{#if data.planes.length === 0}
		<p class="text-gray-500">Todavía no hay planes.</p>
	{:else}
		<ul class="divide-y">
			{#each data.planes as plan (plan.id)}
				<li>
					<a href="/planes/{plan.id}" class="block py-3 hover:underline">
						<span class="font-mono text-sm">{plan.proyecto}</span>
						<span class="ml-2 text-sm text-gray-500">{new Date(plan.creadoEl).toLocaleString()}</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</main>
