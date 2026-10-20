import { eq } from "drizzle-orm";
import { db } from "../db";
import { user } from "../db/schema";
import { hashear, nuevaApiKey } from "./reglas";

/** Genera una API key nueva para el usuario, reemplazando la anterior. */
export function generarApiKey(userId: string): Promise<string> {
    return nuevaApiKey((hash) =>
        db
            .update(user)
            .set({ apiKeyHash: hash, apiKeyCreatedAt: new Date() })
            .where(eq(user.id, userId)),
    );
}

export async function usuarioPorApiKey(clave: string) {
    return db.query.user.findFirst({
        where: eq(user.apiKeyHash, hashear(clave)),
    });
}
