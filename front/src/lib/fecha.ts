const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

const unidades: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 1000 * 60 * 60 * 24 * 365],
    ["month", 1000 * 60 * 60 * 24 * 30],
    ["day", 1000 * 60 * 60 * 24],
    ["hour", 1000 * 60 * 60],
    ["minute", 1000 * 60],
];

/** "hace 3 horas", "ayer", "hace 2 meses". Menos de un minuto: "recién". */
export function haceCuanto(iso: string, ahora = Date.now()): string {
    const diff = new Date(iso).getTime() - ahora;
    for (const [unidad, ms] of unidades) {
        if (Math.abs(diff) >= ms)
            return rtf.format(Math.round(diff / ms), unidad);
    }
    return "recién";
}
