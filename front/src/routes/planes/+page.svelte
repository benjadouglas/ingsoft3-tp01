<script lang="ts">
	import * as Empty from '$lib/components/ui/empty';
	import { Badge } from '$lib/components/ui/badge';
	import { haceCuanto } from '$lib/fecha';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { FileEmpty01Icon } from '@hugeicons/core-free-icons';

	let { data } = $props();

	const porProyecto = $derived(
		Map.groupBy(
			data.planes.toSorted((a, b) => b.actualizadoEl.localeCompare(a.actualizadoEl)),
			(plan) => plan.proyecto
		)
	);
</script>

<main class="mx-auto w-full max-w-3xl px-4 py-10">
	<h1 class="text-xl font-semibold tracking-tight">Planes</h1>

	{#if data.planes.length === 0}
		<Empty.Root class="mt-6 border border-dashed">
			<Empty.Header>
				<Empty.Media variant="icon">
					<HugeiconsIcon icon={FileEmpty01Icon} />
				</Empty.Media>
				<Empty.Title>Todavía no hay planes</Empty.Title>
				<Empty.Description>
					Cuando tu agente publique uno con tu <a href="/token" class="underline underline-offset-4">API key</a>, aparece acá.
				</Empty.Description>
			</Empty.Header>
		</Empty.Root>
	{:else}
		<div class="mt-8 flex flex-col gap-8">
			{#each porProyecto as [proyecto, planes] (proyecto)}
				<section>
					<h2 class="mb-2 font-mono text-xs text-muted-foreground">{proyecto}</h2>
					<ul class="divide-y rounded-lg border">
						{#each planes as plan (plan.id)}
							<li>
								<a
									href="/planes/{plan.id}"
									class="flex items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
								>
									<span class="min-w-0 flex-1 truncate">{plan.titulo}</span>
									<Badge variant="outline">v{plan.version}</Badge>
									<time datetime={plan.actualizadoEl} class="w-24 shrink-0 text-right text-xs text-muted-foreground">
										{haceCuanto(plan.actualizadoEl)}
									</time>
								</a>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		</div>
	{/if}
</main>
