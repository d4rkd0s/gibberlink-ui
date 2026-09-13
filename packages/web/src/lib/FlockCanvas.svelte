<script lang="ts">
  import { createFlock, type GlyphTime } from "@gibberlink/core";
  import { onMount } from "svelte";
  import { drawGlyphs } from "./glyphs.ts";

  export interface Flight {
    glyphs: GlyphTime[];
    /** seconds on the flight's own clock */
    clock: () => number;
    /** what each glyph is drawn as (runes for a Latin letter, etc.) */
    display: (glyph: string) => string;
    id: number;
  }

  let { flight, label = "" }: { flight: Flight | null; label?: string } = $props();

  let canvas: HTMLCanvasElement;
  let wrap: HTMLDivElement;
  let reduced = $state(false);

  onMount(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    reduced = mq.matches;
    const onMq = () => (reduced = mq.matches);
    mq.addEventListener("change", onMq);
    return () => mq.removeEventListener("change", onMq);
  });

  $effect(() => {
    const f = flight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let flock: ReturnType<typeof createFlock> | null = null;
    let size = { w: 0, h: 0 };

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      size = { w: r.width, h: r.height };
      if (f) flock = createFlock(f.glyphs, { width: r.width, height: r.height, seed: f.id, reducedMotion: reduced });
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    const style = getComputedStyle(wrap);
    const ink = style.getPropertyValue("--bird").trim() || "#e8c47a";
    const thread = style.getPropertyValue("--thread").trim() || "rgba(232,196,122,0.18)";

    const frame = () => {
      ctx.clearRect(0, 0, size.w, size.h);
      if (f && flock) {
        const birds = flock.step(f.clock());
        const glyphSize = Math.max(22, Math.min(40, size.h / 6));
        // a faint thread through the flock in message order: shows what came first
        ctx.strokeStyle = thread;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const [i, b] of birds.entries()) {
      if (i === 0) ctx.moveTo(b.x, b.y);
      else ctx.lineTo(b.x, b.y);
    }
        ctx.stroke();
        for (const b of birds) {
          ctx.save();
          ctx.globalAlpha = b.alpha;
          ctx.translate(b.x, b.y);
          ctx.rotate(b.angle);
          ctx.fillStyle = ink;
          ctx.shadowColor = ink;
          ctx.shadowBlur = 8 * b.alpha;
          drawGlyphs(ctx, f.display(b.glyph), glyphSize * b.scale);
          ctx.restore();
        }
        if (f.clock() > flock.duration) return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  });
</script>

<div class="sky" bind:this={wrap} aria-hidden="true">
  <canvas bind:this={canvas}></canvas>
  {#if !flight && label}
    <p class="hint">{label}</p>
  {/if}
</div>

<style>
  .sky {
    /* sticky so the flock stays in view while you press Transmit further down the page */
    position: sticky;
    top: 8px;
    z-index: 10;
    box-shadow: 0 6px 24px rgb(0 0 0 / 0.18);
    height: clamp(140px, 24vh, 260px);
    border-radius: var(--radius);
    background:
      radial-gradient(120% 90% at 50% 120%, var(--sky-glow), transparent 60%),
      var(--sky);
    overflow: hidden;
  }
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .hint {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    margin: 0;
    color: var(--muted);
    font-size: 0.95rem;
  }
</style>
