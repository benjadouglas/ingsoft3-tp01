<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import GoogleButton from '$lib/components/GoogleButton.svelte';
	import { signInWithGoogle } from '$lib/auth-client';
</script>

<main class="flex min-h-dvh items-center justify-center bg-muted/40 p-6">
	<Card.Root class="w-full max-w-sm">
		<Card.Header class="text-center">
			<Card.Title class="text-xl">Iniciar sesión en Borrador</Card.Title>
			<Card.Description>Bienvenido. Elegí tu cuenta de Google para continuar.</Card.Description>
		</Card.Header>
		<Card.Content>
			<GoogleButton onclick={() => signInWithGoogle()} />
		</Card.Content>
	</Card.Root>
</main>
