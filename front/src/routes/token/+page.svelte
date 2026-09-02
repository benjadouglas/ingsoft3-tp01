<script lang="ts">
	import * as Card from '$lib/components/ui/card';

	let token = $state<string | null>(null);
	let error = $state<string | null>(null);

	async function generar() {
		error = null;
		const res = await fetch('/api/token', { method: 'POST' });
		if (!res.ok) {
			error = 'No se pudo generar la API key.';
			return;
		}
		token = ((await res.json()) as { token: string }).token;
	}
</script>

<main class="mx-auto max-w-2xl p-6">
	<Card.Root>
		<Card.Header>
			<Card.Title>API key</Card.Title>
			<Card.Description>
				Dásela a tu agente. Se muestra una sola vez; generar otra invalida la anterior.
			</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			{#if token}
				<pre class="overflow-x-auto rounded-md bg-muted p-3 text-sm select-all">{token}</pre>
			{/if}
			{#if error}
				<p class="text-sm text-destructive">{error}</p>
			{/if}
			<button class="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" onclick={generar}>
				{token ? 'Regenerar' : 'Generar API key'}
			</button>
		</Card.Content>
	</Card.Root>
</main>
