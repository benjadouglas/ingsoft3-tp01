<script lang="ts">
    import "./layout.css";
    import logo from "$lib/assets/htmlplan-logo.png";
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

<svelte:head>
    <link rel="icon" type="image/png" href={logo} />
    <title>htmlplan</title>
</svelte:head>

{#if data.usuario && !page.url.pathname.startsWith("/planes/")}
    <div class="flex min-h-dvh flex-col">
        <header class="border-b bg-background">
            <div class="mx-auto flex h-12 max-w-3xl items-center gap-6 px-4">
                <a
                    href="/"
                    aria-label="htmlplan"
                    class="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                    <img src={logo} alt="" class="h-7 w-auto" />
                </a>
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
