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
    data-comentario-toast
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

<style>
    /* Sonner mide con height:auto al plegar. Mantener esa altura evita el salto;
       el recorte oculta el excedente de los comentarios largos en la pila. */
    :global([data-sonner-toast]:has([data-comentario-toast])) {
        height: auto !important;
        transform-origin: top center;
        clip-path: inset(-16px -16px -24px -16px round 16px);
    }

    :global([data-sonner-toast][data-swiping="false"]:has([data-comentario-toast])) {
        transition: transform 400ms ease, opacity 400ms ease,
            height 400ms ease, box-shadow 200ms ease, clip-path 400ms ease;
    }

    :global([data-sonner-toast][data-expanded="false"][data-front="false"][data-removed="false"]:has([data-comentario-toast])) {
        --y: translateY(calc(100% - var(--front-toast-height) + var(--lift-amount) * var(--toasts-before)))
            scale(calc(1 - var(--toasts-before) * 0.05));
        clip-path: inset(-16px -16px calc(100% - var(--front-toast-height)) -16px round 16px);
    }
</style>
