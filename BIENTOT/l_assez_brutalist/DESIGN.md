# Design System Document: The Editorial Terminal

## 1. Overview & Creative North Star

### Creative North Star: "The Radical Dispatch"
This design system rejects the "SaaS-standard" of soft rounded corners and polite pastels. Instead, it draws inspiration from the raw urgency of a newsroom terminal mixed with the sophisticated structural integrity of a high-end broadsheet. It is a system built for speed, authority, and uncompromising clarity.

The experience is defined by **Aggressive Intentionality**. We do not use "defaults." Every line is a thick statement; every shadow is a hard architectural offset. By combining the classic elegance of `Playfair Display` with the monospaced industrialism of `Space Grotesk`, we create a "Digital Curator" persona—someone who is both an expert analyst and a bold publisher.

---

## 2. Colors

The palette is rooted in a high-contrast triad designed to command attention and maintain a strict hierarchy of information.

### Palette Roles
*   **Primary (#BC0100):** The "Urgency Red." Reserved for critical actions, active states, and breaking news alerts.
*   **On-Background (#1A1C1C):** The "Ink Black." Used for all structural borders (4px), hard shadows, and primary UI typography.
*   **Surface (#F9F9F9):** The "Paper White." A slightly warm, premium off-white that reduces eye strain while maintaining maximum contrast against the Ink Black.

### The "No-Line" Rule & Boundary Logic
Despite the Brutalist style, we do not section off the entire page with lines. 
*   **Structural Division:** Major content blocks are separated by `surface-container` shifts (e.g., a `surface-container-low` section sitting on a `surface` background).
*   **The 4px Rule:** Borders are only used for **interactive elements** or **primary containers** (Cards, Buttons, Inputs). Do not use 1px or 2px lines for "decoration" or "softness."

### Signature Textures
To elevate the Brutalist aesthetic into a premium space, use a subtle **Paper Grain** overlay on `surface` containers. For primary CTAs, use a 5% linear gradient transitioning from `primary` (#BC0100) to `on-primary-fixed-variant` (#930100) to give the red a "printed ink" depth rather than a flat digital glow.

---

## 3. Typography

The typography is a dialogue between the tradition of print journalism and the efficiency of a terminal.

*   **Display & Headlines (Playfair Display Bold):** Used for large-scale data points and section headers. This introduces the "Editorial" soul. It should feel authoritative and expensive.
*   **UI & Data (Space Grotesk):** A tall, geometric sans-serif that mimics the feel of a code editor. Used for labels, buttons, and system logs. It ensures legibility in high-density backend environments.

| Level | Token | Font | Size | Weight |
| :--- | :--- | :--- | :--- | :--- |
| Display LG | `display-lg` | Newsreader (Playfair) | 3.5rem | Bold |
| Headline MD | `headline-md` | Newsreader (Playfair) | 1.75rem | Bold |
| Title MD | `title-md` | Space Grotesk | 1.125rem | Medium |
| Body LG | `body-lg` | Space Grotesk | 1.0rem | Regular |
| Label SM | `label-sm` | Space Grotesk | 0.6875rem| Bold (Caps) |

---

## 4. Elevation & Depth

This system ignores the laws of natural light. Depth is not "soft"; it is **structural.**

### Hard Offset Shadows
Abandon Gaussian blurs. Elevation is achieved through a **Hard 4px or 8px Offset**.
*   **Level 1 (Default):** 4px offset X, 4px offset Y. Color: `#1A1C1C` (100% opacity).
*   **Level 2 (Hover/Active):** 8px offset X, 8px offset Y. This creates a "popping" effect that signals clear interactivity.

### Tonal Layering (Nesting)
Instead of drop shadows for every element, use surface nesting:
*   **Background:** `surface` (#F9F9F9)
*   **Nested Section:** `surface-container-low` (#F4F3F3)
*   **Active Item:** `surface-container-lowest` (#FFFFFF) with a 4px `on-background` border.

### The "Terminal Glass" Fallback
In high-density data areas (like log consoles), use a `surface-container` with 80% opacity and a `20px` backdrop blur. This allows the brutalist background to peak through, softening the interface just enough to keep it feeling "modern."

---

## 5. Components

### Buttons
*   **Style:** 0px border radius. 4px solid `#1A1C1C` border.
*   **Primary:** Background `#BC0100`, Text `#FFFFFF`. 4px Hard Shadow.
*   **Secondary:** Background `#F9F9F9`, Text `#1A1C1C`. 4px Hard Shadow.
*   **State:** On hover, the button shifts -2px, -2px while the shadow expands to 6px, creating a "pressable" tactile feel.

### Input Fields
*   **Structure:** Rectangular, 4px border. No rounded corners.
*   **Focus:** Border changes to `primary` (#BC0100). Label remains `label-sm` in all-caps, positioned strictly above the field.
*   **Validation:** Errors use a secondary "Ghost Border" of `error` at 20% opacity combined with the standard 4px black border.

### Status Indicators (Active/Idle)
*   **Active:** A vibrant `#BC0100` pulse or solid block.
*   **Idle:** A `secondary` (#5D5F5E) hollow 4px square.
*   **Pattern:** Use a terminal-inspired `[ STATUS ]` text block alongside the indicator for maximum clarity.

### Cards & Lists
*   **Constraint:** Forbid 1px dividers. 
*   **Alternative:** Use `surface-container-highest` background shifts or 24px-32px of vertical white space.
*   **Large Clickable Areas:** Every list item should have a minimum height of 64px to satisfy the "Large Clickable Area" requirement, ensuring accessibility in high-pressure backend environments.

---

## 6. Do's and Don'ts

### Do
*   **DO** use strict 0px border radii everywhere.
*   **DO** use Playfair Display for numbers (e.g., "31 RESULTS") to give data an editorial flair.
*   **DO** treat the UI as a physical stack of paper and metal.
*   **DO** utilize all-caps for `label-sm` to maintain the "Terminal" feel.

### Don't
*   **DON'T** use 1px borders. If it’s not 4px, it shouldn't be a border.
*   **DON'T** use "Soft Blue" for links. Use `primary` red or underlined `on-surface` black.
*   **DON'T** use Gaussian/Soft drop shadows. If the shadow isn't a hard-edged block, it doesn't belong in this system.
*   **DON'T** allow components to float without a clear anchor (either a background shift or a hard shadow).

---

## Director's Closing Note
This system is about **Authority.** Every pixel should feel like it was placed with a heavy hand. We are not building a generic dashboard; we are building a command center for truth. Keep the contrast high, the borders thick, and the typography bold.