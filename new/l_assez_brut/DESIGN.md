```markdown
# Design System Strategy: The Bold Radical

## 1. Overview & Creative North Star
**Creative North Star: "The Editorial Protest"**
This design system moves beyond the standard "digital-first" aesthetic to embrace the raw, high-impact legacy of French radical journalism and independent broadsheets. It is "Refined Brutalism"—where the aggression of thick strokes and high contrast meets the sophisticated restraint of Parisian editorial design.

We break the "template" look by treating every screen like a physical poster. Through intentional asymmetry, massive typography scales, and a rejection of subtle "tech" aesthetics (like soft shadows or gradients), we create a visual voice that demands attention in a crowded social feed. This is not a UI to be scrolled; it is a manifest to be read.

---

## 2. Colors & Tonal Authority
The palette is a violent, high-contrast triad designed for maximum legibility and emotional impact.

*   **Primary (#BC0100):** Our "Pure Red." Use this for urgent news, critical CTAs, and brand anchors. It represents the pulse of the media.
*   **Surface & Background (#F9F9F9 / #FFFFFF):** The "Paper." We avoid clinical grays in favor of a stark, newsprint-white.
*   **On-Surface (#1A1C1C):** Our "Ink." A deep, near-black that provides the necessary weight for brutalist elements.

### The Rules of Boundary
*   **The "Heavy-Stroke" Rule:** Unlike standard UI, we explicitly utilize the `outline` token (#956D67) at 100% opacity for structural containment. Boxes do not float; they are anchored by 2px to 4px solid black borders.
*   **Surface Hierarchy:** We use `surface-container` tiers to create "ink-on-paper" depth. 
    *   `surface-container-lowest` (#FFFFFF) for primary content cards.
    *   `surface` (#F9F9F9) for the global canvas.
    *   `primary-container` (#EB0000) for high-impact breaking news blocks.
*   **The Anti-Glass Rule:** We reject glassmorphism and blurs. This system is about permanence and physical ink. Surfaces are opaque and unapologetic.

---

## 3. Typography: The Voice of 'L'Assez'
Typography is our primary design element. The tension between the serif and the sans-serif creates the "French Independent" feel.

*   **Display & Headlines (Newsreader/Playfair Display):** These must be used at a massive scale. `display-lg` (3.5rem) is the default for Instagram story covers. The tight tracking and bold weight mimic traditional printing presses.
*   **Body (Inter/Grotesque Sans):** For long-form reporting. We use `body-lg` (1rem) with generous line-height to ensure readability on mobile devices under harsh lighting.
*   **Labels (Space Grotesk):** Used for metadata, timestamps, and categories. The monospaced-adjacent feel of Space Grotesk adds a "documentary" or "archival" layer to the journalism.

---

## 4. Elevation & Structural Impact
We do not use light to create depth; we use geometry and ink.

*   **The Stacking Principle:** Depth is achieved through "Offset Hard Shadows." Instead of a soft blur, a card is elevated by placing a solid black rectangle (`on-surface`) 4px to 8px behind the primary container, shifted to the bottom-right.
*   **Intentional Asymmetry:** Avoid centering everything. Align headlines to the hard left edge. Use the `spacing-8` (1.75rem) or `spacing-10` (2.25rem) to create "gutters" that feel like a newspaper column.
*   **The "Ghost Border" Prohibition:** We never use low-opacity borders. If a boundary exists, it must be visible and authoritative. Use the `outline` token at full strength.

---

## 5. Components & Primitive Styling

### Buttons
*   **Primary:** `primary` background, `on-primary` text. 0px border-radius. 2px `on-surface` solid border.
*   **States:** On hover/active, shift the button position by 2px to "press" onto the offset shadow.

### Cards & Social Tiles
*   **The News Card:** Use `surface-container-lowest`. No dividers. Use a heavy 3px bottom border (`outline`) to separate the headline from the metadata. 
*   **The "Story" Canvas:** High-contrast `primary` background with `on-primary` text for "Breaking" alerts.

### Inputs & Fields
*   **Text Inputs:** Stark white background, 2px black border. Label in `label-md` (Space Grotesk) placed *above* the border, never floating inside.
*   **Error State:** Use `error` (#BA1A1A) not just for text, but as a thick 4px border surrounding the field.

### Editorial Add-ons
*   **The "Stamp" Chip:** A high-contrast tag using `on-secondary-fixed` for categories (e.g., *POLITIQUE*, *CULTURE*). Always uppercase.
*   **The Pull-Quote:** `headline-lg` text nested within a container that has a 12px left-border of `primary` red.

---

## 6. Do’s and Don’ts

### Do
*   **Do** embrace "White Space" as "Active Space." A large empty area focuses the eye on a single, massive headline.
*   **Do** use 0px border radius for everything. Sharp corners imply precision and urgency.
*   **Do** overlap elements. A photo can break the border of its container to create a collage-like, zine aesthetic.

### Don't
*   **Don't** use shadows with a blur radius higher than 0px. If it’s not a hard edge, it doesn't belong here.
*   **Don't** use "Soft Red" or pinks. Stick to the aggressive `primary` (#BC0100) to maintain brand authority.
*   **Don't** use icons where words can work. This is a media brand; let the typography do the heavy lifting.
*   **Don't** center-align body text. Keep it flush-left (ragged right) to maintain the editorial grid.

---

## 7. Spacing Scale
Our spacing is rigid and rhythmic.
*   **Micro (2-4):** Use for internal padding of buttons and chips.
*   **Macro (12-24):** Use for margins between articles and sections.
*   **The "Social Safe" Margin:** Always maintain at least `spacing-8` (1.75rem) from the edge of mobile screens to ensure UI elements don't get cut off by Instagram's native overlays.```