/**
 * Stand-in for `next/font/google`. The font files and their CSS are the old
 * site's own (src/styles/fonts.css, copied from the Next build). This only
 * returns the same class names that file defines: `<font>__variable` sets the
 * CSS variable, `<font>__className` the font family.
 */
type FontOptions = { variable?: string; subsets?: string[]; weight?: string | string[]; display?: string };
type Font = { className: string; variable: string; style: { fontFamily: string } };

function font(name: string, family: string) {
  return (_options: FontOptions = {}): Font => ({
    className: `${name}__className`,
    variable: `${name}__variable`,
    style: { fontFamily: `'${family}', '${family} Fallback'` },
  });
}

export const Inter = font("inter", "Inter");
export const Sora = font("sora", "Sora");
export const JetBrains_Mono = font("jetbrains_mono", "JetBrains Mono");
export const Geist = font("geist", "Geist");
export const Geist_Mono = font("geist_mono", "Geist Mono");
export const Poppins = font("poppins", "Poppins");
export const Space_Grotesk = font("space_grotesk", "Space Grotesk");
export const Manrope = font("manrope", "Manrope");
export const Plus_Jakarta_Sans = font("plus_jakarta_sans", "Plus Jakarta Sans");
export const DM_Sans = font("dm_sans", "DM Sans");
export const Outfit = font("outfit", "Outfit");
export const Montserrat = font("montserrat", "Montserrat");
export const Figtree = font("figtree", "Figtree");
export const Instrument_Serif = font("instrument_serif", "Instrument Serif");
export const Playfair_Display = font("playfair_display", "Playfair Display");
export const Fraunces = font("fraunces", "Fraunces");
export const Bricolage_Grotesque = font("bricolage_grotesque", "Bricolage Grotesque");
