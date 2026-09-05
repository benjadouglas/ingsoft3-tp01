import type { PageLoad } from "./$types";

type PlanResumen = {
    id: string;
    titulo: string;
    proyecto: string;
    version: number;
    estado: "user_turn" | "agent_turn" | "approved";
    entregado: boolean;
    actualizadoEl: string;
};

export const load: PageLoad = async ({ fetch, depends }) => {
    depends("app:planes");
    const res = await fetch("/api/planes");
    return { planes: (await res.json()) as PlanResumen[] };
};
