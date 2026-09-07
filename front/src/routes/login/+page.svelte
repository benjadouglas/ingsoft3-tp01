<script lang="ts">
    import GoogleButton from "$lib/components/GoogleButton.svelte";
    import { signInWithGoogle } from "$lib/auth-client";
    import FondoGradiente from "$lib/components/fondo-gradiente.svelte";
    import { fondo } from "$lib/fondo.svelte";

    // Mismo halo blanco apilado que usan los títulos de proyecto en /planes.
    const sombra = $derived(
        fondo.titulo.sombra === 0
            ? "none"
            : Array(4).fill(`0 0 ${fondo.titulo.sombra}px #fff`).join(", "),
    );
</script>

<main
    class="flex min-h-dvh flex-col items-center justify-center gap-6 p-6"
>
    <FondoGradiente />
    <span
        class="font-mono text-3xl font-semibold tracking-tight"
        style:text-shadow={sombra}>htmlplan</span
    >
    <div class="w-68 max-w-full">
        <GoogleButton
            onclick={() => signInWithGoogle()}
        />
    </div>
</main>
