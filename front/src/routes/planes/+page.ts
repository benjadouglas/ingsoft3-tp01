import type { PageLoad } from "./$types";

type PlanResumen = {
    id: string;
    titulo: string;
    proyecto: string;
    version: number;
    actualizadoEl: string;
};

export const load: PageLoad = async ({ fetch }) => {
    const res = await fetch("/api/planes");
    return { planes: (await res.json()) as PlanResumen[] };
};
