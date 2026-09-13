import {
  DEFAULT_RUNE_SET,
  type GlyphOutline,
  glyphOutlines,
  lexicon,
  type Rune,
  type RuneSet,
  type RuneSetId,
} from "./lexicon.ts";

export const RUNE_SEPARATORS = ["᛫", "᛬", "᛭", " ", ""] as const;
export type RuneSeparator = (typeof RUNE_SEPARATORS)[number];

const SEPARATOR_GLYPHS = new Set(lexicon.separators.map((s) => s.glyph));

export function getRuneSet(id: string): RuneSet {
  const set = lexicon.sets.find((s) => s.id === id);
  if (!set) throw new Error(`Unknown rune set: ${id}`);
  return set;
}

/** The set followed by the sets it borrows from, nearest first. */
export function ruleChain(id: string): RuneSet[] {
  const chain: RuneSet[] = [];
  for (let s: RuneSet | undefined = getRuneSet(id); s; s = s.rulesFrom ? getRuneSet(s.rulesFrom) : undefined) {
    if (chain.includes(s)) throw new Error(`Rule cycle at ${s.id}`);
    chain.push(s);
  }
  return chain;
}

interface Compiled {
  /** latin -> runes, longest keys first */
  rules: [string, string][];
  /** glyph -> rune row as read in this set */
  runes: Map<string, Rune>;
}

const cache = new Map<string, Compiled>();

function compile(id: string): Compiled {
  const hit = cache.get(id);
  if (hit) return hit;
  const map = new Map<string, string>();
  const runes = new Map<string, Rune>();
  // farthest ancestor first so nearer sets override
  for (const s of ruleChain(id).reverse()) {
    for (const r of lexicon.latin) if (r.set === s.id) map.set(r.latin.normalize("NFC"), r.runes);
    for (const r of lexicon.runes) if (r.set === s.id) runes.set(r.glyph, r);
  }
  const compiled = {
    rules: [...map.entries()].sort((a, b) => [...b[0]].length - [...a[0]].length),
    runes,
  };
  cache.set(id, compiled);
  return compiled;
}

/** Runes (with their reading) available when writing in a set, in lexicon order. */
export function runesOf(id: string): Rune[] {
  return [...compile(id).runes.values()];
}

export interface ToRunesOptions {
  set?: RuneSetId;
  /** Placed between words. Default ᛫ (RUNIC SINGLE PUNCTUATION). */
  separator?: RuneSeparator;
}

/**
 * Latin text -> runes. Modern convention, not a scholarly standard.
 * NFC + lower-case, greedy longest match; accented letters without a rule fall back to their
 * base letter; digits and punctuation pass through; runes already in the input are kept.
 */
export function toRunes(text: string, opts: ToRunesOptions = {}): string {
  const { rules } = compile(opts.set ?? DEFAULT_RUNE_SET);
  const separator = opts.separator ?? "᛫";
  const words = text.normalize("NFC").toLowerCase().trim().split(/\s+/u).filter(Boolean);
  return words.map((w) => runifyWord(w, rules)).join(separator);
}

function runifyWord(word: string, rules: [string, string][]): string {
  let out = "";
  let i = 0;
  outer: while (i < word.length) {
    for (const [latin, runes] of rules) {
      if (word.startsWith(latin, i)) {
        out += runes;
        i += latin.length;
        continue outer;
      }
    }
    const ch = String.fromCodePoint(word.codePointAt(i) as number);
    const base = ch.normalize("NFD").replace(/\p{M}+/gu, "");
    const fallback = base !== ch ? rules.find(([latin]) => latin === base) : undefined;
    out += fallback ? fallback[1] : ch;
    i += ch.length;
  }
  return out;
}

export interface ToLatinOptions {
  set?: RuneSetId;
}

/** Runes -> Latin reading. Best effort: many runes stand for several sounds. */
export function toLatin(runes: string, opts: ToLatinOptions = {}): string {
  const set = compile(opts.set ?? DEFAULT_RUNE_SET);
  let out = "";
  for (const ch of runes.normalize("NFC")) {
    if (SEPARATOR_GLYPHS.has(ch)) out += " ";
    else out += (set.runes.get(ch) ?? anyRune(ch))?.translit ?? ch;
  }
  return out.replace(/ {2,}/g, " ");
}

function anyRune(glyph: string): Rune | undefined {
  // oldest layer wins when a glyph isn't part of the chosen set
  return [...lexicon.runes]
    .sort((a, b) => getRuneSet(a.set).layer - getRuneSet(b.set).layer)
    .find((r) => r.glyph === glyph);
}

export interface RuneInfo {
  glyph: string;
  rune?: Rune;
  separator: boolean;
}

/** Per-character breakdown for tooltips, screen readers and the rune keyboard. */
export function describeRunes(text: string, opts: ToLatinOptions = {}): RuneInfo[] {
  const set = compile(opts.set ?? DEFAULT_RUNE_SET);
  return [...text].map((glyph) => {
    const rune = set.runes.get(glyph) ?? anyRune(glyph);
    return { glyph, separator: SEPARATOR_GLYPHS.has(glyph), ...(rune ? { rune } : {}) };
  });
}

const RUNIC = /[ᚠ-ᛸ]/u;

export function isRunic(text: string): boolean {
  return RUNIC.test(text);
}

const outlines = new Map(glyphOutlines.glyphs.map((g) => [g.glyph, g]));

/** Font-independent SVG outline for a rune or runic separator. */
export function glyphOutline(glyph: string): GlyphOutline | undefined {
  return outlines.get(glyph);
}

export const OUTLINE_METRICS = glyphOutlines.meta;
