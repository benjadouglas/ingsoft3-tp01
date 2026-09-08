<script lang="ts">
    import GoogleButton from "$lib/components/GoogleButton.svelte";
    import { signInWithGoogle } from "$lib/auth-client";
    import FondoGradiente from "$lib/components/fondo-gradiente.svelte";
    import { fondo } from "$lib/fondo.svelte";
    import logo from "$lib/assets/htmlplan-logo.png";

    const haloLogo = $derived(
        fondo.titulo.sombra === 0
            ? "none"
            : `drop-shadow(0 0 ${fondo.titulo.sombra}px #fff)`,
    );
</script>

<main
    class="flex min-h-dvh flex-col items-center justify-center gap-6 p-6"
>
    <FondoGradiente />
    <img
        src={logo}
        alt="htmlplan"
        class="h-24 w-auto"
        style:filter={haloLogo}
    />
    <div class="w-68 max-w-full">
        <GoogleButton
            onclick={() => signInWithGoogle()}
        />
    </div>
</main>
