import { describe, expect, it } from "vitest";
import { prepararPlan } from "./plan-html";

const html = `<!doctype html><html><head><style>
  :root { --canvas: #f7f7f4; --primary: #f54e00; }
  body { background: var(--canvas); }
  .eyebrow { color: var(--primary); }
</style></head><body><p class="eyebrow">hola</p></body></html>`;

describe("prepararPlan", () => {
    it("acota :root, html y body al contenedor .plan", () => {
        const { estilos, cuerpo } = prepararPlan(html);
        const style = document.createElement("style");
        style.textContent = estilos;
        const plan = document.createElement("div");
        plan.className = "plan";
        plan.innerHTML = cuerpo;
        document.head.append(style);
        document.body.append(plan);

        expect(estilos).not.toContain(":root");
        expect(getComputedStyle(plan).backgroundColor).toBe("rgb(247, 247, 244)");
        expect(getComputedStyle(plan.querySelector(".eyebrow")!).color).toBe("rgb(245, 78, 0)");
        expect(getComputedStyle(document.documentElement).getPropertyValue("--canvas")).toBe("");

        style.remove();
        plan.remove();
    });
});
