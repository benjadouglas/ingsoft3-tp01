import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Falta DATABASE_URL");

export const db = drizzle(postgres(url, { onnotice: () => {} }), { schema });

export async function migrar() {
    await migrate(db, { migrationsFolder: `${import.meta.dir}/../../drizzle` });
}
