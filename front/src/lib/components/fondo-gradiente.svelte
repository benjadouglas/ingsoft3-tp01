<script lang="ts">
    import {
        ShaderMount,
        meshGradientFragmentShader,
        halftoneCmykFragmentShader,
        getShaderColorFromString,
        getShaderNoiseTexture,
        defaultObjectSizing,
        ShaderFitOptions,
        HalftoneCmykTypes,
        type MeshGradientUniforms,
        type HalftoneCmykUniforms,
    } from "@paper-design/shaders";
    import { onMount, untrack } from "svelte";
    import { base } from "$app/paths";
    import { fondo } from "$lib/fondo.svelte";

    let animar = $state(false);
    let listo = $state(false);

    onMount(() => {
        const motion = matchMedia("(prefers-reduced-motion: reduce)");
        const device = navigator as Navigator & {
            deviceMemory?: number;
            connection?: { saveData?: boolean };
        };
        function elegirModo() {
            animar = !motion.matches && !device.connection?.saveData
                && !(device.deviceMemory && device.deviceMemory <= 4)
                && !(device.hardwareConcurrency && device.hardwareConcurrency <= 2);
        }
        elegirModo();
        motion.addEventListener("change", elegirModo);
        return () => motion.removeEventListener("change", elegirModo);
    });

    function usarImagen() {
        listo = false;
        animar = false;
    }

    function liberarContextos(contenedor: HTMLElement) {
        for (const canvas of contenedor.querySelectorAll("canvas")) {
            canvas.getContext("webgl2")?.getExtension("WEBGL_lose_context")?.loseContext();
        }
    }

    function montarSeguro(contenedor: HTMLElement) {
        try {
            return montarShader(contenedor);
        } catch {
            liberarContextos(contenedor);
            usarImagen();
        }
    }

    // Dos ShaderMount de @paper-design/shaders encadenados: el mesh gradient se
    // renderiza en un canvas chico y se copia a una textura reutilizable del
    // semitono CMYK. ShaderMount solo acepta HTMLImageElement como textura, así
    // que la subida se hace a mano contra su contexto WebGL (campos privados).

    function uniformsGradiente() {
        const g = fondo.gradiente;
        return {
            ...uniformsSizing(1),
            u_colors: g.colores.map(getShaderColorFromString),
            u_colorsCount: g.colores.length,
            u_distortion: g.distortion,
            u_swirl: g.swirl,
            u_grainMixer: 0,
            u_grainOverlay: 0,
        } satisfies MeshGradientUniforms;
    }

    function uniformsHalftone() {
        const s = fondo.shader;
        return {
            ...uniformsSizing(s.scale),
            u_colorBack: getShaderColorFromString(s.colorBack),
            u_colorC: getShaderColorFromString(s.colorC),
            u_colorM: getShaderColorFromString(s.colorM),
            u_colorY: getShaderColorFromString(s.colorY),
            u_colorK: getShaderColorFromString(s.colorK),
            u_size: s.size,
            u_contrast: s.contrast,
            u_softness: s.softness,
            u_grainSize: s.grainSize,
            u_grainMixer: s.grainMixer,
            u_grainOverlay: s.grainOverlay,
            u_gridNoise: s.gridNoise,
            u_floodC: s.floodC,
            u_floodM: s.floodM,
            u_floodY: s.floodY,
            u_floodK: s.floodK,
            u_gainC: s.gainC,
            u_gainM: s.gainM,
            u_gainY: s.gainY,
            u_gainK: s.gainK,
            u_type: HalftoneCmykTypes[s.type],
        } satisfies Omit<HalftoneCmykUniforms, "u_image" | "u_noiseTexture">;
    }

    function uniformsSizing(scale: number) {
        const s = defaultObjectSizing;
        return {
            u_fit: ShaderFitOptions.cover,
            u_scale: scale,
            u_rotation: s.rotation,
            u_offsetX: s.offsetX,
            u_offsetY: s.offsetY,
            u_originX: s.originX,
            u_originY: s.originY,
            u_worldWidth: s.worldWidth,
            u_worldHeight: s.worldHeight,
        };
    }

    // Imagen de 1x1 para que el halftone cree la textura y el uniform de aspect
    // ratio; después se pisa cada frame con el canvas del gradiente.
    async function imagenVacia() {
        const img = new Image();
        img.src = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
        await img.decode();
        return img;
    }

    type Internos = {
        gl: WebGL2RenderingContext;
        textures: Map<string, WebGLTexture>;
        textureUnitMap: Map<string, number>;
        uniformLocations: Record<string, WebGLUniformLocation | null>;
    };

    function subirTextura(halftone: ShaderMount, canvas: HTMLCanvasElement, resize: boolean) {
        const { gl, textures, textureUnitMap, uniformLocations } = halftone as unknown as Internos;
        const textura = textures.get("u_image");
        const unidad = textureUnitMap.get("u_image");
        if (!textura || unidad === undefined) return;
        gl.activeTexture(gl.TEXTURE0 + unidad);
        gl.bindTexture(gl.TEXTURE_2D, textura);
        if (resize) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
        } else {
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
        }
        gl.uniform1f(uniformLocations.u_imageAspectRatio, canvas.width / canvas.height);
    }

    function montarShader(contenedor: HTMLElement) {
        // Los controles actualizan uniforms sin volver a crear contextos WebGL.
        return untrack(() => {
            const capaGradiente = contenedor.firstElementChild as HTMLElement;
            const capaHalftone = contenedor.lastElementChild as HTMLElement;
            const context = { antialias: false, depth: false, stencil: false, failIfMajorPerformanceCaveat: true };
            const gradiente = new ShaderMount(
                capaGradiente, meshGradientFragmentShader, uniformsGradiente(),
                context, 0, 0, 1, 512 * 512,
            );
            let halftone = $state.raw<ShaderMount>();
            let disposed = false;
            let raf = 0;
            let lastTime = 0;
            let width = 0;
            let height = 0;
            let sampleTime = 0;
            let sampleFrames = 0;

            function dibujar(frame = gradiente.getCurrentFrame()) {
                if (!halftone || document.hidden) return;
                // Render y copia en el mismo callback: no hace falta conservar el buffer.
                gradiente.setFrame(frame);
                const canvas = gradiente.canvasElement;
                subirTextura(halftone, canvas, width !== canvas.width || height !== canvas.height);
                width = canvas.width;
                height = canvas.height;
                halftone.setFrame(0);
                const gl = halftone.canvasElement.getContext("webgl2")!;
                if (!listo) {
                    if (gl.isContextLost() || gl.getError() !== gl.NO_ERROR) {
                        usarImagen();
                        return;
                    }
                    listo = true;
                }
            }

            function loop(now: number) {
                raf = requestAnimationFrame(loop);
                if (now - lastTime < 1000 / 30) return;
                const elapsed = now - lastTime;
                lastTime = now;
                // Una caída sostenida por debajo de ~15 fps activa el fondo estático.
                sampleTime += elapsed;
                sampleFrames++;
                if (sampleTime >= 3000) {
                    if (sampleTime / sampleFrames > 1000 / 15) {
                        usarImagen();
                        return;
                    }
                    sampleTime = 0;
                    sampleFrames = 0;
                }
                dibujar(gradiente.getCurrentFrame() + elapsed * fondo.velocidad);
            }

            function actualizarAnimacion() {
                cancelAnimationFrame(raf);
                lastTime = performance.now();
                sampleTime = 0;
                sampleFrames = 0;
                dibujar();
                if (halftone && !document.hidden && fondo.velocidad !== 0) {
                    raf = requestAnimationFrame(loop);
                }
            }

            const noise = getShaderNoiseTexture()!;
            Promise.all([imagenVacia(), noise.decode()]).then(([u_image]) => {
                if (disposed) return;
                halftone = new ShaderMount(
                    capaHalftone, halftoneCmykFragmentShader,
                    { ...uniformsHalftone(), u_image, u_noiseTexture: noise },
                    context, 0, 0, 1, 1920 * 1080,
                );
            }).catch(usarImagen);

            $effect(() => {
                gradiente.setUniforms(uniformsGradiente());
                untrack(dibujar);
            });
            $effect(() => halftone?.setUniforms(uniformsHalftone()));
            $effect(() => {
                fondo.velocidad;
                halftone;
                untrack(actualizarAnimacion);
            });
            const resize = new ResizeObserver(() => dibujar());
            resize.observe(contenedor);
            document.addEventListener("visibilitychange", actualizarAnimacion);
            contenedor.addEventListener("webglcontextlost", usarImagen, true);

            return () => {
                disposed = true;
                cancelAnimationFrame(raf);
                resize.disconnect();
                document.removeEventListener("visibilitychange", actualizarAnimacion);
                contenedor.removeEventListener("webglcontextlost", usarImagen, true);
                liberarContextos(contenedor);
                gradiente.dispose();
                halftone?.dispose();
            };
        });
    }

</script>

<div aria-hidden="true" class="pointer-events-none fixed inset-0 -z-10 bg-white">
    <img
        src={`${base}/fondo-shader.webp`}
        alt=""
        class="absolute inset-0 h-full w-full object-cover"
        style:opacity={listo && animar ? 0 : fondo.opacidad}
    />
    {#if animar}
        <div {@attach montarSeguro} class="absolute inset-0" style:visibility={listo ? "visible" : "hidden"}>
            <div class="absolute inset-0 opacity-0"></div>
            <div class="absolute inset-0" style:opacity={fondo.opacidad}></div>
        </div>
    {/if}
</div>
