// Harness cuya sesión el script sabe leer del disco: con id se reabre por comando.
const resume: Record<string, (id: string) => string> = {
    "claude-code": (id) => `claude --resume ${id}`,
};

export function esReabrible(harness: string): boolean {
    return harness in resume;
}

/** Comando para retomar la sesión del agente, o null si no hay con qué armarlo. */
export function comandoReanudar(
    harness: string,
    sesionId: string | null,
    sesionDirectorio: string | null,
): string | null {
    if (!sesionId || !esReabrible(harness)) return null;
    const cmd = resume[harness]!(sesionId);
    return sesionDirectorio ? `cd ${sesionDirectorio} && ${cmd}` : cmd;
}
