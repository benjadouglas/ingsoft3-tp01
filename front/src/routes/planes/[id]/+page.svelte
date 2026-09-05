<script lang="ts">
    import { Badge } from "$lib/components/ui/badge";
    import { Button } from "$lib/components/ui/button";
    import * as InputGroup from "$lib/components/ui/input-group";
    import * as Popover from "$lib/components/ui/popover";
    import { Toaster } from "$lib/components/ui/sonner";
    import { toast } from "svelte-sonner";
    import { fragmentoDe } from "$lib/plan-html";
    import ComentarioToast from "./comentario-toast.svelte";
    import ReanudarSesion from "./reanudar-sesion.svelte";
    import LoadingState from "$lib/components/loading-state.svelte";
    import FondoGradiente from "$lib/components/fondo-gradiente.svelte";
    import { fondo } from "$lib/fondo.svelte";
    import { HugeiconsIcon } from "@hugeicons/svelte";
    import {
        ArrowLeft01Icon,
        ArrowRight02Icon,
        Comment01Icon,
        ComputerTerminal01Icon,
        RefreshIcon,
        SentIcon,
        Tick02Icon,
    } from "@hugeicons/core-free-icons";
    import { fade, fly } from "svelte/transition";
    // Comentario local. No viaja al servidor hasta Refinar/Implementar.
    type Pendiente = {
        id: string;
        bloqueId: string | null;
        fragmento: string | null;
        texto: string;
    };

    let { data } = $props();

    // Derivado escribible: arranca del load y se pisa localmente al cerrar el turno.
    let estado = $derived(data.estado);
    // Si el agente ya recibió la acción pendiente. Se resetea al cerrar el turno.
    let entregado = $derived(data.entregado);
    let pendientes = $state<Pendiente[]>([]);
    let seleccionado = $state.raw<HTMLElement | null>(null);
    let scroller = $state.raw<HTMLDivElement | null>(null);
    let anclaGeneral = $state.raw<HTMLElement | null>(null);
    let abierto = $state(false);
    let texto = $state("");
    let enviando = $state(false);
    let error = $state<string | null>(null);
    let inputEl = $state.raw<HTMLTextAreaElement | null>(null);
    // Comentario que se está editando en el popover; null cuando es uno nuevo.
    let editando = $state<Pendiente | null>(null);

    // Pill mientras es una sola línea; radio fijo chico cuando crece en altura.
    let multilinea = $state(false);
    $effect(() => {
        texto;
        multilinea = (inputEl?.offsetHeight ?? 0) > 44;
    });

    const esMiTurno = $derived(estado === "user_turn");
    // Fase del turno del agente, para el pie: enviado → recibido → (versión nueva) mi turno,
    // o aprobado si se cerró con Implementar.
    const fase = $derived(
        estado === "approved"
            ? "aprobado"
            : estado === "agent_turn"
              ? entregado
                  ? "recibido"
                  : "enviado"
              : "mi_turno",
    );

    // Cada pendiente es un toast fijo (duration infinita) con el mismo id:
    // volver a llamar a toast.custom con ese id lo actualiza en lugar de duplicarlo.
    $effect(() => {
        if (!esMiTurno) {
            toast.dismiss();
            return;
        }
        for (const c of pendientes) {
            toast.custom(ComentarioToast, {
                id: c.id,
                duration: Number.POSITIVE_INFINITY,
                dismissible: false,
                componentProps: {
                    texto: c.texto,
                    onEditar: () => editar(c.id),
                    onBorrar: () => borrar(c.id),
                },
            });
        }
    });

    function bloqueDe(id: string | null) {
        return id
            ? scroller?.querySelector<HTMLElement>(`.plan #${CSS.escape(id)}`) ??
                  null
            : null;
    }

    function editar(id: string) {
        const c = pendientes.find((p) => p.id === id);
        if (!c) return;
        abrir(bloqueDe(c.bloqueId), c);
    }

    function borrar(id: string) {
        pendientes = pendientes.filter((p) => p.id !== id);
        toast.dismiss(id);
        if (editando?.id === id) cerrar();
    }

    // Tap sobre cualquier elemento con id dentro del plan lo selecciona.
    function tocar(e: MouseEvent) {
        if (!esMiTurno) return;
        const bloque = (e.target as Element).closest<HTMLElement>(".plan [id]");
        if (!bloque) return;
        abrir(bloque);
    }

    function abrir(bloque: HTMLElement | null, existente: Pendiente | null = null) {
        seleccionado?.removeAttribute("data-seleccionado");
        bloque?.setAttribute("data-seleccionado", "");
        seleccionado = bloque;
        editando = existente;
        texto = existente?.texto ?? "";
        error = null;
        abierto = true;
        // Deja el top del bloque un poco por encima del centro del visor,
        // así queda lugar para el input arriba.
        if (bloque && scroller) {
            const delta =
                bloque.getBoundingClientRect().top -
                scroller.getBoundingClientRect().top;
            scroller.scrollTo({
                top: scroller.scrollTop + delta - scroller.clientHeight * 0.4,
                behavior: "smooth",
            });
        }
    }

    // Clic en otro bloque no debe cerrar el popover: lo reanclamos.
    function fuera(e: PointerEvent) {
        const t = e.target as Element;
        if (t.closest(".plan [id]") || t.closest("[data-comentar-general]")) {
            e.preventDefault();
        }
    }

    function cerrar() {
        abierto = false;
        editando = null;
        seleccionado?.removeAttribute("data-seleccionado");
        seleccionado = null;
    }

    // Alta o edición, siempre local.
    function comentar() {
        const t = texto.trim();
        if (!t) return;
        if (editando) {
            const id = editando.id;
            pendientes = pendientes.map((p) =>
                p.id === id ? { ...p, texto: t } : p,
            );
        } else {
            pendientes.push({
                id: crypto.randomUUID(),
                bloqueId: seleccionado?.id ?? null,
                fragmento: seleccionado ? fragmentoDe(seleccionado) : null,
                texto: t,
            });
        }
        cerrar();
    }

    async function post(ruta: string, body: unknown) {
        return fetch(`/api/planes/${data.id}/${ruta}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
        });
    }

    // Recién acá viajan los comentarios: primero todos, después la acción.
    async function accion(tipo: "refine" | "implement") {
        enviando = true;
        error = null;
        try {
            for (const c of pendientes) {
                const body =
                    c.bloqueId !== null
                        ? {
                              bloqueId: c.bloqueId,
                              fragmento: c.fragmento ?? "",
                              texto: c.texto,
                          }
                        : { texto: c.texto };
                const res = await post("comentarios", body);
                if (!res.ok) {
                    error =
                        res.status === 409
                            ? "El plan ya no está en tu turno."
                            : "No se pudo guardar un comentario.";
                    return;
                }
                // Ya está en el servidor: si el próximo falla, no se reenvía al reintentar.
                pendientes = pendientes.filter((p) => p.id !== c.id);
                toast.dismiss(c.id);
            }
            const res = await post("acciones", { tipo });
            if (!res.ok) {
                error = "No se pudo cerrar el turno.";
                return;
            }
            estado = tipo === "refine" ? "agent_turn" : "approved";
            entregado = false;
        } finally {
            enviando = false;
        }
    }

    // Cmd+Enter refina, Shift+Cmd+Enter implementa
    function atajo(e: KeyboardEvent) {
        if (e.key !== "Enter" || !(e.metaKey || e.ctrlKey)) return;
        if (!esMiTurno || enviando) return;
        e.preventDefault();
        if (abierto && texto.trim()) comentar();
        accion(e.shiftKey ? "implement" : "refine");
    }
</script>

<svelte:window onkeydown={atajo} />

<svelte:head>
    <title>{data.titulo}</title>
    {@html `<style>${data.plan.estilos}</style>`}
</svelte:head>

<FondoGradiente />

<div class="flex h-dvh flex-col">
    <header class="flex items-center gap-2 border-b bg-background/70 px-2 py-1.5 backdrop-blur">
        <Button variant="ghost" size="sm" href="/planes">
            <HugeiconsIcon icon={ArrowLeft01Icon} data-icon="inline-start" />
            Planes
        </Button>
        <span class="min-w-0 flex-1 truncate text-sm">{data.titulo}</span>
        <Badge variant="outline">v{data.version}</Badge>
    </header>

    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="flex-1 overflow-auto px-3" bind:this={scroller} onclick={tocar}>
        <div class={["plan", esMiTurno && "plan-editable"]} style:--ancho-plan="{fondo.anchoPlan}rem">
            {@html data.plan.cuerpo}
        </div>
    </div>

    <footer
        class="flex flex-wrap items-center gap-x-3 gap-y-2 border-t bg-background px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
        {#if esMiTurno}
            <!-- Estado primero en el DOM y a ancho completo si los botones no entran en una fila. -->
            <span
                class="order-first basis-full text-xs text-muted-foreground sm:order-none sm:basis-auto sm:min-w-0 sm:flex-1 sm:truncate"
            >
                {#if pendientes.length === 0}
                    Tocá un bloque para comentarlo
                {:else}
                    {pendientes.length}
                    {pendientes.length === 1 ? "comentario" : "comentarios"}
                {/if}
            </span>
            <Button
                variant="outline"
                size="sm"
                data-comentar-general
                bind:ref={anclaGeneral}
                onclick={() => abrir(null)}
            >
                <HugeiconsIcon icon={Comment01Icon} data-icon="inline-start" />
                Comentar
            </Button>
            <span class="flex-1 sm:hidden"></span>
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
        {:else}
            <!-- Cada fase se apila en el mismo lugar y cruza en fundido con la siguiente. -->
            <div class="relative min-h-6 flex-1">
                {#key fase}
                    <div
                        class="absolute inset-0 flex items-center gap-1.5 text-xs text-muted-foreground"
                        in:fly={{ y: 6, duration: 200, delay: 120 }}
                        out:fade={{ duration: 120 }}
                    >
                        {#if fase === "enviado"}
                            <HugeiconsIcon icon={SentIcon} class="size-3.5 shrink-0" />
                            Enviado. Esperando que el agente lo reciba.
                        {:else if fase === "recibido"}
                            <LoadingState label="Refinando el plan" />
                        {:else}
                            Plan aprobado. El agente lo está implementando.
                        {/if}
                    </div>
                {/key}
            </div>
            {#if data.sesion}
                <!-- Si el agente no responde, desde acá se reabre su conversación. -->
                <Popover.Root>
                    <Popover.Trigger>
                        {#snippet child({ props }: { props: Record<string, unknown> })}
                            <Button variant="outline" size="sm" {...props}>
                                <HugeiconsIcon
                                    icon={ComputerTerminal01Icon}
                                    data-icon="inline-start"
                                />
                                Reanudar
                            </Button>
                        {/snippet}
                    </Popover.Trigger>
                    <Popover.Content
                        class="w-[calc(100vw-1.5rem)] max-w-md"
                        side="top"
                        align="end"
                        collisionPadding={12}
                    >
                        <p class="mb-2 text-xs text-muted-foreground">
                            Si el agente se cerró o dejó de esperar, reabrí su
                            conversación y decile que ya comentaste.
                        </p>
                        <ReanudarSesion {...data.sesion} planTitulo={data.titulo} />
                    </Popover.Content>
                </Popover.Root>
            {/if}
        {/if}
        {#if error && !abierto}
            <span class="basis-full text-xs text-destructive">{error}</span>
        {/if}
    </footer>
</div>

<!-- Los comentarios pendientes viven acá, apilados, sin vencimiento.
     Sin tope al expandir; colapsados se ven tres (ver el :global de abajo). -->
<Toaster
    position="bottom-right"
    duration={Number.POSITIVE_INFINITY}
    visibleToasts={Math.max(3, pendientes.length)}
    offset={{ bottom: "calc(3rem + env(safe-area-inset-bottom))", right: 16 }}
    mobileOffset={{ bottom: "calc(3rem + env(safe-area-inset-bottom))", right: 12 }}
/>

<Popover.Root
    bind:open={abierto}
    onOpenChange={(o) => {
        if (!o) cerrar();
    }}
>
    <Popover.Trigger class="sr-only" tabindex={-1}></Popover.Trigger>
    <Popover.Content
        class="w-[min(20rem,calc(100vw-1.5rem))] gap-0 border-0 bg-transparent p-0 shadow-none ring-0"
        side="top"
        align="start"
        sideOffset={16}
        collisionPadding={12}
        customAnchor={seleccionado ?? anclaGeneral}
        onInteractOutside={fuera}
    >
        <Popover.Title class="sr-only">
            {editando ? "Editar comentario" : "Comentario"}
        </Popover.Title>
        <InputGroup.Root
            class={[
                "border-[#EAEAEA] shadow-[0_6px_24px_rgba(0,0,0,0.12)] has-[[data-slot=input-group-control]:focus-visible]:border-[#EAEAEA] has-[[data-slot=input-group-control]:focus-visible]:ring-0",
                multilinea
                    ? "items-end [--radius:1.25rem]"
                    : "items-center [--radius:9999px]",
            ]}
        >
            <InputGroup.Textarea
                bind:ref={inputEl}
                bind:value={texto}
                placeholder="Describir el cambio"
                class="max-h-32 min-h-9 overflow-y-auto py-2 ps-2.5 text-base md:text-base placeholder:text-[#A8A8A8]"
                onkeydown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        comentar();
                    }
                }}
            />
            <InputGroup.Addon align="inline-end">
                <InputGroup.Button
                    variant="default"
                    size="icon-sm"
                    class="rounded-full [&_svg:not([class*='size-'])]:size-4"
                    disabled={enviando || !texto.trim()}
                    onclick={comentar}
                >
                    <HugeiconsIcon icon={ArrowRight02Icon} strokeWidth={2.5} />
                    <span class="sr-only">{editando ? "Guardar" : "Agregar"}</span>
                </InputGroup.Button>
            </InputGroup.Addon>
        </InputGroup.Root>
        {#if error}
            <p class="px-1 pt-1 text-xs text-destructive">{error}</p>
        {/if}
    </Popover.Content>
</Popover.Root>

<style>
    /* Colapsados, del cuarto en adelante quedan escondidos detrás de la pila. */
    :global([data-sonner-toast][data-expanded="false"]:nth-child(n + 4)) {
        opacity: 0;
        pointer-events: none;
    }

    /* El plan entero es la tarjeta sobre el gradiente. Conserva el fondo que
       trae su propio body (puede ser oscuro); adentro se acomoda como quiera. */
    .plan {
        max-width: var(--ancho-plan);
        margin: 1.5rem auto;
        overflow: hidden;
        border: 1px solid var(--border);
        border-radius: 1rem;
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.06);
    }

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
            box-shadow: none;
        }
    }
    .plan :global([data-seleccionado]),
    .plan-editable :global([data-seleccionado]:hover) {
        outline-color: var(--primary);
        box-shadow: none;
    }
</style>
