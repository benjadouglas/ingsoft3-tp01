<script lang="ts">
    import { Button } from "$lib/components/ui/button";
    import { HugeiconsIcon } from "@hugeicons/svelte";
    import { Delete02Icon, PencilEdit02Icon } from "@hugeicons/core-free-icons";

    // Cuerpo de un toast de svelte-sonner: la <li> viene sin estilos cuando
    // se renderiza un componente, así que el ancho y la caja los pone este root.
    let {
        texto,
        onEditar,
        onBorrar,
    }: {
        texto: string;
        onEditar: () => void;
        onBorrar: () => void;
        closeToast?: () => void;
    } = $props();
</script>

<div
    class="flex w-(--width) items-center gap-2 rounded-2xl border bg-popover py-2 ps-4 pe-2 text-popover-foreground shadow-md"
>
    <p class="min-w-0 flex-1 text-sm">{texto}</p>
    <div class="flex shrink-0 items-center gap-1">
        <Button
            variant="ghost"
            size="icon-lg"
            class="rounded-full [&_svg:not([class*='size-'])]:size-5"
            onclick={onEditar}
        >
            <HugeiconsIcon icon={PencilEdit02Icon} />
            <span class="sr-only">Editar</span>
        </Button>
        <Button
            variant="ghost"
            size="icon-lg"
            class="rounded-full [&_svg:not([class*='size-'])]:size-5"
            onclick={onBorrar}
        >
            <HugeiconsIcon icon={Delete02Icon} />
            <span class="sr-only">Borrar</span>
        </Button>
    </div>
</div>
