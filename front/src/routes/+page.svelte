<script lang="ts">
    import * as Card from "$lib/components/ui/card";
    import { HugeiconsIcon } from "@hugeicons/svelte";
    import { File01Icon, Key01Icon } from "@hugeicons/core-free-icons";
    import FondoGradiente from "$lib/components/fondo-gradiente.svelte";
</script>

<FondoGradiente />

<main class="mx-auto w-full max-w-3xl px-4 py-10">
    <div class="grid gap-4 sm:grid-cols-2">
        <a
            href="/planes"
            class="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
            <Card.Root class="h-full transition-colors group-hover:bg-muted/40">
                <Card.Header>
                    <HugeiconsIcon
                        icon={File01Icon}
                        class="size-5 text-muted-foreground"
                    />
                    <Card.Title class="mt-2 ">Planes</Card.Title>
                    <Card.Description
                        >Todo lo que el agente publicó, por proyecto.</Card.Description
                    >
                </Card.Header>
            </Card.Root>
        </a>
        <a
            href="/token"
            class="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
            <Card.Root class="h-full transition-colors group-hover:bg-muted/40">
                <Card.Header>
                    <HugeiconsIcon
                        icon={Key01Icon}
                        class="size-5 text-muted-foreground"
                    />
                    <Card.Title class="mt-2">API key</Card.Title>
                    <Card.Description
                        >La credencial con la que el agente publica en tu
                        nombre.</Card.Description
                    >
                </Card.Header>
            </Card.Root>
        </a>
    </div>
</main>
