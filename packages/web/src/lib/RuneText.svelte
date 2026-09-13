<script lang="ts">
  import { type RuneSetId, toLatin } from "@gibberlink/core";
  import { outlineViewBox } from "./glyphs.ts";

  /** Renders runes from embedded outlines so they show on every device, font or no font. */
  let { text, set = "elder", size = 1.6 }: { text: string; set?: RuneSetId; size?: number } = $props();

  const chars = $derived([...text]);
  const reading = $derived(toLatin(text, { set }));
</script>

<span class="runes" dir="ltr" role="img" aria-label={`Runes, read as: ${reading}`} style:--size={`${size}em`}>
  {#each chars as c, i (i)}
    {@const o = outlineViewBox(c)}
    {#if o}
      <svg viewBox={`0 0 ${o.width} ${o.height}`} width={`${(o.width / o.height) * size}em`} height={`${size}em`} aria-hidden="true">
        <path d={o.d} />
      </svg>
    {:else}
      <span class="plain" aria-hidden="true">{c}</span>
    {/if}
  {/each}
</span>

<style>
  .runes {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    line-height: 1;
    gap: 0;
  }
  svg {
    fill: currentColor;
    display: block;
  }
  .plain {
    font-size: calc(var(--size) * 0.75);
    padding-inline: 0.1em;
  }
</style>
