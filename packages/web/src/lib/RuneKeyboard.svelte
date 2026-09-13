<script lang="ts">
  import { lexicon, type RuneSetId, runesOf } from "@gibberlink/core";
  import { outlineViewBox } from "./glyphs.ts";

  let { set, oninsert }: { set: RuneSetId; oninsert: (glyph: string) => void } = $props();

  const groups = $derived.by(() => {
    const out = new Map<string, ReturnType<typeof runesOf>>();
    for (const r of runesOf(set)) out.set(r.group, [...(out.get(r.group) ?? []), r]);
    return [...out.entries()];
  });
</script>

<div class="keyboard" role="group" aria-label="Rune keyboard">
  {#each groups as [group, runes] (group)}
    <fieldset>
      <legend>{group}</legend>
      <div class="keys">
        {#each runes as r (r.cp)}
          {@const o = outlineViewBox(r.glyph)}
          <button
            type="button"
            title={`${r.name} · ${r.translit} · ${r.cp}`}
            aria-label={`${r.name}, ${r.translit}`}
            onclick={() => oninsert(r.glyph)}
          >
            {#if o}
              <svg viewBox={`0 0 ${o.width} ${o.height}`} aria-hidden="true"><path d={o.d} /></svg>
            {/if}
            <small>{r.translit}</small>
          </button>
        {/each}
      </div>
    </fieldset>
  {/each}
  <fieldset>
    <legend>Separators</legend>
    <div class="keys">
      {#each lexicon.separators as s (s.cp)}
        {@const o = outlineViewBox(s.glyph)}
        <button type="button" title={`${s.label} · ${s.cp}`} aria-label={s.label} onclick={() => oninsert(s.glyph)}>
          {#if o}<svg viewBox={`0 0 ${o.width} ${o.height}`} aria-hidden="true"><path d={o.d} /></svg>{/if}
          <small>{s.label}</small>
        </button>
      {/each}
    </div>
  </fieldset>
</div>

<style>
  .keyboard {
    display: grid;
    gap: 0.5rem;
  }
  fieldset {
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 0.4rem 0.6rem 0.6rem;
    margin: 0;
  }
  legend {
    color: var(--muted);
    font-size: 0.8rem;
    padding-inline: 0.3rem;
  }
  .keys {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  button {
    display: grid;
    justify-items: center;
    gap: 0.1rem;
    min-width: 2.75rem;
    min-height: 2.75rem;
    padding: 0.3rem 0.35rem;
    border-radius: 8px;
    border: 1px solid var(--line);
    background: var(--surface-2);
    color: var(--ink);
    cursor: pointer;
  }
  button:hover {
    border-color: var(--accent);
  }
  svg {
    height: 1.5rem;
    fill: currentColor;
  }
  small {
    font-size: 0.7rem;
    color: var(--muted);
  }
</style>
