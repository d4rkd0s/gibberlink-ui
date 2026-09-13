import { readFileSync } from "node:fs";
import { decode, encode } from "@toon-format/toon";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain JS build script
import { render } from "../scripts/embed-data.mjs";
import {
  createDecoder,
  describeRunes,
  encode as encodeAudio,
  glyphOutline,
  isRunic,
  lexicon,
  MAX_PAYLOAD_BYTES,
  payloadBytes,
  RUNE_SEPARATORS,
  type RuneSetId,
  ruleChain,
  runesOf,
  toLatin,
  toPayload,
  toRunes,
} from "../src/index.ts";

const dataDir = new URL("../data/", import.meta.url);
const ucd = new Map(
  readFileSync(new URL("unicode-runic.txt", dataDir), "utf8")
    .trim()
    .split("\n")
    .map((l) => l.split(";"))
    .map(([cp, name]) => [`U+${cp}`, name as string]),
);
const SETS = lexicon.sets.map((s) => s.id as RuneSetId);

describe("lexicon data integrity", () => {
  it("embedded module is in sync with data/*.toon", () => {
    expect(readFileSync(new URL("../src/runes/data.generated.ts", import.meta.url), "utf8")).toBe(render());
  });

  it("is valid strict TOON that round-trips through the reference encoder", () => {
    const text = readFileSync(new URL("runic-lexicon.toon", dataDir), "utf8");
    const data = decode(text, { strict: true });
    expect(decode(encode(data, { delimiter: "|" }), { strict: true })).toEqual(data);
  });

  it("every rune's glyph and Unicode name match Unicode 17.0", () => {
    for (const r of lexicon.runes) {
      expect(r.glyph, `${r.set} ${r.cp}`).toBe(String.fromCodePoint(Number.parseInt(r.cp.slice(2), 16)));
      expect(r.uname, `${r.set} ${r.cp}`).toBe(ucd.get(r.cp));
    }
    for (const s of lexicon.separators) {
      expect(s.glyph).toBe(String.fromCodePoint(Number.parseInt(s.cp.slice(2), 16)));
      expect(s.uname).toBe(ucd.get(s.cp));
    }
  });

  it("covers every encoded rune in the Unicode Runic block", () => {
    const covered = new Set([...lexicon.runes.map((r) => r.cp), ...lexicon.separators.map((s) => s.cp)]);
    const missing = [...ucd.keys()].filter((cp) => !covered.has(cp));
    expect(missing).toEqual([]);
  });

  it("sets form a layered tree rooted at the oldest system", () => {
    const roots = lexicon.sets.filter((s) => s.parent === "");
    expect(roots.map((s) => s.id)).toEqual(["elder"]);
    for (const s of lexicon.sets) {
      if (s.parent) expect(lexicon.sets.find((p) => p.id === s.parent)!.layer).toBeLessThan(s.layer);
      expect(() => ruleChain(s.id)).not.toThrow();
    }
  });

  it("no duplicate rows, orders or rules within a set", () => {
    for (const id of SETS) {
      const rows = lexicon.runes.filter((r) => r.set === id);
      expect(new Set(rows.map((r) => r.glyph)).size, id).toBe(rows.length);
      expect(new Set(rows.map((r) => r.order)).size, id).toBe(rows.length);
      const rules = lexicon.latin.filter((r) => r.set === id);
      expect(new Set(rules.map((r) => r.latin)).size, id).toBe(rules.length);
    }
  });

  it("rules only emit runes that exist in that set (no leaks between layers)", () => {
    for (const id of SETS) {
      const allowed = new Set(runesOf(id).map((r) => r.glyph));
      for (const rule of lexicon.latin.filter((r) => ruleChain(id).some((s) => s.id === r.set))) {
        for (const g of rule.runes) expect(allowed.has(g), `${id}: ${rule.latin} -> ${g}`).toBe(true);
      }
    }
  });

  it("the `reversible` flag tells the truth for every rune", () => {
    for (const r of lexicon.runes) {
      const set = r.set as RuneSetId;
      const back = toRunes(toLatin(r.glyph, { set }), { set });
      expect(back === r.glyph, `${r.set} ${r.glyph} (${r.translit}) -> ${back}`).toBe(r.reversible);
    }
  });

  it("every rune and separator has a font-independent outline", () => {
    for (const g of [...lexicon.runes, ...lexicon.separators]) {
      const o = glyphOutline(g.glyph);
      expect(o, g.cp).toBeDefined();
      expect(o!.d).toMatch(/^M/);
      expect(o!.advance).toBeGreaterThan(0);
    }
  });
});

describe("toRunes", () => {
  it("Elder Futhark by default, with digraphs", () => {
    expect(toRunes("thing")).toBe("ᚦᛁᛜ");
    expect(toRunes("Odin")).toBe("ᛟᛞᛁᚾ");
  });

  it("joins words with ᛫ and never leaves spaces in rune text", () => {
    expect(toRunes("hello  world")).toBe("ᚺᛖᛚᛚᛟ᛫ᚹᛟᚱᛚᛞ");
    expect(toRunes("  a b ")).toBe("ᚨ᛫ᛒ");
  });

  it("supports every separator option", () => {
    expect(RUNE_SEPARATORS.map((separator) => toRunes("a b", { separator }))).toEqual([
      "ᚨ᛫ᛒ",
      "ᚨ᛬ᛒ",
      "ᚨ᛭ᛒ",
      "ᚨ ᛒ",
      "ᚨᛒ",
    ]);
  });

  it("passes digits and punctuation through; keeps existing runes", () => {
    expect(toRunes("a1!")).toBe("ᚨ1!");
    expect(toRunes("ᚠa")).toBe("ᚠᚨ");
  });

  it("folds accents only when no rule exists", () => {
    expect(toRunes("é")).toBe("ᛖ");
    expect(toRunes("þ")).toBe("ᚦ");
    expect(toRunes("ö", { set: "medieval" })).toBe("ᚮ");
    expect(toRunes("ø", { set: "medieval" })).toBe("ᚯ");
  });

  it("layers override their base", () => {
    expect(toRunes("sea king", { set: "futhorc" })).toBe("ᛋᛠ᛫ᛣᛁᛝ");
    expect(toRunes("hat", { set: "younger-long" })).toBe("ᚼᛅᛏ");
    expect(toRunes("hat", { set: "younger-short" })).toBe("ᚽᛆᛐ");
    expect(toRunes("oak", { set: "franks-casket" })).toBe("ᛴᛷᛣ");
    expect(toRunes("shook", { set: "tolkien" })).toBe("ᛲᛳᛱ");
  });

  it("Younger Futhark never uses Elder-only runes", () => {
    const elderOnly = ["ᚨ", "ᚲ", "ᚷ", "ᚹ", "ᚺ", "ᛃ", "ᛇ", "ᛈ", "ᛉ", "ᛊ", "ᛖ", "ᛗ", "ᛜ", "ᛞ", "ᛟ"];
    const out = toRunes("the quick brown fox jumps over the lazy dog ïøæ", { set: "younger-long" });
    for (const g of elderOnly) expect(out).not.toContain(g);
  });
});

describe("toLatin", () => {
  it("reads runes and turns separators into spaces", () => {
    expect(toLatin("ᚦᛁᛜ᛫ᛟᛞᛁᚾ")).toBe("þiŋ odin");
    expect(toLatin("ᛋᛠ", { set: "futhorc" })).toBe("sea");
  });

  it("reads runes from other sets by their oldest meaning", () => {
    expect(toLatin("ᛅ")).toBe("a");
  });

  it("leaves non-runes alone", () => {
    expect(toLatin("ᚠ 1 x")).toBe("f 1 x");
  });
});

describe("stability: runes -> latin -> runes", () => {
  for (const id of SETS) {
    it(id, () => {
      // runes that round-trip in this set (own flagged rows + inherited rows not overridden)
      const pool = runesOf(id)
        .map((r) => r.glyph)
        .filter((g) => toRunes(toLatin(g, { set: id }), { set: id }) === g);
      expect(pool.length, id).toBeGreaterThan(3);
      let seed = 99;
      const rand = (n: number) => {
        seed = (seed * 48271) % 2147483647;
        return seed % n;
      };
      for (let k = 0; k < 500; k++) {
        const words = Array.from({ length: 1 + rand(4) }, () =>
          Array.from({ length: 1 + rand(6) }, () => pool[rand(pool.length)]).join(""),
        );
        const runes = words.join("᛫");
        const latin = toLatin(runes, { set: id });
        const back = toRunes(latin, { set: id });
        // Adjacent readings can form a digraph (ᛏ+ᚺ reads "th", which is written ᚦ), so a
        // sequence may re-segment once into its canonical spelling. Guarantees: every rune is
        // stable alone (pool filter above), one pass reaches a fixed point, words never merge.
        expect(toRunes(toLatin(back, { set: id }), { set: id })).toBe(back);
        expect(back.split("᛫")).toHaveLength(words.length);
      }
    });
  }
});

describe("describe / detect / budget", () => {
  it("describes each glyph with its lexicon row", () => {
    const [f, sep, x] = describeRunes("ᚠ᛫x");
    expect(f?.rune?.name).toBe("*fehu");
    expect(sep?.separator).toBe(true);
    expect(x?.rune).toBeUndefined();
  });

  it("detects runic payloads", () => {
    expect(isRunic("hello")).toBe(false);
    expect(isRunic("hi ᚠ")).toBe(true);
  });

  it("46 runes fit a GibberLink payload, 47 do not", () => {
    expect(payloadBytes("ᚠ".repeat(46))).toBeLessThanOrEqual(MAX_PAYLOAD_BYTES);
    expect(payloadBytes("ᚠ".repeat(47))).toBeGreaterThan(MAX_PAYLOAD_BYTES);
  });

  it("runes survive the audio channel and read back", async () => {
    const runes = toRunes("odin");
    const wave = await encodeAudio(toPayload(runes), { protocol: "audible-fast" });
    const d = await createDecoder();
    const [msg] = [...d.push(wave.samples), ...d.push(new Float32Array(48000))];
    d.dispose();
    const text = new TextDecoder().decode(msg);
    expect(text).toBe("ᛟᛞᛁᚾ");
    expect(isRunic(text)).toBe(true);
    expect(toLatin(text)).toBe("odin");
  });
});
