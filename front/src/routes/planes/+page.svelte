<script lang="ts">
    import * as Empty from "$lib/components/ui/empty";
    import { Badge } from "$lib/components/ui/badge";
    import { haceCuanto } from "$lib/fecha";
    import { HugeiconsIcon } from "@hugeicons/svelte";
    import { FileEmpty01Icon, SentIcon } from "@hugeicons/core-free-icons";
    import LoadingState from "$lib/components/loading-state.svelte";
    import { fade, fly } from "svelte/transition";
    import { cubicOut } from "svelte/easing";
    import { prefersReducedMotion } from "svelte/motion";
    import FondoGradiente from "$lib/components/fondo-gradiente.svelte";
    import { fondo } from "$lib/fondo.svelte";

    // Un solo text-shadow blurreado queda casi invisible sobre fondo claro; se
    // apilan varias copias para que el halo blanco tenga cuerpo.
    const sombra = $derived(
        fondo.titulo.sombra === 0
            ? "none"
            : Array(4).fill(`0 0 ${fondo.titulo.sombra}px #fff`).join(", "),
    );
    const fuente = $derived(
        { serif: "var(--font-serif)", sans: "var(--font-sans)", mono: "var(--font-mono)" }[
            fondo.titulo.fuente
        ],
    );

    let { data } = $props();

    // Misma máquina de estados que el pie del visor: enviado → refinando → reposo.
    function faseDe(plan: { estado: string; entregado: boolean }) {
        if (plan.estado !== "agent_turn") return "reposo";
        return plan.entregado ? "refinando" : "enviado";
    }

    const porProyecto = $derived(
        Map.groupBy(
            data.planes.toSorted((a, b) =>
                b.actualizadoEl.localeCompare(a.actualizadoEl),
            ),
            (plan) => plan.proyecto,
        ),
    );
</script>

<FondoGradiente />
<main class="mx-auto w-full max-w-3xl px-4 py-10">
    <!-- <h1 class="text-xl font-semibold tracking-tight">Planes</h1> -->

    {#if data.planes.length === 0}
        <Empty.Root class="mt-6 border border-dashed bg-card">
            <Empty.Header>
                <Empty.Media variant="icon">
                    <HugeiconsIcon icon={FileEmpty01Icon} />
                </Empty.Media>
                <Empty.Title>Todavía no hay planes</Empty.Title>
                <Empty.Description>
                    Cuando tu agente publique uno con tu <a
                        href="/token"
                        class="underline underline-offset-4">API key</a
                    >, aparece acá.
                </Empty.Description>
            </Empty.Header>
        </Empty.Root>
    {:else}
        <div class="mt-8 flex flex-col gap-8">
            {#each porProyecto as [proyecto, planes] (proyecto)}
                <section>
                    <h2
                        class="mb-2 font-medium"
                        style:font-family={fuente}
                        style:font-size="{fondo.titulo.tamano}px"
                        style:color={fondo.titulo.color}
                        style:text-shadow={sombra}
                    >
                        {proyecto}
                    </h2>
                    <ul class="divide-y rounded-lg border bg-card">
                        {#each planes as plan (plan.id)}
                            <li>
                                <a
                                    href="/planes/{plan.id}"
                                    class="flex items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                                >
                                    <span class="min-w-0 flex-1 truncate"
                                        >{plan.titulo}</span
                                    >
                                    <Badge variant="outline" class="shrink-0">v{plan.version}</Badge>
                                    <!-- Una sola celda trailing: la fecha en reposo, y en el turno del agente
                                         el estado (enviado → refinando) la reemplaza en el mismo lugar. Las
                                         fases se apilan en la grilla y cruzan en fundido. El ancho mínimo es
                                         el de la fecha, así el badge queda pegado a ella como siempre. -->
                                    <span
                                        class="grid min-w-24 shrink-0 justify-items-end text-xs text-muted-foreground"
                                    >
                                        {#key faseDe(plan)}
                                            <span
                                                class="col-start-1 row-start-1 flex items-center gap-1.5"
                                                in:fly={{
                                                    y: prefersReducedMotion.current ? 0 : 6,
                                                    duration: 200,
                                                    delay: 120,
                                                    easing: cubicOut,
                                                }}
                                                out:fade={{ duration: 120, easing: cubicOut }}
                                            >
                                                {#if faseDe(plan) === "refinando"}
                                                    <LoadingState label="Refinando" elapsed={false} />
                                                {:else if faseDe(plan) === "enviado"}
                                                    <HugeiconsIcon icon={SentIcon} class="size-3.5 shrink-0" />
                                                    Enviado
                                                {:else}
                                                    <time datetime={plan.actualizadoEl}>
                                                        {haceCuanto(plan.actualizadoEl)}
                                                    </time>
                                                {/if}
                                            </span>
                                        {/key}
                                    </span>
                                </a>
                            </li>
                        {/each}
                    </ul>
                </section>
            {/each}
        </div>
    {/if}
</main>
