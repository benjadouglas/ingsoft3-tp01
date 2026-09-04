<script lang="ts">
    // Cómo volver a la conversación del agente que publicó el plan.
    // Claude Code y Codex: el script guardó id, título y directorio, así que damos el comando
    // exacto (CLI) o qué buscar en el historial (GUI). El resto: un prompt para pegarle a un
    // agente nuevo en el mismo repo, que retoma por el estado que la skill guarda por repo.
    import { Button } from "$lib/components/ui/button";
    import { HugeiconsIcon } from "@hugeicons/svelte";
    import {
        ComputerTerminal01Icon,
        Copy01Icon,
        Tick02Icon,
    } from "@hugeicons/core-free-icons";
    import claudeCode from "$lib/assets/harness/claude-code.svg";
    import codex from "$lib/assets/harness/codex.png";
    import cursor from "$lib/assets/harness/cursor.svg";
    import opencode from "$lib/assets/harness/opencode.svg";

    let {
        harness,
        sesionId,
        sesionTitulo,
        sesionDirectorio,
        planTitulo,
    }: {
        harness: string;
        sesionId: string | null;
        sesionTitulo: string | null;
        sesionDirectorio: string | null;
        planTitulo: string;
    } = $props();

    const iconos: Record<string, [nombre: string, icono: string]> = {
        "claude-code": ["Claude Code", claudeCode],
        codex: ["Codex", codex],
        cursor: ["Cursor", cursor],
        opencode: ["OpenCode", opencode],
    };
    // Harness cuya sesión el script sabe leer del disco: con id se reabre por comando.
    const resume: Record<string, (id: string) => string> = {
        "claude-code": (id) => `claude --resume ${id}`,
        codex: (id) => `codex resume ${id}`,
    };

    const nombre = $derived(iconos[harness]?.[0] ?? harness);
    const icono = $derived(iconos[harness]?.[1]);
    const reabrible = $derived(harness in resume);

    const modos = [
        ["cli", "CLI"],
        ["gui", "GUI"],
    ] as const;
    let modo = $state<(typeof modos)[number][0]>("cli");

    const comando = $derived.by(() => {
        if (!sesionId) return null;
        const cmd = resume[harness]!(sesionId);
        return sesionDirectorio ? `cd ${sesionDirectorio} && ${cmd}` : cmd;
    });
    const busqueda = $derived(sesionTitulo ?? planTitulo);
    const prompt = $derived(
        `Retomá la conversación en la que se creó el plan «${planTitulo}»` +
            (sesionDirectorio ? ` (repo ${sesionDirectorio})` : "") +
            `. Ya lo comenté en Borrador: corré el wait de la skill handoff-html y aplicá los comentarios.`,
    );

    const texto = $derived.by(() => {
        if (!reabrible) return prompt;
        if (modo === "gui") return busqueda;
        return comando ?? busqueda;
    });
    const nota = $derived.by(() => {
        if (!reabrible) return `Pegale esto a ${nombre} en una conversación nueva.`;
        if (modo === "gui")
            return `Buscá esta conversación en el historial de ${nombre}.`;
        if (!comando) return `Sin id de sesión: buscala por este título.`;
        return null;
    });

    let copiado = $state(false);
    async function copiar() {
        await navigator.clipboard.writeText(texto);
        copiado = true;
        setTimeout(() => (copiado = false), 1500);
    }
</script>

<div class="overflow-hidden rounded-lg border bg-muted/40 text-sm">
    <div class="flex items-center gap-1 border-b px-2 py-1.5">
        {#if icono}
            <img src={icono} alt="" class="size-5 rounded-sm" />
        {:else}
            <HugeiconsIcon icon={ComputerTerminal01Icon} class="size-4" />
        {/if}
        <span class="mr-1 truncate font-medium">{nombre}</span>
        {#if reabrible}
            {#each modos as [valor, etiqueta] (valor)}
                <button
                    type="button"
                    class={[
                        "rounded-md px-2 py-0.5 text-xs",
                        modo === valor
                            ? "bg-background font-medium shadow-sm ring-1 ring-border"
                            : "text-muted-foreground hover:text-foreground",
                    ]}
                    onclick={() => (modo = valor)}
                >
                    {etiqueta}
                </button>
            {/each}
        {/if}
        <span class="flex-1"></span>
        <Button variant="ghost" size="icon-sm" onclick={copiar} aria-label="Copiar">
            <HugeiconsIcon icon={copiado ? Tick02Icon : Copy01Icon} />
        </Button>
    </div>
    <div class="px-3 py-2">
        <code class="block break-all font-mono text-xs">{texto}</code>
        {#if nota}
            <p class="mt-1 text-xs text-muted-foreground">{nota}</p>
        {/if}
    </div>
</div>
