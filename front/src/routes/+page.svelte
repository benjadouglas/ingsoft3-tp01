<script lang="ts">
	import { goto } from '$app/navigation';
	import { signOut } from '$lib/auth-client';

	let { data } = $props();

	async function cerrarSesion() {
		await signOut();
		await goto('/login');
	}
</script>

<main class="mx-auto max-w-2xl p-6">
	<h1 class="mb-4 text-2xl font-semibold">Borrador</h1>
	<p>Hola, {data.usuario?.name}.</p>
	<a href="/planes" class="underline">Ver planes</a>
	<button class="ml-4 underline" onclick={cerrarSesion}>Cerrar sesión</button>
</main>
