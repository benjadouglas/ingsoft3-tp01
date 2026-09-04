/**
 * El plan llega como documento HTML completo pero se renderiza inline, dentro
 * de la app, para poder tocar sus bloques. Sus `<style>` se acotan con
 * `@scope (.plan)` así no pisan los estilos de la app, y `html`/`body` pasan a
 * ser el contenedor.
 */
export function prepararPlan(html: string): { estilos: string; cuerpo: string } {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const css = [...doc.querySelectorAll("style")]
        .map((s) => s.textContent ?? "")
        .join("\n")
        .replace(/(?<![.#\w-])(html|body)(?![\w-])/g, ":scope");
    for (const el of doc.querySelectorAll("style, script, link")) el.remove();
    return { estilos: `@scope (.plan) {\n${css}\n}`, cuerpo: doc.body.innerHTML };
}

/** Primeros 150 caracteres de texto de un bloque, para saber de qué era el comentario. */
export function fragmentoDe(bloque: Element): string {
    return (bloque.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 150);
}

/** Título humano de un bloque: su primer encabezado, o el id si no tiene. */
export function tituloDe(bloque: Element): string {
    const h = bloque.querySelector("h1, h2, h3, h4, h5, h6");
    return h?.textContent?.replace(/\s+/g, " ").trim() || bloque.id;
}
