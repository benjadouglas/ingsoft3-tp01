<script lang="ts">
    import { invalidate } from "$app/navigation";

    let { children } = $props();

    // Cuando un agente publica un plan o una versión, o recibe una acción, el back
    // avisa por SSE y se vuelven a correr los `load` que dependen de "app:planes".
    $effect(() => {
        const eventos = new EventSource("/api/planes/eventos");
        const refrescar = () => invalidate("app:planes");
        eventos.addEventListener("plan_nuevo", refrescar);
        eventos.addEventListener("version_nueva", refrescar);
        eventos.addEventListener("accion_entregada", refrescar);
        return () => eventos.close();
    });
</script>

{@render children()}
