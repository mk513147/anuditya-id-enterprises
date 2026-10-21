# Brand logo assets

Vectorised from the official "Anuditya ID Solutions – Complete solution in one roof" logo supplied by the business
(a 1600 × 368 raster). These are the only logo files; render them through `src/components/shared/Logo.tsx`.

| File | Use | viewBox |
| --- | --- | --- |
| `anuditya-id-solutions-logo.svg` | Master: symbol, "nuditya", "ID Solutions" and the tagline | `0 0 1600 368` (1 unit = 1 source pixel) |
| `anuditya-id-solutions-compact.svg` | Same artwork without the tagline (headers, menus, sidebars) | `0 0 1532 318` |
| `anuditya-symbol.svg` | The red "A" alone, centred in a square (icon contexts) | `-6.4 -0.8 320 320` |

`public/favicon.svg` is a copy of the symbol; `public/favicon-32x32.png`, `public/apple-touch-icon.png` and
`public/icons/*.png` are rendered from it (white background where the platform needs an opaque icon).

- Colours: red `#EC3237`, charcoal `#363435` (medians of the interior of each colour region in the supplied artwork).
  Never recolour the logo (no CSS filters); on dark surfaces use `<Logo plate />`, which puts it on white.
- Method: per-colour masks → 4× upscale → Potrace (Bézier paths). The lettering is traced from the artwork itself, not
  set in a font. Measured against the source: 98.4 % (red) and 99.4 % (charcoal) pixel agreement at 1:1.
- The files contain only `<title>` and two filled `<path>` elements: no raster, fonts, scripts, styles or external references.
- The supplied artwork is tightly cropped: the tagline's last letter touches the right edge and the "A" apex the top edge.
  The vectors follow it as supplied.
