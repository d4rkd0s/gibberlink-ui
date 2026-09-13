# Runic research (2026-09-13)

This is the source record for `packages/core/data/runic-lexicon.toon`. The lexicon's code points and
Unicode names are not taken from this document. They come from Unicode 17.0 `UnicodeData.txt`
(`packages/core/data/unicode-runic.txt`) and are checked in CI.

## 1. Chronology and what "oldest first" means

| System | Dates | Status | Evidence |
|---|---|---|---|
| (Meldorf fibula) | 1st half of 1st c. CE | Disputed | The signs may be runic, proto-runic or Latin. [WP](https://en.wikipedia.org/wiki/Meldorf_fibula), [L2/24-129](https://www.unicode.org/L2/L2024/24129-runology.pdf) |
| **Elder Futhark** | c. 150/160 to c. 800 | Historical, **layer 0** | Vimose comb *harja* c. 160, the earliest inscription that is securely runic ([Vimose](https://en.wikipedia.org/wiki/Vimose_inscriptions)). Øvre Stabu *raunijaz* c. 180. Svingerud stone, 1 to 250 CE, is the oldest dated runestone ([KHM Oslo](https://www.khm.uio.no/english/news/found-the-world-s-oldest-rune-stone.html)). The Kylver stone (c. 400) has the first complete row. |
| Gothic runic evidence | 3rd to 4th c. | Historical, tiny corpus | It uses Elder Futhark letters, so it is not a separate system ([WP](https://en.wikipedia.org/wiki/Gothic_runic_inscriptions)) |
| Anglo-Frisian Futhorc | 5th to 11th c. | Historical, layer 1 | 28 to 33 runes, plus the Northumbrian additions ([WP](https://en.wikipedia.org/wiki/Anglo-Saxon_runes)) |
| Franks Casket cryptic forms | early 8th c. | Historical, one object | U+16F4 to U+16F8 ([WP](https://en.wikipedia.org/wiki/Franks_Casket)) |
| Marcomannic runes | late 8th to 9th c. | Manuscript-only | No distinct code points ([Cod. Vind. 795](https://en.wikipedia.org/wiki/Codex_Vindobonensis_795)) |
| Younger Futhark, long-branch and short-twig | c. 800 to 1100 | Historical, layers 1 and 2 | 24 runes were reduced to 16 by the late 8th c. ([WP](https://en.wikipedia.org/wiki/Younger_Futhark)) |
| Staveless (Hälsinge) | 10th to 12th c. | Historical | Allographs of short-twig runes. A proposal to encode them separately was rejected (L2/24-129). |
| Medieval dotted runes | c. 1100 to 15th c. | Historical, layer 2 | [WP](https://en.wikipedia.org/wiki/Medieval_runes) |
| Dalecarlian runes | 16th to 20th c. | Historical, **not in Unicode** | [WP](https://en.wikipedia.org/wiki/Dalecarlian_runes) |
| Tolkienian runes / Cirth | 20th c. | Modern, fictional | Only three letters are in Unicode (U+16F1 to U+16F3). Cirth exists only in the ConScript Private Use Area (U+E080 to U+E0FF). |

## 2. Unicode Runic block (U+16A0 to U+16FF)

- There are 89 characters. 81 arrived in Unicode 3.0 and 8 in 7.0 ([Everson & West, L2/11-096R](https://www.unicode.org/L2/L2011/11096r-n4013r-runic-additions.pdf)). U+16F9 to U+16FF are unused.
- Punctuation: U+16EB ᛫ SINGLE, U+16EC ᛬ MULTIPLE, U+16ED ᛭ CROSS. These are Script=Common.
- Golden numbers: U+16EE ᛮ ARLAUG (17), U+16EF ᛯ TVIMADUR (18), U+16F0 ᛰ BELGTHOR (19).
- All runes have bidi class L, so the app sets `dir="ltr"` on rune output.
- Unicode unifies runes by shape, not by sound, and it encodes long-branch and short-twig forms separately ([core spec ch. 8](https://www.unicode.org/versions/Unicode17.0.0/core-spec/chapter-8/)).
- **Not encoded:** Dalecarlian runes, staveless runes, Greenlandic r, maskros m, bind-runes, and mirrored or inverted forms. Runologists call the block inconsistent. The Runicode project proposes variation selectors and OpenType stylistic sets rather than new code points ([L2/24-129](https://www.unicode.org/L2/L2024/24129-runology.pdf)).
- **The Private Use Area is avoided.** Code points there collide with other PUA agreements (MUFI, Menota) and fonts don't render them by default. Search and screen readers also treat them as opaque.

## 3. Word separators

Historical practice varied: no divider, one dot, two or more dots, crosses, or strokes. Most Elder Futhark inscriptions use **no** dividers ([WP](https://en.wikipedia.org/wiki/Runic_inscriptions)). ᛫ is defensible and common in modern runic typesetting.

Decision: rune text uses ᛫ by default. ᛬, ᛭, a space and "none" are also selectable, with "none" labelled as the authentic Elder Futhark choice. Latin text keeps normal spaces.

## 4. Fonts and never missing a glyph

| Font | Runic coverage | License |
|---|---|---|
| **Noto Sans Runic** v2.002 | Full block, including U+16F8 (all 89 extracted here) | OFL 1.1 |
| BabelStone Runic | Everything in Unicode 7.0 | OFL 1.1 |
| Segoe UI Historic | Runic (Windows only) | Proprietary |
| GNU FreeFont | 3.0 block | GPL with font exception |

Which operating systems ship a runic font:

| OS | Runic font |
|---|---|
| Windows | Segoe UI Historic |
| Android | Noto Sans Runic |
| **macOS / iOS** | **None** ([Apple font list](https://support.apple.com/en-us/122869)) |
| Linux | Depends on the distro |

**Strategy used:**
1. **DOM text:** a bundled WOFF2 subset of Noto Sans Runic (U+0020, U+16A0 to U+16F8; 3.2 KB), loaded with `unicode-range` and `font-display: block`, with `OFL.txt` shipped beside it.
2. **Canvas (flock) and export:** `runic-glyphs.toon`, SVG outlines for all 89 glyphs extracted from the same pinned, hash-checked font file. Drawing through `Path2D` never touches fonts, so no device can show a missing box.
3. Both are regenerated by `packages/core/scripts/build-glyphs.mjs`. Derived outlines remain OFL-1.1.

## 5. TOON

- Spec v4.1 (Working Draft, 2026-07-26), [toon-format/spec](https://github.com/toon-format/spec/blob/main/SPEC.md). The npm package is `@toon-format/toon` 4.1.1 (MIT); pin it.
- Tables use the `|` delimiter because IPA and notes contain commas.
- Code points are written as `U+16E0`, because a bare `16E0` parses as the number 16×10^0.
- Quoting (§7.2) is required for:
  - text that looks numeric (golden-number transliterations `"17"`)
  - values containing `:` (URLs, notes)
  - empty values (`""`)
- The lexicon test decodes the file in strict mode and round-trips it through the reference encoder.

## 6. Transliteration

- **No scholarly standard exists for Latin to runes.** Runology transliterates runes to Latin (the Rundata and Nytt om runer conventions), so this app's Latin-to-runes rules are a modern convention. Rules that fill a gap (for example Elder c, q, v, x, y) carry `convention=true`.
- Digraphs are matched greedily, longest first:
  - th → ᚦ and ng → ᛜ (Elder)
  - ea → ᛠ, io/ia → ᛡ, eo → ᛇ (Futhorc)
  - ei → ᛇ is **not** used, because the sound value of ᛇ is disputed.
- Digits are never converted. Runes had no digit system.
- Input is normalised to NFC and lower-cased. Accented letters fall back to their base letter only when no rule exists.
- The Elder Futhark ᛞ/ᛟ order varies (Kylver puts ᛟ first). The lexicon uses the modern standard order and says so in a note.
- Adjacent readings can merge (ᛏ + ᚺ reads "th", which is written ᚦ). Each rune is stable on its own, and one round trip reaches a fixed point.

## 7. Risks being tracked

- TOON is still a Working Draft, so the package version is pinned.
- Sound values are disputed for ᛇ and ᛉ. Notes in the lexicon say so.
- OFL obligations apply to the font and the derived outlines.
- Line breaking around ᛫ in browsers needs a check in M2.
- Runes are 3 bytes each over ggwave, so at most 46 fit in one message.
- Confusable separators (· ⁚ ×) must never replace ᛫ ᛬ ᛭.
