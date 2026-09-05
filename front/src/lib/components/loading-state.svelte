<script lang="ts">
    /*
     * Grilla de píxeles para trabajo largo. Variantes:
     *   drive — celdas cuadradas, frente en chevrón que avanza a la derecha
     *   dots  — mismo frente, celdas redondas
     *   orbit — un cometa dando vueltas por el perímetro
     * Va con un rótulo con shimmer y, opcionalmente, un contador de tiempo en mono
 * (cuenta desde el montaje: en listas donde el componente se remonta no dice nada útil).
     * Con reduced-motion la grilla queda fija en su estado apagado; el contador sigue.
     */
    type Variante = "drive" | "dots" | "orbit";

    let {
        label = "Trabajando",
        variant = "drive",
        elapsed = true,
    }: { label?: string; variant?: Variante; elapsed?: boolean } = $props();

    const chevron = Array.from({ length: 9 }, (_, i) => {
        const r = Math.floor(i / 3);
        const c = i % 3;
        return (c + Math.abs(r - 1)) * 90;
    });

    const ORBIT_ORDER = [0, 1, 2, 5, 8, 7, 6, 3];
    const orbit = Array.from({ length: 9 }, (_, i) => {
        const k = ORBIT_ORDER.indexOf(i);
        return k === -1 ? null : k * 110;
    });

    const PATTERNS: Record<
        Variante,
        { delays: (number | null)[]; dur: number; round: boolean }
    > = {
        drive: { delays: chevron, dur: 650, round: false },
        dots: { delays: chevron, dur: 650, round: true },
        orbit: { delays: orbit, dur: 950, round: false },
    };

    const patron = $derived(PATTERNS[variant]);

    // Décimas de segundo desde que se montó.
    let ds = $state(0);
    $effect(() => {
        const t = setInterval(() => ds++, 100);
        return () => clearInterval(t);
    });
    const tiempo = $derived.by(() => {
        const total = ds / 10;
        if (total < 60) return `${total.toFixed(1)}s`;
        return `${Math.floor(total / 60)}m ${(total % 60).toFixed(1)}s`;
    });
</script>

<div role="status" class="flex w-fit items-center gap-2.5">
    <span
        aria-hidden="true"
        class="grid shrink-0 grid-cols-[repeat(3,4px)] gap-[1.5px]"
    >
        {#each patron.delays as delay, i (i)}
            <span
                class={[
                    "size-[4px] bg-foreground",
                    patron.round ? "rounded-full" : "rounded-[1px]",
                    delay === null ? "pixel-off" : "pixel",
                ]}
                style:--dur="{patron.dur}ms"
                style:--delay="{delay ?? 0}ms"
            ></span>
        {/each}
    </span>
    <span class="shimmer bg-clip-text text-[13px] font-medium text-transparent">
        {label}
    </span>
    {#if elapsed}
        <span class="font-mono text-[12px] text-muted-foreground tabular-nums">
            {tiempo}
        </span>
    {/if}
</div>

<style>
    .pixel-off {
        opacity: 0.07;
    }
    .pixel {
        opacity: 0.15;
        animation: pixel-on var(--dur) ease-in-out var(--delay) infinite;
    }
    .shimmer {
        background-image: linear-gradient(
            90deg,
            var(--muted-foreground) 35%,
            var(--foreground) 50%,
            var(--muted-foreground) 65%
        );
        background-size: 200% 100%;
        animation: shimmer-text 1.4s linear infinite;
    }
    @keyframes pixel-on {
        0%,
        100% {
            opacity: 0.15;
        }
        18%,
        42% {
            opacity: 1;
        }
        62% {
            opacity: 0.15;
        }
    }
    @keyframes shimmer-text {
        from {
            background-position: 150% center;
        }
        to {
            background-position: -50% center;
        }
    }
    @media (prefers-reduced-motion: reduce) {
        .pixel,
        .shimmer {
            animation: none;
        }
    }
</style>
