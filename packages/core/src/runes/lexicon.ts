import { decode } from "@toon-format/toon";
import { glyphsToon, lexiconToon } from "./data.generated.ts";

export interface RuneSet {
  id: string;
  name: string;
  layer: number;
  parent: string;
  rulesFrom: string;
  from: number | "";
  to: number | "";
  historical: boolean;
  note: string;
  source: string;
}

export interface Rune {
  set: string;
  order: number;
  group: string;
  cp: string;
  glyph: string;
  uname: string;
  name: string;
  translit: string;
  ipa: string;
  reversible: boolean;
  note: string;
}

export interface LatinRule {
  set: string;
  latin: string;
  runes: string;
  convention: boolean;
}

export interface Separator {
  cp: string;
  glyph: string;
  uname: string;
  label: string;
}

export interface Lexicon {
  meta: { name: string; version: string; unicode: string; license: string; wordSeparator: string };
  sets: RuneSet[];
  runes: Rune[];
  separators: Separator[];
  latin: LatinRule[];
}

export interface GlyphOutline {
  cp: string;
  glyph: string;
  advance: number;
  d: string;
}

export interface GlyphOutlines {
  meta: { unitsPerEm: number; ascender: number; descender: number; license: string; source: string };
  glyphs: GlyphOutline[];
}

export const lexicon = decode(lexiconToon, { strict: true }) as unknown as Lexicon;
export const glyphOutlines = decode(glyphsToon, { strict: true }) as unknown as GlyphOutlines;

export type RuneSetId =
  | "elder"
  | "futhorc"
  | "younger-long"
  | "younger-short"
  | "medieval"
  | "franks-casket"
  | "golden-numbers"
  | "tolkien";

export const DEFAULT_RUNE_SET: RuneSetId = "elder";
