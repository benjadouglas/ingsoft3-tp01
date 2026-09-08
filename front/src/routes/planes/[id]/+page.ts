import { error } from "@sveltejs/kit";
import { prepararPlan } from "$lib/plan-html";
import type { PageLoad } from "./$types";

export type Estado = "user_turn" | "agent_turn" | "approved";

export type Comentario = {
    id: string;
    bloqueId: string | null;
    fragmento: string | null;
    texto: string;
    versionNumero: number;
    atendido: boolean;
};

type PlanResumen = {
    id: string;
    titulo: string;
    version: number;
    estado: Estado;
    entregado: boolean;
    harness: string | null;
    sesionId: string | null;
    sesionTitulo: string | null;
    sesionDirectorio: string | null;
    sesionUrl: string | null;
};

export const load: PageLoad = async ({ params, fetch, depends }) => {
    depends("app:planes");
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
    if (!comentarios.ok) error(comentarios.status, "No se pudieron cargar los comentarios");
    const lista: Comentario[] = await comentarios.json();
    return {
        comentarios: lista.filter((c) => c.versionNumero === plan.version && !c.atendido),
        id: params.id,
        titulo: plan.titulo,
        version: plan.version,
        estado: plan.estado,
        entregado: plan.entregado,
        sesion: plan.harness
            ? {
                  harness: plan.harness,
                  sesionId: plan.sesionId,
                  sesionTitulo: plan.sesionTitulo,
                  sesionDirectorio: plan.sesionDirectorio,
                  sesionUrl: plan.sesionUrl,
              }
            : null,
        plan: prepararPlan(await html.text()),
    };
};
