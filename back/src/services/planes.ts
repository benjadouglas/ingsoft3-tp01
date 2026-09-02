import { desc, eq } from "drizzle-orm";
import { db } from "../db";
import { plan, type Plan } from "../db/schema";

export async function publicarPlan(input: { proyecto: string; contenidoHtml: string }): Promise<Plan> {
  const [creado] = await db.insert(plan).values(input).returning();
  return creado;
}

export async function obtenerPlan(id: string): Promise<Plan | undefined> {
  return db.query.plan.findFirst({ where: eq(plan.id, id) });
}

export async function listarPlanes() {
  return db
    .select({ id: plan.id, proyecto: plan.proyecto, creadoEl: plan.creadoEl })
    .from(plan)
    .orderBy(desc(plan.creadoEl));
}
