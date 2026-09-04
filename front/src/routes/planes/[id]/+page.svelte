<script lang="ts">
    import { Badge } from "$lib/components/ui/badge";
    import { Button } from "$lib/components/ui/button";
    import * as Drawer from "$lib/components/ui/drawer";
    import { Textarea } from "$lib/components/ui/textarea";
    import { fragmentoDe } from "$lib/plan-html";
    import { HugeiconsIcon } from "@hugeicons/svelte";
    import {
        ArrowLeft01Icon,
        Comment01Icon,
        RefreshIcon,
        Tick02Icon,
    } from "@hugeicons/core-free-icons";
    import type { Comentario, Estado } from "./+page";

    let { data } = $props();

    // Derivados escribibles: arrancan del load y se pisan localmente al comentar o cerrar el turno.
    let estado = $derived(data.estado);
    let comentarios = $derived(data.comentarios);
    let seleccionado = $state.raw<HTMLElement | null>(null);
    let abierto = $state(false);
    let texto = $state("");
    let enviando = $state(false);
    let error = $state<string | null>(null);

    const esMiTurno = $derived(estado === "user_turn");
    const etiquetaEstado: Record<Estado, string> = {
        user_turn: "Tu turno",
        agent_turn: "Turno del agente",
        approved: "Aprobado",
    };

    // Solo los de la versión actual: los anteriores ya fueron atendidos.
    const actuales = $derived(
        comentarios.filter((c) => c.versionNumero === data.version),
    );
    const porBloque = $derived(Map.groupBy(actuales, (c) => c.bloqueId));
    const delSeleccionado = $derived(
        porBloque.get(seleccionado?.id ?? null) ?? [],
    );

    // Tap sobre cualquier elemento con id dentro del plan lo selecciona.
    function tocar(e: MouseEvent) {
        if (!esMiTurno) return;
        const bloque = (e.target as Element).closest<HTMLElement>(".plan [id]");
        if (!bloque) return;
        abrir(bloque);
    }

    function abrir(bloque: HTMLElement | null) {
        seleccionado?.removeAttribute("data-seleccionado");
        bloque?.setAttribute("data-seleccionado", "");
        seleccionado = bloque;
        texto = "";
        error = null;
        abierto = true;
        // El drawer tapa la mitad de abajo: dejamos el bloque arriba, visible.
        bloque?.scrollIntoView({ block: "start", behavior: "smooth" });
    }

    function cerrar() {
        abierto = false;
        seleccionado?.removeAttribute("data-seleccionado");
        seleccionado = null;
    }

    // Marca cuántos comentarios tiene cada bloque, para el chip de la esquina.
    function marcar(plan: HTMLDivElement) {
        const marcados: Element[] = [];
        for (const [bloqueId, lista] of porBloque) {
            if (!bloqueId) continue;
            const el = plan.querySelector(`#${CSS.escape(bloqueId)}`);
            if (!el) continue;
            el.setAttribute("data-comentarios", String(lista.length));
            marcados.push(el);
        }
        return () => {
            for (const el of marcados) el.removeAttribute("data-comentarios");
        };
    }

    async function comentar() {
        if (!texto.trim()) return;
        enviando = true;
        error = null;
        try {
            const body = seleccionado
                ? {
                      bloqueId: seleccionado.id,
                      fragmento: fragmentoDe(seleccionado),
                      texto,
                  }
                : { texto };
            const res = await fetch(`/api/planes/${data.id}/comentarios`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                error =
                    res.status === 409
                        ? "El plan ya no está en tu turno."
                        : "No se pudo guardar el comentario.";
                return;
            }
            const lista = await fetch(`/api/planes/${data.id}/comentarios`);
            comentarios = (await lista.json()) as Comentario[];
            cerrar();
        } finally {
            enviando = false;
        }
    }

    async function accion(tipo: "refine" | "implement") {
        enviando = true;
        error = null;
        try {
            const res = await fetch(`/api/planes/${data.id}/acciones`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ tipo }),
            });
            if (!res.ok) {
                error = "No se pudo cerrar el turno.";
                return;
            }
            estado = tipo === "refine" ? "agent_turn" : "approved";
        } finally {
            enviando = false;
        }
    }
</script>

<svelte:head>
    <title>{data.titulo}</title>
    {@html `<style>${data.plan.estilos}</style>`}
</svelte:head>

<div class="flex h-dvh flex-col">
    <header class="flex items-center gap-2 border-b bg-muted/40 px-2 py-1.5">
        <Button variant="ghost" size="sm" href="/planes">
            <HugeiconsIcon icon={ArrowLeft01Icon} data-icon="inline-start" />
            Planes
        </Button>
        <span class="min-w-0 flex-1 truncate text-sm">{data.titulo}</span>
        <Badge variant="outline">v{data.version}</Badge>
        <Badge variant={esMiTurno ? "default" : "secondary"}>
            {etiquetaEstado[estado]}
        </Badge>
    </header>

    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="flex-1 overflow-auto" onclick={tocar}>
        <div class={["plan", esMiTurno && "plan-editable"]} {@attach marcar}>
            {@html data.plan.cuerpo}
        </div>
    </div>

    <footer
        class="flex items-center gap-2 border-t bg-background px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
        {#if esMiTurno}
            <Button variant="outline" size="sm" onclick={() => abrir(null)}>
                <HugeiconsIcon icon={Comment01Icon} data-icon="inline-start" />
                Comentar
            </Button>
            <span class="flex-1 truncate text-xs text-muted-foreground">
                {#if actuales.length === 0}
                    Tocá un bloque para comentarlo
                {:else}
                    {actuales.length}
                    {actuales.length === 1 ? "comentario" : "comentarios"}
                {/if}
            </span>
            <Button
                variant="outline"
                size="sm"
                disabled={enviando}
                onclick={() => accion("refine")}
            >
                <HugeiconsIcon icon={RefreshIcon} data-icon="inline-start" />
                Refinar
            </Button>
            <Button
                size="sm"
                disabled={enviando}
                onclick={() => accion("implement")}
            >
                <HugeiconsIcon icon={Tick02Icon} data-icon="inline-start" />
                Implementar
            </Button>
        {:else if estado === "agent_turn"}
            <span class="text-xs text-muted-foreground">
                El agente está trabajando en la próxima versión.
            </span>
        {:else}
            <span class="text-xs text-muted-foreground">
                Plan aprobado. El agente lo está implementando.
            </span>
        {/if}
        {#if error && !abierto}
            <span class="text-xs text-destructive">{error}</span>
        {/if}
    </footer>
</div>

<Drawer.Root
    bind:open={abierto}
    onOpenChange={(o) => {
        if (!o) cerrar();
    }}
>
    <Drawer.Content>
        <div class="mx-auto w-full max-w-lg px-4 pb-4">
            <Drawer.Header class="px-0">
                <Drawer.Title>
                    {#if seleccionado}
                        <span class="font-mono text-xs font-normal text-muted-foreground">
                            #{seleccionado.id}
                        </span>
                    {:else}
                        Comentario general
                    {/if}
                </Drawer.Title>
                <Drawer.Description class="line-clamp-2">
                    {seleccionado
                        ? fragmentoDe(seleccionado)
                        : "Sobre el plan entero."}
                </Drawer.Description>
            </Drawer.Header>

            {#if delSeleccionado.length > 0}
                <ul class="mb-3 flex flex-col gap-1.5">
                    {#each delSeleccionado as c (c.id)}
                        <li
                            class="rounded-md border-l-2 border-primary bg-muted/40 px-2 py-1.5 text-sm"
                        >
                            {c.texto}
                        </li>
                    {/each}
                </ul>
            {/if}

            <Textarea
                bind:value={texto}
                placeholder="Qué cambiarías?"
                class="min-h-24 text-base"
                autofocus
            />
            {#if error}
                <p class="mt-2 text-xs text-destructive">{error}</p>
            {/if}
            <Drawer.Footer class="flex-row justify-end px-0 pb-0">
                <Button variant="ghost" onclick={cerrar}>Cancelar</Button>
                <Button
                    disabled={enviando || !texto.trim()}
                    onclick={comentar}
                >
                    Enviar
                </Button>
            </Drawer.Footer>
        </div>
    </Drawer.Content>
</Drawer.Root>

<style>
    /* Sobre el HTML del plan, que llega vía {@html}: de ahí el :global. */
    .plan :global([id]) {
        position: relative;
        border-radius: 10px;
        scroll-margin-top: 1rem;
        transition:
            outline-color 150ms,
            background-color 150ms;
        outline: 2px solid transparent;
        outline-offset: 6px;
    }
    .plan-editable :global([id]) {
        cursor: pointer;
    }
    /* Hover solo en el bloque más interno: el padre no se prende junto con el hijo. */
    @media (hover: hover) {
        .plan-editable :global([id]:hover:not(:has([id]:hover))) {
            outline-color: color-mix(in oklch, var(--primary) 35%, transparent);
            background-color: color-mix(in oklch, var(--primary) 4%, transparent);
        }
    }
    .plan :global([data-seleccionado]),
    .plan-editable :global([data-seleccionado]:hover) {
        outline-color: var(--primary);
        background-color: color-mix(in oklch, var(--primary) 4%, transparent);
    }
    .plan :global([data-comentarios]::after) {
        content: attr(data-comentarios);
        position: absolute;
        top: -0.9rem;
        right: -0.9rem;
        min-width: 1.25rem;
        height: 1.25rem;
        padding: 0 0.35rem;
        border-radius: 9999px;
        background: var(--primary);
        color: var(--primary-foreground);
        font: 600 0.7rem/1.25rem ui-sans-serif, system-ui, sans-serif;
        text-align: center;
        pointer-events: none;
    }
    /* El drawer es un panel de comentario, no un modal: el plan y el bloque marcado siguen viéndose. */
    :global([data-slot="drawer-overlay"]) {
        background: color-mix(in oklch, var(--foreground) 15%, transparent);
        backdrop-filter: none;
    }
</style>
