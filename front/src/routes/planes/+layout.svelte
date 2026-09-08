<script lang="ts">
    import { invalidate } from "$app/navigation";
    import { tick } from "svelte";
    import { toast } from "svelte-sonner";

    let { children } = $props();

    // Cuando un agente publica un plan o una versión, o recibe una acción, el back
    // avisa por SSE y se vuelven a correr los `load` que dependen de "app:planes".
    $effect(() => {
        const eventos = new EventSource("/api/planes/eventos");
        const refrescar = () => invalidate("app:planes");
        eventos.addEventListener("plan_nuevo", refrescar);
        eventos.addEventListener("version_nueva", refrescar);
        eventos.addEventListener("accion_entregada", refrescar);
        // El agente estaba ocupado: el plan vuelve a tu turno con los comentarios guardados.
        eventos.addEventListener("accion_rebotada", async () => {
            await refrescar();
            // Los comentarios se restauran primero; el aviso queda al frente.
            await tick();
            toast.warning("El agente estaba ocupado y no tomó la acción.", {
                description:
                    "Tus comentarios siguen guardados. Volvé a Refinar o Implementar cuando termine.",
                duration: 10_000,
            });
        });
        return () => eventos.close();
    });
</script>

{@render children()}
