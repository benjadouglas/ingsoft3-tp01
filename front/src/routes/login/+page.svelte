<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import GoogleButton from '$lib/components/GoogleButton.svelte';
	import { signInWithGoogle } from '$lib/auth-client';
</script>

<main class="flex min-h-dvh flex-col items-center justify-center gap-6 bg-muted/40 p-6">
	<span class="font-mono text-sm font-semibold tracking-tight">htmlplan</span>
	<Card.Root class="w-full max-w-sm">
		<Card.Header class="text-center">
			<Card.Title class="text-lg">Iniciar sesión</Card.Title>
			<Card.Description>Elegí tu cuenta de Google para continuar.</Card.Description>
		</Card.Header>
		<Card.Content>
			<GoogleButton onclick={() => signInWithGoogle()} />
		</Card.Content>
	</Card.Root>
</main>
