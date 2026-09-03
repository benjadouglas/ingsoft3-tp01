<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { Copy01Icon, Tick02Icon } from '@hugeicons/core-free-icons';

	let token = $state<string | null>(null);
	let error = $state<string | null>(null);
	let generando = $state(false);
	let copiado = $state(false);

	async function generar() {
		error = null;
		generando = true;
		try {
			const res = await fetch('/api/token', { method: 'POST' });
			if (!res.ok) {
				error = 'No se pudo generar la API key. Probá de nuevo.';
				return;
			}
			token = ((await res.json()) as { token: string }).token;
			copiado = false;
		} finally {
			generando = false;
		}
	}

	async function copiar() {
		if (!token) return;
		await navigator.clipboard.writeText(token);
		copiado = true;
		setTimeout(() => (copiado = false), 2000);
	}
</script>

<main class="mx-auto w-full max-w-3xl px-4 py-10">
	<Card.Root class="max-w-xl">
		<Card.Header>
			<Card.Title>API key</Card.Title>
			<Card.Description>
				Es lo único que identifica a tu agente como vos. Se muestra una sola vez y generar otra
				invalida la anterior.
			</Card.Description>
		</Card.Header>
		<Card.Content class="flex flex-col gap-4">
			{#if token}
				<div class="flex items-center gap-2 rounded-md border bg-muted/40 py-2 pr-2 pl-3">
					<code class="min-w-0 flex-1 truncate font-mono text-xs select-all">{token}</code>
					<Button variant="outline" size="sm" onclick={copiar}>
						<HugeiconsIcon icon={copiado ? Tick02Icon : Copy01Icon} data-icon="inline-start" />
						{copiado ? 'Copiada' : 'Copiar'}
					</Button>
				</div>
				<p class="text-xs text-muted-foreground">Guardala ahora. Al salir de esta página no la vas a volver a ver.</p>
			{/if}
			{#if error}
				<Alert.Root variant="destructive">
					<Alert.Title>{error}</Alert.Title>
				</Alert.Root>
			{/if}
		</Card.Content>
		<Card.Footer>
			<Button variant={token ? 'outline' : 'default'} onclick={generar} disabled={generando}>
				{token ? 'Generar otra' : 'Generar API key'}
			</Button>
		</Card.Footer>
	</Card.Root>
</main>
