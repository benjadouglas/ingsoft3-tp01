import type { HalftoneCmykParams } from "@paper-design/shaders";

// Fondo de /login y /planes: un mesh gradient animado que pasa por el shader de
// semitono CMYK. Los valores de acá son los defaults; en dev aparece un panel
// (botón abajo a la derecha) para ajustar la sombra del texto y copiar el JSON.
export const fondo = $state({
    opacidad: 0.77,
    // Títulos de proyecto en /planes, sobre el fondo.
    titulo: {
        fuente: "serif" as "serif" | "sans" | "mono",
        // Tamaño (px).
        tamano: 18,
        color: "#1b2125",
        // Blur (px) del halo blanco detrás del texto (0 = sin sombra).
        sombra: 2,
    },
    // Velocidad de la animación del gradiente (0 = quieto).
    velocidad: 0.22,
    // Ancho máximo (rem) de la tarjeta del plan en /planes/[id].
    anchoPlan: 60,
    gradiente: {
        colores: [
            "#fefefe",
            "#d8e8f2",
            "#d1e3f1",
            "#9ab3c6",
            "#3c4f62",
            "#d2e4f2",
            "#758da1",
            "#5f7f9a",
            "#f2f7fa",
            "#cee0e7",
        ],
        distortion: 0.8,
        swirl: 0.1,
    },
    shader: {
        colorBack: "#ffffff",
        colorC: "#6dc0d5",
        colorM: "#d96363",
        colorY: "#fad85c",
        colorK: "#2d2824",
        size: 0.2,
        gridNoise: 0.45,
        type: "sharp" as NonNullable<HalftoneCmykParams["type"]>,
        softness: 0.4,
        contrast: 1.25,
        floodC: 0.15,
        floodM: 0.1,
        floodY: 0,
        floodK: 0,
        gainC: 0.3,
        gainM: 0,
        gainY: 0.2,
        gainK: -0.8,
        grainMixer: 0.15,
        grainOverlay: 0.1,
        grainSize: 0.5,
        scale: 1,
    },
});
