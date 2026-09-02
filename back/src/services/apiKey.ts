import { eq } from "drizzle-orm";
import { db } from "../db";
import { apiKey, user } from "../db/schema";

function hashear(clave: string): string {
    return new Bun.CryptoHasher("sha256").update(clave).digest("hex");
}

/** Genera una API key nueva para el usuario, reemplazando la anterior. Devuelve el texto plano: solo se ve una vez. */
export async function generarApiKey(userId: string): Promise<string> {
    const clave = `brd_${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url")}`;
    const hash = hashear(clave);
    await db
        .insert(apiKey)
        .values({ userId, hash })
        .onConflictDoUpdate({ target: apiKey.userId, set: { hash, creadaEl: new Date() } });
    return clave;
}

export async function usuarioPorApiKey(clave: string) {
    const [fila] = await db
        .select({ usuario: user })
        .from(apiKey)
        .innerJoin(user, eq(apiKey.userId, user.id))
        .where(eq(apiKey.hash, hashear(clave)));
    return fila?.usuario;
}
