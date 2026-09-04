import { error } from "@sveltejs/kit";
import { prepararPlan } from "$lib/plan-html";
import type { PageLoad } from "./$types";

export type Estado = "user_turn" | "agent_turn" | "approved";

export type Comentario = {
    id: string;
    versionNumero: number;
    bloqueId: string | null;
    fragmento: string | null;
    texto: string;
    atendido: boolean;
};

type PlanResumen = {
    id: string;
    titulo: string;
    version: number;
    estado: Estado;
};

export const load: PageLoad = async ({ params, fetch }) => {
    const [html, planes, comentarios] = await Promise.all([
        fetch(`/api/planes/${params.id}`),
        fetch("/api/planes"),
        fetch(`/api/planes/${params.id}/comentarios`),
    ]);
    if (!html.ok) error(html.status, "Plan no encontrado");
    const plan = ((await planes.json()) as PlanResumen[]).find(
        (p) => p.id === params.id,
    );
    if (!plan) error(404, "Plan no encontrado");
    return {
        id: params.id,
        titulo: plan.titulo,
        version: plan.version,
        estado: plan.estado,
        plan: prepararPlan(await html.text()),
        comentarios: (await comentarios.json()) as Comentario[],
    };
};
