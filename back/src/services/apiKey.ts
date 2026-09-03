import { eq } from "drizzle-orm";
import { db } from "../db";
import { user } from "../db/schema";

function hashear(clave: string): string {
    return new Bun.CryptoHasher("sha256").update(clave).digest("hex");
}

/** Genera una API key nueva para el usuario, reemplazando la anterior. Devuelve el texto plano: solo se ve una vez. */
export async function generarApiKey(userId: string): Promise<string> {
    const clave = `brd_${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url")}`;
    await db
        .update(user)
        .set({ apiKeyHash: hashear(clave), apiKeyCreatedAt: new Date() })
        .where(eq(user.id, userId));
    return clave;
}

export async function usuarioPorApiKey(clave: string) {
    return db.query.user.findFirst({ where: eq(user.apiKeyHash, hashear(clave)) });
}
