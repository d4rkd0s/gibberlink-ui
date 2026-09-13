import { glyphOutline, OUTLINE_METRICS } from "@gibberlink/core";

const paths = new Map<string, Path2D | null>();

function pathFor(glyph: string): Path2D | null {
  let p = paths.get(glyph);
  if (p === undefined) {
    const o = glyphOutline(glyph);
    p = o ? new Path2D(o.d) : null;
    paths.set(glyph, p);
  }
  return p;
}

const EM = OUTLINE_METRICS.unitsPerEm;
const HEIGHT = OUTLINE_METRICS.ascender - OUTLINE_METRICS.descender;

/**
 * Draws a run of glyphs centred on (0, 0) at `size` px tall. Runes come from embedded outlines
 * (no font involved); anything else uses the system UI font.
 */
export function drawGlyphs(ctx: CanvasRenderingContext2D, text: string, size: number) {
  const scale = size / EM;
  const chars = [...text];
  const widths = chars.map((c) => (glyphOutline(c)?.advance ?? EM * 0.6) * scale);
  let x = -widths.reduce((a, b) => a + b, 0) / 2;
  chars.forEach((c, i) => {
    const p = pathFor(c);
    if (p) {
      ctx.save();
      ctx.translate(x, (-HEIGHT / 2) * scale);
      ctx.scale(scale, scale);
      ctx.fill(p);
      ctx.restore();
    } else {
      ctx.save();
      ctx.font = `${size * 0.8}px system-ui, sans-serif`;
      ctx.textBaseline = "middle";
      ctx.fillText(c, x, 0);
      ctx.restore();
    }
    x += widths[i] ?? 0;
  });
}

export function outlineViewBox(glyph: string): { d: string; width: number; height: number } | null {
  const o = glyphOutline(glyph);
  return o ? { d: o.d, width: o.advance, height: HEIGHT } : null;
}
