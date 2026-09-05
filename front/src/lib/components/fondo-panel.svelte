<script lang="ts">
    import { fondo } from "$lib/fondo.svelte";

    // Panel de ajuste (solo dev). "Copiar" deja en el portapapeles el JSON para
    // pegarlo como defaults en $lib/fondo.svelte.ts.
    let abierto = $state(false);

    const fuentes = ["serif", "sans", "mono"] as const;

    function copiar() {
        navigator.clipboard.writeText(JSON.stringify($state.snapshot(fondo), null, 4));
    }
</script>

<button
    type="button"
    class="fixed right-3 bottom-3 z-50 rounded-full border bg-card px-3 py-1 font-mono text-xs shadow"
    onclick={() => (abierto = !abierto)}
>
    fondo
</button>

{#if abierto}
    <aside
        class="fixed right-3 bottom-12 z-50 w-72 rounded-lg border bg-card p-3 font-mono text-xs shadow-lg"
    >
        <div class="mb-2 flex items-center justify-between">
            <span class="font-semibold">título</span>
            <button type="button" class="underline" onclick={copiar}>copiar</button>
        </div>
        <label class="grid grid-cols-[6rem_1fr_3rem] items-center gap-2">
            fuente
            <select bind:value={fondo.titulo.fuente} class="col-span-2 border">
                {#each fuentes as f (f)}
                    <option value={f}>{f}</option>
                {/each}
            </select>
        </label>
        <label class="grid grid-cols-[6rem_1fr_3rem] items-center gap-2">
            tamaño
            <input type="range" min="10" max="32" step="1" bind:value={fondo.titulo.tamano} />
            <span class="text-right">{fondo.titulo.tamano}px</span>
        </label>
        <label class="grid grid-cols-[6rem_1fr_3rem] items-center gap-2">
            color
            <input type="color" bind:value={fondo.titulo.color} />
            <span class="truncate text-right">{fondo.titulo.color}</span>
        </label>
        <label class="grid grid-cols-[6rem_1fr_3rem] items-center gap-2">
            sombra
            <input type="range" min="0" max="20" step="0.5" bind:value={fondo.titulo.sombra} />
            <span class="text-right">{fondo.titulo.sombra}px</span>
        </label>
    </aside>
{/if}
