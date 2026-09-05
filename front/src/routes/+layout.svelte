<script lang="ts">
    import "./layout.css";
    import favicon from "$lib/assets/favicon.svg";
    import { page } from "$app/state";
    import { goto } from "$app/navigation";
    import { signOut } from "$lib/auth-client";
    import { Button } from "$lib/components/ui/button";
    import { HugeiconsIcon } from "@hugeicons/svelte";
    import { Logout03Icon } from "@hugeicons/core-free-icons";

    let { data, children } = $props();

    async function cerrarSesion() {
        await signOut();
        await goto("/login");
    }
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if data.usuario && !page.url.pathname.startsWith("/planes/")}
    <div class="flex min-h-dvh flex-col">
        <header class="border-b bg-background">
            <div class="mx-auto flex h-12 max-w-3xl items-center gap-6 px-4">
                <a
                    href="/"
                    class="font-mono text-sm font-semibold tracking-tight"
                    >htmlplan</a
                >
                <div class="ml-auto flex items-center gap-3">
                    <span class="hidden text-xs text-muted-foreground sm:inline"
                        >{data.usuario.email}</span
                    >
                    <Button variant="ghost" size="sm" onclick={cerrarSesion}>
                        <HugeiconsIcon
                            icon={Logout03Icon}
                            data-icon="inline-start"
                        />
                        Salir
                    </Button>
                </div>
            </div>
        </header>
        <div class="flex flex-1 flex-col">
            {@render children()}
        </div>
    </div>
{:else}
    {@render children()}
{/if}
